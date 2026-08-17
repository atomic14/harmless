// What destruction leaves behind: whether the pilot got out, how long their
// capsule is safe, and what a mined rock pays.
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
 * Seconds the commander's beam registers nothing on a bystander, counted from
 * the moment her own shot destroys a ship (GitHub #35).
 *
 * A **bystander** is a ship that `isHostileToPlayer` says is not already in the
 * fight. Only a ship that was minding its own business is covered, and that is
 * exactly what the report is about.
 *
 * The cause is measured. A pirate died at frame 525 of a held burst, and the
 * beam reached the Viper 900 units behind it at frame 540. That is 0.25
 * seconds, which is one pulse-laser cooldown. `traceShot` skips a dead ship at
 * once, and `Combat.wreck` despawns the hull in the same frame. So nothing
 * stands between the beam and whatever was behind the target (docs/TODO/173).
 *
 * The number is `POD_LAUNCH_GRACE`'s own second argument, which reads: *"a beam
 * laser fires 10 times a second, and a held trigger outlives the kill by about
 * a second."* That sentence is about the capsule AT the wreck. It is equally
 * true of the ship BEHIND the wreck. 1.0 is that second.
 *
 * **The distribution says the same thing.** Over 593 seeded kills with the
 * grace off, 12 melees turned a Viper hostile. Eleven of the twelve came AFTER
 * the kill, and every one of those landed between 0.25 and 1.00 seconds of it.
 * The twelfth came before the kill, and no grace covers that one.
 *
 * **A SPAN CANNOT DO BETTER THAN THE TRIGGER IT BETS ON.** With a half-second
 * trigger hold after the kill, this span leaves 1 stray of 593, which is that
 * twelfth. With a full-second hold it leaves 6, and four of those land in the
 * frame the span lapses. That is the probe's own release time rather than a
 * fact about players, so it does not argue for a longer number. A longer one
 * also blinds a commander who WANTS the bystander gone.
 *
 * **The station truce widens the cover, and it is consistent rather than a
 * fault.** Inside `STATION_TRUCE` an unprovoked pirate is not hostile, so the
 * grace covers it too. Out at the witchpoint a queue of pirates costs nothing at
 * all. The second of two died 4.38 seconds after the first, with this span off
 * and on alike. Near the port the same measurement reads 4.38 against 5.13.
 *
 * It has its own rule id. It shares the value 1.0 with `PURSUIT_CLOSE_GAIN` and
 * four others in the catalogue. None of them is a span of seconds, and none
 * moves with this.
 *
 * @rule wreck.wreckBurstGrace
 */
export const WRECK_BURST_GRACE = 1.0;

/**
 * Seconds a fresh capsule cannot be shot, counted from the moment it launches
 * (GitHub #28).
 *
 * A capsule appears AT the wreck, which is the one place the gun is certainly
 * already pointed. So the shot that killed the ship killed the pilot too, and
 * the commander never chose it. This is the grace that makes it a choice.
 *
 * The number comes from the two rules it sits between. A capsule drifts at 40 to
 * 70 units a second (`CargoField.spawnCapsule`). It leaves the graze cone once
 * it is more than `POD_GRAZE` — 16 units — off the line of fire. The worst
 * lateral case is therefore 16/40, which is 0.4 seconds. The rest is the
 * commander: a beam laser fires 10 times a second, and a held trigger outlives
 * the kill by about a second. 1.5 covers both, and it is short enough that a
 * commander who WANTS the capsule gone still gets it.
 *
 * It has its own rule id. It shares the value 1.5 with `DISREPUTE_DECAY`
 * (constants/character.ts). That one is a score a day rather than a span of
 * seconds. The two must stay free to move apart.
 *
 * @rule wreck.podLaunchGrace
 */
export const POD_LAUNCH_GRACE = 1.5;

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
 *
 * It has its own rule id. It is a count of CANISTERS, and `WRECK_BURST_GRACE`
 * above it is a span of seconds. Two values in one file that must stay free to
 * move apart is exactly the coincidence somebody tidies into a bug.
 *
 * @rule wreck.miningYieldMin
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
