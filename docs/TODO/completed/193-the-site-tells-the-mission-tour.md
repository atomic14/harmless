# 193 — The site tells the mission tour

**Kind:** feature · **Severity:** low · **Size:** medium · **Depends on:**
191, 192 · **Blocks:** nothing · **GitHub:** none

## Where we are

### Project context

HARMLESS is a browser space game built with TypeScript, Vite and three.js.
It is an unofficial, non-commercial tribute to Elite (1984). The site has
seven pages: the landing page, the game, the manual, the novella, the
encyclopaedia, the ship viewer and the gallery. Each is a Vite input in
`vite.config.ts`, and each is in `public/sitemap.xml`.

docs/TODO/190 built the mission machine and the LOG screen. An **arc** is a
main story mission. A **patron** is the person who offers it. A **dossier**
is its generated words. The **journal** is a commander's record of mission
events. docs/TODO/191 writes the dossiers and the patrons. docs/TODO/192
writes the arcs.

### What the code says today

**The story and the map are pure, and the game shows them.** `storyPages`
in `src/missions/story.ts` turns a journal into pages. `routeMapSvg` in
`src/missions/route-map.ts` draws the visited worlds as SVG text.
`renderLog` in `src/ui/screens-log.ts` paints both into the game's screen
through `show()`, which needs a document.

**A page is built from data at build time.** `vite.config.ts` has a plugin,
`encyclopaediaEntries`, that writes 256 entries into `encyclopaedia.html`
at a marker in the `transformIndexHtml` hook. `src/encyclopaedia/entry.ts`
builds each entry from the galaxy. The same hook fills the footer marker on
every page, and `test/site-footer.test.ts` checks every page carries it.

**A page has four homes to keep.** A page is a Vite input, a sitemap entry,
a card on the landing page, and a path in `test/ladder-words.test.ts`. That
test scans the site's prose for the three ladder words. Invariant 2 in
`docs/INVARIANTS.md` says an internal link omits `.html`.

**The player-facing pages are exempt from the prose gate.** `CLAUDE.md`
names the manual, `index.html`, the briefing and the novella. The new page is
one of them.

**The tour has no page.** Nothing on the site says what the missions are,
who offers them, or how a failure becomes a branch.

## What to do

Add `missions.html`, the mission tour. It is a static page built from the
skeletons, the patrons, the dossiers and the galaxy at build time. It shows
the five arcs in order, each patron with a face, and the route across
galaxy 1. It shows the side jobs by verb. It shows one worked example of a
failure that becomes a branch.

### M1 — The tour as data

1. Add `src/missions/tour-page.ts` with a pure `tourModel(systems)`. It
   lists the arcs in tour order. Each arc carries the start world, the
   patron, and the dossier's title and briefing. Each arc carries the legs
   in words, the recovery legs, and the jumps to the next arc. It lists the
   side jobs by verb. It builds the
   route SVG of the arc start worlds through `routeMapSvg`.
2. Extract the HTML builder from `renderLog` into `logHtml(view)` in
   `src/ui/screens-log.ts`, and let `renderLog` call it. The page reuses the
   builder for its worked example, so the game and the site cannot tell a
   story two ways.
3. Add `test/tour-page.test.ts`. Check the order, the patron per arc, the
   jumps, and that every side job appears under its verb. Check that the
   builder produces the same markup for the game and the page.

### M2 — The page

1. Add `missions.html` with the manual's stylesheet, the site navigation,
   the footer marker and a canonical link. Add a marker where the tour goes.
2. Add a `missionTour` plugin to `vite.config.ts`, shaped like
   `encyclopaediaEntries`. It fills the marker from `tourModel` at build
   time.
3. Add the page as a Vite input and a sitemap entry. Add a card on the
   landing page beside the novella. Add its path to `test/ladder-words.test.ts`.
4. Add the page to `test/site-footer.test.ts`'s scan, if the scan lists
   pages by name rather than by directory.

### M3 — The worked example and the links

1. Build the worked example from a fixed journal: the scientist's pod lost,
   the data delivered, the next arc still open. Render it with `logHtml`.
   Say in one paragraph why a failure is a branch.
