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
// file asks the offers on `accept`. What a dock SAYS about them is hail.ts,
// which this file calls on `docked` (docs/TODO/203).
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
import { hail } from './hail.ts';
import type {
  Branch, CommanderFacts, DossierWord, Leg, LiveMission, MissionEffect, MissionInput,
  MissionState, Settlement, Skeleton, Trigger,
} from './model.ts';
import { canAccept } from './offers.ts';
import { placeLeg } from './placement.ts';
import { legOf } from './lookups.ts';
import { SKELETONS, skeletonById } from './skeletons/index.ts';
import { fillSlots, legPay, lineSlots } from './text.ts';
import { applySettlement } from './settlement.ts';
import { offerLead } from './leads.ts';
import { sameTrigger, triggerLabel, wordKind } from './triggers.ts';
import { verbItem, verbModule, verbNeedsShip } from './verbs/registry.ts';
import { DEADLINE_WARNING_DAYS } from '../constants/missions.ts';

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
    case 'galaxyChanged': leaveGalaxy(st, ctx, effects); break;
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
  st.journal.push({ skeleton: id, leg: first.id, outcome: 'accepted', day: c.day, world: c.systemIndex, galaxy: c.galaxy });
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
  st.journal.push({ skeleton: id, leg: live.leg, outcome: 'abandoned', day: c.day, world: c.systemIndex, galaxy: c.galaxy });
  finish(st, live, 'fail', ctx, effects);
}

/**
 * The commander left the galaxy. Every live mission fails by its own final
 * outcome, with the departure as the reason. A lead stays where it was
 * saved. An arc is offered in its own galaxy (`Gate.galaxy`), so the LEADS
 * row says IN ANOTHER GALAXY until she returns. The leads used to move to
 * the tour of the new galaxy. The arc they opened there placed its legs by
 * seed index, which is not the tour (docs/TODO/213 M2).
 */
function leaveGalaxy(
  st: MissionState, ctx: MissionContext, effects: MissionEffect[],
): void {
  const c = ctx.commander;
  for (const live of [...st.live]) {
    st.journal.push({ skeleton: live.skeleton, leg: live.leg, outcome: 'galaxyLeft', day: c.day, world: c.systemIndex, galaxy: c.galaxy });
    finish(st, live, 'fail', ctx, effects);
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
    const reaction = module({ live, leg, commander: ctx.commander, entities: st.entities }, input);
    if (!reaction) continue;
    // A ship that ran or jumped out is gone from the record too, once a leg
    // took the word (docs/TODO/217 M1). The Constrictor cannot leave, and
    // its verb takes no such word, so it stays and comes back on the next
    // arrival. The mark says which, so a gang hunt can read its leader's
    // fate at the end.
    if ((input.kind === 'fled' || input.kind === 'escaped') && input.tag in st.entities) {
      st.entities[input.tag].alive = false;
      st.entities[input.tag].fled = true;
    }
    if (reaction.progress !== undefined) live.progress = reaction.progress;
    if (reaction.passenger && input.kind === 'scooped') {
      st.passengers.push({ tag: input.tag, mission: live.skeleton });
    }
    if (reaction.unload && leg.verb.kind === 'smuggle') {
      effects.push({ kind: 'unload', commodity: leg.verb.commodity, tonnes: leg.verb.tonnes });
    }
    if (reaction.say !== undefined) {
      effects.push({ kind: 'say', text: fillSlots(reaction.say, lineSlots(ctx.systems, live.target, legPay(leg))) });
    }
    if (reaction.trigger !== undefined) fire(st, live, reaction.trigger, ctx, effects);
    // The ambush springs after the branch settles, so its line queues behind
    // the settlement's own (docs/TODO/214 M2).
    if (reaction.sprung && leg.ambush) {
      effects.push({ kind: 'spawn', ships: leg.ambush.ships });
      effects.push({ kind: 'later', text: leg.ambush.say });
    }
  }
  // A passenger answered for is off the ship, whichever mission owned them.
  if (input.kind === 'survivor') st.passengers = st.passengers.filter((p) => p.tag !== input.tag);
}

