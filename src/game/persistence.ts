// Writing the world down, and putting it back.
//
// `snapshot.ts` says what a save LOOKS like, `storage.ts` says where it lives,
// and this says how the running world turns into one and back.
//
// The pattern is the project's: a module decides, and the orchestrator applies.
// A restore is the one place that cannot be purely declarative. To put a world
// back means to REBUILD it, and a rebuild spawns ships, opens the station menu
// and rerolls a market. Those three reach outside the state, so they come in
// through `PersistenceHost` (below). That is exactly how the world step asks for
// its consequences through `StepHost`.
//
// TWO ORDERINGS ARE LOAD-BEARING and neither is obvious:
//
//   1. The galaxy is rebuilt BEFORE the ships are placed, because an NPC's
//      position is only meaningful against a station that exists.
//   2. `restoreRng` is LAST. Everything above it draws from the seeded stream:
//      buildWorld, enterWitchspace and enterDocked. The generator's *state* is
//      saved rather than its seed. That is what makes the next draw after a
//      reload the draw the run was about to make.
//
// This file is NOT in the `purity` list in test/run.ts and should not be: it
// reaches persistence through its host. Everything it does to the state,
// though, it does without a renderer.

import { generateGalaxy, type MarketEntry } from '../galaxy/galaxy.ts';
import { LivingGalaxy } from '../galaxy/living.ts';
import type { Contract } from './commander.ts';
import type { PirateThreat } from './threat.ts';
import { CONSTRICTOR_SPEC, pirateSpecForTier, specForDesign } from './ship-specs.ts';
import type { NpcRole } from './ship-roles.ts';
import type { CombatComputer } from './combat-computer.ts';
import type { Ordnance } from './ordnance.ts';
import { rngState, restoreRng } from './rng.ts';
import {
  SNAPSHOT_VERSION, v3, q4, serialiseState, restoreState,
  type WorldSnapshot,
} from './snapshot.ts';
import { parseSnapshot } from './snapshot-parse.ts';
import type { GameState } from './state.ts';

/**
 * What restoring a world needs the orchestrator to do.
 *
 * Restore verbs, lifecycle questions, and the narrow persistence operations
 * that reach outside `GameState`. Those are the scene rebuild, the re-entry to
 * witch-space (which SPAWNS, and therefore draws), the mode machine and the
 * store. All four belong to the Game. It is still small enough for a test
 * fixture to own.
 */
export interface PersistenceHost {
  /** where the ship is right now — a snapshot records flight or docked */
  baseMode(): 'docked' | 'flight' | 'dead';
  /**
   * Put the ship into the restored mode. Clear the screen stack. Then open the
   * station, or hand the sky back. The mode machine has one writer, and it is
   * not this file.
   */
  enterMode(mode: 'docked' | 'flight'): void;
  /** rebuild the scene for the commander's current system */
  buildWorld(): void;
  /** back into mis-jump limbo — spawns Thargoids, so it DRAWS from the rng */
  enterWitchspace(): void;
  /** has the run ended? a dead commander's world must never be written */
  isDead(): boolean;
  /** something to say out loud */
  message(text: string, seconds: number): void;
  /**
   * The three writes, and they are three because a save says what it IS.
   *
   * `dock` is the checkpoint, taken at a dock and immediately before a launch.
   * `flight` is the ring that must never evict it. `named` is the one the player
   * asked for, and no automatic write can address it. The key shapes that make
   * the last sentence true belong to storage.ts.
   */
  writeDockSave(career: string, world: WorldSnapshot): boolean;
  writeFlightSave(career: string, world: WorldSnapshot): boolean;
  writeNamedSave(name: string, career: string, world: WorldSnapshot): 'ok' | 'full' | 'failed';
  /** The world this session resumes, if the save it booted from carries one. */
  bootWorld(): WorldSnapshot | null;
  /** Drop a career's in-flight ring — on docking, and on death. */
  clearFlightSaves(career: string): void;
  /**
   * Refuse save writes for a span, and return the keys a write would change.
   *
   * The storage implementation owns the guard; Persistence only needs this
   * narrow capability to restore a simulator entry without risking its career.
   */
  withoutSaving<T>(fn: () => T): { value: T; refused: string[] };
}

