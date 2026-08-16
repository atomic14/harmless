# 162 — one word that means five things

**Kind:** bug · **Severity:** low · **Size:** medium · **Depends on:** nothing ·
**Blocks:** nothing · **GitHub:** #33 · **Source:** Chris, 2026-08-16:
*"'Cost you name' doesn't mean anything. We use it in a lot of places and 'name'
is a bit confusing - what are we saying."*

## Where we are

The screenshot is the survivors screen. Its keyline ends with
`V AND L BOTH COST YOUR NAME` (`src/ui/screens.ts:88`).

**The report is exact. The cause is wider than the one line.** The word `name`
carries five meanings here. `CLAUDE.md` sets one rule for exactly this fault:
one word, one meaning.

| what `name` means | example |
| --- | --- |
| what a thing is CALLED | `A COMMANDER NEEDS A NAME` (`screens/new-commander.ts:87`) |
| the Character ladder | `V AND L BOTH COST YOUR NAME` (`ui/screens.ts:88`) |
| the legal record | *"Buy your name back at the station"* (`law-actions.ts:137`) |
| the combat rating | *"counts kills for a NAME — Harmless to Elite"* (`constants/law.ts:93`) |
| a value's own label | `sys.name`, `SoundName`, `LEGAL_NAMES` |

**The first meaning is the one the game teaches the player.** Three screens ask
for a name and each means the typed word: `A COMMANDER NEEDS A NAME`,
`A SAVE NEEDS A NAME` and `NAME A NEW COMMANDER`. So a commander reads
`COST YOUR NAME` against that lesson. The sentence then says that an answer
costs her the word she typed, which is not a rule the game has.

### The three ladders already have three words

Every one of them is on the COMMANDER screen (`ui/screens.ts:115`):

- `Legal status: Fugitive` — the record, which a fine or five pirate kills clear;
- `Character: Dodgy` — the disrepute a dirty deed earns;
- `Rating: Competent` — what the kill count is called.

**So this item invents no vocabulary.** It spends the words that ship.

### The worst case is one paragraph, and it is in `src/game/law.ts`

`bribeOffered`'s doc comment holds both of the middle meanings, four lines
apart:

> **It always costs your name, refusal included.** … The record is untouched
> either way: buying your name back is `recordCleared` at a station, by choice,
> and it is the only thing that clears one.

The first `name` is the Character ladder. The second is the legal record. The
paragraph states that one is untouched while it uses one word for both.

**A second defect sits in the same sentence, and it is a stale claim.**
`recordCleared` is no longer *"the only thing that clears one"*. docs/TODO/160
added `recordWorkedOff`, and ten pirate kills take a Fugitive to Clean. Line 51
of the same file says so. The file contradicts itself.

### What the player meets

Five strings say `NAME` for the Character ladder:

1. `ui/screens.ts:88` — `V AND L BOTH COST YOUR NAME`;
2. `game/prompts.ts:90` — `NAME_COST`, spent by the two bribe prompts;
3. `game/law-actions.ts:224` — `PATROL BREAKS OFF — 100 CR AND YOUR NAME`;
4. `game/law-actions.ts:239` — `PATROL LOOKS THE OTHER WAY — 100 CR AND YOUR NAME`;
5. `game/command-help.ts:171` — *"it always costs your name"*.

**No player-facing string uses `YOUR NAME` for anything else.** That is measured
over `src/`, and it is what makes a gate possible in M4.

## Chris changed the item on the day it was planned

The plan above answered the wrong question, and the first milestone landed
before he said so (2026-08-16):

> *"I think we've been trying to keep text overly short in the UI. We need to
> remember that a user does not have the context we have and they don't
> understand all our internal ways of naming things."*

**`CHARACTER` is an internal word too.** M1 swapped one word a player has never
met for another word a player has never met. The COMMANDER screen prints
`Character: Dodgy`, and nothing on any screen says what that row measures. The
fault the issue reports is not that `name` is the wrong word. It is that the
game names a thing instead of saying it.

**So the item grew, and Chris set both answers.**

1. **The word is `REPUTATION`**, on every surface a player reads. It needs no
   manual. `Character` stays as the word the CODE uses, which is what the
   directory, the module and the constants are called.
2. **The scope is every consequence line**, and no longer the five strings the
   screenshot found. A line that reports a consequence to a pilot is in scope,
   whichever ladder it reports.

**One collision comes with the word, and it is recorded rather than fixed.**
The briefing tells a new commander that she has *"no reputation at all"*, and it
means the combat rating. Under the new vocabulary that sentence says she is
Honest, which is the BEST rung. The briefing is Chris's own writing on a page
the style excludes, so this item reports it and changes nothing.

## What to do

### M1 — the five strings *(landed, then re-cut)*

The first cut said `CHARACTER`. The second says `REPUTATION`, at the length the
sentence needs.

Four tests pin the phrase and each one updates with the rule it pins:
`test/prompts.test.ts:142`, `test/bribe-flight.test.ts:271`,
`test/bribe.test.ts:56` and `test/constants.test.ts:614`.

`NAME_COST` becomes `REPUTATION_COST`. Its doc comment states the rule that the
constant reads off `DISREPUTE_BRIBE`, and that rule does not change.

### M2 — the ladder is REPUTATION on every screen

The COMMANDER screen row and the console verdict are the two places that print
the ladder itself. Both say `Reputation` now. `characterName` still computes the
rung, because the module keeps the code's word.

### M3 — every consequence line reads for a first-time pilot

Chris's scope. Take each line that reports a consequence — the police scan, the
record, the fine, the reputation verdict and the deeds that move either ladder.
Ask one question of each: **does a pilot who has read no documentation know what
just happened?** Where the answer is no, say the consequence rather than name
it.

