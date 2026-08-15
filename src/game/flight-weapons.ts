// What the ship spends, and what it takes.
//
// A child of `flight.ts`, split from it by docs/TODO/155 M2 because the flight
// half reached 648 lines and five section headers — which is `tools/sizes.mjs`
// working as a detector rather than as a rule: a file rarely reaches 400 lines
// doing one thing, and that one was doing three.
//
// ONE RESPONSIBILITY: what the ship spends, and what it takes. The racks and
// the guns are the same subject read from both ends — a missile, a burst of
// E.C.M., a bomb, a tonne over the side and a trigger pull are what a commander
// SPENDS, and a hit on the hull is the bill. Both end in the same place, which
// is why they are one file: `applyCombat` below pays for either.
//
// `ordnance.ts` owns what a rack holds and what firing one costs, `combat.ts`
// resolves a hit, and `jettison.ts` decides what goes over the side first. This
// spends all three, and says what happened.
//
// IT DECIDES NOTHING ABOUT WHAT COMES NEXT. A death, an offence and a sound all
// leave through the host, because who dies and what the law thinks are the
// orchestrator's, two files up.

import * as THREE from 'three';
import { sfx } from '../audio.ts';
import { Combat, BEAM_FLASH, type CombatEvent, type DamageSource } from './combat.ts';
import { firePlayerLaser, damagePlayer } from './combat-player.ts';
import { CombatInstrumentation, type CombatObserver } from './instrumentation.ts';
import { fireEcm, ordnanceMessage, type Ordnance, type OrdnanceOutcome } from './ordnance.ts';
import { dealToNpc } from './damage-dealt.ts';
import { npcImpactDamage } from './impact-damage.ts';
import { IMPACT } from '../constants/impact.ts';
import { breachLoss } from './systems.ts';
import type { PlayerPoolPoints } from './damage-units.ts';
import { dumpCargo, dumpContraband } from './jettison.ts';
import { random } from './rng.ts';
import { COMMODITIES } from '../galaxy/galaxy.ts';
import type { CombatSim } from './combat-sim.ts';
import type { NpcShip } from './npc.ts';
import type { CockpitView } from './cockpit-view.ts';
import type { LawActions } from './law-actions.ts';
import type { SoundEvent } from './sounds.ts';
import type { GameState } from './state.ts';

/**
 * What spending and taking damage has to reach back for.
 *
 * EIGHT, and every one of them is a consequence that outlives the shot. What
 * the console says, what the law makes of it, whether the pilot is still alive,
 * and the two flashes the machine paints. None of them is this file's to
 * decide.
 */
export interface WeaponsHost {
  showMessage(text: string, seconds: number): void;
  /** a message event, said or queued as it asks */
  sayEvent(e: { text: string; seconds: number; queued?: boolean }): void;
  /** the one place a SoundEvent becomes a noise (sounds.ts) */
  playSound(e: SoundEvent): void;
  /** a shot at a trader is the law's business, not the gun's */
  raiseLegal(level: number): void;
  /** the hull is gone: what happens next is the career's, not the gun's */
  die(reason: string): void;
  /** the co-pilot's own record that the commander is being hit — see autopilot.ts */
  noteUnderFire(): void;
  flashDamage(): void;
  flashBomb(): void;
}

export class Weapons {
  private readonly state: GameState;
  /** the racks: missiles in flight, the E.C.M. and the energy bomb */
  private readonly ordnance: Ordnance;
  /** what the cockpit shows — the beams meet where a shot lands */
  private readonly cockpit: CockpitView;
  /** what the law does about what goes over the side */
  private readonly law: LawActions;
  /**
   * The exercise, which credits its own clone rather than the career.
   *
   * REACHED LAZILY, because the two are a cycle by construction: an exercise
   * runs the same gun the career does, so `CombatSim` takes this file's
   * `Combat` — and a kill inside an exercise has to be credited to the
   * exercise. A thunk is the smaller of the two evils; the alternative is a
   * second `Combat`, and then a shot would resolve differently in a trainer.
   */
  private readonly exercise: () => CombatSim;

