// What destruction leaves behind: whether the pilot got out, and what a mined
// rock pays.
//
// The rule that spends these is `Combat.wreck` and `Combat.destroy` in
// game/combat.ts. WHAT spills — the cargo list a wreck sheds, the ore list a rock
// yields — is `commodities.ts`. Those are the career's classes of the 1984 market
// table, and the bulletin board shares one of them. They therefore live with
// their class, and this file stays about the chances and the counts.

/**
 * How often the pilot punches out before the hull goes.
 *
 * It is per role, rather than one rate. A wily trader bails out more than twice
 * as often as a pirate or a hunter. A trade-lane kill therefore usually leaves a
 * capsule in the wreckage, and a fight with pirates usually does not. Both
 * figures are what shipped, and nothing records how somebody chose them. What can
 * be said is that the capsule is scoopable, so this rate is also how often a kill
 * leaves something worth a slow-down. `test/combat.test.ts` flies the real wreck
 * path over seeded kills. It holds each role's measured rate against its entry
 * here.
 */
export const ESCAPE_CHANCE = { trader: 0.45, other: 0.2 } as const;

/**
 * Canisters of ore that a mined asteroid yields: at least the first one, plus a
 * flat draw over the span. It is
 * `MINING_YIELD_MIN + randomInt(MINING_YIELD_SPAN)`, so one to three cans.
 *
 * There is ALWAYS at least one. The mining laser's whole promise is that a
 * destroyed rock pays. A rock that pays nothing reads as a fitting that does not
 * work, rather than as bad luck. The span is what makes a field of rocks a gamble
 * worth the flight, rather than a fixed wage. Only a commander with the mining
 * laser fitted gets any of it (`Combat.destroy`).
 */
export const MINING_YIELD_MIN = 1;
export const MINING_YIELD_SPAN = 3;

/**
 * Contraband canisters that a destroyed rock hermit scatters: a smuggler's den
 * that spills its stock.
 *
 * It is `HERMIT_CONTRABAND_MIN + randomInt(HERMIT_CONTRABAND_SPAN)`, so three to
 * six cans, drawn from `CONTRABAND` (constants/law.ts) — the illegal goods it
 * dealt in. There are always at least a few. To crack a hermit is a deliberate
 * job, because it is tougher than any hull (npc-energy.ts), so it has to pay like
 * one. What the cans hold is contraband, which is worth the carry only where you
 * can sell it: another hermit, if you can find one.
 */
export const HERMIT_CONTRABAND_MIN = 3;
export const HERMIT_CONTRABAND_SPAN = 4;
