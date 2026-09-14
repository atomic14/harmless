# 225 — The briefing tells a new pilot five things, in the cockpit's own words

**Kind:** fix · **Severity:** medium · **Size:** small · **Depends on:**
224 · **Blocks:** nothing · **GitHub:** none

## Where we are

Chris, 2026-09-14: *"I think the new pilot briefing needs a rework?"* and,
after the review below, *"Ok fix it all up."*

The briefing has seven pages of 100 to 180 words. Its flow is right: launch,
JUMP TO, FLY TO THE STATION, the fight, the dock. Its details describe an
older cockpit. It puts FIRE LASER at the bottom right and the target icon
above it. The gun row is in the console since docs/TODO/215, and the icon
is at the bottom left since docs/TODO/222. It says a second press of ARM
MISSILE fires; FIRE MISSILE is its own button. It names the keys Y, E, C and
? for a phone that has none of them. It says nobody tells you where to go,
and the course list does. It never says the word fuel.

On a 390-pixel phone the fight page is 743 pixels tall in a 672-pixel box,
so it scrolls and the pager falls off the bottom. On page one the keyline
wraps under the button row. The tour link renders in browser blue.

## What to do

Two milestones.

- **M1. Five pages, one action each.** Where you are; buy, sell and fuel;
  go; a fight; dock. Every button is named by its words, and no key is
  named, because the `?` guide and the manual hold the keys. No sentence
  says where a button is, except the course list at the top right, which
  a first flight must find. Fuel and the CONTRACTS, MISSIONS and EQUIP SHIP
  rows are named. The edition counter bumps, so every commander reads the
  new briefing one time. The test that reads the briefing asks for the
  rows and the buttons, and for no key at all.
- **M2. The screen fits a phone.** The pager and the keyline stay inside
  the box on a phone. A link in a screen takes the palette. The manual link
  is clean, as every other link on the site is.

## Decisions already made

- **Buttons by their words, keys not at all** (Chris chose to lead with the
  buttons, docs/TODO/224).
- **The edition bumps.** A returning pilot reads the new pages one time,
  and the marker rides the save as before (docs/TODO/106).
- **The manual keeps the rest.** Anarchies, contraband, shields and the
  worked first run stay in the manual, which the last page links.

## Open questions

None.

## Watch out for

- **`test/key-help.test.ts` reads the briefing** for the rows, the buttons
  and the death line. Its journey list asked for three keys. It asks for
  none now, and its control still holds.
- **`test/ladder-words.test.ts` reads the briefing** for a ladder word used
  for another ladder. "Rating" is the combat ladder's own word.
- **The onboarding test reads `BRIEFING_VERSION`** and asserts the edition,
  not the number.

## Verification

- `npm run check` passes.
- Each page fits the 390-pixel frame with the pager and the buttons in view.

## What the milestones found

**M1.** Five pages of 76 to 118 words, where seven pages ran 100 to 180. In
the 390-pixel frame every page fits its box with no scroll, and the pager
and the buttons are in view. The edition is 2, and a commander who read
edition 1 reads the new pages one time. The journey test asks for seven
rows and fourteen buttons. It holds that no key of the flight table or the
global table is quoted. The onboarding test and the ladder test pass.

**M2.** The keyline stood under the sticky button row on a phone, and a
short page slid it behind the row. It stands above the buttons now. The
tour link rendered in the browser's blue; a link in a screen takes the
palette green. The manual link is `/manual`, as the site's links are.

## Outcome

Landed on 2026-09-14, in two commits. The briefing is five pages in the
buttons' own words, with no key and no position but the course list. It
names fuel, CONTRACTS, MISSIONS and EQUIP SHIP. Every page fits a phone
with the pager and the buttons in view.
