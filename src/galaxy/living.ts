// The living galaxy — level 1 of a two-level simulation.
//
// The other 255 systems keep their trade up while you are docked, in a jump,
// or in a fight somewhere else. This layer models that abstractly and cheaply.
// A ship between systems is a record rather than an object. It becomes a real
// NPC only where it arrives in the system you are in. See game.ts
// populateSystem, and the arrivals it pulls from here.
//
// Erasable-TypeScript only, so no parameter properties and no enums. test/run.ts
// imports this module, and Node runs that file directly via
// --experimental-strip-types.
//
// Design notes:
//  - the 1984 seeded galaxy is the BASELINE. This layer stores only *deltas* —
//    recent price pressure and traffic events — so saves stay small and the
//    original determinism survives underneath
//  - it advances in whole days, on the same clock as the contract deadlines,
//    so it never needs a real-time tick
//  - everything here is pure data and maths: no three.js, no DOM

import { COMMODITIES, type StarSystem } from './galaxy.ts';
import { distanceTenths, daysForJump } from './navigation.ts';
import { makeRng, random } from '../game/rng.ts';
import {
  DANGER_DECAY, DANGER_VISIBLE, HEAT_DECAY, PRESSURE_DECAY, PREWARM_DAYS,
} from '../constants/living-galaxy.ts';
import { MAX_FUEL } from '../constants/commander.ts';

/** A trade run in flight between two systems. */
export interface Convoy {
  from: number;
  to: number;
  /** commodity index of the load */
  commodity: number;
  tonnes: number;
  /** day the convoy arrives */
  etaDay: number;
  /** false once pirates got it — arrivals of lost cargo never happen */
  intact: boolean;
}

/** Per-system state that drifts away from the 1984 baseline. */
export interface SystemState {
  /** price pressure per commodity, -1..1; positive = dearer than baseline */
  pressure: Float32Array;
  /** recent pirate activity, 0..1; raises encounter rates and prices */
  danger: number;
  /** convoys that landed here recently, for the flavour and the arrivals */
  recentArrivals: number;
  /** convoys lost en route to here recently */
  recentLosses: number;
  /**
   * 0..1 — how loud this region's talk about the player's cargo is. A big or
   * contraband load landed nearby raises it. It spreads to the jump-range
   * neighbours. A quiet spell decays it. Word of mouth, essentially.
   */
  heat: number;
}

export interface GalaxyStateSave {
  day: number;
  convoys: Convoy[];
  /** sparse: only the systems that drifted from the baseline */
  systems: Record<number, { pressure: number[]; danger: number; arrivals: number; losses: number; heat?: number }>;
}

/**
 * One pressure slot per commodity — the length of every saved pressure array.
 *
 * DERIVED from `COMMODITIES.length`, and not transcribed. It cannot move to
 * src/constants/, because that home may not import the table it is the length
 * of. So it stays here, as a named entry on the constants gate. See
 * docs/TODO/completed/90-constants-cleanup.md, Blocked.
 */
const COMMODITY_COUNT = COMMODITIES.length;

/**
 * The galaxy ticks on the world's seeded stream by default. An explicit rng
 * still works, as test/campaign.ts shows. That is how the balance harness
 * stays reproducible on its own seed.
 */
const defaultRng = (): number => random();

export class LivingGalaxy {
  readonly states = new Map<number, SystemState>();
  convoys: Convoy[] = [];
  day = 0;

  private readonly systems: StarSystem[];
  /**
   * Each system's plausible trading partners, precomputed.
   *
   * A ship has the same 7 LY jump range the commander's tank enforces
   * (`MAX_FUEL`, in tenths). So trade is inherently local. A uniform sample
   * across 256 systems would scatter the convoys. Lanes are what makes some
   * routes rich and others dangerous.
   */
  private readonly neighbours: number[][];

