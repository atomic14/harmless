# The pages are right where a test reads them, and stale where none does

Review date: 14 September 2026. Source revision: `eb5a3b0`, branch
`the-ship-flies-itself`. The two pages are [`README.md`](../README.md) and
[`index.html`](../index.html), the landing page at
[harmless.atomic14.com](https://harmless.atomic14.com/).

No page changed during this review. Both pages are Chris's. CLAUDE.md says the README opening is his own
writing, and that the landing page is a player page.
This document lists what the code contradicts, what the code has that the pages
do not say, and what reads badly. A proposed plan is at the end, with the
questions only Chris can answer.

The short version. Every table and every number that a test reads is correct.
The Commands table, the footer line and the phone metas each have a gate. The
prose around them drifted. The README describes the missions of July, and it says a
survivor becomes cargo. It never says that the ship flies a course, or that
the game plays on a phone. The landing page tells a phone visitor that the
game needs a keyboard and a mouse, and its title does not fit a phone screen.

## Scope and measurement

The review read both pages in full. It checked every claim against the code
that runs:

- the scripts in `package.json` and the page inputs in `vite.config.ts`;
- the key map (`src/engine/keymap.ts`), the binding table
  (`src/game/bindings.ts`) and the command help (`src/game/command-help.ts`);
- the constants the pages quote, by name;
- the mission skeletons under `src/missions/skeletons/`;
- the wave ramp (`src/game/combat-sim-scenarios.ts`), driven with Node to get
  the wave numbers;
- the hull catalogue (`docs/ELITE-A.md`) and every file the README links.

It rendered the landing page in Chrome at 1512 pixels wide and in a 390-pixel
frame, and it measured the title's width in the frame.

Four tests read the pages. `test/key-help.test.ts` holds the README's Commands
table to the binding table in both directions. `test/site-footer.test.ts`
holds the footer line. `test/phone-page.test.ts` holds the phone metas.
`test/tour-page.test.ts` holds the missions page that the landing page links.
Everything those tests read is correct. Every finding below is in text that no
test reads.

## README.md

### High priority: the code contradicts the page

**1. The missions paragraph describes one mission. The game has fifteen.**
[`README.md:387`](../README.md#L387) says: "Navy missions — prove yourself
(16+ kills, galaxy 1) for the Constrictor hunt and the classified courier
run." That arc is still there
([`constrictor.ts:34`](../src/missions/skeletons/constrictor.ts#L34)). Beside
it the game now has:

- five arcs of the tour, one patron on each of five worlds across the first
  galaxy, seventeen legs in all
  ([`skeletons/arcs/`](../src/missions/skeletons/arcs/));
- eight side jobs, one per verb, drawn two or three per station from the seed
  ([`side.ts`](../src/missions/skeletons/side.ts)). Four of them wait for the
  commander. The gang hunt needs eight kills. The lane and the escort jobs
  need four. The recover and rescue jobs need fuel scoops
  ([`side.ts:42`](../src/missions/skeletons/side.ts#L42),
  [`:141`](../src/missions/skeletons/side.ts#L141),
  [`:175`](../src/missions/skeletons/side.ts#L175),
  [`:80`](../src/missions/skeletons/side.ts#L80));
- the Dark Wheel, four missions that open at Above Average and end at
  Competent, with a reward no shop sells
  ([`skeletons/wheel/`](../src/missions/skeletons/wheel/),
  [`constants/missions.ts:162`](../src/constants/missions.ts#L162)).

The page also never names the MISSIONS screen (R), the COMMANDER'S LOG (⇧R) or
the site's own [missions page](https://harmless.atomic14.com/missions), which
the landing page does link. The Commands table has the two rows, so the
reader meets the keys with no idea what they open.

**2. A survivor is not cargo, and the page says it is.**
[`README.md:393`](../README.md#L393): "scoop one and the survivor becomes,
regrettably, cargo". [`src/game/survivors.ts:12`](../src/game/survivors.ts#L12)
states the rule in capitals: a survivor is not cargo and must not become cargo
(docs/TODO/108). A survivor rides in the crew spaces, and the dock forces the
choice of what becomes of them (`screens/survivors.ts`). The sentence was true
once, and the code moved.

**3. The page never says that the ship flies a course.** That is this
branch's subject. The cockpit offers a course list
([`courses.ts:39`](../src/game/courses.ts#L39)). The list holds the jump,
the mission target, the station, a derelict, the rocks, the hermit, the
star, a run, and a canister to collect. A
computer flies the one the pilot picks, and a header over the view names it.
The `▶▶` button runs time forward while nothing hostile is near. The docking
computer is one button on that header. The manual says all of this. The
README's Docking section ([`:309`](../README.md#L309)) and its C key row
describe the game before the course list, and neither is wrong. The section
lacks the one thing the manual now leads with.

### Medium priority: the game has it, and the page does not say

**4. The game plays on a phone. The README does not say so.** Since plans 202
and 216 every command is a tap. That covers the docked rows, the screen
buttons, the gun row, the course header and the `◎` targets button. Plan 220 holds the zoom,
hides the address bar as a home-screen app and enlarges the chart. The word
"phone" appears once in the README, in the Docked section, and only as "tap or
click a row". A reader on a phone learns nothing about the flight buttons.

**5. The Architecture section is a July snapshot.** It lists six places under
`src/`. The tree has twelve directories. The section does not name these:

- `src/missions/`, the mission machine;
- `src/engine/`, the platform seam: the shell, the keymap, the phone chrome;
- `src/constants/`, every tunable, with a generated catalogue;
- `src/encyclopaedia/` and `src/viewer/`;
- `src/game/screens/`, twenty-one screen modules.

[`README.md:431`](../README.md#L431) still says the full-page
screens are "station menu, market, chart, status".
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md) maps all of it. The README could
point there and list the directories in one line each.

**6. The docs index omits the two documents an agent needs first.**
[`README.md:48`](../README.md#L48) lists ten documents.
[`docs/INVARIANTS.md`](INVARIANTS.md), [`docs/PROCESS.md`](PROCESS.md),
[`docs/TODO/README.md`](TODO/README.md) and
[`src/constants/CATALOG.md`](../src/constants/CATALOG.md) are not in it. Nor
are the three reviews: [`COMBAT-COMPUTER-REVIEW.md`](COMBAT-COMPUTER-REVIEW.md),
[`MISSIONS-REVIEW.md`](MISSIONS-REVIEW.md) and
[`MISSIONS-FLIGHT-REVIEW.md`](MISSIONS-FLIGHT-REVIEW.md). The README's opening says the agent is the contributor. INVARIANTS and
PROCESS are the two documents that contributor needs first.

**7. The Run block lists five of the eight pages.**
[`README.md:68`](../README.md#L68) names `/manual · /novella`. The build also
makes `/missions` and `/encyclopaedia`
([`vite.config.ts:133`](../vite.config.ts#L133)), and the landing page links
both.

**8. `npm run build` runs the whole gate, and the page says "lint + tests".**
[`README.md:69`](../README.md#L69) and [`:121`](../README.md#L121). `prebuild`
is `npm run check`. That gate runs lint, the tests, the size ceiling, the
constants, the palette, the claims, the plans and the map. It also runs the
titles, STE and five generator drift checks. A reader who runs `npm run build` should expect all of it, and its
run time.

### Low priority: it reads badly

**9. One fact appears five times.** "Nothing neural ships" is at
[`:30`](../README.md#L30), [`:125`](../README.md#L125),
[`:403`](../README.md#L403), [`:444`](../README.md#L444) and
[`:491`](../README.md#L491), each time with its own wording and its own
history. One home is enough, and the training log holds the history.

**10. The combat trainer essay sits inside Controls.** Lines
[`231`](../README.md#L231) to [`283`](../README.md#L283) are about fifty lines
of method and measurement, between the Docked table and the Market keys.
[`docs/COMBAT-SIM.md`](COMBAT-SIM.md) exists for that essay. The Controls
section needs the keys and one paragraph.

**11. The Run block holds the portrait pipeline.** Three commands for a GPU
box and a sibling repo sit between `npm run campaign` and the editor note. A
reader who wants to run the game trips over them. They belong in their own
short section, or in `tools/`.

**12. The sentences are long, and the house style is not applied.** The
README's AI part is outside the STE gate by Chris's decision. Still, the
sentences run to fifty and sixty words, with dashes and nested parentheses.
The rest of the repo reads differently now. Whether the AI part takes the
house style is Chris's call; it is one of the open questions.

**13. The screenshots are from 28 July.** `docs/images/` and `public/images/`
carry the same four files, unchanged since the landing page commit. The
cockpit since gained the course header, the gun row, the targets button and
the phone layout. The shots are not wrong. They show a cockpit a new player
does not get.

### Verified correct

These claims were checked against the code, and they hold:

- the Flight table for both layouts (`keymap.ts`), and the Commands table
  (gated);
- the Docked table, every row and the order
  ([`bindings.ts:265`](../src/game/bindings.ts#L265));
- the trainer keys, and the wave numbers, computed with `waveStage`. The
  count stops at 11. Missiles come at 12, E.C.M. at 14, a bounty hunter at
  16 and Thargoids at 18;
- the Market keys, the Chart keys (D, M, F, T, ENTER, ESC), the docking
  marker words, the S and E console lights;
- 100.0 Cr, 3 missiles, 7.0 LY, the 5-second countdown and the 20-tonne
  hold. 17 commodities, and three flight autosaves every 20 seconds. The
  ±25% price band, the Trumble at 2 credits, 38 hulls and 15 flyable. 16
  kills for the Navy;
- the TypeScript 7 editor note (`typescript ^7.0.2`);
- every linked file and image exists, and every `npm run` command exists;
- the Roadmap's "remaining" items: no gamepad code and no shipyard exist.

## index.html

### High priority

**1. The page tells a phone visitor the game needs a keyboard and a mouse.**
[`index.html:60`](../index.html#L60): "Free · in your browser · no account ·
keyboard and mouse". Plans 202, 216 and 220 to 222 made every control a tap.
A phone visitor reads that line under the LAUNCH button and leaves. Nothing
else on the page says the game plays by touch, or that it opens as an app from
the home screen. The metas say so to the phone; the copy does not say so to
the person.

**2. The title does not fit a phone screen.** In a 386-pixel viewport the
`h1` needs 409 pixels in a 338-pixel column. The last S is clipped, and the
document is 432 pixels wide, so the page scrolls sideways. The cause is
[`landing.css:38`](../src/landing.css#L38). The font size has a 56-pixel
floor, the letter spacing has a 10-pixel floor, and the text indent matches
the spacing. Eight letters at those floors need more than the column. A lower floor
on both (about 34 pixels and 6 pixels) fits, and `overflow-x: hidden` on the
body stops the sideways scroll as a belt. The stylesheet is not a player page,
so an agent can make that change.

### Medium priority

**3. "Nobody in the game tells you where to go" is now half true.**
[`index.html:120`](../index.html#L120). The new pilot's briefing opens by
itself on the first dock. The course header names the next thing to do, and
the console says where a mission target is. The three pages still help. The
sentence before them now undersells the game.

**4. The Dock bullet stops before the ship flies itself.**
[`index.html:83`](../index.html#L83): "Line up with the slot and go in slowly.
Buy a docking computer when you can afford one." True. The page never says
that a tap on the station, the rocks or the star flies the ship there. It
never says that `▶▶` runs the trip forward. The manual leads with it. For a visitor with a
phone it is the reason to launch.

**5. The zoom lock is on a reading page.**
[`index.html:5`](../index.html#L5) carries `maximum-scale=1.0,
user-scalable=no`. The game page needs it; a double tap in flight must not
zoom the cockpit. The landing page is prose, and that meta stops a reader's pinch
zoom of the text. Whether to keep it on the landing page is Chris's
call; the manifest and the app metas can stay either way.

**6. The missions page the card links has one stale line.**
[`tour-page.ts:54`](../src/missions/tour-page.ts#L54): "A Krait is taking
ships on the lane. Destroy it." The hunt is a gang of four since plan 217, led
by a Fer-de-Lance. Plan 199 decided that these summaries are hand-written, so
the test holds the table complete but not true. The page also says nothing
about the gates: a reader takes the hunt at zero kills and never sees it
offered.

**7. The screenshots are from July.** The same four files as the README. The
docking shot shows the cockpit with no buttons. A phone shot of the course
header would carry finding 1 on its own.

### Verified correct

The routes `/play`, `/manual`, `/novella`, `/missions` and `/encyclopaedia`
exist and build. The sitemap lists all eight pages. The metas, the Open Graph
tags and the JSON-LD agree with each other and with the page. The footer line
is gated. "Five people across the first galaxy", 2,048 worlds, 256 portraits,
seven light years, 100 credits, the Cobra Mk III and Lave's description all
hold. The desktop layout renders cleanly at 1512 pixels, and every section
below the title reads well in the phone frame.

## Adjacent findings

These are outside the two pages, and a reader reaches them from the pages.

- **The `?` guide says "toggle with B when docked".**
  [`keymap.ts:120`](../src/engine/keymap.ts#L120) writes that line into the
  help panel. Since plan 202 the docked menu has no letter keys, and the
  layout switch is the KEYBOARD LAYOUT row. It is code, not a player page, so
  an agent can fix it.
- **`MOBILE_CONVERSION.md`** sits untracked at the repo root. It is Chris's
  own notes on the phone and on a story-led game. This review did not use it.
  Its subject overlaps the landing page copy in finding 1 and finding 4.

## Proposed plan

One plan under `docs/TODO/`, kind docs, four milestones. The order puts the
two wrong claims first, then the phone, then shape.

- **M1. The landing page says what the game is today.** Replace the
  keyboard-and-mouse note. Add one bullet to "What's in it" for the phone and
  the home screen. Rewrite the "Nobody tells you" sentence. Extend the Dock
  bullet, or add a Fly bullet, for the course list. Fix the title's floors in
  `landing.css` and measure it again in the 390-pixel frame. Decide the zoom
  lock. Chris writes or approves every sentence of copy.
- **M2. The README's facts match the code.** Rewrite the missions bullet for
  the tour, the side jobs and their gates, and the R and ⇧R screens. Fix the
  survivor sentence. Add a Courses paragraph to Docking, and a Phone paragraph
  to Controls. Add `/missions` and `/encyclopaedia` to the Run block. Say what
  `npm run build` runs. Add the absent documents to the docs index. Rewrite
  the Architecture list from `docs/ARCHITECTURE.md`. Sentences of fact only;
  the opening stays as Chris wrote it.
- **M3. The README has one home per fact.** Move the trainer essay to
  `docs/COMBAT-SIM.md` and leave the keys. Collapse the five "nothing neural"
  passages to one. Move the portrait pipeline out of the Run block. Apply the
  house style to the AI part if Chris says yes.
- **M4. The adjacent lines.** Fix the hunt summary in `tour-page.ts` and show
  each side job's gate on the missions page. Fix the help panel line in
  `keymap.ts`. Take new screenshots, desktop and phone, if Chris wants them.

### Open questions for Chris

1. Does the README name the Dark Wheel? It is a secret in the game. The README
   is the developer's page, and its key table already says "no shop sells it".
   The landing page should not name it.
2. Does the landing page keep the zoom lock? The game page keeps it either
   way.
3. Who writes the landing copy? The agent can propose the sentences in a plan
   for Chris to edit, or Chris writes them and the agent measures the layout.
4. Does the trainer essay leave the README for `docs/COMBAT-SIM.md`?
5. Does the AI part of the README take the house style, and the STE gate with
   it?
6. New screenshots now, or after the phone layout settles?
