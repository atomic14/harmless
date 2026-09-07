# 191 — A model writes the patrons and the dossiers, and a gate reads them first

**Kind:** feature · **Severity:** low · **Size:** large · **Depends on:**
nothing · **Blocks:** 193 · **GitHub:** none

## Where we are

### Project context

HARMLESS is a browser space game built with TypeScript, Vite and three.js.
It is an unofficial, non-commercial tribute to Elite (1984). The game deploys
as a static site. No model runs at build time or in the browser. Generated
content is produced offline and committed to the repository.

docs/TODO/190 built the mission machine. A **skeleton** is one mission's
rules, written in TypeScript under `src/missions/skeletons/`. A **dossier** is
that mission's generated words, committed as JSON. A **patron** is the person
who offers a mission. A **leg** is one stage of a mission. A **lead** is a
saved pointer to the next mission's start world.

### What the code says today

**No dossier ships.** `src/missions/dossiers.ts` is an empty table, and
`dossierFor` returns null for every skeleton. Every reader falls back to the
skeleton's plain words. Those readers are:

- the MISSIONS screen, which shows `Skeleton.pitch` for an offer and the
  leg's `line` for a held mission (`ui/screens.ts`);
- the console, which says `Skeleton.hail` on docking and a branch's `say`
  when it settles (`missions/machine.ts`);
- the hints, which write a rumour, a news line and two patron messages in
  fixed words (`missions/hints.ts`);
- the story, which writes one line per journal entry in fixed words
  (`missions/story.ts`).

**The dossier's shape is fixed.** `Dossier` in `src/missions/model.ts` has a
title, briefing pages, a text per leg and outcome, and a lead line. It has
two rumours, a news line and two image paths. It has the story's opening,
closing and per-branch lines. Its `hash` field exists for a drift check that
nobody wrote yet.

**No patron has a name.** `PatronRef` names the Navy, a world by seed slot,
or the local station. `Patron` in `model.ts` has a name, a role, a species,
a voice and a portrait path, and nothing constructs one. `patronId` in
`machine.ts` keys standing by `navy` or `world-<index>`.

**A world already has a face and a paragraph.** `public/species/` holds 256
portraits for galaxy 1, one per world, written by `tools/generate-species.py`
from the prompts `tools/species-prompts.ts` derives from the 1984 seed.
`src/galaxy/descriptions/galaxy-1.json` holds a generated paragraph per world,
written by `tools/generate-descriptions.ts` through the Message Batches API.

**The description pipeline is the pattern.** `tools/system-prompts.ts` owns
the prompt, a `PROMPT_VERSION`, a `faults()` check and a `BANNED` word list.
The generator drops a record that fails a check, and an absent record renders
the old page. `--check` compares each record's hash with the prompt it was
written from, and `npm run check` runs it. `test/descriptions.test.ts` holds
the fallback and the faults.

**Player-facing words have a content rule.** `test/ladder-words.test.ts`
scans the site pages and the game's voice. REPUTATION is general conduct,
LEGAL STATUS is the criminal record, and RATING is combat rank. A dossier's
text is player-facing, so the same scan must read it.

**Slots are the seam between a rule and a word.** `fillSlots` in
`src/missions/text.ts` replaces `{NAME}` with a value. The machine fills
`{TARGET}` and `{PAY}`. The story fills `{WORLD}` and `{DAY}`. The model
declares `{PATRON}` and `{HERE}` for briefings, and nothing fills them yet.

## What to do

Build the two generators, the validator and the readers. Commit the generated
content for galaxy 1. Put the drift check in `npm run check`. A dossier or a
patron that fails validation never reaches the game.

### M1 — Patrons from the seed

1. Add `tools/patron-prompts.ts`. Derive one patron per world of galaxy 1
   from the 1984 seed, as `species-prompts.ts` does. A patron has a name, a
   role that fits the government, the world's species, and a voice in one
   sentence. Add a Navy patron with no world. Print a sample by default, and
   emit the manifest with `--json`.
2. Add `tools/generate-patrons.ts`. It takes the manifest and asks the
   model for the name and the voice through the Message Batches API. It
   validates each record with `faults()`. It writes
   `src/missions/patrons/galaxy-1.json`.
   Record the prompt hash and the tokens spent. Add `--check`.
3. Add `src/missions/patrons.ts`. `patronFor(ref, facts, systems)` returns a
   `Patron`. A world patron and a local patron read the committed record for
   their world. An absent record falls back to a plain patron named by the
   world and its government. The Navy patron is fixed in code. The portrait
   is the world's, `species/<index>-<name>.png`, or '' for the Navy.
