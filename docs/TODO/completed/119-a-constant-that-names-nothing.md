# 119 — A constant that names nothing, and the exports around it

**Kind:** cleanup · **Severity:** low · **Size:** small
**Depends on:** none. Touches one constants file, one comment in
`game/break-off.ts`, two dead re-exports and nine visibility keywords.
**GitHub:** #7 — "Sweep the 128 unused exports".

## Why

Issue #7 counted 128 exported names in `src/` used nowhere outside their own
file and asked, in priority order, for exported constants nobody imports, dead
functions left by the decomposition, and types that could be local. It was
labelled **needs investigation** on purpose: the 128 was never a removal target.

The investigation put a tool on it. `npx knip@6` under the repo's real entry
points — the five HTML pages plus `test/`, `train/`, `tools/` and
`vite.config.ts` — and a second grep pass counting names absent from every other
file. **The count today is 106, and 83 of those are types.** Every one of the
23 types knip flags is used as a field or parameter type inside its own file;
none is dead. Issue #7's own guess about the bulk of the number was right.

That left seven real findings, and one of them is not a tidy-up.

**`BRAIN_HANDOVER_RANGE` named a rule the game does not have.**
`constants/attack-run.ts` documented 150 as "the range at which a trained pilot
stops flying its own policy and hands the ship over to the scripted break-off",
and `CATALOG.md` published it. Its only reader was `pirateBrainFor`'s
`guard:`, deleted on 2026-08-05 in `8ed705d` ("Scripted is the only opposition
— delete the trained pirate policies") along with the trained pirate weights.
Since then `brainFly` has had exactly two call sites — `npc.ts:729` and `:739`,
both in the armed-trader defence branch — and **neither carries a range guard**.
No shipped pilot hands over at any distance.

The constant surviving its behaviour was the cheap part. The expensive part was
that three pieces of prose went on asserting the handover as live: the constant's
own doc, the `describeFlight` header in `break-off.ts` ("a brain-flown ship's
tactic is dormant until it hands over at `BRAIN_HANDOVER_RANGE`") and the
matching comment in `test/break-off.test.ts`. A reader reaching for why a
brain-flown ship names no tactic was told a mechanism, and the mechanism was
gone. That is the defect; the unused export was only the symptom that found it.

## What was done

**Deleted, because nothing reads them:**

1. `BRAIN_HANDOVER_RANGE` (`constants/attack-run.ts`), with the file header
   rewritten and a note left in its place saying what the number was and when
   it stopped being true — the next person to wonder where the handover went
   should find the answer at the scene rather than in this file.
   `break-off.ts` and `test/break-off.test.ts` now say what is actually the
   case: a brain-flown ship never runs the attack-run machine, so its tactic is
   a plan it is not executing.
2. `chance()` and `pick()` (`game/rng.ts`) — no caller anywhere in `src/`,
   `test/`, `train/` or `tools/`. Convenience wrappers over `random()` and
   `randomInt()` that nothing ever reached for.
3. `export { COMMODITIES }` (`game/screens/trade.ts`), whose comment read
   "Re-exported so game.ts's jettison path keeps its commodity table" — and
   `game.ts:33` imports `COMMODITIES` straight from `galaxy/galaxy.ts`. The
   import it re-exported went with it; the file never used the value.
4. `export { sourceGeometryToWorld }` (`ships/registry.ts`), imported solely to
   be re-exported. Every consumer, `test/geometry.test.ts` included, takes it
   from `ships/elite-a-hulls.ts` — the owner named in `registry.ts`'s header.

**Made file-local**, keeping the declaration and its comment, since the only
thing being removed is a claim that someone outside might want it:
`galaxySeed` (`galaxy/galaxy.ts`), `berthTonnes` (`game/commander.ts`),
`saveRows` and `liveRun` (`game/screens/saves.ts`), `helpRows` (`ui/key-help.ts`),
`clearBootId` (`game/storage.ts`), `VERTEX_STRIDE` / `EDGE_STRIDE` /
`FACE_STRIDE` (`ships/elite-a-faces.ts`), `ANCHOR_RECHARGE_RATING`
(`game/systems.ts`) and `NO_FACE` (`tools/elite-a/build.mjs`).

## Decisions already made

- **The types are not touched.** All 23 are in use inside their own files, and
  exporting a type is how this codebase documents a shape. Unexporting them
  would trade readable module surfaces for a lower number in a tool.
- **Documented sets stay whole even when half of them is unimported.**
  `AS_SHIPPED` / `AS_THE_GAME_FLIES` are introduced in `brain-names.ts` as "the
  two picker values that are not pilots"; `MAX_OBS_SIZE` / `MAX_HIDDEN` /
  `MAX_OUT_SIZE` are named together in `test/constants.test.ts` as the policy
  format's own dimensions. Unexporting the members that happen to have no
  outside caller would split a set that a comment presents as one thing.
- **Nothing in `src/constants/` is unexported.** `SHIELD_REGEN_FRACTION` is
  read only by the `SHIELD_REGEN` derivation one line below it, but that
  directory's convention is that a constant is exported and catalogued, and its
  `CATALOG.md` row is where the 0.035 is explained. Deletion is the only
  sensible move there, and it is only sensible when the number names nothing —
  which is why `BRAIN_HANDOVER_RANGE` went and this did not.
- **The two "duplicate export" pairs stay.** `HULL_BOX_MARGIN` /
  `NPC_HULL_BOX_MARGIN` and `ENERGY_BANK_POINTS` / `LOW_ENERGY` are deliberate
  aliases whose comments say the second name exists to make the shared rule
  visible at the second call site.
- **knip is not added to the gate.** Left for Chris: it is a new devDependency
  and needs a checked-in config to be worth anything, and the constants gate
  already owns the rule that matters most here. Recorded rather than decided.

## Watch out for

- **`test/constants.test.ts` counts declarations, not exports.** Its scanner is
  `/^(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\b/`, so dropping `export` from
  `ANCHOR_RECHARGE_RATING` or the three strides leaves the `OUTSIDE` plan intact
  — and its staleness check is what would have caught a *deletion* off that
  list. Deleting `BRAIN_HANDOVER_RANGE` needed `npm run generate:constants` to
  drop the `CATALOG.md` row.

## Verify

Done 2026-08-10.

- `npm run check` green end to end: `tsc --noEmit`, **3578 passed, 0 failed**,
  the size gate (29 files over 400 lines, 0 unlisted), `constants: 342 exports,
  23 rule ids, 0 warning(s) — catalogue current`, the palette check, the Elite-A
  source-hash check and the description check.
- knip re-run under the same config: the 15 findings this plan took off its
  list are gone, and what it still reports is exactly the kept set above — the
  two documented groups, `SHIELD_REGEN_FRACTION`, and the 23 in-file types.
  `clearBootId` is a sixteenth change knip could NOT see: `test/playtest.js` and
  `train/jameson-autopilot.js` import through absolute `/src/...` paths it
  cannot resolve, so it treats every export of the files they name — including
  `game/storage.ts` — as reached. The grep pass is what found it, and it is the
  reason this sweep did not run on knip alone.
- The handover finding was confirmed against history, not inferred:
  `git log -S BRAIN_HANDOVER_RANGE -- src` names `8ed705d`, and its diff shows
  `guard: BRAIN_HANDOVER_RANGE` leaving with `pirateBrainFor`.
