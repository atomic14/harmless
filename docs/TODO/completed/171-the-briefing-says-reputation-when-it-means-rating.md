# 171 — The briefing says reputation when it means rating

**Kind:** gap · **Severity:** medium · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none — GitHub #36 closed on
2026-08-16, and this is what its triage found

## Where we are

**GitHub #36 reported a string that was already fixed, and a stale link is
why.** Chris read `const NAME_COST = DISREPUTE_BRIBE > 0 ? ' AND YOUR NAME' :
'';` at `src/game/prompts.ts:90`. That is a GitHub permalink, and it pins commit
`bff0018` of 2026-08-15. docs/TODO/162 M1 landed the next day, in `5f63ff8`. On
`main` the line is `REPUTATION_COST`, and it reads `' AND YOUR REPUTATION'`.

**A permalink names a commit, so it never moves.** A search result that carries
one shows the tree as it was. That answers the report and it settles the issue.

**THE TRIAGE THEN MEASURED THE TREE, AND FOUND SOMETHING ELSE.** Two surfaces
carry the retired meaning on `main` today. Neither one is what the report named,
and no gate reads either. That is this item.

### The ban reads a third of what a player reads
`test/ladder-words.test.ts` is docs/TODO/162's gate. Two lines decide its whole
scope:

```ts
if (/[a-z]/.test(text)) return [];                        // shouted only
for (const root of ['../src/game/', '../src/ui/']) { ... } // two directories only
```

So the ban reads **the console's shouted voice, in TypeScript, in two
directories**. Every mixed-case surface a player reads is invisible to it. That
is not an oversight in 162: its own header says `screen-capture.ts` covers the
screens. But nothing covers the prose pages.

**Measured, the unguarded surface holds the defect.** The word `reputation`
reaches a player four times, and three of the four mean a different ladder:

| site | what it says | what it means | correct? |
| --- | --- | --- | --- |
| `src/ui/briefing.ts:58` | *"no reputation at all"* | the combat RATING | no |
| `manual.html:37` | *"reputation whatsoever"* | the combat RATING | no |
| `manual.html:193` | *"reputations build along lawless routes"* | route danger | no |
| `manual.html:284` | *"Your legal status follows you"* | the legal ladder | yes |

**The briefing states both words four lines apart.** It says *"no reputation at
all"*, and then *"The only score that matters is your combat rating, which
starts at Harmless."* One ladder, two words, one screen. Since 162, REPUTATION
is the player's word for the OTHER ladder, so *"no reputation at all"* now reads
as the best rung of the disrepute ladder.

**docs/TODO/162 recorded exactly this and did not schedule it**, because the
pages are Chris's own writing. This item schedules the measurement and the gate,
and it leaves the words to him.

### The ban strips a comment before it reads

**The second surface is comments in `src/`, and the ban drops them on line 86:**

```ts
const stripped = (url) => readFileSync(url, 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
```

That is deliberate. 162's gate is about the console's voice, and the file's own
comments discuss the banned words. So a comment can say anything, and six of
them still use `name` for the disrepute ladder:

| site | the words |
| --- | --- |
| `constants/law.ts:229` | *"a third idea about what a bad name"* |
| `constants/threat.ts:53` | *"What a fully notorious name is worth as HEAT"* |
| `constants/threat.ts:106` | *"rolled only when there is a name to recognise"* |
| `game/game.ts:561` | *"Your name changed hands on the ladder"* |
| `game/law.ts:193` | *"The record moves and the NAME does not"* |
| `game/survivors.ts:113` | *"a tonne of narcotics costs a name"* |

**Two of the six are PUBLISHED.** A doc comment in `src/constants/` is the
`Purpose` column of `CATALOG.md`, which the generator writes. So
`DISREPUTE_HEAT` reads *"What a fully notorious name is worth as HEAT"* and
`DISREPUTE_DRAW` reads *"How much a criminal name draws challengers"*.

**THE RULE IS ALREADY WRITTEN DOWN, ONE FILE AWAY.** `constants/character.ts:10`
says: *"The word `name` never means this ladder (docs/TODO/162). A commander has
a name, and it is the word the player types."* Five files break a rule that one
file states.

**Five other hits are correct and must not move.** *"a rung name"*, *"the ladder
it names"* and *"the name on the status screen"* each mean what a thing is
CALLED. That is the word's one right meaning, and 162 refused to ban it.

## What to do

Three milestones. M1 is the gate, because it finds the full list. M2 is the
player's prose. M3 is the tree's comments.

### M1 — the ban reads every surface a player reads

Widen `test/ladder-words.test.ts` on both axes, and keep the two halves apart so
each can fail on its own.

**Axis one: the pages.** Add the player-facing HTML to the walk. Those are
`index.html`, `manual.html`, `play.html`, `novella.html` and
`encyclopaedia.html`. Read the text between the tags, and never the markup.