4. Show the patron's name on the MISSIONS screen beside each offer and each
   held mission. Show the face on the LOG screen through `patronFor`.
5. Add `test/patrons.test.ts`. Check the fallback, the Navy case, the local
   case, and that every committed record names an existing world.

### M2 — Dossiers from a skeleton and a patron

1. Add `tools/dossier-prompts.ts`. For each skeleton, build one prompt from
   the skeleton's legs, verbs, branches and pitch, and from its patron. The
   prompt names every leg id and every branch trigger, so the model returns
   a line for each. A relative leg names no world: the prompt says so, and
   the validator checks it. Version the prompt.
2. Add `tools/generate-dossiers.ts` with the same shape as
   `generate-descriptions.ts`. It has a schema per `Dossier` and the batch
   API. It has `--limit`, `--out`, `--batch` and a `--check` drift gate.
   Write one file per skeleton under `src/missions/dossiers/`.
3. Add `tools/dossier-faults.ts`, and export it for the tests. It checks:
   - every field passes `faults()` from `system-prompts.ts`;
   - every slot in a field is one the field may carry;
   - `legs` names every leg of the skeleton and no other;
   - `story.legs` names every leg and every branch trigger of the skeleton,
     as `triggerLabel` in `machine.ts` spells it, and no other;
   - no field names a system of galaxy 1 other than the patron's world
     (`foreignSystemNames`);
   - no field breaks the ladder-word rule.
4. Fill `src/missions/dossiers.ts` from the committed files. Import them
   with `with { type: 'json' }`, as `descriptions.ts` does.

### M3 — The readers use the words

1. The MISSIONS screen shows the dossier's title and its briefing pages for
   an offer, with `{PATRON}` and `{HERE}` filled. It shows the plain pitch
   when no dossier exists.
2. A branch's `say` comes from the dossier's `legs[leg].success` or `.fail`
   when the dossier has one. The skeleton's `say` stays the fallback.
3. The hints use `rumour.far`, `rumour.near` and `news`. The lead line on
   the MISSIONS screen uses `lead`.
4. `story.ts` already reads `story.opening`, `story.closing` and
   `story.legs`. Check that the committed dossiers make it say every branch.
5. Add `test/dossiers.test.ts`. Check every reader's fallback with the table
   emptied. Check that every committed dossier passes `dossier-faults.ts`
   against its skeleton. Check the drift hash of every committed file.

### M4 — The gate

1. Wire `generate-dossiers.ts --check` and `generate-patrons.ts --check`
   into `npm run check`, beside the descriptions check.
2. Extend `test/ladder-words.test.ts` to read the committed dossiers and
   patrons.
3. Prove each check can fail. Break one committed field by hand, run the
   test, and restore it.

## Decisions already made

Chris made these decisions on 2026-09-06 (docs/TODO/190):

- Generate the content offline and commit it. The game stays server-free.
- Every mission gets a patron with a face. A skeleton is code and a dossier
  is words. Generated content cannot change mission rules.
- Derive each patron from the 1984 galaxy seed, so Lave always has the same
  governor. The Navy is the exception, with no home world.
- Generated text cannot invent facts about a target world. A relative leg
  uses the target's existing description for those facts.

This plan adds one default. A world patron's face is the world's own
portrait, which exists for every world of galaxy 1. A portrait per patron is
a later option, and `Patron.portrait` already carries a path for it.

## Open questions

Use these answers unless Chris changes them:

- **Which model writes the dossiers?** The one `generate-descriptions.ts`
  defaults to, `claude-haiku-4-5`. Taste one skeleton with `--limit 1` and
  `--out` first, as the descriptions did. Chris chooses the model he reads.
- **Does a side job get a dossier?** Yes, one per side job. A local patron's
  dossier names no world, so the same dossier reads at every station.
- **What does a briefing page say about a relative target?** Nothing. The
  screen prints the world's name from the rule, and the DATA ON page carries
  the world's description. The dossier speaks of "the target" only.

## Watch out for

- The eight side jobs and the Constrictor are nine dossiers. The arcs of
  docs/TODO/192 add more. The generator must take a list of skeleton ids, so
  a new skeleton costs one run and not a full regeneration.
- The prompt hash must cover the skeleton's shape as well as the prompt
  text. A skeleton with a new leg invalidates its dossier.
- `fillSlots` leaves an unknown slot in place. The validator is what stops a
  dossier from shipping `{TARGET}` in a field the machine never fills.
