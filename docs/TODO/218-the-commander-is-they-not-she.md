# 218 — The commander is they, not she

**Kind:** fix · **Severity:** medium · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

Chris, 2026-09-13: *"at some point we seem to have slipped into the
referring to the user as "She" "her" - I think we may have taken the
novella as fact. But the player is the player and they give the pilot a
name that can have any gender."*

The novella is Chris's own page, and its pilot is a character with a
gender. The comments, the constants' doc comments, the reference docs,
the tests and the training tools took that pronoun for the commander.
So did the dossier prompt: it said "aboard her ship" and "the day she
took the job", and every generated dossier learned it.

Other characters keep their pronouns. A patron, a rescued pilot, the
surveyor at Vetitice and the administrator at Xeer are people the
skeletons describe, with a gender of their own. A ship called "her" in
the nautical way stays too.

## What to do

One milestone, and one run of the generator by Chris.

- The dossier prompt names the commander as the player, of any gender,
  and asks for "they" and "the commander". Its version rises to 4, so
  every dossier's hash moves, and one run of the generator writes all
  fourteen again.
- Every comment, doc comment, test label and reference doc that calls
  the commander "she" or "her" says "they" or "the commander" instead.
  The sentence caps hold, so a sentence that grows splits in two.
- The archive stays as it was: the completed plans, the research, the
  logs and the novella are records or Chris's own pages.

## Decisions already made

- **"They" and "the commander"**, never a guess at a gender (Chris,
  2026-09-13).
- **Other characters keep their pronouns.** The rule is about the player.

## Open questions

None.

## Watch out for

- **The sentence caps.** "The commander" is two words where "she" was
  one, and the gate reads every comment in `src/`.
- **A test that compares a game string with HER** about a rescued pilot
  compares it still.
- **The catalogue** is generated from the constants' doc comments, so it
  is written again after the sweep.

## Verification

The gates always run: `npm run check`.

The tier: prose alone. No rule of the game changes.

Evidence:

- A grep for the four words over `src/`, `test/`, `train/*.ts`, `tools/`
  and the reference docs finds only lines about another character or a
  ship.
- The drift gate passes on the fourteen dossiers Chris writes again.

## What the milestones found

(filled in as it lands)

## Outcome

(filled in at the end)