export class Persistence {
  private readonly state: GameState;
  private readonly ordnance: Ordnance;
  private readonly combatComputer: CombatComputer;
  private readonly host: PersistenceHost;

  constructor(
    state: GameState, ordnance: Ordnance,
    combatComputer: CombatComputer, host: PersistenceHost,
  ) {
    this.state = state;
    this.ordnance = ordnance;
    this.combatComputer = combatComputer;
    this.host = host;
  }

  /**
   * The whole world as plain data — see snapshot.ts.
   *
   * This is what lets a commander be saved anywhere rather than only at a
   * station. The station save is the commander alone. Mid-flight there is a
   * great deal more that matters.
   */
  capture(): WorldSnapshot {
    const s = this.state;
    return {
      version: SNAPSHOT_VERSION,
      mode: this.host.baseMode() === 'flight' ? 'flight' : 'docked',
      commander: structuredClone(s.commander),
      // `s.career` is NOT written down here. It is the record's, not the
      // world's — see snapshot.ts's header.
      galaxyState: s.living.save(),
      player: {
        pos: v3(s.player.position),
        quat: q4(s.player.quaternion),
        speed: s.player.speed,
        pitchRate: s.player.pitchRate,
        rollRate: s.player.rollRate,
      },
      systems: { ...s.sys },
      // Each object saves ITSELF: capture and restore living in different files
      // is precisely the failure this keeps having.
      npcs: s.world.captureNpcs(),
      canisters: s.world.cargo.capture(),
      encounterTimers: { ...s.encounterTimers },
      dockPlan: serialiseState(s.dockPlan as unknown as Record<string, unknown>),
      combatComputer: serialiseState(
        this.combatComputer.state as unknown as Record<string, unknown>),
      lastThreat: s.lastThreat ? { ...s.lastThreat } : null,
      ecmDetectedTimer: s.ecmDetectedTimer,
      // Which brains the NPCs fly. In the snapshot because it is state the step
      // READS: it must resume with the brains the run was made with, not the
      // shipped ones.
      brains: { ...s.brains },
      cheat: s.cheat,
      session: serialiseState(s.session as unknown as Record<string, unknown>),
      rng: rngState(),
      chartTarget: s.chart.targetIndex,
      chartCursor: [s.chart.cursorX, s.chart.cursorY],
      stationQuat: q4(s.world.station.quaternion),
      missiles: this.ordnance.capture((npc) => s.world.npcs.indexOf(npc)),
      market: structuredClone(s.market),
      hermitMarket: structuredClone(s.hermitMarket),
      contractOffers: structuredClone(s.contractOffers),
      targetLock: this.ordnance.targetLock
        ? s.world.npcs.indexOf(this.ordnance.targetLock) : -1,
      missileArmed: this.ordnance.armed,
    };
  }

