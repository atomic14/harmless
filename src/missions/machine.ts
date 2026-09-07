// The mission machine: one pure step that reads an event and returns the new
// progress, and the consequences the game must apply.
//
//   stepMissions(state, input, ctx) → { state, effects }
//
// PURE. It never touches the commander, the purse or the world. The caller
// installs the state, applies each effect, and then saves. So a test drives
// the whole Constrictor mission with no game world, and a reload cannot pay
// twice (docs/TODO/190).
//
// The offers and the hints are their own files (offers.ts, hints.ts). This
// file asks them on `accept` and on `docked`, and applies what they answer.
//
// A VERB MODULE decides what an input means for one leg and names a trigger.
// `triggers.ts` says what a trigger is called and which one means success.
// This file finds the branch that trigger selects, places the next leg, and
// settles the branch. A settlement is paid ONCE, at the moment its branch is
// taken. A second input for the same kill finds the mission on the next leg,
// whose verb ignores it. That is the whole of the duplicate-payment rule.
//
// The random generator is an argument, so a test can count its draws. A
// placement in a band makes one draw. Nothing else here draws.

import type { StarSystem } from '../galaxy/galaxy.ts';
import { dockHint } from './hints.ts';
import type {
  Branch, CommanderFacts, DossierWord, Leg, LiveMission, MissionEffect, MissionInput,
  MissionState, Settlement, Skeleton, Trigger,
} from './model.ts';
import { canAccept, offersFor } from './offers.ts';
import { placeLeg } from './placement.ts';
import { legOf, patronId, startWorld } from './lookups.ts';
import { ARC_TOUR, SKELETONS, skeletonById } from './skeletons/index.ts';
import { fillSlots, legPay, lineSlots } from './text.ts';
import { leadWorldIn } from './tour.ts';
import { sameTrigger, triggerLabel, wordKind } from './triggers.ts';
import { verbItem, verbModule, verbNeedsShip } from './verbs/registry.ts';

export interface MissionContext {
  commander: CommanderFacts;
  systems: readonly StarSystem[];
  rng: () => number;
  /** the skeletons in force; a test supplies its own, the game uses `SKELETONS` */
  skeletons?: readonly Skeleton[];
}

export interface MissionStep { state: MissionState; effects: MissionEffect[] }

/** The one entry point. `state` is never changed; a copy comes back. */
export function stepMissions(
  state: MissionState, input: MissionInput, ctx: MissionContext,
): MissionStep {
  const st: MissionState = structuredClone(state);
  const effects: MissionEffect[] = [];
  const journalBefore = st.journal.length;
  switch (input.kind) {
    case 'accept': accept(st, input.skeleton, ctx, effects); break;
    case 'abandon': abandon(st, input.skeleton, ctx, effects); break;
    case 'dayPassed':
      deadlines(st, ctx, effects);
      // A world change holds through its last day, and is gone the day after.
      st.changes = st.changes.filter((ch) => ch.until >= ctx.commander.day);
      break;
    case 'galaxyChanged': leaveGalaxy(st, input.to, ctx, effects); break;
    default: react(st, input, ctx, effects);
  }
  if (input.kind === 'docked') hail(st, ctx, effects, st.journal.length !== journalBefore);
  return { state: st, effects };
}

// --- lookups ----------------------------------------------------------------

/** The skeleton, or an error: the lint test keeps a live mission from naming a ghost. */
function skeletonOf(id: string, ctx: MissionContext): Skeleton {
  const s = skeletonById(id, ctx.skeletons ?? SKELETONS);
  if (!s) throw new Error(`mission ${id}: no such skeleton`);
  return s;
}


/**
 * What a dock says about missions beyond the legs it moved: the offers here,
 * and then at most one hint about a lead (hints.ts). `moved` is whether this
 * dock advanced any journal entry, which resets the idle count.
 */
function hail(
  st: MissionState, ctx: MissionContext, effects: MissionEffect[], moved: boolean,
): void {
  st.idleDocks = moved ? 0 : st.idleDocks + 1;
  const offers = offersFor(st, ctx);
  // ONE CONSOLE LINE PER KIND. An arc hails by name, because a patron who
  // briefs a commander one time deserves the console. A second arc at the
  // same dock waits behind the first, since docs/TODO/192 put the governor
  // of Lave beside the Navy there. The side jobs on the board are one
  // count, said behind an arc's hail when there is one. So a dock with four
  // offers cannot say four lines into one frame and show the last of them.
  const arcs = offers.filter((s) => s.kind !== 'side');
  const side = offers.length - arcs.length;
  arcs.forEach((s, i) => effects.push(i === 0
    ? { kind: 'say', text: s.hail, command: 'openMissions' }
    : { kind: 'later', text: s.hail }));
  if (side > 0) {
    const text = `${side} SIDE JOB${side === 1 ? '' : 'S'} ON THE STATION BOARD`;
    if (arcs.length === 0) effects.push({ kind: 'say', text, command: 'openMissions' });
    else effects.push({ kind: 'later', text });
  }
  const hint = dockHint(st, ctx.commander, ctx.systems, offers.length > 0, st.idleDocks);
  if (hint) effects.push({ kind: 'later', ...hint });
}

