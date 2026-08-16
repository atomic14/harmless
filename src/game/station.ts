// The station: arriving at one, leaving one, and the menu in between.
//
// `enterDocked` was a 66-line method of game.ts that did nine unrelated things
// in one breath. It reset the shields, handed over survivors, paid a fine and
// cleared the sky. It rolled a market, settled the work you were carrying and
// wrote the save. Then it shut the bay door and painted a menu. Half of them
// are consequences
// of docking, and half are the docked STATE being set up. None of them could be
// read without reading all of them.
//
// So it moved, with the two transitions that pair with it: `launch`, and the
// base screen the two of them switch between. The pattern is the project's.
// This decides and reports, as `StationEvent`s the Game says out loud. What it
// cannot own, it asks for through `StationHost`.
//
// TWO THINGS ARE DELIBERATELY NOT EVENTS, and both for the same reason
// (game/rng.ts). `populateSystem` and the Navy mission step DRAW from the
// seeded stream. A draw moved across a branch would change every seeded outcome
// after it. So they are direct host calls, made at exactly the point they were
// made before. The four draws in a dock happen in the order the stream saw
// them: the mission's target, the market's seed, then the offers.
//
// A RESUMED DOCK IS THE ONE PLACE TWO OF THOSE DRAWS DO NOT HAPPEN. It is the
// exception that proves the rule rather than a hole in it. See
// `DockArrival` below. The stream a resume ends on is `snap.rng`, which
// `Persistence.restore` assigns on the line AFTER the one that reaches this
// method. So nothing downstream can observe whether the two rolls were made.
// Every other way onto the pad draws exactly what it drew before.
//
// What this file is NOT: it does not own the rules. The fine is law.ts, the
// market is contracts.ts, the mission is missions.ts, the save is storage.ts.

import * as THREE from 'three';
import { slotNormal } from '../world/slot.ts';

import type { StarSystem } from '../galaxy/galaxy.ts';
import { formatCredits } from './commander.ts';
import { LAUNCH_STANDOFF, LAUNCH_SPEED } from '../constants/station.ts';
import { generateContractOffers } from './contract-offers.ts';
import { makeLocalMarket } from './market.ts';
import { stepMissionAtDock, constrictorWarning } from './missions.ts';
import { ordersSummary, standingOrders } from './orders.ts';
import type { Command } from './controls.ts';
import type { Ordnance } from './ordnance.ts';
import { repairAtStation } from './systems.ts';
import type { GameState } from './state.ts';
import type { SoundEvent, SoundName } from './sounds.ts';

/**
 * How the ship came to be on the pad. Three ways in, and they differ.
 *
 * - `arrived` — you flew in. It is the whole transition. The flight it ended
 *   is forgotten, the checkpoint is written, the bay-door theatre plays, and
 *   the station rolls today's prices and bulletin board.
 * - `fresh` — a boot with nothing to resume, and the fallback of a respawn for
 *   a career that never docked. Nothing arrived, so there is no checkpoint and
 *   no theatre. But `freshState` leaves the market and the board EMPTY, and
 *   somebody has to stock them.
 * - `resumed` — a world came off the shelf, or out of the combat simulator's
 *   entry snapshot, and was stocked FROM it a few lines earlier. A roll here
 *   would overwrite what the restore just put back. That is docs/TODO/46: it
 *   made the market and the board rerollable by a reload, and rerollable ON
 *   DEMAND through the simulator. The player picks the simulator's seed, and
 *   its promise is that nothing which happens inside it leaves.
 *
 * The distinction the last two need is not "did we arrive", because neither
 * did. It is "is the state we are dressing already dressed", and only the
 * caller knows.
 */
export type DockArrival = 'arrived' | 'fresh' | 'resumed';