**Axis two: the case.** A mixed-case sentence needs its own predicate. The
shouted rule is `NAME` as a whole word; a sentence needs `reputation` in the
prose sense. **Write the two predicates apart.** One list that served both would
ban `Your legal status follows you`, which is the one correct row of the four.

**Axis three: the comments.** Read a comment rather than stripping it, under a
third predicate. `name` beside a ladder word is the fault, and `name` alone is
not. **This axis needs an exemption for the two files that discuss the rule**,
which are `constants/character.ts` and `game/character.ts`. Their own headers
state what the word may not mean, so a blanket ban would fail on the rule
itself.

**The rule the ban holds is already written down** in the file's own header:

    the disrepute ladder -> REPUTATION   (Honest … Cutthroat)
    the legal ladder     -> LEGAL STATUS (Clean, Offender, Fugitive)
    the combat ladder    -> RATING       (Harmless … Elite)

**Do not restate that table.** It has one home, and the ban reads it.

**Expect the gate to find more than this plan lists.** That is the pattern of
docs/TODO/165 and docs/TODO/166, and it is the reason M1 runs first.

### M2 — the pages say which ladder they mean

Repair what M1 finds. The three known rows are one word each:

1. `src/ui/briefing.ts:58` — *"no reputation at all"* means the RATING.
2. `manual.html:37` — *"reputation whatsoever"* means the RATING.
3. `manual.html:193` — *"reputations build along lawless routes"* means danger.

**THE WORDS ARE CHRIS'S, AND THE CHANGE IS HIS CALL.** `CLAUDE.md` excludes the
manual, `index.html`, the briefing and the novella from the house prose style on
his instruction of 2026-08-12. That exclusion is about STYLE. A word that names
the wrong ladder is a fact rather than a style. **Propose the smallest wording
and ask.** Do not rewrite a paragraph.

### M3 — the comments say which ladder they mean

Repair the six comments in the table above. Each one is a word, and each becomes
the ladder's own word.

**`src/constants/` comes with a step of its own.** Two of the six are constant
doc comments, so `CATALOG.md` carries them. Run `npm run generate:constants`
BEFORE the gates, then `npm run constants:check`. That is `docs/PROCESS.md`
step 3, row two of the tier table.

**`game/law.ts:193` needs a reading rather than a substitution.** The sentence is
*"The record moves and the NAME does not"*, and it draws the line between the
two ladders. docs/TODO/160's record uses the same words. Say REPUTATION, and
check that the paragraph still says which ladder stays still.

**Do not touch the five correct hits.** They mean what a thing is CALLED.

## Verification

The gates always run: `npm run check`. The tier table puts this at "prose,
comments or a plan doc → nothing more". M1 adds assertions, so `npm test` is the
measurement.

**M1 is proved by breaking each rule separately.** Six proofs, because the gate
has six ways to be vacuous:

1. Put `no reputation at all` back into `briefing.ts`. The prose rule goes red.
2. Put `COST YOUR NAME` back into a shouted string. The shouted rule goes red,
   which is 162's existing proof and must still hold.
3. Put *"costs a name"* back into a comment. The comment rule goes red.
4. Point the HTML walk at a directory with no pages. The control must go red.
   **A scan that read nothing would otherwise report success**, which is the
   failure 162's own `shouted > 100` control exists to catch.
5. Assert that `Your legal status follows you` (manual.html:284) still passes.
   That is the row that proves the prose rule is not a blanket ban.
6. Assert that *"a rung name"* (`game/character.ts:56`) still passes. That is
   the row that proves the comment rule reads the ladder word beside it.

**Report the count of what was read**, in the shape 162 used: the number of
shouted strings, and now the number of prose sentences and comment lines. A gate
that says how much it read is a gate that cannot silently stop reading.

**M2 and M3 are proved by the gate M1 wrote.** It goes from red to green, and
the two tables above are the list.

**M3 runs `npm run generate:constants` first**, then `npm run constants:check`.
`CATALOG.md` must lose both of its `name` rows.

## Decisions already made

- **The prose rule, the shouted rule and the comment rule stay apart.** One list
  that served all three would ban a correct row of each.
- **`NAME` is not banned.** It is the word's one correct meaning.
- **GitHub #36 is closed rather than carried here.** Its report named a string
  that docs/TODO/162 had already fixed, and a commit permalink is why it looked
  live.
- **The three sentences on the pages are Chris's, and he chose all three**
  (2026-08-16). The briefing says *"a rating of Harmless"*. The manual says
  *"no rating whatsoever"* and *"danger builds along lawless routes"*.

## Open questions

Both are answered, and both answers are Chris's.

- **Which word does the RATING get on the two pages?** RATING. The briefing
  names the rung as well, because the sentence four lines below already does.