/**
 * A day passed. A deadline behind the day fails its leg, and says so. A
 * deadline within `DEADLINE_WARNING_DAYS` says how many days are left
 * (docs/TODO/203 M1). Both lines name the leg's world, because that is where
 * the player must be.
 */
function deadlines(st: MissionState, ctx: MissionContext, effects: MissionEffect[]): void {
  for (const live of [...st.live]) {
    if (live.deadlineDay === null) continue;
    const left = live.deadlineDay - ctx.commander.day;
    const where = live.target === null ? 'ANY STATION' : ctx.systems[live.target].name.toUpperCase();
    if (left < 0) {
      effects.push({ kind: 'say', text: `THE JOB AT ${where} RAN OUT OF TIME, AND IT IS LOST.` });
      fire(st, live, 'deadlinePassed', ctx, effects);
    } else if (left <= DEADLINE_WARNING_DAYS) {
      effects.push({
        kind: 'say',
        text: left === 0
          ? `THE JOB AT ${where} MUST BE DONE TODAY.`
          : `THE JOB AT ${where} HAS ${left} DAY${left === 1 ? '' : 'S'} LEFT.`,
      });
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
  const entry = { skeleton: live.skeleton, leg: live.leg, outcome: triggerLabel(branch.on), day: c.day, world: c.systemIndex, galaxy: c.galaxy };
  const leg = legOf(skeleton, live.leg);
  const kind = wordKind(leg, branch);
  const word = (target: number | null): DossierWord | undefined => (kind
    ? { skeleton: skeleton.id, leg: leg.id, kind, slots: lineSlots(ctx.systems, target, branch.settle?.pay) }
    : undefined);
  if (branch.to === 'complete' || branch.to === 'fail') {
    // The world a change lands on is where she stands, so the target is
    // null. The words still name the leg's own world, or a patron's line
    // read "at ANY STATION" at the end of every job (docs/TODO/203 M5).
    settle(st, skeleton, branch.settle, null, ctx, effects, word(live.target), live.target);
    st.journal.push(entry);
    finish(st, live, branch.to, ctx, effects);
    return;
  }
  const next = legOf(skeleton, branch.to);
  const placed = placeLeg(next.place, st, c, ctx.systems, ctx.rng, live.skeleton, ctx.skeletons ?? SKELETONS);
  // A LEG THAT CANNOT BE PLACED STARTS AT ANY STATION. The branch used to
  // return here, before the settlement and the journal, with the target
  // already dead. The kill paid nothing and the mission held its slot for
  // good (docs/TODO/213 M4). The lint measures every band and every
  // handover from every world, so the path is a guard rather than a rule.
  const target = placed.ok ? placed.target : null;
  settle(st, skeleton, branch.settle, target, ctx, effects, word(target));
  st.journal.push(entry);
  startLeg(st, live, skeleton, next, target, ctx, effects);
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
    // The gang flies with the leader, and each member is a record of its
    // own under the leg's tag (docs/TODO/217 M1). So a dead member stays
    // dead across an arrival, and the clean-up at the end finds it.
    if (leg.verb.kind === 'hunt') {
      (leg.verb.gang ?? []).forEach((ship, i) => {
        st.entities[`${tag}#gang-${i + 1}`] = { kind: 'ship', ship, hull: 1, lastWorld: target ?? c.systemIndex, alive: true };
      });
    }
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
 * Apply a settlement, and say its word (`settlement.ts`). The flags it newly
 * set then fire on every live leg that names one.
 */
function settle(
  st: MissionState, skeleton: Skeleton, s: Settlement | undefined,
  target: number | null, ctx: MissionContext, effects: MissionEffect[], word?: DossierWord,
  /** the world the words name, when it is not the world a change lands on */
  sayTarget: number | null = target,
): void {
  const added = applySettlement(st, skeleton, s, target, ctx, effects, word, sayTarget);
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
  st.journal.push({ skeleton: live.skeleton, leg: live.leg, outcome, day: c.day, world: c.systemIndex, galaxy: c.galaxy });
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
