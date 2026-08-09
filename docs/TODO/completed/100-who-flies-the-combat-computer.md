# 100 — Who flies the combat computer? The docs disagree with the code, both ways

> Completed plan. Archived from the active queue.

**Kind:** docs/truth · **Severity:** medium · **Size:** small
**Found during** 99's implementation (2026-08-09). Not yet investigated
beyond the evidence below — the first job is to establish code-truth.

## Where we are

The claims about which pilot the purchasable combat computer flies point in
opposite directions, and one set must be stale:

- **`src/game/scripted-co-pilot.ts` (the code):** header says "a PURSUIT
  DOGFIGHTER flying YOUR ship… It flies `pursuit.ts`, not the attack run",
  and the module imports `pursuitSpeed` from `pursuit.ts`. Code-truth looks
  like **pursuit**.
- **`src/game/brain-names.ts:142-147`:** the `SHIPPED_DEFENCE` comment says
  the commander's ship flies "the same `attack-run` the pirates fly, pointed
  the other way (scripted-co-pilot.ts, npc.ts's defence path). It does not
  follow the pirates onto pursuit." Also `SHIPPED_DEFENCE: BrainName =
  'attack-run'`.
- **CLAUDE.md (~line 100) and README:** both say the armed trader's pilot
  AND the combat computer fly `attack-run`.
- **The reverse staleness:** `scripted-co-pilot.ts`'s own header says "the
  pirates fly the attack run (npc.ts)" — stale since pirates moved to
  `pursuit` by default.

## What to do

1. **Establish code-truth first.** Read what actually runs: does anything
   consume `SHIPPED_DEFENCE` in a way that decides the co-pilot's flight, or
   is `scripted-co-pilot.ts` hardcoded pursuit regardless? What does the
   armed trader's defence path (`npc.ts`) actually fly? Do not fix a doc
   until you can state, with the call chain, what each of the three
   defence-adjacent things flies: the combat computer, the armed trader, the
   trainer's defence rows.
2. **Then make every claim agree with the code,** in all its homes:
   `brain-names.ts` comments (and `SHIPPED_DEFENCE`'s value if it is
   genuinely wrong rather than differently-scoped), `scripted-co-pilot.ts`'s
   stale pirates line, CLAUDE.md, README. If `SHIPPED_DEFENCE` turns out to
   be correctly `attack-run` for the trader while the co-pilot is pursuit,
   the fix is wording that stops lumping them.
3. **Echo the floor framing** where 99's agent noted it: README's
   `npm run survivability` line can say "a floor measured in the training
   world" now that the tool's own header does.

## Watch out for

- This is a truth item, not a behaviour item. If establishing code-truth
  reveals an actual behaviour bug (e.g. the co-pilot was MEANT to fly the
  attack run), STOP and report — changing what the co-pilot flies is a feel
  change with its own verification, not a doc fix.
- CLAUDE.md and the README are read by every future session; wrong claims
  there propagate into plans. That is why this is medium severity for a
  docs item.

## Verification

- The stated call chain for each of the three defence-adjacent pilots, in
  the item's Outcome, with file:line.
- `grep` finds no remaining claim that contradicts it in CLAUDE.md, README,
  `brain-names.ts`, `scripted-co-pilot.ts`, or `train/survivability.ts`.
- `npm run build` green.

## Outcome

**Shipped 2026-08-09.** Code-truth, established with the call chains before
any edit:

1. **The combat computer flies PURE PURSUIT, selected under the name
   `attack-run`.** `K` → `Game.toggleCombatComputer` (game.ts:1202) →
   `Autopilot.toggleCombat` (autopilot.ts:118) → per frame
   `defenceBrainNameFor` returns `SHIPPED_DEFENCE = 'attack-run'`
   (brain-names.ts:156) → `ScriptedCoPilot.step` (scripted-co-pilot.ts:84),
   pure-pursuit bank-to-turn with `pursuitSpeed`. Deliberate, not a
   regression: 790d965 built it on the attack run and named the selection;
   3c7b8ea moved the flight to pure pursuit without renaming it. The docs
   were the leftovers.
2. **The armed trader genuinely flies the attack run** (npc.ts:699-708) —
   the "differently-scoped" case the plan anticipated, so
   `SHIPPED_DEFENCE`'s value stands and the fix was wording: one name, two
   flights, stated at the name's home and everywhere it was lumped
   (CLAUDE.md, README, ARCHITECTURE, GAP-ANALYSIS, five src comment
   sites). The display name became `FIGHTS BACK`, which claims neither
   flight's shape; `test/scripted-co-pilot.test.ts` pins the anti-lumping
   rule and both pins were broken once and went red.
3. **Bonus code-truth:** the `scripted` A/B does not revert the defence to
   the attack run — it switches the defence OFF (co-pilot refuses,
   autopilot.ts:133; armed trader flees, npc.ts:699). CLAUDE.md said
   otherwise; corrected.
4. `train/survivability.ts` flies neither shipped defence (its header
   already said so after 99); README's survivability line now carries the
   floor framing.

Verified: build 3263/0, elite-a 494/0, campaign all-green, contradiction
greps clean. Two behaviour defects found and NOT touched, filed as
[102](102-two-things-still-load-the-retired-brains.md): the viewer page
throws at module scope since the retirement, and the ram-probe's `evades`
row would load a brain that does not exist.
