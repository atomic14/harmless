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
// A VERB MODULE decides what an input means for one leg and names a trigger.
// This file finds the branch that trigger selects, places the next leg, and
// settles the branch. A settlement is paid ONCE, at the moment its branch is
// taken. A second input for the same kill finds the mission on the next leg,
// whose verb ignores it. That is the whole of the duplicate-payment rule.
//
// The random generator is an argument, so a test can count its draws. A
// placement in a band makes one draw. Nothing else here draws.

import { MISSION_LIVE_CAP } from '../constants/missions.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { routeEstimate } from '../galaxy/route.ts';
import { ratingRung } from '../game/rating.ts';
import type {
  Branch, CommanderFacts, Gate, Leg, LiveMission, MissionEffect, MissionInput,
  MissionState, Settlement, Skeleton, Trigger,
} from './model.ts';
import { placeLeg } from './placement.ts';
import { SKELETONS, skeletonById } from './skeletons/index.ts';
import { fillSlots, lineSlots } from './text.ts';
import { verbModule, verbNeedsShip } from './verbs/registry.ts';

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
  switch (input.kind) {
    case 'accept': accept(st, input.skeleton, ctx, effects); break;
    case 'abandon': abandon(st, input.skeleton, ctx, effects); break;
    case 'dayPassed': deadlines(st, ctx, effects); break;
    case 'galaxyChanged': leaveGalaxy(st, input.to, ctx, effects); break;
    default: react(st, input, ctx, effects);
  }
  if (input.kind === 'docked') hail(st, ctx, effects);
  return { state: st, effects };
}

// --- offers -----------------------------------------------------------------

/** The skeleton, or an error: the lint test keeps a live mission from naming a ghost. */
function skeletonOf(id: string, ctx: MissionContext): Skeleton {
  const s = skeletonById(id, ctx.skeletons ?? SKELETONS);
  if (!s) throw new Error(`mission ${id}: no such skeleton`);
  return s;
}

/** The leg of a skeleton by id. The lint test makes a miss impossible. */
export function legOf(skeleton: Skeleton, id: string): Leg {
  const leg = skeleton.legs.find((l) => l.id === id);
  if (!leg) throw new Error(`mission ${skeleton.id}: no leg ${id}`);
  return leg;
}

/** The key that `MissionState.standing` and a dossier file use for a patron. */
export function patronId(skeleton: Skeleton): string {
  return skeleton.patron.kind === 'navy' ? 'navy' : `world-${skeleton.patron.seedSlot}`;
}

/**
 * Where a skeleton is offered. A world patron waits at home. The Navy has no
 * home, so its lead opens wherever the commander stands.
 */
export function startWorld(skeleton: Skeleton, commander: CommanderFacts): number {
  return skeleton.patron.kind === 'navy' ? commander.systemIndex : skeleton.patron.seedSlot;
}

function gateOpen(gate: Gate, st: MissionState, c: CommanderFacts): boolean {
  if (gate.galaxy !== undefined && c.galaxy !== gate.galaxy) return false;
  if (gate.minKills !== undefined && c.kills < gate.minKills) return false;
  if (gate.minRating !== undefined && ratingRung(c.combatScore) < gate.minRating) return false;
  if (gate.legalStatus === 'clean' && c.legalStatus !== 0) return false;
  if (gate.flags?.some((f) => !st.flags.includes(f))) return false;
  if (gate.notFlags?.some((f) => st.flags.includes(f))) return false;
  if (gate.done?.some((d) => !(d in st.done))) return false;
  return true;
}

/** How many times this skeleton ended, by either outcome. */
function timesFinished(st: MissionState, id: string): number {
  return st.journal.filter((j) => j.skeleton === id
    && (j.outcome === 'complete' || j.outcome === 'fail')).length;
}

