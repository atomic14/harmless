// What everything that is NOT a laser costs — the one Harmless rule for it.
//
// HARMLESS POLICY, not an Elite-A fact, and recorded as ours in
// docs/DAMAGE-PATHS.md: the pack tabulates registered laser hits only, nothing
// for a ram, a canister, a station wall, a warhead or an energy bomb. This file
// is the rule's only home; nothing here may be presented as an Elite-A number.
//
// THE RULE: an impact costs a FIXED WHOLE NUMBER OF SOURCE POINTS, stated
// separately for a ship's energy bank and for the commander's pools, spent on
// whatever it hits without asking what that is. Two columns because the banks
// are not comparable (a ship carries 2-255 energy; the commander a 255-point
// shield face over a 255-point bank). Fixed points rather than a share of the
// target so a hull's size is worth something — a 44-point scrape is a third of a
// Sidewinder's bank and a sixth of an Anaconda's.
//
// Numbers are calibrated off the Cobra Mk III (98 points of released energy;
// one 255-point shield face) and re-derived from the catalogue by
// `test/damage-paths.test.ts`, so a re-import that moves that bank fails the
// build. A `null` column means "there is no such path" and both spend functions
// in `game/impact-damage.ts` refuse it (the type system first). Severity per row
// is stated in prose and checked in the test.

/**
 * Every non-laser way anything in this game can be hurt, in points.
 *
 * The list is CLOSED: the inventory in docs/DAMAGE-PATHS.md has a row per entry,
 * and a new way to hurt something must be added here first. `game/impact-damage.ts`
 * turns a row into a branded, spendable number.
 */
export const IMPACT = {
  /**
   * Flying into something, either way round.
   *
   * 44 to a ship: 45% of the 98-point Cobra anchor, so three rams kill an
   * unshielded one. 115 to the commander: the same 45% of the 255-point shield
   * face.
   */
  ram: { name: 'ram', ship: 44, commander: 115 },
  /**
   * A canister breaking on a hull with no scoops fitted.
   *
   * 6% of the shield face: a nuisance, seventeen to strip it — and it must stay a
   * nuisance, because flying through a wreck's cargo is how you learn you never
   * bought the scoops.
   */
  canisterOnHull: { name: 'canister on the hull', ship: null, commander: 15 },
  /**
   * Bouncing off the Coriolis, or fluffing the slot.
   *
   * 90% of the shield face and none of the bank: docking badly should cost a
   * shield and a minute waiting for it back, not a hull breach.
   */
  stationScrape: { name: 'station scrape', ship: null, commander: 230 },
  /**
   * A missile warhead reaching what it was homing on, ours or theirs.
   *
   * 250 to anything: one byte less a margin. It flattens a full 255-point shield
   * face and destroys every released build except the five heaviest of the 260,
   * which survive one at full energy by a sliver — the heaviest things in the sky
   * being the only ones a missile does not simply delete.
   */
  warhead: { name: 'missile warhead', ship: 250, commander: 250 },
  /**
   * The energy bomb, on everything in range that is not a Thargoid.
   *
   * 255: the top of the byte scale, above every released bank, so everything it
   * catches is destroyed — but spent through the same function as every other
   * hit rather than as a special case.
   */
  energyBomb: { name: 'energy bomb', ship: 255, commander: null },
} as const;