  /**
   * Put the world back exactly as a snapshot found it.
   *
   * Order matters. The galaxy is rebuilt first, because an NPC is placed
   * relative to a station that must exist. The rng is restored LAST, so nothing
   * rebuilt along the way consumes from the stream the snapshot was about to
   * use.
   */
  restore(snap: WorldSnapshot): void {
    // THE DOOR (docs/TODO/94), and it is `snapshot-parse.ts`. It also RAISES a
    // save from an older build on the way through, so an old snapshot and an
    // invalid one are different things (docs/TODO/161).
    // Everything with an invariant is checked HERE, before a single field of
    // the live session moves, so a refusal costs nothing. That is the version,
    // the branded ids, the fleet indexes, and the bounds a rebuild would hang
    // on.
    //
    // `restoreSnapshot` is the console-harness and combat-trainer entry, and it
    // has no catch on purpose. A harness that hands over junk sees the throw,
    // and the session it interrupted is untouched. A trusted caller pays the
    // same toll: `capture()`'s own output parses by construction, and
    // `test/snapshot-parse.test.ts` holds that both ways.
    snap = parseSnapshot(snap);
    const s = this.state;
    s.commander = structuredClone(snap.commander);
    // `s.career` IS NOT TOUCHED HERE (docs/TODO/43). A restored world does not
    // change whose autosave group this session writes. `bootCareer()` decided
    // that at boot, from the record the save came off the shelf in. For a
    // snapshot handed straight to a running session — the combat trainer, or a
    // console harness — it is the career already in flight. A `snap.career`
    // assignment here would point an imported file's autosaves at the exporting
    // career instead. One home: the record.
    s.systems = generateGalaxy(s.commander.galaxy);
    s.living = new LivingGalaxy(s.systems);
    s.living.load(snap.galaxyState as Parameters<LivingGalaxy['load']>[0]);
    restoreState(s.session as unknown as Record<string, unknown>, snap.session);
    // A LOADED SAVE NEVER RESUMES A COUNTDOWN (docs/TODO/116). `session` is
    // walked generically, so the five seconds after `H` were saved along with
    // everything else. Load one of those, and the world step finished the jump a
    // moment later. It spent the fare and arrived somewhere the player never
    // chose. A save is a place and a moment. A jump nobody pressed is neither.
    // Back to the at-rest value `freshSession` starts at, and NOT
    // conditionally. That also repairs the saves already on the shelf. It means
    // a countdown that arrives as junk cannot be mistaken for a live one, and
    // the door leaves `session` opaque on purpose (snapshot.ts). The player
    // keeps their
    // decision either way: `chartTarget` is its own field, so `H` costs one
    // keystroke. In witch-space the same clear lands a ship its pilot controls,
    // still in limbo, with the escape jump one press away.
    s.session.hyperCountdown = -1;
    this.host.buildWorld();
    if (s.session.witchspace) this.host.enterWitchspace();

    s.player.position.set(...snap.player.pos);
    s.player.quaternion.set(...snap.player.quat);
    s.player.speed = snap.player.speed;
    s.player.pitchRate = snap.player.pitchRate;
    s.player.rollRate = snap.player.rollRate;
    // Straight across: `snap.systems` is a whole `ShipSystems`, every field of
    // it written by `capture()`.
    Object.assign(s.sys, snap.systems);

    // Which hull each ship gets is a GAME rule — the roster, the tier tables
    // and the Constrictor — so the World asks rather than deciding.
    //
    // THE SAVED DESIGN WINS. The combat trainer's hull picker puts any pirate
    // hull in the sky. So the roster row is looked up by the design the
    // snapshot recorded. That is the only lookup which cannot make what a ship
    // WAS and what it looks like disagree.
    //
    // The tier is what is left when that lookup MISSES. That happens when the
    // roster no longer flies that design in that role. A retired hull is the
    // case: the Asp Mk II came off the pirate list. So the tier is the answer
    // for a retired hull, and not legacy tolerance.
    this.ordnance.clear();
    s.world.restoreNpcs(snap.npcs, (n) => {
      if (n.state.isMissionTarget) return CONSTRICTOR_SPEC;
      const role = n.role as NpcRole;
      return specForDesign(role, n.designId)
        ?? (role === 'pirate'
          ? pirateSpecForTier(Number(n.state.threatTier ?? 0), n.seed) : undefined);
    });
    s.world.cargo.restoreAll(snap.canisters);
    this.ordnance.restoreAll(snap.missiles, (i) => s.world.npcs[i] ?? null);

    s.encounterTimers = { ...snap.encounterTimers };
    restoreState(s.dockPlan as unknown as Record<string, unknown>, snap.dockPlan);
    restoreState(
      this.combatComputer.state as unknown as Record<string, unknown>, snap.combatComputer);
    s.lastThreat = snap.lastThreat as PirateThreat | null;
    s.ecmDetectedTimer = snap.ecmDetectedTimer;
    s.chart.targetIndex = snap.chartTarget;
    [s.chart.cursorX, s.chart.cursorY] = snap.chartCursor;
    s.market = structuredClone(snap.market) as MarketEntry[];
    s.hermitMarket = structuredClone(snap.hermitMarket) as MarketEntry[];
    s.contractOffers = structuredClone(snap.contractOffers) as Contract[];
    this.ordnance.targetLock = snap.targetLock >= 0
      ? (s.world.npcs[snap.targetLock] ?? null) : null;
    this.ordnance.armed = snap.missileArmed;
    s.brains = { ...snap.brains };
    s.cheat = snap.cheat;
    s.world.station.quaternion.set(...snap.stationQuat);
    s.world.station.updateMatrixWorld(true);
    this.host.enterMode(snap.mode);

    // LAST: anything above that spawns or builds draws from the stream
    restoreRng(snap.rng);
  }