/** A skeleton the commander holds, or held, shuts this one out for good. */
function excluded(st: MissionState, id: string, ctx: MissionContext): boolean {
  const held = [...st.live.map((l) => l.skeleton), ...Object.keys(st.done)];
  const from = ctx.skeletons ?? SKELETONS;
  return held.some((h) => skeletonById(h, from)?.excludes?.includes(id) ?? false);
}

function leadHere(st: MissionState, id: string, c: CommanderFacts): boolean {
  return st.leads.some((l) => l.skeleton === id
    && l.galaxy === c.galaxy && l.world === c.systemIndex);
}

/**
 * Whether the commander can accept this skeleton where she stands.
 *
 * A LEAD OPENS THE OFFER regardless of the gate (docs/TODO/190, failure rule
 * 3). It does not open a slot, and it does not restart an arc she holds or
 * finished. A side job with a `cap` comes back until the cap is spent.
 */
export function canAccept(st: MissionState, id: string, ctx: MissionContext): boolean {
  const s = skeletonById(id, ctx.skeletons ?? SKELETONS);
  if (!s) return false;
  if (st.live.length >= MISSION_LIVE_CAP) return false;
  if (st.live.some((l) => l.skeleton === id)) return false;
  const runs = timesFinished(st, id);
  if (runs >= (s.kind === 'side' ? (s.cap ?? 1) : 1)) return false;
  if (excluded(st, id, ctx)) return false;
  return leadHere(st, id, ctx.commander) || gateOpen(s.offer, st, ctx.commander);
}

/** Every skeleton on offer where the commander stands. */
export function offersFor(st: MissionState, ctx: MissionContext): Skeleton[] {
  return (ctx.skeletons ?? SKELETONS).filter((s) => canAccept(st, s.id, ctx));
}

function hail(st: MissionState, ctx: MissionContext, effects: MissionEffect[]): void {
  for (const s of offersFor(st, ctx)) {
    effects.push({ kind: 'say', text: s.hail, command: 'openMissions' });
  }
}

// --- acceptance and abandonment ---------------------------------------------

function accept(
  st: MissionState, id: string, ctx: MissionContext, effects: MissionEffect[],
): void {
  if (!canAccept(st, id, ctx)) return;
  const skeleton = skeletonOf(id, ctx);
  const c = ctx.commander;
  const first = skeleton.legs[0];
  const placed = placeLeg(first.place, st, c, ctx.systems, ctx.rng);
  if (!placed.ok) return;
  st.journal.push({ skeleton: id, leg: first.id, outcome: 'accepted', day: c.day, world: c.systemIndex });
  const live: LiveMission = {
    skeleton: id, leg: first.id, target: null, tag: null, progress: 0, deadlineDay: null,
  };
  st.live.push(live);
  startLeg(st, live, skeleton, first, placed.target, ctx);
  st.leads = st.leads.filter((l) => l.skeleton !== id);
  effects.push({ kind: 'say', text: fillSlots(first.line, lineSlots(ctx.systems, placed.target)) });
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
 * outcome, with the departure as the reason. Every lead moves to its
 * skeleton's start world in the new galaxy. Its galaxy moves with it, so a
 * lead never points at an index in a galaxy she is not in.
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
    const s = skeletonById(lead.skeleton, ctx.skeletons ?? SKELETONS);
    if (!s) continue;
    lead.galaxy = to;
    lead.world = reachableFrom(ctx.systems, c.systemIndex, startWorld(s, c));
  }
}

/**
 * `preferred`, or the next index after it that a chain of full-tank jumps
 * from `here` reaches. Galaxies 3, 4, 6, 7 and 8 each strand a group of
 * worlds (galaxy/route.ts). A lead on one of those is a lead nobody can
 * follow. The arc plan, item 192 of docs/TODO/190, owns the placement proper.
 */
function reachableFrom(systems: readonly StarSystem[], here: number, preferred: number): number {
  for (let step = 0; step < systems.length; step++) {
    const index = (preferred + step) % systems.length;
    if (index === here || routeEstimate(systems, systems[here], systems[index]) !== null) return index;
  }
  return here;
}

// --- events -----------------------------------------------------------------