  constructor(systems: StarSystem[]) {
    this.systems = systems;
    this.neighbours = systems.map((sys) =>
      systems
        .map((other) => ({ index: other.index, d: distanceTenths(sys, other) }))
        .filter((x) => x.index !== sys.index && x.d > 0 && x.d <= MAX_FUEL)
        .sort((a, b) => a.d - b.d)
        .slice(0, 10)
        .map((x) => x.index));
  }

  state(index: number): SystemState {
    let s = this.states.get(index);
    if (!s) {
      s = {
        pressure: new Float32Array(COMMODITY_COUNT),
        danger: 0,
        recentArrivals: 0,
        recentLosses: 0,
        heat: 0,
      };
      this.states.set(index, s);
    }
    return s;
  }

  /**
   * How much a system's economy wants a commodity: negative where it is
   * produced (an industrial world makes computers), positive where it is
   * consumed. It reads the original's price gradient, so it agrees with the
   * market model rather than works against it.
   */
  private demand(sys: StarSystem, gradient: number): number {
    // gradient > 0 → dearer at agricultural (high economy index) worlds
    const bias = gradient > 0 ? sys.economy : 7 - sys.economy;
    return (bias - 3.5) / 3.5; // -1..1
  }

  /**
   * Advance the abstract galaxy by whole days. Called whenever the player's
   * clock moves (hyperspace jumps, rescues) — never per frame.
   */
  advance(days: number, gradients: number[], rng: () => number = defaultRng): void {
    for (let d = 0; d < days; d++) {
      this.day += 1;

      // 1. deliver or lose convoys that are due
      const remaining: Convoy[] = [];
      for (const c of this.convoys) {
        if (c.etaDay > this.day) {
          remaining.push(c);
          continue;
        }
        const dest = this.state(c.to);
        if (c.intact) {
          // supply arrives: prices at the destination ease
          dest.pressure[c.commodity] -= 0.05 * c.tonnes / 10;
          dest.recentArrivals += 1;
          // and the source shipped its surplus away
          this.state(c.from).pressure[c.commodity] += 0.03 * c.tonnes / 10;
        } else {
          // the cargo never came: scarcity, and a nervous reputation
          dest.pressure[c.commodity] += 0.08 * c.tonnes / 10;
          dest.recentLosses += 1;
          // How much a loss damages a system's standing depends on how well
          // policed it is. An anarchy takes the full hit. A corporate state
          // shrugs it off. Otherwise a busy, well-governed hub would gather
          // danger purely from its traffic volume.
          const lawlessness = (7 - this.systems[c.to].government) / 7;
          dest.danger = Math.min(1, dest.danger + 0.22 * lawlessness);
          // raiders work a route, so the origin gets a milder reputation hit
          const src = this.state(c.from);
          src.danger = Math.min(1, src.danger + 0.08 * ((7 - this.systems[c.from].government) / 7));
        }
      }
      this.convoys = remaining;

      // 2. new convoys depart, at a rate set by productivity and safety
      for (const sys of this.systems) {
        const st = this.state(sys.index);
        const traffic = (sys.productivity / 60000) * (1 - st.danger * 0.6);
        if (rng() > traffic) continue;

        const dest = this.pickTradePartner(sys, rng);
        if (dest === null) continue;
        const commodity = this.pickExport(sys, gradients, rng);
        const tonnes = 5 + Math.floor(rng() * 25);
        const distDays = daysForJump(distanceTenths(sys, this.systems[dest]));

        // does it survive the trip? lawless space eats convoys
        const risk = Math.min(0.5,
          (7 - this.systems[dest].government) * 0.035 + this.state(dest).danger * 0.2);
        this.convoys.push({
          from: sys.index,
          to: dest,
          commodity,
          tonnes,
          etaDay: this.day + distDays,
          intact: rng() > risk,
        });
      }

      // 3. everything decays back toward the 1984 baseline
      for (const [index, st] of this.states) {
        for (let i = 0; i < COMMODITY_COUNT; i++) {
          st.pressure[i] *= 1 - PRESSURE_DECAY;
          if (Math.abs(st.pressure[i]) < 0.002) st.pressure[i] = 0;
        }
        // well-policed systems recover their reputation faster
        const order = (this.systems[index].government + 1) / 8;
        st.danger = Math.max(0, st.danger - DANGER_DECAY * (0.5 + order * 1.5));
        st.recentArrivals = Math.max(0, st.recentArrivals - 0.5);
        st.recentLosses = Math.max(0, st.recentLosses - 0.5);
        // gossip fades faster than a reputation for piracy does
        st.heat = Math.max(0, st.heat - HEAT_DECAY);
      }

      // keep the convoy list bounded however long the player plays
      if (this.convoys.length > 400) this.convoys = this.convoys.slice(-400);
    }
  }

