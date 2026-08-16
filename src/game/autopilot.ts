// Is something else at the stick, and what does it want?
//
// Two pieces of equipment answer to that. The docking computer flies you into
// the slot; the approach itself is `docking.ts`, and `world-step.ts` steps it.
// The combat computer's shipped pilot is the scripted pure-pursuit co-pilot.
// `scripted-co-pilot.ts` holds its decisions. `combat-computer.ts` is the
// trained seat, and it stays dormant while no weights load.
//
// They had nothing to do with each other in game.ts, and everything to do with
// each other in fact. Both are bought. Both engage on one key. Both hand the
// ship back the moment the pilot touches the controls. Both end as a
// `FlightDemand` that `PlayerShip.update` flies.
//
// (That last claim was false of the docking computer for a long time. It wrote
// `player.quaternion`, and this header said otherwise. That is how
// docs/TODO/126 was found. It is true now.)
//
// So they share a file, and it follows the project's pattern. This file DECIDES
// and reports an `AutopilotEvent`, and the Game says it out loud. The sounds
// are events too: a named sound and the docking music are both a `SoundEvent`
// (sounds.ts). That is what keeps the file free of `audio.ts`, and so free of
// the browser. Nothing here draws from the seeded rng, so there is no order to
// preserve.
//
// What this file does NOT own is the flight itself:
//
//   - the docking approach is docking.ts;
//   - the combat decisions are scripted-co-pilot.ts, or the trained seat in
//     combat-computer.ts;
//   - the trigger is the Game's.
//
// The trigger is the Game's because a shot has consequences — legal status,
// bounties, the station's Vipers — and an autopilot has no business over those.

import type { FlightDemand } from '../player.ts';
import type { Brain } from '../ai-training/policy.ts';
import type { V3 } from '../ai-training/observation.ts';
import { hostilesNear } from './hostility.ts';
import { defenceBrainNameFor } from './brain-names.ts';
import type { CombatComputer } from './combat-computer.ts';
import { ScriptedCoPilot } from './scripted-co-pilot.ts';
import type { SoundEvent } from './sounds.ts';
import type { GameState } from './state.ts';
import { DOCK_COMPUTER_RANGE } from '../constants/docking-computer.ts';

/** What an autopilot reports for the orchestrator to say and play. */
export type AutopilotEvent =
  | { kind: 'message'; text: string; seconds: number }
  | SoundEvent;

const say = (text: string, seconds: number): AutopilotEvent =>
  ({ kind: 'message', text, seconds });
/** The refusal noise shared by every rejected command in the game. */
const REFUSED: AutopilotEvent = { kind: 'sound', name: 'refused' };

/** What the combat computer decided this frame. */
export interface AutopilotDemand {
  /**
   * What it wants, or null when it just handed the ship back. On a null the
   * pilot's own demand stands for this frame, exactly as it did when the
   * autopilot applied itself on top of manual flight.
   */
  demand: FlightDemand | null;
  /**
   * It reaches for the E.C.M. this frame.
   *
   * Reported rather than done, like every other consequence in this file. The
   * burst spends a quarter of the bank and wipes the sky. The Game presses it
   * through the same `fireEcm` that the player's own key does.
   */
  ecm: boolean;
  events: AutopilotEvent[];
}

export class Autopilot {
  private readonly state: GameState;
  private readonly computer: CombatComputer;
  private readonly scripted: ScriptedCoPilot;

  constructor(
    state: GameState, computer: CombatComputer,
    scripted: ScriptedCoPilot = new ScriptedCoPilot(),
  ) {
    this.state = state;
    this.computer = computer;
    this.scripted = scripted;
  }

  /** The commander took a hit — the scripted co-pilot's only way to feel it. */
  noteUnderFire(): void {
    this.scripted.noteHit();
  }

  /**
   * The docking computer, on or off.
   *
   * It FLIES you in rather than teleports you. It uses the same primitive the
   * traders use (game/docking.ts). The hard part is roll, and it is the same
   * problem for both. Press C again, or touch the controls, to take over.
   */
  toggleDocking(): AutopilotEvent[] {
    const s = this.state;
    if (!s.commander.equipment.dockingComputer) {
      return [say('NO DOCKING COMPUTER FITTED', 3), REFUSED];
    }
    const dist = s.player.position.distanceTo(s.world.station.position);
    if (dist > DOCK_COMPUTER_RANGE) {
      return [say('STATION OUT OF RANGE', 3), REFUSED];
    }
    const on = !s.session.dcEngaged;
    s.session.dcEngaged = on;
    s.dockPlan.phase = 'gate'; // fresh approach each time it's engaged
    const events: AutopilotEvent[] = [
      say(on ? 'DOCKING COMPUTER ENGAGED' : 'DOCKING COMPUTER OFF', 2),
    ];
    if (on) events.push({ kind: 'sound', name: 'dockingComputerEngaged' });
    events.push({ kind: 'dockingMusic', on });
    return events;
  }