// --- acceptance and abandonment ---------------------------------------------

function accept(
  st: MissionState, id: string, ctx: MissionContext, effects: MissionEffect[],
): void {
  if (!canAccept(st, id, ctx)) return;
  const skeleton = skeletonOf(id, ctx);
  const c = ctx.commander;
  const first = skeleton.legs[0];
  const placed = placeLeg(first.place, st, c, ctx.systems, ctx.rng, id, ctx.skeletons ?? SKELETONS);
  if (!placed.ok) return;
  st.journal.push({ skeleton: id, leg: first.id, outcome: 'accepted', day: c.day, world: c.systemIndex });
  const live: LiveMission = {
    skeleton: id, leg: first.id, target: null, tag: null, progress: 0, deadlineDay: null,
  };
  st.live.push(live);
  startLeg(st, live, skeleton, first, placed.target, ctx, effects);
  st.leads = st.leads.filter((l) => l.skeleton !== id);
  // The fee is the leg's, so a dossier's arrive line can quote it.
  const slots = lineSlots(ctx.systems, placed.target, legPay(first));
  effects.push({
    kind: 'say', text: fillSlots(first.line, slots),
    word: { skeleton: id, leg: first.id, kind: 'arrive', slots },
  });
}

/**
 * Abandonment is the skeleton's own failure, with no recovery leg. A second
 * abandon finds no live mission, and does nothing.
 */
function abandon(
  st: MissionState, id: string, ctx: MissionContext, effects: MissionEffect[],
): void {
  const live = st.live.find((l) => l.skeleton === id);
  if (!live) return;
  const c = ctx.commander;
  st.journal.push({ skeleton: id, leg: live.leg, outcome: 'abandoned', day: c.day, world: c.systemIndex });
  finish(st, live, 'fail', ctx, effects);
}

/**
 * The commander left the galaxy. Every live mission fails by its own final
 * outcome, with the departure as the reason. Every lead moves to the world
 * the tour of the new galaxy gives its arc (tour.ts), from the arrival
 * world. Its galaxy moves with it, so a lead never points at an index in a
 * galaxy she is not in. `ctx.systems` is the galaxy she arrives in.
 */
function leaveGalaxy(
  st: MissionState, to: number, ctx: MissionContext, effects: MissionEffect[],
): void {
  const c = ctx.commander;
  for (const live of [...st.live]) {
    st.journal.push({ skeleton: live.skeleton, leg: live.leg, outcome: 'galaxyLeft', day: c.day, world: c.systemIndex });
    finish(st, live, 'fail', ctx, effects);
  }
  for (const lead of st.leads) {
    if (!skeletonById(lead.skeleton, ctx.skeletons ?? SKELETONS)) continue;
    lead.galaxy = to;
    lead.world = leadWorldIn(ctx.systems, c.systemIndex, ARC_TOUR.indexOf(lead.skeleton));
  }
}

// --- events -----------------------------------------------------------------

function react(
  st: MissionState, input: MissionInput, ctx: MissionContext, effects: MissionEffect[],
): void {
  // A tagged thing that died or was scooped is gone from the record, whatever
  // any leg makes of it. `missionSpawns` (queries.ts) then never puts it back.
  if ((input.kind === 'destroyed' || input.kind === 'scooped') && input.tag in st.entities) {
    st.entities[input.tag].alive = false;
  }
  // A choice is the MISSIONS screen's, not a verb's: the branch that names
  // it fires on every live leg that carries it (docs/TODO/192 M3).
  if (input.kind === 'choice') {
    for (const live of [...st.live]) fire(st, live, { choice: input.id }, ctx, effects);
    return;
  }
  for (const live of [...st.live]) {
    const skeleton = skeletonOf(live.skeleton, ctx);
    const leg = legOf(skeleton, live.leg);
    const module = verbModule(leg.verb.kind);
    if (!module) continue;
    const reaction = module({ live, leg, commander: ctx.commander }, input);
    if (!reaction) continue;
    if (reaction.progress !== undefined) live.progress = reaction.progress;
    if (reaction.passenger && input.kind === 'scooped') {
      st.passengers.push({ tag: input.tag, mission: live.skeleton });
    }
    if (reaction.trigger !== undefined) fire(st, live, reaction.trigger, ctx, effects);
  }
  // A passenger answered for is off the ship, whichever mission owned them.
  if (input.kind === 'survivor') st.passengers = st.passengers.filter((p) => p.tag !== input.tag);
}