  /** A plausible partner: inside jump range, and short of what we have. */
  private pickTradePartner(sys: StarSystem, rng: () => number): number | null {
    const options = this.neighbours[sys.index];
    if (!options.length) return null;
    let best: number | null = null;
    let bestScore = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      const cand = this.systems[options[Math.floor(rng() * options.length)]];
      const dist = distanceTenths(sys, cand);
      // trade flows between unlike economies, and toward wealth
      const contrast = Math.abs(cand.economy - sys.economy) / 7;
      const score = contrast * (cand.productivity / 40000) * (1 - dist / 100) * (0.6 + rng() * 0.8);
      if (score > bestScore) {
        bestScore = score;
        best = cand.index;
      }
    }
    return best;
  }

  /** What this system sends out: whatever its economy makes cheaply. */
  private pickExport(sys: StarSystem, gradients: number[], rng: () => number): number {
    let best = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < COMMODITY_COUNT; i++) {
      const score = -this.demand(sys, gradients[i]) + rng() * 0.4;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  /**
   * Price multiplier for a commodity here, from accumulated pressure.
   * Deliberately gentle (±25%) — the 1984 economy stays recognisable.
   */
  priceMultiplier(systemIndex: number, commodity: number): number {
    const st = this.states.get(systemIndex);
    if (!st) return 1;
    return 1 + Math.max(-0.25, Math.min(0.25, st.pressure[commodity]));
  }

  /** Extra pirate presence here, 0..1, from convoy losses. */
  danger(systemIndex: number): number {
    return this.states.get(systemIndex)?.danger ?? 0;
  }

  /** How loud this region's talk about the player is, 0..1. */
  notoriety(systemIndex: number): number {
    return this.states.get(systemIndex)?.heat ?? 0;
  }

  /**
   * Word gets around. A fat or dirty cargo landed here raises the player's
   * profile here, and more faintly everywhere within a jump. That is why a
   * contraband run makes the *next* system's reception worse rather than this
   * one's.
   *
   * It reads the same jump-range neighbour lists as trade. So heat travels
   * along the routes that really connect the systems.
   */
  addNotoriety(systemIndex: number, amount: number): void {
    if (amount <= 0) return;
    const here = this.state(systemIndex);
    here.heat = Math.min(1, here.heat + amount);
    for (const n of this.neighbours[systemIndex] ?? []) {
      const st = this.state(n);
      st.heat = Math.min(1, st.heat + amount * 0.35);
    }
  }

  /** Convoys due to arrive in this system within the next day or so. */
  imminentArrivals(systemIndex: number): Convoy[] {
    return this.convoys.filter((c) => c.to === systemIndex && c.intact && c.etaDay <= this.day + 1);
  }

  /** One line of news for the system data screen, or ''. */
  headline(systemIndex: number): string {
    const st = this.states.get(systemIndex);
    if (!st) return '';
    if (st.recentLosses >= 2) return 'Trade convoys have been lost to pirates recently.';
    // The same threshold the charts ring in red (galaxy/danger-overlay.ts):
    // a system cannot be reported dangerous here and unmarked there.
    if (st.danger > DANGER_VISIBLE) return 'Merchants report heavy pirate activity in this system.';
    if (st.recentArrivals >= 3) return 'The docks are busy with incoming trade.';
    let dearest = -1;
    let worst = 0.08;
    for (let i = 0; i < COMMODITY_COUNT; i++) {
      if (st.pressure[i] > worst) {
        worst = st.pressure[i];
        dearest = i;
      }
    }
    if (dearest >= 0) return `Shortages have pushed prices up in this system.`;
    return '';
  }

  // --- persistence ---------------------------------------------------------

  save(): GalaxyStateSave {
    const systems: GalaxyStateSave['systems'] = {};
    for (const [index, st] of this.states) {
      // NOT rounded. Rounding for compactness quantises the simulation, so a
      // reload lands on a NEARBY galaxy rather than the same one and every
      // subsequent day diverges.
      const pressure = Array.from(st.pressure);
      // Skip only a system that is REALLY untouched. The test covers the
      // arrivals and the losses counters too. Without them, a system with a
      // convoy history but no price pressure yet loses that history on every
      // save.
      const untouched = !pressure.some((p) => p !== 0)
        && st.danger === 0 && st.heat === 0
        && st.recentArrivals === 0 && st.recentLosses === 0;
      if (untouched) continue;
      systems[index] = {
        pressure,
        danger: st.danger,
        arrivals: st.recentArrivals,
        losses: st.recentLosses,
        heat: st.heat,
      };
    }
    return { day: this.day, convoys: this.convoys, systems };
  }

  /**
   * Put a saved galaxy back.
   *
   * EVERY FIELD DEFAULTS, and none of it is a migration. `save()` writes all
   * five for every system it keeps. What arrives short is an IMPORTED FILE,
   * whose `galaxyState` is `unknown` JSON that a human can hand us.
   *
   * The defaults belong to that boundary, and they are uniform on purpose. A
   * system this loader cannot read a number for is a system at rest. It is
   * never a `NaN` that compounds through every later day.
   */
  load(data: GalaxyStateSave | undefined): void {
    if (!data) return;
    this.day = data.day ?? 0;
    this.convoys = Array.isArray(data.convoys) ? data.convoys : [];
    this.states.clear();
    for (const [key, s] of Object.entries(data.systems ?? {})) {
      const st = this.state(Number(key));
      if (Array.isArray(s.pressure)) st.pressure.set(s.pressure.slice(0, COMMODITY_COUNT));
      st.danger = s.danger ?? 0;
      st.recentArrivals = s.arrivals ?? 0;
      st.recentLosses = s.losses ?? 0;
      st.heat = s.heat ?? 0;
    }
  }
}

/**
 * Give a fresh galaxy a past: `PREWARM_DAYS` of trade before anybody watched
 * (docs/TODO/117).
 *
 * The simulation used to start when the player did. A new commander opened the
 * chart and saw a still galaxy, because day 0 is the honest truth about a
 * galaxy that never traded. This is the one place the number is spent, so the
 * game and the balance harness cannot disagree about what "a new galaxy" means.
 *
 * ONLY where there is no saved galaxy to load. The warmed deltas are ordinary
 * saved state from the first checkpoint on. So a reload resumes THIS galaxy,
 * rather than warms a second one on top of it.
 *
 * A DERIVED stream, never the world's. Invariant 11 protects determinism per
 * seed, and `makeRng` keeps it. A spend from the world's stream at boot would
 * shift every draw after it. That would move the seeded pins that hold the
 * rest of the game still. It would buy a galaxy no more repeatable than this
 * one. The caller supplies the seed, so one seed still means one galaxy
 * at the start.
 */
export function prewarm(living: LivingGalaxy, seed: number): void {
  living.advance(PREWARM_DAYS, COMMODITIES.map((c) => c.gradient), makeRng(seed));
}
