# 223 — The pages say what the game is, and leave the history to the logs

**Kind:** docs · **Severity:** medium · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

[`docs/PAGES-REVIEW.md`](../PAGES-REVIEW.md) reviewed `README.md` and
`index.html` on 2026-09-14. Every table and number that a test reads is
correct. The prose that no test reads drifted. The README describes the
missions of July, says a survivor becomes cargo, and never says that the
ship flies a course or that the game plays on a phone. The landing page says
"keyboard and mouse" under the LAUNCH button, and its title does not fit a
phone screen.

Chris, 2026-09-14: *"Ok let's clean things up. There's a lot of old content
in there. We don't need all the old history. The landing pages are aimed at
people who want to play the game. The readme file is aimed at people who
might want to understand the project. They don't need war and peace on all
the decisions we made and things that we discarded."*

## What to do

Three milestones.

- **M1. The landing page speaks to a player.** The note under LAUNCH says
  the game plays with a keyboard, a mouse or a touch. One bullet says the
  ship flies a course to what you tap. One bullet says the game plays on a
  phone and opens from the home screen. The "Nobody in the game tells you
  where to go" sentence says what the game does tell you. The title fits a
  phone: the stylesheet lowers the floors of its size and its spacing, and
  the body never scrolls sideways. The frame at 390 pixels is measured again.
- **M2. The README says what the project is.** Chris's opening stays as he
  wrote it. The part after the rule is written again, shorter. It says what
  the game is, how to run it, the controls, the systems, the missions as they
  are, the course list, the phone, the shape of the source, the documents,
  the legal notice and what remains. The history of the neural pilots, the
  trainer essay, the playtest harnesses and the portrait pipeline leave the
  README. The training log and the trainer document hold them. The sentences
  that tests read stay, in the same words.
- **M3. The two lines the pages reach.** The missions page says the hunt is
  a gang, and each side job says what it waits for. The `?` guide stops
  telling a pilot to press B when docked.

## Decisions already made

- **The landing page is for a player, and the README is for a reader of the
  project** (Chris, 2026-09-14). Neither carries history.
- **The README's opening is Chris's own writing.** It does not change.
- **The README stays the home of the Commands table.** `test/key-help.test.ts`
  holds it to the binding table in both directions, and it stays where the
  test reads it.
- **The Dark Wheel keeps its secret on both pages.** The README says a secret
  organisation exists at the higher ratings, and no more. The landing page
  does not name it.
- **The trainer keeps one paragraph in the README, with its keys.** Three
  tests read the README for those keys, and the paragraph keeps their words.

## Open questions

- **The zoom lock on the landing page.** `index.html` carries
  `user-scalable=no`, which the game page needs and a reading page does not.
  `test/phone-page.test.ts` asserts it on both. This plan leaves it, because
  it is behaviour and not content. Chris decides.
- **New screenshots.** The four images are from 2026-07-28. This plan does
  not replace them.

## Watch out for

- **Four tests read README prose.** `test/key-help.test.ts` reads the
  Commands table under its exact heading, the Docked section between its
  heading and the trainer heading, and two sentences of the "New to Elite?"
  section. `test/combat-sim.test.ts`, `test/combat-sim-panel.test.ts` and
  `test/combat-sim-compare.test.ts` read the COMBAT TRAINING row and four
  phrases of the trainer paragraph. The new text keeps those words.
- **Five tests read the landing page.** The phone metas, the footer marker,
  the clean links to `/missions` and `/encyclopaedia`, and the ladder words.
  A new sentence on the page never uses "reputation" for the combat rating.
- **The house style does not gate the README or the landing page.** The
  README's new part still follows it, because it is the agent's writing.
- **The `?` guide's layout line is in two places.** `keymap.ts` writes it,
  and `play.html` holds its first value. Both change.
- **The summaries on the missions page are hand-written** (docs/TODO/199).
  The hunt line changes in `tour-page.ts`, and the test's table changes with
  it.

## Verification

- `npm run check` passes.
- The landing page in a 390-pixel frame shows the whole title, and the
  document is no wider than the viewport.
- Every claim of fact in the new README is checked against the code, and
  the review names the file for each.

## What the milestones found

**M1.** In the 390-pixel frame the title needed 409 pixels in a 338-pixel
column, and the document was 432 pixels wide. With the floors at 34 pixels
and 5 pixels the title is 42 pixels tall with 12 pixels of spacing, it
fills the column exactly, and the document is 386 pixels wide, which is
the viewport. The desktop size is unchanged: 11vw and 3vw reach the same
ceilings at 1512 pixels that 13vw and 4vw did. The five tests that read the
page pass.

**M2.** The README went from 505 lines to 370, and Chris's opening did not
change. The part after the rule is new. It keeps the three tables the tests
read, in the same words, and the seven phrases four tests pin. The trainer
essay, the two playtest harnesses, the portrait pipeline and four of the
five passages on the retired neural pilots left the README. The training
log and the trainer document hold them. Every number and every name in the
new part was checked against the code during the review. The Charts keys
are a table now, as the Flight keys are. The four tests that read the
README pass.

## Outcome

(filled when the plan lands)
