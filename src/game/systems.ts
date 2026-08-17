// The commander's ship as a set of numbers: energy, shields, laser heat,
// cabin temperature — how they regenerate, and what a hit costs.
//
// Simulation, not presentation. No three.js: a hit needs to know only whether
// it came from in front.
//
// THE BANKS ARE 255-POINT POOLS AND WHOLE NUMBERS, because a fractional point
// is not something a 6502 byte can express. Every hit on them arrives as
// `PlayerPoolPoints` (damage-units.ts). The module that owns the rule mints the
// value, and there are two of those:
//
// - an NPC laser, through `gunnery.ts`'s `npcLaserDamageToPlayer`. That is the
//   shot's power, less this hull's armour, once;
// - a ram, a canister, the Coriolis wall or a warhead, through
//   `constants/impact.ts`.
//
// RECHARGE IS HARMLESS POLICY, and the rates are `constants/recharge.ts`. The
// pack gives each hull an `energyRechargeRating` and no clock. So what a rating
// is worth in seconds is a browser-game decision. It accumulates in whole
// sub-ticks rather than in a float sum, so 15, 60 and 144 Hz agree. The NPC
// banks run on that same clock. One piece of this could not move into the
// constants directory. It divides one rating by the Cobra's rating: see
// `ANCHOR_RECHARGE_RATING`.
//
// A snapshot's `systems` is a complete `ShipSystems` and is assigned straight
// across — no migration path. `test/damage-paths.test.ts` fails if the old
// rescaling names come back.

import { random } from './rng.ts';
import { LOW_ENERGY, MAX_ENERGY, MAX_SHIELD } from '../constants/pools.ts';
import {
  ENERGY_REGEN_FRACTION, ENERGY_UNIT_MULTIPLIER, SHIELD_REGEN,
} from '../constants/recharge.ts';
import { LASER_COOL_RATE, LASER_ENERGY_COST } from '../constants/player-gun.ts';
import { CABIN_TEMP_FATAL, CABIN_TEMP_LAG, SCOOP_RATE, SUN_HEAT_MAX, SUN_HEAT_START,
  SUN_SCOOP_RANGE } from '../constants/sun.ts';
import { BREAKABLE, CARGO_LOSS_CHANCE, EQUIPMENT_DAMAGE_CHANCE }
  from '../constants/hull-breach.ts';
import type { Equipment } from './commander.ts';
import { eliteARegenTicks, eliteATicksPerPoint } from './elite-a/combat-math.ts';
import type { PlayerPoolPoints } from './damage-units.ts';
import { COBRA_MK_3_HULL_ID, playerHull, type PlayerHullId } from './ship-identity.ts';

/** Everything about the ship that a fight changes. */
export interface ShipSystems {
  /** 0..MAX_ENERGY, a whole number — the last thing between you and an escape pod */
  energy: number;
  foreShield: number;
  aftShield: number;
  /**
   * Recharge's sub-second remainders, as whole ticks — see
   * ELITE_A_REGEN_TICKS_PER_SECOND. State, because a flight reloaded mid-tick
   * must recover at the same moment as the run it came from. One per pool: a
   * full pool banks nothing and a shared carry would throw away the others'.
   */
  foreShieldCarry: number;
  aftShieldCarry: number;
  energyCarry: number;
  /** 0..1; the gun cuts out at `LASER_CUTOUT` and cools at `LASER_COOL_RATE` */
  laserTemp: number;
  laserCooldown: number;
  /**
   * Seconds of `WRECK_BURST_GRACE` left, after the commander's own shot
   * destroyed a ship. Above zero, her beam registers nothing on a bystander.
   *
   * THE GUN'S THIRD CLOCK, and it is here because the other two are. The heat,
   * the cadence and this all describe what the trigger just did.
   * `regenerate` ticks all three in one place (docs/TODO/173).
   *
   * A version 3 snapshot carries no such field. `Persistence.restore` uses
   * `Object.assign` onto a `freshSystems()`, so an older save keeps the 0 here
   * rather than restoring `undefined`. That is why this needs no migration.
   */
  wreckGrace: number;
  /** 0..1; `CABIN_TEMP_FATAL` kills you */
  cabinTemp: number;
}

/**
 * You are down to your last bank. Three things happen at that point:
 *
 * 1. the shields no longer recover (below);
 * 2. the step flashes ENERGY LOW;
 * 3. the gauge's last segment goes red.
 *
 * ONE comparison, so all three arrive at the same point count. It is inclusive
 * because the shield cut-off already was. It is also the one of the three that
 * a fight can feel.
 */