  /** Resolving hits: shots, wrecks, bounties — see combat.ts. */
  private readonly combat: Combat;
  /** Explicit telemetry seam; absent during ordinary play. */
  private readonly instrumentation = new CombatInstrumentation();
  /** the shot's ray and scratch vectors, reused every trigger pull */
  private readonly combatScratch = {
    a: new THREE.Vector3(), b: new THREE.Vector3(),
    q: new THREE.Quaternion(), ray: new THREE.Raycaster(),
  };
  private readonly host: WeaponsHost;

  constructor(
    state: GameState, ordnance: Ordnance, cockpit: CockpitView, law: LawActions,
    exercise: () => CombatSim, host: WeaponsHost,
  ) {
    this.state = state;
    this.ordnance = ordnance;
    this.cockpit = cockpit;
    this.law = law;
    this.exercise = exercise;
    this.host = host;
    this.combat = new Combat(state.world);
  }

  /** The gun itself, because an exercise fires the career's own (combat-sim.ts). */
  get gun(): Combat { return this.combat; }

  /**
   * Observe live combat without replacing production methods.
   *
   * The returned disposer removes only this registration, so one recorder
   * stopping cannot detach another.
   */
  setCombatObserver(observer: CombatObserver | null): () => void {
    return this.instrumentation.setObserver(observer);
  }

  /** Ordnance sounds first, then says its semantic reply, as before extraction. */
  applyOrdnance(outcome: OrdnanceOutcome): void {
    for (const event of outcome.events) this.host.playSound(event);
    this.say(outcome.reply);
  }

  armMissile(): void {
    this.applyOrdnance(this.ordnance.arm(this.state.commander));
  }

  launchMissile(): void {
    this.applyOrdnance(this.ordnance.launch(
      this.state.commander, this.state.player.position));
  }

  disarmMissile(): void {
    if (!this.ordnance.targetLock && !this.ordnance.armed) return;
    this.ordnance.disarm();   // one home for "no lock, no pylon" — ordnance.ts
    this.host.showMessage('MISSILE DISARMED', 2);
    sfx.missileDisarmed();
  }

  triggerEcm(): void {
    // The burst and its price are `fireEcm` — one call, because the combat
    // computer presses the same button from `pilotDemand` and a training
    // episode's target presses it too (docs/TODO/72).
    this.applyOrdnance(fireEcm(this.state.commander, this.state.sys, this.ordnance));
  }

  detonateEnergyBomb(): void {
    const outcome = this.ordnance.detonateEnergyBomb(
      this.state.commander, this.state.player.position);
    this.applyOrdnance(outcome);
    if (outcome.reply !== 'bombFired') return;   // no bomb fitted: no flash either
    this.host.flashBomb();
    for (const npc of outcome.caught) {
      // The bomb is a stated `IMPACT` like every other non-laser source, spent
      // through the same `dealToNpc` — 255 points, above every released bank,
      // so everything it caught is gone.
      //
      // The two lines are the same pair as the step's: what it cost the ship,
      // then the kill. The bomb is the one damage path that never touches the
      // world step, so both are handed to a running exercise here.
      const hit = dealToNpc(
        npc, npcImpactDamage(IMPACT.energyBomb), this.state.player.position, 'bomb');
      this.exercise().playerDealt(hit.event);
      this.destroyNpc(npc);
    }
  }

  /** Ordnance reports what it did; saying it is ours. */
  say(reply: OrdnanceOutcome['reply']): void {
    if (!reply) return;
    const m = ordnanceMessage(reply);
    // A refusal with an answer names the COMMAND (ordnance.ts); the letter is
    // this side's business, from the same table the prompt line reads.
    const offer = m.offer ? this.cockpit.renderPrompt(m.offer) : null;
    this.host.showMessage(offer ? `${m.text} — ${offer}` : m.text, m.seconds);
  }

  /**
   * Dump a tonne over the side.
   *
   * WHY that buys a pirate off, and how much more an organised gang wants, is
   * `jettison.ts`'s opening — it said both first and says them better
   * (docs/TODO/153).
   *
   * @internal — driven by test/jettison.test.ts
   */
  jettisonCargo(tonnes = 1): void {
    this.law.throwOverboard(
      (cargo) => dumpCargo(cargo, tonnes), 'HOLD EMPTY');
  }