function react(
  st: MissionState, input: MissionInput, ctx: MissionContext, effects: MissionEffect[],
): void {
  // A tagged ship that died is dead in the record, whatever any leg makes of
  // it. `missionSpawns` (queries.ts) then never puts it back in the sky.
  if (input.kind === 'destroyed' && input.tag in st.entities) st.entities[input.tag].alive = false;
  for (const live of [...st.live]) {
    const skeleton = skeletonOf(live.skeleton, ctx);
    const leg = legOf(skeleton, live.leg);
    const module = verbModule(leg.verb.kind);
    if (!module) continue;
    const reaction = module({ live, leg, commander: ctx.commander }, input);
    if (!reaction) continue;
    if (reaction.progress !== undefined) live.progress = reaction.progress;
    if (reaction.trigger !== undefined) fire(st, live, reaction.trigger, ctx, effects);
  }
}

function deadlines(st: MissionState, ctx: MissionContext, effects: MissionEffect[]): void {
  for (const live of [...st.live]) {
    if (live.deadlineDay !== null && ctx.commander.day > live.deadlineDay) {
      fire(st, live, 'deadlinePassed', ctx, effects);
    }
  }
}

function sameTrigger(a: Trigger, b: Trigger): boolean {
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** `targetDestroyed`, or `flag:plans` for the object forms: the journal's word. */
function triggerLabel(t: Trigger): string {
  if (typeof t === 'string') return t;
  const [k, v] = Object.entries(t)[0];
  return `${k}:${v}`;
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
  if (branch.to === 'complete' || branch.to === 'fail') {
    settle(st, skeleton, branch.settle, null, ctx, effects);
    st.journal.push(entry);
    finish(st, live, branch.to, ctx, effects);
    return;
  }
  const next = legOf(skeleton, branch.to);
  const placed = placeLeg(next.place, st, c, ctx.systems, ctx.rng);
  if (!placed.ok) return;
  settle(st, skeleton, branch.settle, placed.target, ctx, effects);
  st.journal.push(entry);
  startLeg(st, live, skeleton, next, placed.target, ctx);
}

/**
 * Put a live mission on a leg. A hunt, an escort or a scan gets a tag for its
 * ship. The tag is unique across missions and across repeats of one job. The
 * ship enters `entities`, so the game can spawn it and a save can rebuild it.
 */
function startLeg(
  st: MissionState, live: LiveMission, skeleton: Skeleton, leg: Leg,
  target: number | null, ctx: MissionContext,
): void {
  const c = ctx.commander;
  live.leg = leg.id;
  live.target = target;
  live.progress = 0;
  live.tag = null;
  live.deadlineDay = leg.deadlineDays === undefined ? null : c.day + leg.deadlineDays;
  if (verbNeedsShip(leg.verb)) {
    const run = st.journal.filter((j) => j.skeleton === skeleton.id && j.outcome === 'accepted').length;
    const tag = `${skeleton.id}#${run}#${leg.id}`;
    st.entities[tag] = { ship: leg.verb.ship, hull: 1, lastWorld: target ?? c.systemIndex, alive: true };
    live.tag = tag;
  }
}

function settle(
  st: MissionState, skeleton: Skeleton, s: Settlement | undefined,
  target: number | null, ctx: MissionContext, effects: MissionEffect[],
): void {
  if (!s) return;
  if (s.pay > 0) effects.push({ kind: 'pay', tenths: s.pay });
  if (s.deed) effects.push({ kind: 'deed', deed: s.deed });
  if (s.legal) effects.push({ kind: 'legal', delta: s.legal });
  for (const f of s.setFlags ?? []) if (!st.flags.includes(f)) st.flags.push(f);
  if (s.standing) {
    const id = patronId(skeleton);
    st.standing[id] = (st.standing[id] ?? 0) + s.standing;
  }
  if (s.say) effects.push({ kind: 'say', text: fillSlots(s.say, lineSlots(ctx.systems, target, s.pay)) });
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