- `test/ladder-words.test.ts` reads pages by path. Add the dossier files to
  its list, or the rule is not held over them.
- A dossier's `images` name files under `public/`. Absent files must degrade
  to no image, as the species portraits do with `onerror`.
- The plan archive under `docs/TODO/completed/` is not STE-gated, and this
  plan is. Keep the sentences short.

## Verification

Run `npm run check` after each milestone. It runs the tests, the size
ceilings, the constants check, the title and prose gates, and the generator
drift checks. A new test file needs an import in `test/run.ts`.

Require this evidence before the plan is complete:

- Every reader renders with the dossier table emptied, and with it full.
- Every committed dossier passes `dossier-faults.ts` against its skeleton.
  A dossier with a missing branch line, a stray slot, a foreign world name
  or a ladder word fails the test.
- `--check` fails when a committed record's hash differs from its prompt.
- The patron reader falls back for an absent record, and never for the Navy.

Temporarily introduce each fault below to prove that its test can detect it.
Restore the correct content after each check.

| Temporary fault | Required test failure |
| --- | --- |
| Delete one branch line from a committed dossier | Missing branch line |
| Write `{TARGET}` into a story line | Slot the field may not carry |
| Name Diso in a side job's rumour | Foreign world name |
| Write "combat reputation" into a briefing | Ladder word |
| Change one prompt word without regenerating | Drift check |

## Outcome

Landed on 2026-09-06, in four milestones, one commit each. The pipeline,
the validator, the readers and the gate are in place. **The generation run
happened on 2026-09-07, through the `claude` command line.** This machine
holds no `ANTHROPIC_API_KEY`, and Chris asked whether the command line
could do the run instead. It can: `claude -p` takes a system prompt and a
JSON schema, and returns a structured result on the subscription. It has
no batch mode, so `runLocal` in `tools/batch.ts` runs one process per
record, four at a time, with the batch's three passes. Both generators
take it with `--via claude`:

```
npm run generate:patrons -- --via claude
npm run generate:dossiers -- --via claude
```

256 patrons and 9 dossiers are committed, and every one passes the
validator, the drift check and the ladder-word test. Taste first, as the
descriptions did: `--limit 1` for the patrons, and `--out <dir>` for a
dossier, so a taste never reaches the generated index.

### What the run taught

- **A console line has no full stop.** `KRAIT DESTROYED — {PAY} FROM THE
  STATION` is a skeleton's own line. The validator's floor on a console
  line is zero sentences now, and three dossiers that dropped for that
  alone pass.
- **A story line must say "day" before `{DAY}`.** The first Constrictor
  draft said "On 12".
- **A name a model likes comes back on many worlds.** The first 101
  patrons held four repeats, and the full Haiku set had thirteen worlds
  with a Marcus. Chris asked for better names from a better model. The
  patrons were written again on Sonnet 5 under prompt version 2, which
  tells the model that the first name to come to mind is the wrong one.
  The generator asks a repeated full name or a repeated given name again
  with the taken names listed, two rounds, and the test pins that no two
  worlds share a full name. The result is 256 distinct given names.
  Sonnet wrote each voice in a tenth of Haiku's output tokens, and a third
  of its first drafts ran to three sentences, which the second pass fixed.
- **The command line refuses for a stretch after about a hundred calls
  in ten minutes**, on both models, and answers again a few minutes
  later. A run keeps what it wrote, so the answer is to run it again with
  `--jobs 2`. The runner closes stdin on each call now, which saves three
  seconds a call and keeps the real stderr line.
- **The dossiers are Sonnet's too, under prompt version 3.** Chris asked
  for a polish of the prose on 2026-09-07, and the nine Haiku dossiers
  were the weakest words a player reads: a title that echoed the job id,
  a Navy briefing that spoke "from {HERE}", and a "near" message read as
  the patron docking rather than the commander. The prompt now says the
  Navy uses neither slot, the patron stays at home in both rumours, a
  title is never the id or the verb alone, and a news line never names
  the page it sits on. A recover leg's loss is "the canister was destroyed
  before the scoop", because the first draft had the commander's own ship
  lost. All fourteen were written again on Sonnet 5, and every one passes
  the gates.
- **An `arrive` line that quotes `{PAY}` filled it with zero.** The
  acceptance slot carries the leg's fee now, and `legPay` in `text.ts` is
  the one home of that number.
