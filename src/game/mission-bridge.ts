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

import { generateGalaxy, type StarSystem } from '../galaxy/galaxy.ts';
import { afterDeed } from './character.ts';
import { cargoCapacity, cargoTonnes, type CommanderData } from './commander.ts';
import { random } from './rng.ts';
import { specForDesign, type NpcSpec } from './ship-specs.ts';
import { huntWarning } from './hunt-warning.ts';
import { stepMissions } from '../missions/machine.ts';
import { legOf } from '../missions/machine.ts';
import type { CommanderFacts, LiveMission, MissionInput } from '../missions/model.ts';
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

/** The facts a rule may read, and nothing the machine could spend. */
export function missionFacts(c: CommanderData): CommanderFacts {
  return {
    galaxy: c.galaxy, systemIndex: c.systemIndex, kills: c.kills,
    combatScore: c.combatScore, legalStatus: c.legalStatus, day: c.day,
    cargo: c.cargo,
  };
}

/**
 * The systems of a galaxy, for a caller that holds only the commander.
 *
 * The wreck resolver and the world step have no `GameState.systems` in reach.
 * The galaxy is a pure function of its number, and a memo of one galaxy at a
 * time keeps the generator off the hot path.
 */
let memo: { galaxy: number; systems: StarSystem[] } | null = null;
function systemsOf(galaxy: number): readonly StarSystem[] {
  if (!memo || memo.galaxy !== galaxy) memo = { galaxy, systems: generateGalaxy(galaxy) };
  return memo.systems;
}

/**
 * Run one input through the machine, install the record, apply the costs.
 *
 * @returns the lines to say, in order. A `say` takes the console; a `later`
 * waits behind it (session.ts).
 */
export function runMissions(
  c: CommanderData, input: MissionInput,
  systems: readonly StarSystem[] = systemsOf(c.galaxy), rng: () => number = random,
): MissionMessage[] {
  const { state, effects } = stepMissions(c.missions, input, {
    commander: missionFacts(c), systems, rng,
  });
  c.missions = state;
  const out: MissionMessage[] = [];
  for (const e of effects) {
    switch (e.kind) {
      case 'pay': c.credits += e.tenths; break;
      case 'deed': c.disrepute = afterDeed(c.disrepute ?? 0, e.deed.disrepute); break;
      case 'legal':
        c.legalStatus = Math.max(0, Math.min(FUGITIVE, c.legalStatus + e.delta));
        break;
      case 'say': out.push({ kind: 'message', text: e.text, seconds: 6, command: e.command }); break;
      case 'later': out.push({ kind: 'message', text: e.text, seconds: 6, queued: true }); break;
      case 'lead':
        out.push({
          kind: 'message', queued: true, seconds: 6,
          text: `A LEAD: ASK AT ${systems[e.world].name.toUpperCase()}`,
        });
        break;
      // The patron's goods go aboard, as far as the hold allows. A hold too
      // full for all of them is a leg that starts short. The smuggle verb then
      // fails a dock with fewer tonnes than it wants.
      case 'cargo': {
        const room = Math.max(0, cargoCapacity(c) - cargoTonnes(c));
        c.cargo[e.commodity] += Math.min(room, e.tonnes);
        break;
      }
      // Passengers a finished mission left aboard are survivors now, once.
      case 'survivors': c.survivors += e.people; break;
      // The two world effects wait for a skeleton that asks for one. None
      // shipped does (item 192 of docs/TODO/190).
      case 'worldOverride': case 'standingSpawn': break;
    }
  }
  return out;
}

/** The roster row for a mission ship, by the design its entity names. */
export function missionShipSpec(c: CommanderData, tag: string): NpcSpec | undefined {
  const e = c.missions.entities[tag];
  return e ? specForDesign('pirate', e.ship) : undefined;
}

/**
 * What her gun is worth against a live hunt's target, or '' when it will do
 * or the leg is not a hunt.
 */
export function missionWarning(c: CommanderData, live: LiveMission): string {
  const s = skeletonById(live.skeleton);
  if (!s) return '';
  const verb = legOf(s, live.leg).verb;
  if (verb.kind !== 'hunt') return '';
  const spec = specForDesign('pirate', verb.ship);
  return spec ? huntWarning(c, spec, s.patron.kind === 'navy' ? 'NAVY' : 'PATRON') : '';
}