export function energyLow(energy: number): boolean {
  return energy <= LOW_ENERGY;
}

/**
 * Whether the laser can fire. A shot may not take the bank below its one-point
 * reserve. This is the read half of the shot's energy cost
 * (constants/player-gun.ts). `combat.ts` asks this beside the heat gate and the
 * cadence gate. It spends with `spendLaserEnergy` only once the whole shot is
 * eligible.
 */
export function canAffordLaserShot(sys: Pick<ShipSystems, 'energy'>): boolean {
  return sys.energy - LASER_ENERGY_COST >= 1;
}

/**
 * Spend one laser shot's energy. The WRITE lives HERE because this file owns
 * the commander's pools (test/damage-paths.ts invariant 4). The E.C.M.'s price
 * sits beside its burst in ordnance.ts for the same reason.
 */
export function spendLaserEnergy(sys: ShipSystems): void {
  sys.energy -= LASER_ENERGY_COST;
}

/**
 * The recharge rating that `constants/recharge.ts`'s fractions were anchored
 * on. It is read from the catalogue rather than written as `1`. So a hull rated
 * 2 (the Fer-de-Lance) recovers twice as fast as the Cobra, whatever the
 * Cobra's own rating becomes.
 *
 * This is the one constant of this file's that did not move into
 * `src/constants/`. `playerHull` reaches a released hull through
 * `ship-identity.ts` and the Elite-A catalogue, and `src/constants/` may not
 * import anything. The constant stays where both halves are in scope — see
 * docs/TODO/completed/90-the-cleanup-list-tracks-every-constant-still-out-of-its-home.md.
 */
const ANCHOR_RECHARGE_RATING =
  playerHull(COBRA_MK_3_HULL_ID).energyRechargeRating;

export function freshSystems(): ShipSystems {
  return {
    energy: MAX_ENERGY,
    foreShield: MAX_SHIELD,
    aftShield: MAX_SHIELD,
    foreShieldCarry: 0,
    aftShieldCarry: 0,
    energyCarry: 0,
    laserTemp: 0,
    laserCooldown: 0,
    wreckGrace: 0,
    cabinTemp: 0,
  };
}

/**
 * Everything a station's engineers put right: full pools and a cold laser. One
 * home for "what full is". So a later rise in the pools cannot leave a dock
 * that hands back an under-filled ship.
 */
export function repairAtStation(sys: ShipSystems): void {
  const fresh = freshSystems();
  sys.energy = fresh.energy;
  sys.foreShield = fresh.foreShield;
  sys.aftShield = fresh.aftShield;
  sys.foreShieldCarry = 0;
  sys.aftShieldCarry = 0;
  sys.energyCarry = 0;
  sys.laserTemp = 0;
}

/**
 * How much damage this ship can absorb before energy reaches zero, in POOL
 * POINTS. It is one shield face plus the whole energy bank. It is both faces
 * for a commander who manoeuvres, so that hits land front and back.
 *
 * There is no multiplier into energy. The facing shield takes a hit, and the
 * remainder spills straight into the bank. So this is a plain sum, and the
 * balance harness reads it.
 */
export function durability(bothFaces = false): number {
  return (bothFaces ? MAX_SHIELD * 2 : MAX_SHIELD) + MAX_ENERGY;
}

/**
 * HOW MUCH OF THIS SHIP IS LEFT, 0..1 — both faces and the bank, over
 * everything they can hold.
 *
 * ONE HOME: it is the number a defence policy observes (`observeDefend` slot
 * 14), observed in two worlds (the trainer's `TargetShip` and the game's combat
 * computer). Written out twice it would drift. The policy would then fly out of
 * the distribution it was fitted in, and no gate would say so.
 */
export function poolsLeft(sys: ShipSystems): number {
  return (sys.foreShield + sys.aftShield + sys.energy) / durability(true);
}

/**
 * The ENERGY BANK alone, 0..1 — `observeDefend` slot 15, and the same one-home
 * argument as `poolsLeft`.
 *
 * It is separate from `poolsLeft`, because the bank is three things at once:
 *
 * 1. what the ship DIES at;
 * 2. what the shields will not recover past (`energyLow`);
 * 3. what the E.C.M. spends a quarter of.
 *
 * A full pair of shields hides an empty one.
 */
