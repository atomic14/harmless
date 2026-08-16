# 171 — The briefing says reputation when it means rating

**Kind:** gap · **Severity:** medium · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #36

## Where we are

Chris reported one line: *"We still have some text that says 'BOTH COST YOUR
NAME'. 'NAME' doesn't mean anything to the player."*

**The triage of 2026-08-16 answered the wrong half, and closed the issue on it.**
That was wrong, and the issue is open again. This item is what the triage should
have produced.

### Half one: the string he searched for

`V AND L BOTH COST YOUR NAME` is on `main` **eight times**, and none of them is
in a shipped string:

| where | count | what it is |
| --- | ---: | --- |
| `test/ladder-words.test.ts:72` | 1 | the fixture that proves the ban can fail |
| `docs/TODO/completed/162-*.md` | 4 | the plan doc for GitHub #33 |
| `docs/TODO/completed/README.md` | 1 | the landed-work entry |
| `docs/TODO/README.md` | 2 | the same entry, and the 2026-08-16 triage note |

**The live bundle was measured** at `harmless.atomic14.com`: zero uses of the
retired words, four of `REPUTATION`, three of `LEGAL STATUS`. `ui/screens.ts:88`
reads `V AND L BOTH DAMAGE YOUR REPUTATION`.

**So a code search cannot tell a live string from a record of a dead one.** That
is the whole of half one, and it is a real complaint even though no player is
affected.

### Half two: the ban reads a third of what a player reads

**This is the larger half, and the report did not name it.**
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

## What to do

Three milestones. M1 is the gate, because it finds the full list. M2 is the
prose. M3 is the code search.

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

### M3 — a search can tell a record from a live string

**The eight hits are one fixture and seven records**, and the house rule is that
a record is corrected rather than rewritten. So the answer is not to delete the
quotations. It is to make each one say that it is retired.

The cheapest form is one word beside the quotation, and the records mostly carry
it already. Read all eight, and add the marker only where a reader cannot tell.

**The fixture keeps its phrase.** It is the proof that the ban can fail, and
`CLAUDE.md` requires that proof.

**If Chris would rather the search came back clean**, that is option 2 in the
issue and it is a different M3. Do not choose it without him.

## Verification

The gates always run: `npm run check`. The tier table puts this at "prose,
comments or a plan doc → nothing more". M1 adds assertions, so `npm test` is the
measurement.

**M1 is proved by breaking each rule separately.** Four proofs, because the gate
has four ways to be vacuous:

1. Put `no reputation at all` back into `briefing.ts`. The prose rule goes red.
2. Put `COST YOUR NAME` back into a shouted string. The shouted rule goes red,
   which is 162's existing proof and must still hold.
3. Point the HTML walk at a directory with no pages. The control must go red.
   **A scan that read nothing would otherwise report success**, which is the
   failure 162's own `shouted > 100` control exists to catch.
4. Assert that `Your legal status follows you` (manual.html:284) still passes.
   That is the row that proves the prose rule is not a blanket ban.

**Report the count of what was read**, in the shape 162 used: the number of
shouted strings, and now the number of prose sentences. A gate that says how
much it read is a gate that cannot silently stop reading.

**M2 is proved by the gate M1 wrote.** It goes from red to green, and the four
rows above are the list.

**M3 is proved by the search.** Run `grep -rn "COST YOUR NAME"` over the tree
before and after. The count must not fall, and every remaining hit must say what
it is.

## Decisions already made

- **The fixture keeps the phrase.** It proves the ban can fail.
- **A record is corrected, not rewritten.** The seven records keep their words.
- **The prose rule and the shouted rule stay apart.** One list would ban the one
  correct row.

## Open questions

- **Which word does the RATING get on the two pages?** The game's own word is
  RATING, and the briefing already uses it four lines below the offending
  sentence. **Recommendation: use `rating` in both places**, so one screen stops
  using two words for one ladder. Chris decides the sentence.
- **Does `manual.html:193` want a word at all?** *"reputations build along
  lawless routes"* is about the living galaxy's danger, which is a fourth
  meaning. **Recommendation: say `danger`**, which is the word
  `danger-overlay.ts` already uses.
- **Should the search come back clean?** See M3. It is Chris's call, and the
  issue holds the three options.

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