**The console has room.** docs/TODO/147 settled that a station header takes as
many lines as it has orders, on Chris's call: *"we don't need to keep it one
line"*. docs/TODO/157 fixed the console's own width. So length is no longer the
constraint that shortened these lines.

### M4 — the prose in `src/`

Every comment that uses `name` for a ladder names the ladder instead. Three
rules decide the word:

1. the Character ladder becomes `character` or `the Character ladder`;
2. the legal record becomes `record`;
3. the combat rating becomes `rating`.

Repair the two defects that the read found:

- `law.ts:155`–`160` holds two meanings in one paragraph. Split them.
- `law.ts:160` claims that `recordCleared` is the only thing that clears a
  record. It is not. Name `recordWorkedOff` beside it.

**Convert the sentences that are touched.** docs/TODO/154 sweeps `src/` into
Simplified Technical English, and `CLAUDE.md` asks each edit to convert the
comment it touches. A sentence that this item rewrites is a sentence this item
converts.

**Run `npm run generate:constants` before the gates.** Six files under
`src/constants/` carry this prose, and a doc comment there is the `Purpose`
column of `CATALOG.md` (docs/PROCESS.md).

### M5 — the identifiers

`markName` is a host method on two interfaces. It means *"the Character score
moved"*. It becomes `markCharacter`. `wasNamed` is a local in four files and
holds the disrepute before a deed. It becomes `wasCharacter`.

**Use `findReferences` before each rename.** 31 lines hold these three names,
across nine files.

**Code is outside the prose style**, so this milestone rests on `CLAUDE.md`'s
own vocabulary rule rather than on ASD-STE100. The rule is the reason the prose
keeps drifting back: a comment beside `markName` reaches for the word in the
identifier.

### M6 — the gate

`test/key-prose.test.ts` is the shape to copy. It fails on any message in
`src/game/` that spells a bound key.

The new assertion is narrower: no player-facing string in `src/game/` or
`src/ui/` contains `YOUR NAME`. The measurement above says the population is
five strings and that M1 empties it.

**Prove that the gate can fail.** Put `AND YOUR NAME` back into one prompt.
Confirm the failure. Remove it.

## Decisions already made

- **`name` means what a thing is CALLED, and nothing else.** A commander, a
  save, a system, a ship and a sound each have one. A ladder does not.
- **The player's word for the disrepute ladder is `REPUTATION`** (Chris,
  2026-08-16). `Character` is the code's word, and it stays in the directory,
  the module and the constants. The two never appear on one screen.
- **A UI line is as long as it needs to be** (Chris, 2026-08-16). Nothing is
  shortened to fit a row. docs/TODO/147 and docs/TODO/157 already removed the
  width argument.
- **The survivors keyline is in scope.** `CLAUDE.md` excludes four
  player-facing pages from the prose style — the manual, `index.html`, the
  briefing and the novella. A game screen is not one of them. This item changes
  the wording rather than the style, so the exclusion does not decide it either
  way.
- **The briefing is untouched.** It says *"no reputation at all"* about a new
  commander's rating. It is Chris's own writing on an excluded page.
- **No rule moves.** The bribe still costs `DISREPUTE_BRIBE`, the sale still
  costs `DISREPUTE_SLAVE_SALE`, and the record still clears two ways. This item
  changes what the game CALLS those costs.

## Open questions, and the answers

**1. Why not fix only the line in the screenshot?** Because the issue reports
the breadth: *"We use it in a lot of places"*. One line fixed leaves four
strings that say the same wrong thing, and the prose that keeps re-seeding them.

**2. Should the COMMANDER screen say `Record` rather than `Legal status`?** Yes.
Chris widened the item to every consequence line, and one ladder with two labels
is the same fault at a smaller size. The console says `RECORD: FUGITIVE` and the
screen said `Legal status: Fugitive`. M2 makes both say the same word.

**3. Does this touch the save and commander naming screens?** No. They use
`name` in its one correct meaning, and M4's gate is written so that they pass.

**4. Is `Character` a word a player understands?** It is the word the game
already teaches. A commander who reaches the survivors screen has docked, and
the COMMANDER screen prints `Character:` beside `Legal status:` and `Rating:`.
`⇧T` shows the score itself (docs/TODO/121).

## Watch out for

- **Four tests pin the phrase `AND YOUR NAME`.** They are gates on a wording
  rule, so they update with it. Do not weaken an assertion to pass.
- **`test/constants.test.ts:614` holds the phrase inside a failure message**,
  and it names the expression in `prompts.ts`. That message must still describe
  the code after M1.
- **`src/constants/` doc comments feed `CATALOG.md`.** Run
  `npm run generate:constants` BEFORE the gates, then `npm run constants:check`.
- **A quotation is not yours to fix.** Comments in `src/` quote Chris. Leave
  every quoted word.
- **`LEGAL_NAMES`, `ECONOMY_NAMES` and `SoundName` are correct.** They are the
  fifth meaning, which is the one that stays.

## Verification

**The gates always run:** `npm run check`.

**The tier table asks for nothing more** (docs/PROCESS.md). This item changes
strings and comments. It changes no ship data, no combat rule and no economy.
One row does apply: prose in `src/constants/` needs
`npm run generate:constants` first.

**The numbers that say it worked:**

1. `npm run check` passes, and the assertion count moves only by the new gate;
2. `constants:check` reports the same export count and the same rule-id count,
   which is what says the pass changed prose and not rules;
3. no player-facing string in `src/game/` or `src/ui/` contains `YOUR NAME`,
   asserted by M4's gate;
4. M4's gate is proved able to fail.

**A refactor's gate is that nothing needed a new test**, beyond the one that
holds the new rule.