function deadlines(st: MissionState, ctx: MissionContext, effects: MissionEffect[]): void {
  for (const live of [...st.live]) {
    if (live.deadlineDay !== null && ctx.commander.day > live.deadlineDay) {
      fire(st, live, 'deadlinePassed', ctx, effects);
    }
  }
}

/**
 * Take the branch a trigger selects, or nothing when the leg has no such
 * branch. A passed deadline with no branch of its own falls to the leg's
 * `failed` branch, which every leg has (failure rule 1).
 */
function fire(
  st: MissionState, live: LiveMission, trigger: Trigger,
  ctx: MissionContext, effects: MissionEffect[],
): void {
  const leg = legOf(skeletonOf(live.skeleton, ctx), live.leg);
  const branch = leg.next.find((b) => sameTrigger(b.on, trigger))
    ?? (trigger === 'deadlinePassed' ? leg.next.find((b) => b.on === 'failed') : undefined);
  if (branch) takeBranch(st, live, branch, ctx, effects);
}

function takeBranch(
  st: MissionState, live: LiveMission, branch: Branch,
  ctx: MissionContext, effects: MissionEffect[],
): void {
  const skeleton = skeletonOf(live.skeleton, ctx);
  const c = ctx.commander;
  const entry = { skeleton: live.skeleton, leg: live.leg, outcome: triggerLabel(branch.on), day: c.day, world: c.systemIndex };
  const leg = legOf(skeleton, live.leg);
  const kind = wordKind(leg, branch);
  const word = (target: number | null): DossierWord | undefined => (kind
    ? { skeleton: skeleton.id, leg: leg.id, kind, slots: lineSlots(ctx.systems, target, branch.settle?.pay) }
    : undefined);
  if (branch.to === 'complete' || branch.to === 'fail') {
    settle(st, skeleton, branch.settle, null, ctx, effects, word(null));
    st.journal.push(entry);
    finish(st, live, branch.to, ctx, effects);
    return;
  }
  const next = legOf(skeleton, branch.to);
  const placed = placeLeg(next.place, st, c, ctx.systems, ctx.rng, live.skeleton, ctx.skeletons ?? SKELETONS);
  if (!placed.ok) return;
  settle(st, skeleton, branch.settle, placed.target, ctx, effects, word(placed.target));
  st.journal.push(entry);
  startLeg(st, live, skeleton, next, placed.target, ctx, effects);
}

/**
 * Fire a `{ flag }` trigger on every live leg whose branches name one of
 * `flags`, once per flag per leg. `settle` calls it with the flags it
 * newly set. `startLeg` calls it with the flags already set, so a leg that
 * starts after its flag was set still moves. A branch that names its own
 * leg is skipped, or a flag that stays set would fire it on every start.
 */
function fireFlags(
  st: MissionState, flags: readonly string[], ctx: MissionContext, effects: MissionEffect[],
): void {
  if (!flags.length) return;
  for (const live of [...st.live]) {
    if (!st.live.includes(live)) continue;
    const leg = legOf(skeletonOf(live.skeleton, ctx), live.leg);
    const named = flags.find((f) => leg.next.some((b) => typeof b.on !== 'string' && 'flag' in b.on && b.on.flag === f && b.to !== leg.id));
    if (named !== undefined) fire(st, live, { flag: named }, ctx, effects);
  }
}


/**
 * Put a live mission on a leg. A hunt, an escort or a scan gets a tag for its
 * ship, and a recover or a rescue gets one for its item. The tag is unique
 * across missions and across repeats of one job. The thing enters
 * `entities`, so the game can spawn it and a save can rebuild it. A smuggle
 * leg asks the game to put the patron's goods aboard.
 */
