// The living galaxy — level 1 of a two-level simulation.
//
// While you are docked, jumping, or fighting somewhere else, the other 255
// systems keep trading. This layer models that abstractly and cheaply:
// ships between systems are records, not objects, and only materialise as
// real NPCs when they arrive in the system you happen to be in
// (see game.ts populateSystem / the arrivals it pulls from here).
//
// Erasable-TypeScript only (no parameter properties/enums): this module is
// imported by test/run.ts, which Node runs directly via
// --experimental-strip-types.
//
// Design notes:
//  - the 1984 seeded galaxy is the BASELINE; this layer stores only *deltas*
//    (recent price pressure, traffic events), so saves stay small and the
//    original determinism survives underneath
//  - it advances in whole days, driven by the same clock as contract
//    deadlines, so it never needs a real-time tick
//  - everything here is pure data + maths: no three.js, no DOM

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
  /** commodity index being carried */
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
  /** convoys that have arrived here recently (for flavour + arrivals) */
  recentArrivals: number;
  /** convoys lost en route to here recently */
  recentLosses: number;
  /**
   * 0..1 — how loudly this region is talking about the player's cargo. Raised
   * by landing big or contraband loads nearby, spread to jump-range
   * neighbours, and decayed by lying low. Word of mouth, essentially.
   */
  heat: number;
}

export interface GalaxyStateSave {
  day: number;
  convoys: Convoy[];
  /** sparse: only systems that have drifted from baseline */
  systems: Record<number, { pressure: number[]; danger: number; arrivals: number; losses: number; heat?: number }>;
}

/**
 * One pressure slot per commodity — the length of every saved pressure array.
 *
 * DERIVED from `COMMODITIES.length`, not transcribed. It cannot move to
 * src/constants/ (the home may not import the table it is the length of), so it
 * stays here as a named entry on the constants gate — see
 * docs/TODO/completed/90-constants-cleanup.md, Blocked.
 */
const COMMODITY_COUNT = COMMODITIES.length;

/**
 * The galaxy ticks on the world's seeded stream by default. Passing an rng
 * explicitly (as test/campaign.ts does) still works and is how the balance
 * harness stays reproducible on its own seed.
 */
const defaultRng = (): number => random();

export class LivingGalaxy {
  readonly states = new Map<number, SystemState>();
  convoys: Convoy[] = [];
  day = 0;

  private readonly systems: StarSystem[];
  /**
   * Each system's plausible trading partners, precomputed. Ships have the same
   * 7 LY jump range the commander's tank enforces (`MAX_FUEL`, in tenths), so
   * trade is inherently local — sampling uniformly across 256 systems would
   * scatter convoys instead of forming lanes that make some routes rich and
   * others dangerous.
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
   * produced (industrial worlds make computers), positive where it is
   * consumed. Uses the original's price gradient, so this agrees with the
   * market model rather than fighting it.
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
          // and the source has shipped its surplus away
          this.state(c.from).pressure[c.commodity] += 0.03 * c.tonnes / 10;
        } else {
          // the cargo never came: scarcity, and a nervous reputation
          dest.pressure[c.commodity] += 0.08 * c.tonnes / 10;
          dest.recentLosses += 1;
          // How much a loss damages a system's reputation depends on how well
          // policed it is: an anarchy takes the full hit, a corporate state
          // shrugs it off — otherwise busy well-governed hubs accumulate
          // danger purely from traffic volume.
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

  /** A plausible partner: within jump range, and wanting what we have. */
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

  /** How loudly this region is talking about the player, 0..1. */
  notoriety(systemIndex: number): number {
    return this.states.get(systemIndex)?.heat ?? 0;
  }

  /**
   * Word gets around. Landing a fat or dirty cargo raises the player's profile
   * here and, more faintly, everywhere within a jump — which is why running
   * contraband makes the *next* system's reception worse rather than this one's.
   * Reuses the same jump-range neighbour lists as trade, so heat travels along
   * the routes that actually connect systems.
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
      // Skip only systems that are ACTUALLY untouched — including the arrivals
      // and losses counters, or a system with convoy history but no price
      // pressure yet has that history dropped on every save.
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
   * five for every system it keeps; what arrives short is an IMPORTED FILE,
   * whose `galaxyState` is `unknown` JSON a human can hand us. The defaults are
   * that boundary's, uniform on purpose: a system this loader cannot read a
   * number for is a system at rest, never a `NaN` compounding through every
   * subsequent day.
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
 * Give a fresh galaxy a past: `PREWARM_DAYS` of trade before anyone was
 * watching (docs/TODO/117).
 *
 * The simulation used to start when the player did — a new commander opened the
 * chart and saw nothing moving, because day 0 is the honest truth about a
 * galaxy that has never traded. This is the one place the number is spent, so
 * the game and the balance harness cannot disagree about what "a new galaxy"
 * means.
 *
 * ONLY where there is no saved galaxy to load. The warmed deltas are ordinary
 * saved state from the first checkpoint on, so a reload resumes THIS galaxy
 * rather than warming a second one on top of it.
 *
 * A DERIVED stream, never the world's. Determinism per seed is what invariant
 * 11 protects and `makeRng` keeps it — but consuming the world's stream at boot
 * would shift every draw after it and move the seeded pins that hold the rest
 * of the game still, for a galaxy that is no more repeatable than this one.
 * The caller supplies the seed, so one seed still means one starting galaxy.
 */
export function prewarm(living: LivingGalaxy, seed: number): void {
  living.advance(PREWARM_DAYS, COMMODITIES.map((c) => c.gradient), makeRng(seed));
}