/** What the station reports for the orchestrator to say out loud. */
export type StationEvent =
  | SoundEvent
  /**
   * `queued` waits for the console rather than taking it — see session.ts.
   *
   * `command` points the line at the screen that holds the rest of it. It is a
   * `Command` rather than a letter, for the reason `game/prompts.ts` gives in
   * full. `controls.ts` is the one home of what key asks for what. A sentence
   * with a letter in it is therefore a help surface free to lie. The edge
   * renders it (`game.ts`, `keyPointer`).
   */
  | {
    kind: 'message'; text: string; seconds: number; queued?: boolean;
    command?: Command;
  }
  | { kind: 'persistence'; action: 'checkpoint' | 'forgetFlight' }
  | { kind: 'presentation'; action: 'releaseMouseFlight' }
  | { kind: 'presentation'; action: 'screen'; screen: 'docked' | 'hidden' }
  | { kind: 'presentation'; action: 'tunnel'; way: 'in' | 'out' };

/**
 * One console line. `command` points it at the screen that keeps what it says.
 *
 * A line said one time, for five seconds, is the whole of GitHub #27. The
 * commander briefed for the Constrictor could not read that briefing again
 * anywhere. Invariant 16 is the rule that came out of it.
 */
const say = (text: string, seconds: number, command?: Command): StationEvent =>
  ({ kind: 'message', text, seconds, command });

/**
 * ...and one said BEHIND the line it explains (session.ts).
 *
 * The console is one line. A line pushed with `say` TAKES it, so an
 * explanation said in the same breath as its cause deletes the cause.
 */
const later = (text: string, seconds: number): StationEvent =>
  ({ kind: 'message', text, seconds, queued: true });
const heard = (name: SoundName): StationEvent => ({ kind: 'sound', name });

/**
 * What docking and launching need the orchestrator to do.
 *
 * The mode machine and the operations that DRAW stay synchronous. Pointer
 * lock, bay-door theatre, screens, persistence and sound are returned events.
 * Everything else is a direct update to `GameState`.
 */
export interface StationHost {
  /** where the ship is — the base screen is the menu or the cockpit */
  baseMode(): 'docked' | 'flight' | 'dead';
  /** the mode machine has one writer, and it is the Game */
  setBaseMode(mode: 'docked' | 'flight'): void;
  /** point the nose down `dir` */
  lookAlong(dir: THREE.Vector3): void;
  /** the traffic you meet on the way out — DRAWS, so a call and not an event */
  populateSystem(situation: 'launch'): void;
  /**
   * Write the docked checkpoint NOW, before this method changes anything.
   *
   * A call and not an event because the ordering is the content: see `launch`.
   */
  checkpoint(): void;
  /** pay out and expire the work you were carrying, and say what it paid */
  settleContracts(): StationEvent[];
  /** the bulletin board's cursor lives on the contracts screen */
  resetContractSelection(): void;
}

export class Station {
  private readonly state: GameState;
  private readonly ordnance: Ordnance;
  private readonly host: StationHost;

  constructor(state: GameState, ordnance: Ordnance, host: StationHost) {
    this.state = state;
    this.ordnance = ordnance;
    this.host = host;
  }

  private get system(): StarSystem {
    return this.state.systems[this.state.commander.systemIndex];
  }