export function energyLeft(sys: ShipSystems): number {
  return sys.energy / MAX_ENERGY;
}

/**
 * Each shield FACE alone, 0..1 — `observeDefend` slots 27 and 28, same one-home
 * argument as the two above.
 *
 * The pair exists because `poolsLeft` hides the split. An attacker on your six
 * spends a different face from one head-on (`applyDamage`, `hitFromAhead`). So
 * "keep the good face toward him" is flyable only if the policy can see which
 * face is the good one.
 */
export function foreShieldLeft(sys: ShipSystems): number {
  return sys.foreShield / MAX_SHIELD;
}

export function aftShieldLeft(sys: ShipSystems): number {
  return sys.aftShield / MAX_SHIELD;
}

export interface DamageResult {
  /** the hit got past the shields to the hull */
  reachedHull: boolean;
  /** and should therefore roll to wreck a fitting */
  wreckedSomething: boolean;
  /** THIS hit emptied the bank — deliberately not "the bank is empty" */
  destroyed: boolean;
}

/**
 * Apply a hit of `damage` WHOLE POOL POINTS. The facing shield takes it first;
 * whatever is left comes straight out of energy.
 *
 * ARMOUR IS NOT APPLIED HERE. The flyable hull's per-hit armour comes off an
 * NPC LASER hit and nothing else. So the shot's own resolution subtracts it
 * once (`gunnery.ts` `npcLaserDamageToPlayer`), rather than every path into the
 * banks. A ram is not a laser, and it does not meet armour.
 *
 * @param fromFront the shot came from ahead — the caller works this out, since
 * only it knows the ship's orientation.
 * @param roll injectable randomness, so tests are deterministic.
 */
export function applyDamage(
  sys: ShipSystems,
  damage: PlayerPoolPoints,
  fromFront: boolean,
  roll: () => number = random,
): DamageResult {
  // A plain number from here on. What is LEFT of a hit after a shield ate some
  // of it is a remainder, not a fresh damage figure. A type of
  // `PlayerPoolPoints` here would let `applyDamage(sys, remaining, ...)`
  // compile somewhere else.
  let remaining: number = damage;
  if (fromFront) {
    const absorbed = Math.min(sys.foreShield, remaining);
    sys.foreShield -= absorbed;
    remaining -= absorbed;
  } else {
    const absorbed = Math.min(sys.aftShield, remaining);
    sys.aftShield -= absorbed;
    remaining -= absorbed;
  }
  let wreckedSomething = false;
  if (remaining > 0) {
    // Shield was already down: energy takes it, and the hit may wreck cargo or
    // a fitting. ONE ROLL PER HIT — see EQUIPMENT_DAMAGE_CHANCE for why the
    // chance belongs to the hit rather than to the number of points in it.
    sys.energy = Math.max(0, sys.energy - remaining);
    wreckedSomething = roll() < EQUIPMENT_DAMAGE_CHANCE;
  }
  // DESTROYED IS ABOUT THIS HIT, not `sys.energy <= 0`. The E.C.M. can empty
  // the bank without a hit. A hit that a full shield swallowed must not read as
  // a kill (docs/DAMAGE-PATHS.md, row 18).
  return { reachedHull: remaining > 0, wreckedSomething,
    destroyed: remaining > 0 && sys.energy <= 0 };
}

export interface RegenOptions {
  /** which of the 15 flyable hulls: it carries the recharge rating */
  shipId: PlayerHullId;
  /** an energy unit doubles the recharge rate */
  energyUnit: boolean;
}

/**
 * Energy points a second for this hull and fit. HARMLESS POLICY — see
 * ENERGY_REGEN_FRACTION.
 *
 * The hull's recharge rating and the energy unit each appear EXACTLY ONCE. So a
 * caller that also "helpfully" doubled one of them cannot apply it twice.
 */
export function energyRegenPerSecond(shipId: PlayerHullId, energyUnit: boolean): number {
  return MAX_ENERGY * ENERGY_REGEN_FRACTION
    * (playerHull(shipId).energyRechargeRating / ANCHOR_RECHARGE_RATING)
    * (energyUnit ? ENERGY_UNIT_MULTIPLIER : 1);
}

/**
 * One pool, advanced by a frame's worth of ticks.
 *
 * Integer arithmetic on purpose. A float `acc += dt` gives three different
 * answers to "ten seconds" at 15, 60 and 144 Hz. Each answer straddles the
 * moment a whole point is awarded (see ELITE_A_REGEN_TICKS_PER_SECOND).
 *
 * A full pool banks nothing, so a hit taken later does not come straight back.
 */