  /**
   * Dump a tonne of the ILLEGAL cargo — the evidence, not the profit.
   *
   * A KEY OF ITS OWN rather than a mode on the one above, and the reason is
   * that the two reach for opposite tonnes. Inside the window a police warning
   * opens, the key above throws the run's profit into space and leaves the
   * crime aboard. `dumpContraband` (jettison.ts) owns both orderings and the
   * price table that separates them.
   *
   * @internal — driven by test/jettison.test.ts
   */
  jettisonContraband(tonnes = 1): void {
    this.law.throwOverboard(
      (cargo) => dumpContraband(cargo, tonnes), 'NO CONTRABAND ABOARD');
  }

  /**
   * Pull the trigger. The arguments are built from the state by combat.ts, so
   * the same gun can be fired against a state that is not this Game's; what
   * lands on the HUD and in the law is what makes this one the Game's.
   *
   * @internal — driven by src/game/game.ts, which delegates to it.
   */
  fireLaser(): void {
    this.applyCombat(firePlayerLaser(this.state, this.combat, this.combatScratch));
  }

  /**
   * Destruction credited to the player.
   *
   * @internal — driven by src/game/game.ts, which delegates to it.
   */
  destroyNpc(npc: NpcShip): void {
    // The ENERGY BOMB reaches this from runCommand rather than through the step,
    // so it is the one kill an exercise cannot see through its own StepHost. An
    // exercise credits its clone and its record instead (see combat-sim.ts).
    if (this.exercise().active) { this.exercise().destroyNpc(npc); return; }
    this.applyCombat(this.combat.destroy(this.state.commander, npc));
  }

  /** Removal with no credit — an NPC-vs-NPC kill, or a collision. */
  wreckNpc(npc: NpcShip): void {
    this.applyCombat(this.combat.wreck(npc));
  }

  /**
   * The player takes a hit.
   *
   * `source` says what did it. Mechanics treat every source the same, but the
   * explicit CombatObserver seam records the fact without replacing this
   * method at runtime.
   */
  applyPlayerDamage(
    amount: PlayerPoolPoints, from: THREE.Vector3, source: DamageSource): void {
    // the co-pilot's own record that the commander is being hit, kept live end
    // to end so evasive behaviour can read it (scripted-co-pilot.ts)
    this.host.noteUnderFire();
    this.host.flashDamage();
    this.applyCombat(damagePlayer(this.state, this.combat, amount, from, this.combatScratch));
    this.instrumentation.playerDamaged(amount, from, source);
  }

  /**
   * Combat decides; this half pays. Every consequence that reaches outside the
   * world — the HUD, the law, the missile lock, the death screen — lands here.
   */
  applyCombat(events: readonly CombatEvent[]): void {
    for (const e of events) {
      if (e.kind === 'sound' || e.kind === 'countdown' || e.kind === 'dockingMusic') {
        this.host.playSound(e);
        continue;
      }
      switch (e.kind) {
        case 'message': this.host.sayEvent(e); break;
        case 'offence': this.host.raiseLegal(e.level); break;
        // Straight to the law rather than out through the host, and the
        // asymmetry with `offence` above is the reason: raising a record
        // launches the station's Vipers, which is the orchestrator's act. A
        // record worked off queues one console line and nothing else, so it
        // goes the way `throwOverboard` already does.
        case 'atonement': this.law.lowerLegal(e.role); break;
        case 'wrecked': if (this.ordnance.targetLock === e.npc) this.ordnance.targetLock = null; break;
        case 'beam': this.cockpit.aimBeams(e.at); break;
        case 'fired': this.state.session.beamTimer = BEAM_FLASH; break;
        case 'breach': this.damageSomething(); break;
        case 'died': this.host.die(e.reason); break;
      }
    }
  }

  /** A hull hit destroys a tonne of cargo, or knocks out a fitting. */
  damageSomething(): void {
    const lost = breachLoss(this.state.commander, random);
    if (lost.kind === 'cargo') {
      const c = COMMODITIES[lost.commodity];
      this.host.showMessage(`CARGO LOST: 1${c.unit} ${c.name.toUpperCase()}`, 3);
      sfx.cargoLost();
    } else if (lost.kind === 'equipment') {
      // Losing ANY fitting hands control back: a hit hard enough to knock out
      // equipment is a moment the player should be flying.
      this.state.session.ccEngaged = false;
      this.host.showMessage(`${lost.name} DESTROYED`, 4);
      sfx.equipmentDestroyed();
    }
  }
}