function startLeg(
  st: MissionState, live: LiveMission, skeleton: Skeleton, leg: Leg,
  target: number | null, ctx: MissionContext, effects: MissionEffect[],
): void {
  const c = ctx.commander;
  live.leg = leg.id;
  live.target = target;
  live.progress = 0;
  live.tag = null;
  live.deadlineDay = leg.deadlineDays === undefined ? null : c.day + leg.deadlineDays;
  const run = st.journal.filter((j) => j.skeleton === skeleton.id && j.outcome === 'accepted').length;
  const tag = `${skeleton.id}#${run}#${leg.id}`;
  const item = verbItem(leg.verb);
  if (verbNeedsShip(leg.verb)) {
    st.entities[tag] = { kind: 'ship', ship: leg.verb.ship, hull: 1, lastWorld: target ?? c.systemIndex, alive: true };
    live.tag = tag;
  } else if (item !== null) {
    st.entities[tag] = { kind: item, ship: '', hull: 1, lastWorld: target ?? c.systemIndex, alive: true };
    live.tag = tag;
  }
  if (leg.verb.kind === 'smuggle') {
    effects.push({ kind: 'cargo', commodity: leg.verb.commodity, tonnes: leg.verb.tonnes });
  }
  fireFlags(st, st.flags, ctx, effects);
}

/**
 * Apply a settlement, and say its word. A silent settlement with a dossier
 * word still says an empty line. The bridge puts the dossier's line in its
 * place, or drops it.
 */
function settle(
  st: MissionState, skeleton: Skeleton, s: Settlement | undefined,
  target: number | null, ctx: MissionContext, effects: MissionEffect[], word?: DossierWord,
): void {
  const added: string[] = [];
  if (s) {
    if (s.pay > 0) effects.push({ kind: 'pay', tenths: s.pay });
    if (s.deed) effects.push({ kind: 'deed', deed: s.deed });
    if (s.legal) effects.push({ kind: 'legal', delta: s.legal });
    for (const f of s.setFlags ?? []) {
      if (!st.flags.includes(f)) { st.flags.push(f); added.push(f); }
    }
    if (s.standing) {
      const id = patronId(skeleton, ctx.commander);
      st.standing[id] = (st.standing[id] ?? 0) + s.standing;
    }
    // A change to a world is the game's to keep (mission-bridge.ts), at the
    // branch's world, through its last day.
    const world = target ?? ctx.commander.systemIndex;
    if (s.override) {
      effects.push({ kind: 'worldOverride', world, until: ctx.commander.day + s.override.days, change: { override: s.override.set } });
    }
    if (s.spawn) {
      effects.push({ kind: 'standingSpawn', world, until: ctx.commander.day + s.spawn.days, ships: s.spawn.ships });
    }
  }
  const text = s?.say ? fillSlots(s.say, lineSlots(ctx.systems, target, s.pay)) : '';
  if (text || word) effects.push({ kind: 'say', text, word });
  fireFlags(st, added, ctx, effects);
}

/**
 * End a mission by one outcome. The outcome settles, the journal records it,
 * the lead is saved and announced, and every ship the mission tagged is
 * forgotten. The slot is free when this returns.
 */
function finish(
  st: MissionState, live: LiveMission, outcome: 'complete' | 'fail',
  ctx: MissionContext, effects: MissionEffect[],
): void {
  const skeleton = skeletonOf(live.skeleton, ctx);
  const c = ctx.commander;
  const o = skeleton[outcome];
  settle(st, skeleton, o, null, ctx, effects);
  st.done[live.skeleton] = outcome;
  st.journal.push({ skeleton: live.skeleton, leg: live.leg, outcome, day: c.day, world: c.systemIndex });
  st.live = st.live.filter((l) => l !== live);
  for (const tag of Object.keys(st.entities)) {
    if (tag.startsWith(`${live.skeleton}#`)) delete st.entities[tag];
  }
  // Anyone still aboard for this mission is an ordinary survivor now, once.
  const left = st.passengers.filter((p) => p.mission === live.skeleton).length;
  if (left > 0) {
    st.passengers = st.passengers.filter((p) => p.mission !== live.skeleton);
    effects.push({ kind: 'survivors', people: left });
  }
  if (o.lead) offerLead(st, o.lead, ctx, effects);
}

/**
 * Save a lead, once. A lead to an arc she holds or finished is dropped, as
 * failure rule 3 asks. The effect tells the game to announce it.
 */
function offerLead(
  st: MissionState, id: string, ctx: MissionContext, effects: MissionEffect[],
): void {
  const target = skeletonById(id, ctx.skeletons ?? SKELETONS);
  if (!target) return;
  if (id in st.done || st.live.some((l) => l.skeleton === id)) return;
  if (st.leads.some((l) => l.skeleton === id)) return;
  const c = ctx.commander;
  const world = startWorld(target, c);
  st.leads.push({ skeleton: id, galaxy: c.galaxy, world, sinceDay: c.day });
  effects.push({ kind: 'lead', skeleton: id, galaxy: c.galaxy, world });
}