  /**
   * Restore while refusing every persistence write the rebuild may trigger.
   *
   * Returning the refused keys proves the guard was load-bearing to callers
   * such as the combat simulator, without making them know the storage module.
   */
  restoreWithoutSaving(snap: WorldSnapshot): string[] {
    return this.host.withoutSaving(() => this.restore(snap)).refused;
  }

  /**
   * Which career's autosaves this session writes. One home for the read.
   *
   * And one home for the VALUE, which is `SaveRecord.career`. `state.career` is
   * `bootCareer()`'s answer, read off the record this session booted from, and
   * never written again.
   *
   * Every automatic write below addresses a key built from it. So a second home
   * for it is data loss rather than untidiness: the loser of the two decides
   * where the bytes land.
   */
  private get career(): string {
    return this.state.career;
  }

  /**
   * The docked checkpoint: written on docking and immediately before launch,
   * and again whenever something at the station moves the career (a purchase).
   *
   * It is by construction the state you left the station in, which is what the
   * death rule leans on — see `Game.die`.
   */
  checkpoint(): boolean {
    if (this.host.isDead()) return false;
    try {
      return this.host.writeDockSave(this.career, this.capture());
    } catch {
      return false;   // a world that will not serialise must not take the tab down
    }
  }

  /**
   * Write the world down mid-flight. Cheap enough to do on a timer, because the
   * whole point is that closing the tab mid-fight is not punished.
   *
   * Into the RING, never over the docked checkpoint (decision 2): a quiet three
   * minutes of flying must not evict the station you came from.
   */
  autoSave(): void {
    if (this.host.isDead()) return;
    try {
      this.host.writeFlightSave(this.career, this.capture());
    } catch { /* see checkpoint() */ }
  }

  /**
   * Save under a name the player typed. It carries the world like every other
   * save, so a load never puts you somewhere you never went.
   */
  saveNamed(name: string): 'ok' | 'full' | 'failed' {
    try {
      return this.host.writeNamedSave(name, this.career, this.capture());
    } catch {
      return 'failed';
    }
  }

  /** The run just ended: the last twenty seconds of it are not a save. */
  forgetFlight(): void {
    this.host.clearFlightSaves(this.career);
  }

  /**
   * Pick up exactly where the last session stopped, mid-flight if that is
   * where it was.
   *
   * @returns false if there was nothing to resume, so the caller boots
   * normally at the station.
   */
  resume(): boolean {
    const snap = this.host.bootWorld();
    if (!snap) return false;
    try {
      // No version pre-check: `restore`'s parse boundary is the version rule's
      // one home, and the catch below already answers a refusal.
      this.restore(snap);
      if (snap.mode === 'flight') this.host.message('RESUMING FLIGHT', 3);
      return true;
    } catch {
      // a world that will not come back must never cost you the commander. It
      // is NOT deleted for it: the save is still the player's to look at.
      return false;
    }
  }
}