function recharge(
  value: number, carry: number, max: number, ratePerSecond: number, ticks: number,
): [number, number] {
  const period = eliteATicksPerPoint(ratePerSecond);
  if (period === 0 || value >= max) return [Math.min(value, max), 0];
  const carried = carry + ticks;
  const points = Math.floor(carried / period);
  const next = value + points;
  if (next >= max) return [max, 0];
  return [next, carried - points * period];
}

/** One frame of recharge: energy always, shields only once energy is healthy. */
export function regenerate(sys: ShipSystems, dt: number, opts: RegenOptions): void {
  sys.laserCooldown -= dt;
  sys.wreckGrace = Math.max(0, sys.wreckGrace - dt);
  sys.laserTemp = Math.max(0, sys.laserTemp - LASER_COOL_RATE * dt);
  const ticks = eliteARegenTicks(dt);
  [sys.energy, sys.energyCarry] = recharge(sys.energy, sys.energyCarry, MAX_ENERGY,
    energyRegenPerSecond(opts.shipId, opts.energyUnit), ticks);
  // shields only recover once energy is out of its last bank. A beaten ship
  // must disengage, and `energyLow` makes that the moment the console says so
  if (!energyLow(sys.energy)) {
    [sys.foreShield, sys.foreShieldCarry] =
      recharge(sys.foreShield, sys.foreShieldCarry, MAX_SHIELD, SHIELD_REGEN, ticks);
    [sys.aftShield, sys.aftShieldCarry] =
      recharge(sys.aftShield, sys.aftShieldCarry, MAX_SHIELD, SHIELD_REGEN, ticks);
  }
}

/**
 * Cabin temperature follows distance from the sun, and it lags behind.
 *
 * A sun-skim with scoops holds the ship in the hot zone on purpose. So the lag
 * is the mechanic: it gives you time to pull out. The ladder of distances this
 * walks, and what each rung buys, is `constants/sun.ts`.
 *
 * @returns true if the cabin is at a fatal temperature.
 */
export function updateCabinTemp(sys: ShipSystems, dt: number, sunDist: number): boolean {
  const target = Math.max(0, Math.min(1,
    (SUN_HEAT_START - sunDist) / (SUN_HEAT_START - SUN_HEAT_MAX)));
  sys.cabinTemp += (target - sys.cabinTemp) * Math.min(1, dt * CABIN_TEMP_LAG);
  return sys.cabinTemp >= CABIN_TEMP_FATAL;
}

/** Fuel taken on this frame, in tenths of a LY. Zero when the ship does not scoop. */
export function scoopFuel(
  dt: number, sunDist: number, hasScoops: boolean, fuel: number, maxFuel: number,
): number {
  if (!hasScoops || fuel >= maxFuel || sunDist >= SUN_SCOOP_RANGE) return 0;
  return Math.min(maxFuel - fuel, SCOOP_RATE * dt);
}


// --- what a hull hit costs you ---------------------------------------------

export type BreachLoss =
  | { kind: 'cargo'; commodity: number }
  | { kind: 'equipment'; key: keyof Equipment; name: string }
  | { kind: 'nothing' };

/**
 * A hull hit destroys a tonne of cargo, or knocks out a fitting.
 *
 * Mutates the commander. Returns what was lost so the Game can announce it —
 * and so the caller knows to disengage the combat computer if that was what
 * went.
 */
export function breachLoss(
  commander: { cargo: number[]; equipment: Equipment },
  rng: () => number,
): BreachLoss {
  const carried: number[] = [];
  commander.cargo.forEach((qty, i) => { if (qty > 0) carried.push(i); });
  const fittings = BREAKABLE.filter(([key]) => commander.equipment[key]);

  if (carried.length && (!fittings.length || rng() < CARGO_LOSS_CHANCE)) {
    const commodity = carried[Math.floor(rng() * carried.length)];
    commander.cargo[commodity] -= 1;
    return { kind: 'cargo', commodity };
  }
  if (fittings.length) {
    const [key, name] = fittings[Math.floor(rng() * fittings.length)];
    (commander.equipment as unknown as Record<string, boolean>)[key] = false;
    return { kind: 'equipment', key, name };
  }
  return { kind: 'nothing' };
}
