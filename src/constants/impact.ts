// What everything that is NOT a laser costs — the one Harmless rule for it.
//
// HARMLESS POLICY, not an Elite-A fact. docs/DAMAGE-PATHS.md records it as ours.
// The pack tabulates registered laser hits only. It says nothing about a ram, a
// canister, a station wall, a warhead or an energy bomb. This file is the rule's
// only home. Nothing here may be presented as an Elite-A number.
//
// THE RULE: an impact costs a FIXED WHOLE NUMBER OF SOURCE POINTS. The rule
// states that number separately for a ship's energy bank and for the commander's
// pools. The impact spends it on whatever it hits, and it never asks what that
// is. There are two columns because the banks are not comparable. A ship
// carries 2-255 energy. The commander carries a 255-point shield face over a
// 255-point bank. The rule uses fixed points rather than a share of the target.
// So a hull's size is worth something. A 44-point scrape is a third of a
// Sidewinder's bank, and a sixth of an Anaconda's.
//
// The numbers are calibrated off the Cobra Mk III: 98 points of released energy,
// and one 255-point shield face. `test/damage-paths.test.ts` re-derives them from
// the catalogue, so a re-import that moves that bank fails the build. A `null`
// column means "there is no such path", and both spend functions in
// `game/impact-damage.ts` refuse it. The type system refuses it first. Each row
// states its severity in prose, and the test checks it.

/**
 * Every non-laser way anything in this game can be hurt, in points.
 *
 * The list is CLOSED. The inventory in docs/DAMAGE-PATHS.md has a row per entry,
 * and a new way to hurt something must be added here first.
 * `game/impact-damage.ts` turns a row into a branded, spendable number.
 */
export const IMPACT = {
  /**
   * You fly into something, or it flies into you.
   *
   * 44 to a ship: 45% of the 98-point Cobra anchor, so three rams kill an
   * unshielded one. 115 to the commander: the same 45% of the 255-point shield
   * face.
   */
  ram: { name: 'ram', ship: 44, commander: 115 },
  /**
   * A canister breaks on a hull that has no scoops fitted.
   *
   * 6% of the shield face: a nuisance, and seventeen of them to strip it. It
   * must stay a nuisance, because a flight through a wreck's cargo is how you
   * learn that you never bought the scoops.
   */
  canisterOnHull: { name: 'canister on the hull', ship: null, commander: 15 },
  /**
   * You bounce off the Coriolis, or you fluff the slot.
   *
   * 90% of the shield face, and none of the bank. A bad dock should cost a
   * shield, and a minute to wait for it back. It should not cost a hull breach.
   */
  stationScrape: { name: 'station scrape', ship: null, commander: 230 },
  /**
   * A missile warhead reaches what it homed on, ours or theirs.
   *
   * 250 to anything: one byte, less a margin. It flattens a full 255-point
   * shield face. It destroys every released build except the five heaviest of
   * the 260, which survive one at full energy by a sliver. The heaviest things
   * in the sky are the only ones that a missile does not simply delete.
   */
  warhead: { name: 'missile warhead', ship: 250, commander: 250 },
  /**
   * The energy bomb, on everything in range that is not a Thargoid.
   *
   * 255: the top of the byte scale, and above every released bank. Everything it
   * catches is therefore destroyed. It still spends through the same function as
   * every other hit, rather than as a special case.
   */
  energyBomb: { name: 'energy bomb', ship: 255, commander: null },
} as const;