  /**
   * Down on the pad. `arrival` says which of the three ways in this is.
   *
   * Anything but `arrived` is a load path. The world blob is not cleared,
   * because there may not be one. None of the arrival theatre plays, because
   * nothing arrived.
   */
  dock(arrival: DockArrival = 'arrived'): StationEvent[] {
    const s = this.state;
    const c = s.commander;
    const arrived = arrival === 'arrived';
    // A resume was handed a market and a board; every other way in has to roll
    // one. See DockArrival.
    const stocked = arrival === 'resumed';
    // Direct platform effects used to happen during this method, and HUD
    // messages were applied only after it returned. The effects are returned
    // first and the messages second, which preserves that observable order.
    const effects: StationEvent[] = [{ kind: 'dockingMusic', on: false }];
    const messages: StationEvent[] = [];

    s.session.dcEngaged = false;
    this.host.setBaseMode('docked');
    // A dock supersedes the flight it ended. The in-flight ring left behind
    // meant a reload resumed a snapshot from BEFORE the dock. The cargo you
    // just sold was back in the hold, and the equipment you bought was gone.
    // The next dock wrote that rolled-back commander over the good one. It
    // cannot touch the docked checkpoint or a named save, which have different
    // ids (see save-file.ts).
    if (arrived) effects.push({ kind: 'persistence', action: 'forgetFlight' });
    s.world.clearNpcs();
    this.ordnance.clear();
    // Full pools and a cold laser. What "full" is belongs to systems.ts. This
    // used to say it in three assignments of its own, which is a second home
    // for the capacities the moment they change.
    repairAtStation(s.sys);
    s.session.hyperCountdown = -1;
    s.session.torusEngaged = false;
    s.session.ccEngaged = false;
    this.ordnance.armed = false;
    effects.push({ kind: 'presentation', action: 'releaseMouseFlight' });
    // ANYONE YOU PULLED OUT OF A CAPSULE IS NOT RESOLVED HERE any more. A dock
    // used to file them with station medical in the same breath as a reset of
    // the shields. There was no choice, no consequence and no payment, which
    // made the one genuinely moral act in the game free and meaningless.
    //
    // It is a forced question now (`screens/survivors.ts`, opened by
    // `enterDocked`), and the rule behind it is `game/survivors.ts`. The leak
    // this plugged is still plugged. The question cannot be escaped, so nobody
    // rides along for a career.

    // The record is NOT cleared on a dock any more. The station is a neutral
    // trading port. A fugitive may dock and trade, and a cleared record is a
    // choice: the `payFine` docked command (game.ts), not a toll on the door.
    s.session.policeScanned = false;
    s.session.defenceLaunched = false;
    s.session.view = 0;
    s.sys.cabinTemp = 0;
    s.session.witchspace = false;
    s.session.beaconTimer = -1;
    s.world.cargo.clear();
    // The Navy mission advances on docking. missions.ts owns the machine and
    // this owns the announcement, exactly as combat.ts announces the kill.
    // FIRST of the dock's rng draws — it picks the next target.
    for (const e of stepMissionAtDock(c, s.systems)) {
      if (e.kind === 'briefed') {
        // POINTED AT THE SCREEN THAT KEEPS IT (invariant 16). This line is
        // said one time, for five seconds, and it names no target system. On
        // its own it was the same as no briefing at all.
        messages.push(say('INCOMING NAVY TRANSMISSION', 5, 'openMissions'));
        // What the job NEEDS, and not just where it is. The Constrictor's
        // armour halves a player hit before its own defence subtracts. So a
        // beam laser does literally nothing to it, and the commander would
        // find that out forty light years from here.
        //
        // missions.ts derives the line from her actual fitted gun through the
        // oracle, and returns '' where the gun will do.
        //
        // QUEUED, because it explains the line above it. Said with `say`, it
        // took the console away from the transmission in the same frame. A
        // commander with the wrong gun then never saw the Navy call at all.
        // Found by docs/TODO/144 M3, and the rule is session.ts's own.
        const warning = constrictorWarning(c);
        if (warning) messages.push(later(warning, 8));
      }
      else if (e.kind === 'courierOrders') {
        messages.push(say(
          'NAVY: COURIER RUN — EXPECT THARGOID INTERFERENCE', 6, 'openMissions'));
      } else if (e.kind === 'delivered') {
        messages.push(say(
          `PLANS DELIVERED — ${formatCredits(e.payment)}, RIGHT ON COMMANDER`, 6));
      }
    }
    s.session.hermitTrading = false;
    // SECOND draw: the market's seed. It is skipped only for a `resumed` dock.
    // There, the restore two lines up assigned the market this would
    // overwrite, and the stream it draws from is replaced wholesale a line
    // later. So the skip moves no seeded outcome. THE ROLL STILL HAS ONE
    // HOME.
    if (!stocked) {
      s.market = makeLocalMarket(this.system,
        (i) => s.living.priceMultiplier(c.systemIndex, i));
    }
    for (const event of this.host.settleContracts()) {
      if (event.kind === 'message') messages.push(event);
      else effects.push(event);
    }
    // THIRD: the bulletin board, and the same rule for the same reason. This
    // is the half of docs/TODO/46 with teeth. A market rerolls prices, but a
    // board rerolls the WORK. The simulator let you ask for a new board as
    // often as you liked, and then persisted it at the next checkpoint.
    if (!stocked) {
      s.contractOffers = generateContractOffers(this.system, s.systems, c.day);
    }
    this.host.resetContractSelection();
    c.galaxyState = s.living.save();
    if (arrived) {
      // HALF of decision 1: the docked autosave is written on docking. The
      // other half is in `launch()`, and between them they are the checkpoint.
      //
      // ONLY ON A REAL ARRIVAL, and that is data loss rather than tidiness
      // (docs/TODO/43). A boot never docked. Nothing arrived, which is why none
      // of the theatre below plays either, and the world it holds CAME from a
      // save.
      //
      // A write back put the save you just loaded on top of
      // `save:auto:<career>:dock`. Pick a day-5 file out of the commander file.
      // The day-300 checkpoint the screen wrote to protect you was then gone
      // before the first frame, on one Enter and no confirmation.
      //
      // A boot now leaves the checkpoint exactly as it found it. The run you
      // stepped out of is still on the shelf, and still loadable.
      effects.push({ kind: 'persistence', action: 'checkpoint' });
      effects.push(
        { kind: 'dockingMusic', on: false },
        heard('dock'),
        heard('tunnel'),
        { kind: 'presentation', action: 'tunnel', way: 'in' },
      );
    }
    // park just outside the slot so the backdrop behind the menu is the station
    s.player.position.copy(s.world.spawnPosition);
    this.host.lookAlong(s.world.station.position.clone().sub(s.player.position));
    s.player.speed = 0;
    effects.push({ kind: 'presentation', action: 'screen', screen: 'docked' });
    return [...effects, ...messages];
  }

