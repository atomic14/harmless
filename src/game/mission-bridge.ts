// The game's side of the mission machine: run one input, keep the record,
// apply what it costs, and hand back what it says.
//
// `stepMissions` (missions/machine.ts) is pure. It returns a new record and a
// list of effects, and it touches nothing. This is the one place that
// installs the record on the commander and applies the effects that are the
// commander's: credits, reputation and legal status. What is left is words,
// and the caller says them, because a station and a fight announce a line
// through different streams (docs/TODO/190 M2).
//
// ONE OPERATION. The record and its effects land together, before any save,
// so a reload cannot find the credits paid and the leg still owed.

import { COMMODITIES, type StarSystem } from '../galaxy/galaxy.ts';
import { galaxySystems } from '../galaxy/galaxies.ts';
import { afterDeed } from './character.ts';
import { cargoCapacity, cargoTonnes, type CommanderData } from './commander.ts';
import { random } from './rng.ts';
import { specForDesign, type NpcSpec } from './ship-specs.ts';
import { huntWarning } from './hunt-warning.ts';
import { dossierWord } from '../missions/dossiers.ts';
import { stepMissions } from '../missions/machine.ts';
import { legOf } from '../missions/lookups.ts';
import { liveLegs } from '../missions/queries.ts';
import { jobRole, verbJob, verbNeedsShip } from '../missions/verbs/registry.ts';
import type { CommanderFacts, LiveMission, MissionInput, Skeleton, TaggedShip } from '../missions/model.ts';
import { skeletonById } from '../missions/skeletons/index.ts';
import { FUGITIVE } from '../constants/law.ts';
import type { Command } from './controls.ts';

/** A console line the machine asked for. The shape every event stream takes. */
export interface MissionMessage {
  kind: 'message';
  text: string;
  seconds: number;
  queued?: boolean;
  command?: Command;
}

/** `1 TONNE`, `3 TONNES`, for a console line. */
const tonnes = (n: number): string => `${n} TONNE${n === 1 ? '' : 'S'}`;

/** The facts a rule may read, and nothing the machine could spend. */
export function missionFacts(c: CommanderData): CommanderFacts {
  return {
    galaxy: c.galaxy, systemIndex: c.systemIndex, kills: c.kills,
    combatScore: c.combatScore, legalStatus: c.legalStatus, day: c.day,
    cargo: c.cargo, scoops: c.equipment.scoops,
  };
}

/** What one input left for the caller: the lines to say, and the ships to spawn. */
export interface MissionOutcome {
  /** the lines to say, in order. A `say` takes the console; a `later` waits behind it (session.ts) */
  messages: MissionMessage[];
  /** ships an ambush asks for, around the commander now. Only a caller with the world can spawn them */
  spawns: TaggedShip[];
}

/**
 * Run one input through the machine, install the record, apply the costs.
 *
 * @returns the lines to say, in order. A caller that holds the world and can
 * hear a spawn order calls `applyMissions` instead (docs/TODO/214 M2).
 */
export function runMissions(
  c: CommanderData, input: MissionInput,
  systems: readonly StarSystem[] = galaxySystems(c.galaxy), rng: () => number = random,
  skeletons?: readonly Skeleton[],
): MissionMessage[] {
  return applyMissions(c, input, systems, rng, skeletons).messages;
}

/**
 * `runMissions`, with the spawn orders too. A spawn is a world change, and
 * the bridge has no world, so the order goes back to the caller. A caller
 * that cannot spawn drops it, and an ambush no caller can hear is a
 * skeleton fault the flight probe would show.
 */