  /**
   * How far the commander is from the station, for the station's truce
   * (`truceHolds`, law.ts).
   *
   * ONE home for it in this file. All three combat members ask the same
   * question: the engage key, the brain co-pilot and the scripted one. A
   * co-pilot that fought a ship the engage key called absent would be the
   * defect docs/TODO/158 is about, put back one layer up.
   */
  private get playerToStation(): number {
    return this.state.player.position.distanceTo(this.state.world.station.position);
  }

  /**
   * The combat computer, on or off.
   *
   * It refuses to engage with nothing to fight, and that is not a limitation.
   * The policy trained to fly a defence. In an empty sky it would merely hold
   * the ship, while the player wondered why the controls felt odd.
   */
  toggleCombat(): AutopilotEvent[] {
    const s = this.state;
    if (!s.commander.equipment.combatComputer) {
      return [say('NO COMBAT COMPUTER FITTED', 3), REFUSED];
    }
    if (s.session.ccEngaged) {
      s.session.ccEngaged = false;
      return [say('COMBAT COMPUTER OFF', 2)];
    }
    if (!hostilesNear(
      s.world.npcs, s.player.position, s.commander.legalStatus, this.playerToStation)) {
      return [say('NO HOSTILES — COMBAT COMPUTER IDLE', 3), REFUSED];
    }
    // The LIVE BRAINS row can set the co-pilot to NONE outright. A refusal
    // here, in the row's own words, beats a pilot that engages and hands back
    // at once. That pilot reports an empty sky, and the sky is not empty.
    if (defenceBrainNameFor(s.brains) === 'scripted') {
      return [say('COMBAT COMPUTER SET TO NONE — SEE THE COMBAT TRAINER', 4), REFUSED];
    }
    s.session.ccEngaged = true;
    s.session.view = 0; // it aims the front laser
    return [
      say('COMBAT COMPUTER ENGAGED — ANY FLIGHT KEY OVERRIDES', 4),
      { kind: 'sound', name: 'combatComputerEngaged' },
    ];
  }

  /**
   * What the combat computer wants this frame, at the trader-Cobra dynamics it
   * trained in. Manual flight input disengages instantly.
   *
   * It only DECIDES: what comes back is a `FlightDemand` exactly like the one a
   * pair of hands produces, and the same `PlayerShip.update` flies it.
   *
   * @param handsOn the pilot has hold of the controls — always hands back.
   * @param brain the defence policy, or null if the weights failed to load.
   * @param missilePos the hostile warhead's position, or null for a clear sky
   * — `Ordnance.hostileMissilePos`, passed through to the policy's eyes.
   */
  combatDemand(
    dt: number, handsOn: boolean, brain: Brain | null,
    missilePos: V3 | null = null,
  ): AutopilotDemand {
    const s = this.state;
    const step = this.computer.step(
      dt, s.player, s.sys, s.world.npcs, s.commander.legalStatus, handsOn, brain,
      missilePos, this.playerToStation);
    if (step.kind === 'disengage') {
      s.session.ccEngaged = false;
      return {
        demand: null,
        ecm: false,
        events: [say(step.reason, step.reason === 'MANUAL OVERRIDE' ? 2 : 3)],
      };
    }
    return { demand: step.demand, ecm: step.ecm, events: [] };
  }

  /**
   * The SCRIPTED combat computer: a pure-pursuit dogfighter at the stick of
   * your ship. scripted-co-pilot.ts decides. The Game flies the demand and
   * shoots.
   *
   * It takes the same engage key, the same manual override and the same
   * disengage words as the brain co-pilot. It returns a `FlightDemand` too, so
   * it shares the `AutopilotDemand` shape, and game.ts flies both the same way.
   *
   * Which of the two flies is the LIVE BRAINS selection. game.ts asks it
   * through `defenceBrainNameFor`.
   */
  combatSteer(dt: number, handsOn: boolean, missilePos: V3 | null): AutopilotDemand {
    const s = this.state;
    const step = this.scripted.step(
      dt, s.player, s.world.npcs, s.commander.legalStatus, handsOn, missilePos,
      this.playerToStation);
    if (step.kind === 'disengage') {
      s.session.ccEngaged = false;
      return {
        demand: null,
        ecm: false,
        events: [say(step.reason, step.reason === 'MANUAL OVERRIDE' ? 2 : 3)],
      };
    }
    return { demand: step.demand, ecm: step.ecm, events: [] };
  }
}