- **The first patron run lost 155 calls to an error the runner cut off.**
  The capture kept the command text and dropped stderr. A run keeps the
  records the file already holds under the current prompt and asks only
  for the rest, so the second run cost 155 calls and not 256.
- **`--limit 3` read as galaxy 3**, in this generator and in the
  descriptions generator. Both read a bare number behind a flag as the
  flag's now.
- **Two game tests asserted the plain words.** They read the expected
  line through the dossier now, with the plain word as the fallback.
- **The standing-orders test crossed the ceiling**, and its real-Game
  block is `test/standing-orders-game.test.ts`.
- **The MISSIONS screen was read in a browser.** The offer row shows the
  title and the briefing with the patron and the world filled, and the
  console says the dossier's line with the target filled.

### What the milestones did

- **M1.** `tools/patron-prompts.ts` derives a role and a manner per world
  from the seed, with the portraits' own variant hash. `tools/generate-patrons.ts`
  asks for the name and the voice. `src/missions/patrons.ts` reads the
  file, and a world with no record gets a plain patron named by its world
  and its government. The MISSIONS screen names the patron beside each
  row, and the LOG screen shows the face through `patronFor`.
- **M2.** `tools/dossier-prompts.ts` builds one prompt per skeleton from
  its shape and its patron, and the hash covers both. `tools/generate-dossiers.ts`
  takes a list of skeleton ids, builds a schema per skeleton, and writes
  one file per skeleton plus a generated `dossiers/index.ts`.
  `tools/dossier-faults.ts` holds the six checks.
- **M3.** The MISSIONS screen shows the dossier's title and briefing. The
  hints read `lead`, `rumour.far`, `rumour.near` and `news`. A branch's
  console line comes from `legs[leg].success` or `.fail`. The story was
  already a reader.
- **M4.** `npm run check` runs both drift checks. The ladder-word test
  reads the committed files as a fourth surface. Each check was broken by
  hand and restored.

### What the plan did not have

- **The machine never reads a dossier, and the plan's M3.2 would have made
  it.** A `say` effect now names the word it may be replaced by
  (`DossierWord` in `model.ts`), and the bridge resolves it. A silent
  failure names its fail word with no text, so a dossier can give a
  failure a line, and the bridge drops it when none does. The one-jump
  dock message is resolved the same way.
- **A branch is not always a success or a failure.** The rescue's lost pod
  goes on to a delivery leg. `wordKind` in `missions/triggers.ts` says
  which branches may speak with a dossier line: a branch to `fail`, a
  branch to `complete`, and the leg's success trigger. A hunt's success
  trigger is `targetDestroyed`.
- **The machine crossed the size ceiling by seven lines.** The trigger
  vocabulary moved to `missions/triggers.ts`.
- **`faults()` took options.** A briefing must say "you", a title has no
  full stop, and "report on arrival" is a plain order. The description
  checks keep their defaults.
- **One batch runner.** The descriptions generator moved onto
  `tools/batch.ts`, so three generators share one copy of the refusal, the
  truncation and the retry. The API path of that refactor was not
  exercised, for the reason above. `--check` was.
- **One home for the ladder-word lists.** They moved from the test to
  `tools/ladder-rules.ts`, because the generator must refuse a line the
  test would fail.
- **The Navy is not in the patron manifest.** M1.1 said to add it. M1.3
  fixed it in code. One patron has one home, and it is the code.
- **The dossier's `images` field is not generated.** A model writes no
  image, so the generator writes `{}`, and nothing reads it yet.
- **`arrive` has a reader.** The acceptance line names the first leg's
  `arrive` word, so a dossier can put the standing order in the patron's
  voice.
- **A local patron of a held job is the origin's.** `acceptedAt` in
  `queries.ts` finds the world, and `missionName` reads it too.
- **The Sonnet 5 batch rate moved** to the post-introductory figure in
  `tools/batch.ts`, because the introductory rate ended on 2026-08-31.

### Measurements

- 5,353 assertions, from 5,252.
- `npm run check` passes with both generated tables full.
- `dossiers: ok — 9/9 skeletons have a dossier` and
  `patrons: galaxy-1.json ok — 256/256 worlds have a patron` are the two
  new gate lines.
- The Haiku patrons cost 283 calls, about 1.2 million tokens in and 1.4
  million out, most of it thinking, at about a minute a call. The Sonnet
  patrons that ship cost 493 calls over four sittings, 3.5 million tokens
  in and 0.24 million out, at about fifteen seconds a call. The dossiers
  that ship cost about 45 Sonnet calls over three runs, after 22 Haiku
  calls for the first set.