export function applyMissions(
  c: CommanderData, input: MissionInput,
  systems: readonly StarSystem[] = galaxySystems(c.galaxy), rng: () => number = random,
  skeletons?: readonly Skeleton[],
): MissionOutcome {
  const { state, effects } = stepMissions(c.missions, input, {
    commander: missionFacts(c), systems, rng, skeletons,
  });
  c.missions = state;
  const out: MissionMessage[] = [];
  const spawns: TaggedShip[] = [];
  // A dossier's line replaces the skeleton's where one exists (docs/TODO/191
  // M3). The machine named the line and never read it. A word with no
  // dossier and no plain text is silence, as the skeleton meant it.
  const spoken = (e: { text: string; word?: Parameters<typeof dossierWord>[0] }): string =>
    (e.word ? dossierWord(e.word, missionFacts(c), systems) : null) ?? e.text;
  for (const e of effects) {
    switch (e.kind) {
      case 'pay': c.credits += e.tenths; break;
      // A fit no shop sells goes on the ship (docs/TODO/219 M4).
      case 'grant': c.equipment.cloak = true; break;
      case 'deed': c.disrepute = afterDeed(c.disrepute ?? 0, e.deed.disrepute); break;
      case 'legal':
        c.legalStatus = Math.max(0, Math.min(FUGITIVE, c.legalStatus + e.delta));
        break;
      case 'say': {
        const text = spoken(e);
        if (text) out.push({ kind: 'message', text, seconds: 6, command: e.command });
        break;
      }
      case 'later': {
        const text = spoken(e);
        if (text) out.push({ kind: 'message', text, seconds: 6, queued: true });
        break;
      }
      // The lead's own galaxy names the world. An arc that fails on a galactic
      // jump leaves its lead in the galaxy it came from (docs/TODO/213 M2).
      case 'lead': {
        const named = e.galaxy === c.galaxy ? systems : galaxySystems(e.galaxy);
        out.push({
          kind: 'message', queued: true, seconds: 6,
          text: `THERE IS A LEAD. ASK AT ${named[e.world].name.toUpperCase()}.`,
        });
        break;
      }
      // The patron's goods go aboard, as far as the hold allows. A hold too
      // full for all of them is a leg that starts short. The smuggle verb then
      // fails a dock with fewer tonnes than it wants.
      case 'cargo': {
        const room = Math.max(0, cargoCapacity(c) - cargoTonnes(c));
        const took = Math.min(room, e.tonnes);
        c.cargo[e.commodity] += took;
        // Said, because a hold that changed in silence is a hold the player
        // cannot trust (docs/TODO/203 M4). A short load says what the job
        // still needs, so the player can make room and try again.
        const goods = COMMODITIES[e.commodity].name.toUpperCase();
        out.push({
          kind: 'message', queued: true, seconds: 6,
          text: took === e.tonnes
            ? `${tonnes(took)} OF ${goods} ${took === 1 ? 'IS' : 'ARE'} ABOARD FOR THE RUN.`
            : `THE HOLD TOOK ONLY ${tonnes(took)} OF THE ${e.tonnes} ${goods} NEEDS. THE JOB NEEDS ALL ${e.tonnes}.`,
        });
        break;
      }
      case 'spawn': spawns.push(...e.ships); break;
      // The goods delivered leave the hold, and no more than are aboard.
      case 'unload':
        c.cargo[e.commodity] = Math.max(0, c.cargo[e.commodity] - e.tonnes);
        break;
      // Passengers a finished mission left aboard are survivors now, once.
      case 'survivors': c.survivors += e.people; break;
      // A change to a world is kept on the record until its day, and the
      // arrival queries read it (docs/TODO/192 M3).
      case 'worldOverride':
        c.missions.changes.push({ world: e.world, until: e.until, override: e.change.override });
        break;
      case 'standingSpawn':
        c.missions.changes.push({ world: e.world, until: e.until, ships: e.ships });
        break;
    }
  }
  return { messages: out, spawns };
}

/**
 * The roster row for a mission ship, by the design its entity names and the
 * role its leg flies it under. Every tagged ship was looked up as a pirate
 * until docs/TODO/213 M4, so a restored Python escort took a pirate's guns.
 */
export function missionShipSpec(c: CommanderData, tag: string): NpcSpec | undefined {
  const e = c.missions.entities[tag];
  if (!e) return undefined;
  const leg = liveLegs(c.missions).find(({ live }) => live.tag === tag)?.leg;
  const role = leg && verbNeedsShip(leg.verb) ? jobRole(verbJob(leg.verb)) : 'pirate';
  return specForDesign(role, e.ship);
}

/**
 * What the commander's gun is worth against a live hunt's target, or '' when
 * it will do or the leg is not a hunt.
 */
export function missionWarning(c: CommanderData, live: LiveMission): string {
  const s = skeletonById(live.skeleton);
  if (!s) return '';
  const verb = legOf(s, live.leg).verb;
  if (verb.kind !== 'hunt') return '';
  const spec = specForDesign(jobRole(verbJob(verb)), verb.ship);
  return spec ? huntWarning(c, spec, s.patron.kind === 'navy' ? 'NAVY' : 'PATRON') : '';
}