2. Link the page from the manual's mission section and from the in-game
   briefing's mission line, with clean links.
3. Check the page in a browser at desktop and phone widths. The route SVG
   must scale with its column, and no table may scroll the page sideways.

## Decisions already made

Chris made these decisions on 2026-09-06 (docs/TODO/190):

- Provide a commander's log in the game and a mission story page on the
  site. The game's log landed with docs/TODO/190 M5.
- The site stays static. Generated content is committed.
- The story renderer is designed for reuse by the site work.

## Open questions

Use these answers unless Chris changes them:

- **Does the page show a player's own log?** No. A save lives in the
  browser's storage, and the page has no game running. The page shows the
  tour, and the game shows the log. A page that reads a pasted save file is
  a later option.
- **Does the page spoil the arcs?** It shows each arc's title, patron, start
  world and briefing. It does not show the branches or the endings, except
  in the one worked example, which uses a side job.

## Watch out for

- The page reads `SKELETONS`, and `SKELETONS` imports `ship-specs.ts` for a
  design id. The build must not pull three.js into the page. Check the built
  page's bundle, as `index.html` is kept free of the game's bundle.
- `test/ladder-words.test.ts` reads the page's prose. REPUTATION, LEGAL
  STATUS and RATING keep their one meaning each.
- The dossiers are docs/TODO/191's, and the arcs are docs/TODO/192's. The
  page must build with the plain words when either is absent, as the game
  does.
- A build-time plugin runs under Node. `tour-page.ts` must import nothing
  that reaches a document or a window.

## Verification

Run `npm run check` after each milestone. Run `npm run build` after M2, and
open the built page.

Require this evidence before the plan is complete:

- `tourModel` lists the arcs in tour order with the right jumps, and every
  side job under its verb.
- The game's LOG and the page's worked example come from one builder.
- The built page carries the footer, is in the sitemap, and is linked from
  the landing page with a clean link.
- The page builds with the dossier table emptied.
- The route SVG scales with its column at phone width.

Temporarily introduce each fault below to prove that its test can detect it.
Restore the correct implementation after each check.

| Temporary fault | Required test failure |
| --- | --- |
| Swap two arcs in the tour order | Wrong order |
| Drop one side job from the model | Verb without its job |
| Remove the footer marker from the page | Page without the footer |
| Write `.html` into the landing card's link | Unclean link |

## Outcome

Landed on 2026-09-07, in three milestones, one commit each. The site has
`missions.html`, built from the skeletons, the patrons, the dossiers and
the galaxy at build time, and the queue is empty.

### What the milestones did

- **M1.** `missions/tour-page.ts` is the tour as data: the five arcs in
  order with their worlds, patrons, briefings, legs and recovery legs, the
  jumps between them, the side jobs by verb, and the route SVG. `logHtml`
  in `ui/screens-log.ts` is the one builder of the log's markup, and the
  test finds it verbatim in the captured LOG screen.
- **M2.** The page, the `missionTour` plugin, the Vite input, the sitemap
  entry, a third card on the landing page, and `tour-html.ts`, which
  escapes every word a model wrote. The built page has no script.
- **M3.** The worked example through `logHtml`, the manual's Missions
  section, the briefing's line, and the browser check at two widths.

### What the plan did not have

- **The manual had no mission section**, and the briefing and the landing
  page both said nobody would give you a mission. All three are corrected.
- **The ladder-word scan reads pages by directory**, so the new page joined
  it with no edit. The footer test reads the Vite inputs, so the same.
- **The browser's window would not shrink to phone width.** A same-origin
  frame at 390 pixels answers the same question, because media queries
  follow the frame's viewport.
- **A restore by git does not restore an untracked file.** The by-hand
  proofs restore by hand where the file is new.
- **A leg line on the page mixes cases** if the target slot fills in lower
  case, so it fills in the line's own shouted case.

### Measurements

- 5,503 assertions, from 5,462.
- The built page is 25 KB of markup with no script, five arcs, five faces,
  two route maps, nine table rows and the footer.
- At 388 pixels the page is 388 wide, the route and the table are 348, and
  a face is 96.