- **Does `manual.html:193` want a word at all?** Yes, and it is `danger`.

## What landed

**The gate is three rules over three surfaces, and each fails on its own.** The
first is docs/TODO/162's shouted rule, unchanged. The second reads every
mixed-case sentence a player reads. The third reads every comment in `src/`.

**`test/ladder-scan.ts` decides what is read, and the test decides what is wrong
with it.** That split is `tools/ste-read.mjs`'s, and the reader is reused rather
than written a second time. **`tools/ste-read.d.mts` is what made the reuse
possible**: `tools/` is plain JavaScript, `tsconfig.json` sets no `allowJs`, and
a TypeScript file therefore could not import it at all. The plan did not have
that.

**Each rule reports what it read**: 815 shouted strings, 703 player sentences
over 7 pages, and 7,179 comment paragraphs.

### The prose rule is two tests, and neither one bans the word

`reputation` is right where it means the disrepute ladder, so a ban would be
wrong. The two tests are what is true of that ladder:

1. **It is never negated.** Honest is its BEST rung, so a fresh commander has a
   reputation at its best. A sentence that says she has none means the RATING.
2. **It is singular.** A plural is a fourth meaning — a route's danger, or
   somebody else's fame.

Both known page rows fail one test each. `Your legal status follows you` passes,
and so does the novella's *"Commanders of established reputation"*, which means
the disrepute ladder and is correct.

### The comment rule reads the ladder word beside `name`

A paragraph is the unit rather than a sentence, because the word and the ladder
are often two sentences apart. **`name` is wrong only where the comment never
says WHAT is named.** That is the rule rather than an exception list, and the
failure message asks for exactly that: *say which ladder, or say what has the
name*.

**Two files are exempt**, and the plan predicted both: `constants/character.ts`
and `game/character.ts` state the rule, so they must be able to name the word
the rule is about.

### THE GATE FOUND TWENTY SITES, AND THE PLAN NAMED SIX

**Seven of the extra fourteen are the same defect at another site.**
`constants/rating.ts` glossed `FAME_FULL` as *"Your name fully precedes you"*.
`constants/survivors.ts` said a cheap sale is *"not worth a name"*.
`game/station.ts` called a clean legal record *"a cleared name"*.
`game/docked.ts` and `game/screens/trade.ts` each said `name` for the disrepute
ladder. `constants/threat.ts:81` is the second PUBLISHED one, and the plan's
table missed it.

**`game/commander.ts` is the mirror fault, and no rule in the plan covered it.**
It called `combatScore` a *"Combat reputation"*. Since docs/TODO/162 that word
belongs to the other ladder. So the comment rule has a second half: the combat
ladder is the RATING, and its code word is `fame`.

**Six sites were correct and are still repaired.** Each said `name` without ever
saying what is named, inside a paragraph about a ladder. `the name rules` is
`the save name rules`. `the name on the status screen` is `the rung name on the
status screen`. Each repair is one word, and each sentence says more than it
did. A file exemption was the other remedy, and it would have blinded the gate
to the whole file.

**`CATALOG.md` lost both of its `name` rows**, and `npm run generate:constants`
ran before the gates.

### The milestones landed in the order M3, M2, M1

**That is a deviation, and the reason is that a gate cannot land red.** M1 first
is right, and it was written first: it found the full list before any commit.
The COMMIT order is then chosen so that every commit passes `npm run check`. M1
lands last and lands green.

### Verification

`npm run check` passes: 4,739 assertions, 0 failed, 30 files over 400 lines and
0 unlisted, 388 exports, 53 claims and 1,229 plan citations.

**Proved able to fail six ways, each alone.** Each of the three rules goes red
on its own offence put back, and on nothing else. The page walk pointed at a
directory with no pages leaves the RULE green and reddens its CONTROL, which is
the reason the control exists. The two rows that prove the rules are not blanket
bans are assertions rather than proofs: `Your legal status follows you` and `a
rung name`.

### One thing is reported and not fixed

**`novella.html:313` says *"attempts on your name"***, and it means the
disrepute ladder. No rule here reads `name` on a page, because the plan scoped
the prose axis to `reputation`. It is in-universe fiction in Chris's own voice,
and the sentence beside it uses `reputation` correctly.

## Watch out for

- **`NAME` is deliberately not banned.** It is the word's one correct meaning: a
  commander types one, a save takes one, a system has one. Three screens ask for
  it. Banning it is the mistake docs/TODO/162 explicitly refused.
- **The manual is a build input, not a bundle.** Confirm how each HTML page
  reaches the site before the walk assumes a path.
- **Do not read markup as prose.** An attribute value and a tag name are not
  sentences, and a scan that reads them will report noise and then be switched
  off.
- **`docs/` is out of scope here.** Whether a gate reads the documents is
  docs/TODO/168. Do not answer it in this item.
