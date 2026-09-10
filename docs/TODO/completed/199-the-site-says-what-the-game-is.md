# 199 — The site says what the game is

**Kind:** bug · **Severity:** high · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

**Chris read the landing page on 2026-09-10 and called the prose dreadful.**
It is the first page a visitor sees, at https://harmless.atomic14.com. He
named the mission tour page as the worst of it. He asked for the pirates
section to go. He approved the direction below in the same conversation.

**The landing page makes claims the game does not keep.** The pirates section
says the trained policies still fly on the player's side. The features list
says "Trained combat AI for pirates, traders and your own defences". The
combat viewer caption says "three trained pirates". The page's search
description says the traders fly a neural network. The shipped game loads no
trained weights (`CLAUDE.md`, Design direction). All four are false.

**It is written for the author, not the visitor.** The first paragraph
after the title explains the arithmetic of a 32K BBC Micro. A visitor wants
four answers: what is this, can I play it now, what will I do, and is it
hard. Each paragraph ends on a flourish, and there is one per paragraph.
That is the voice of the repository's internal documents, built for
engineers.

**The mission tour page is a data dump with internal names on it.** Its
headings say "The five arcs", "Side jobs, by verb" and "A failure is a
branch". Arc, verb, leg, recovery leg and branch are names from the code.
Under each patron it prints the orders in shouted capitals with a
placeholder: `DESTROY THE SMUGGLER'S COBRA - LAST SEEN AT THE TARGET`. It
ends with a raw dump of the in-game log. `src/missions/tour-html.ts` writes
that markup from `tour-page.ts`'s model, at build time.

## What to do

Two milestones. The player-facing prose is exempt from the house style
(`CLAUDE.md`, Prose). It follows the site style below instead.

### The site style

- Second person, present tense, plain words. Short sentences. One idea per
  paragraph.
- Lead with what the player does. How it works comes second, in one
  sentence, with a link for the curious.
- No flourish at the end of a paragraph. End on the fact.
- No name from the code. If a term needs a definition, do not use it.
- No claim the shipped game does not keep.
- The game's own words appear only as a quotation, set apart, after a plain
  summary in the site's voice.

### M1 — the landing page

`index.html` is rewritten in this order:

1. the title, one line on what it is, one paragraph on what you do, and
   the launch button, with "free, in your browser, no account";
2. the docking screenshot with a plain caption;
3. what you do: trade, jump, fight, dock, climb the ratings;
4. the 1984 galaxy in one paragraph, and the encyclopaedia link;
5. new to Elite: the manual, the novella and the missions, one plain
   sentence each;
6. the features list, corrected;
7. the footer, unchanged.

The pirates section, the combat viewer figure, and every claim of trained
combat AI go. The page's description and its structured data say the same
as the page.

### M2 — the mission tour page

`tour-page.ts` gains a plain summary per arc and per side job, in the site's
voice, and the model carries it. `tour-html.ts` gives each patron one shape:
face, name, role and world; the summary; the steps, in words; then the
patron's own briefing as a quotation. The shouted order lines go. The side
jobs become a plain list. The worked example and the log dump go, with
`exampleLog` and `exampleJournal`, which nothing else uses. The last section
becomes "If you fail", in three sentences. `missions.html` gets a plain
opening, and its navigation and description say the same.

`test/tour-page.test.ts` follows the model: every arc and every side job
carries a summary, and the markup carries no shouted order line.

## Decisions already made

- **The pirates section goes** (Chris, 2026-09-10).
- **The combat viewer stays as a page, and the landing page does not sell
  it.** The viewer is a tool. A visitor came to play.
- **The footer's legal line stays as it is.** It is the one paragraph that
  must not drift.
- **The summaries are hand-written, in `tour-page.ts`.** The skeleton's pitch
  is the station board's own shouted line, and a case conversion cannot
  tell a Krait from a krait. Thirteen sentences is a small table, and a
  test holds it complete.

## Open questions

None.

## Watch out for

- **`test/tour-page.test.ts` reads the pitch in the markup.** That check
  moves to the summary.
- **`vite.config.ts` passes the log markup into `tourHtml`.** The parameter
  goes with the example.
- **The landing page's images keep their files.** `combat-viewer.jpg` stays
  on disk, because the README still shows it.

## Verification

The gates always run: `npm run check`.

The tier: player-facing prose, one model and one builder. Nothing more runs.

Evidence:

- `test/tour-page.test.ts` holds a summary on every arc and every side job,
  and no shouted order line in the markup. Prove it able to fail: blank one
  summary for a run.
- The landing page carries no `trained`, `neural` or `neuroevolution`. A
  grep says so.
- Chris reads both pages on the preview.