  /** Out of the slot, into policed traffic. */
  launch(): StationEvent[] {
    const s = this.state;
    // The OTHER half of decision 1. It is a host call rather than a returned
    // event, for one reason. It must observe the state you are leaving in.
    // Every event this method returns is applied after the ship sits 450 units
    // outside the slot at speed. This checkpoint is what the death rule leans
    // on, so it has to be the station rather than the first second of the
    // flight.
    this.host.checkpoint();
    const n = slotNormal(s.world.station);
    s.player.position.copy(s.world.station.position).addScaledVector(n, LAUNCH_STANDOFF);
    this.host.lookAlong(n);
    s.player.speed = LAUNCH_SPEED;
    this.host.setBaseMode('flight');
    s.session.view = 0;
    const effects: StationEvent[] = [
      { kind: 'presentation', action: 'screen', screen: 'hidden' },
    ];
    this.host.populateSystem('launch');
    effects.push(
      heard('launch'),
      heard('tunnel'),
      { kind: 'presentation', action: 'tunnel', way: 'out' },
    );
    return [...effects, say(`LEAVING ${this.system.name.toUpperCase()} STATION`, 3)];
  }

  /** Nothing on the screen stack: show the docked menu, or clear back to flight. */
  showBaseScreen(): StationEvent[] {
    if (this.host.baseMode() === 'docked') {
      return [{ kind: 'presentation', action: 'screen', screen: 'docked' }];
    }
    return [{ kind: 'presentation', action: 'screen', screen: 'hidden' }];
  }

  /**
   * The standing orders under the station menu's header, one line each.
   *
   * ONE ENTRY PER KIND. It used to return the first contract and stop. Two jobs
   * then hid the Navy mission completely, and the target system went with it
   * (GitHub #27). `orders.ts` owns the words, the sort and how many lines there
   * are. The two screens hold the detail these lines do not carry.
   */
  orderLines(): string[] {
    return ordersSummary(standingOrders(this.state.commander, this.state.systems));
  }
}
