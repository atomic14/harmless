# Open ~~Source~~ Vibe Code

You can play HARMLESS here: https://harmless.atomic14.com/

This is a bit of an experiment. I have not looked at the code. I have no intention of looking at it. All the work has been done by Claude and other coding agents. In fact, this is the first piece of editing I've done!

The repo is Open Vibe Code (yes, I've invented a new thing!). If you want to contribute, don't open a PR - I won't be accepting any code that way.

Instead create an [issue](https://github.com/atomic14/harmless/issues/new) and describe what you want. Periodically, I'll run Claude (or other coding agent of the day) and have it run through the issues and address them.

I'm not completely sure how this will work yet - it might ask questions and clarifications - or it might just go and implement something. We'll find out!

I owe a great deal of thanks to this website - [Elite on the 6502](https://elite.bbcelite.com) - and quite likely a lot of other information that LLMs have trained on.

And now I'll hand you over to the AI.

---

# HARMLESS

*An unofficial browser tribute to **Elite** (1984) by David Braben and Ian
Bell. Harmless is the combat rating you start at. The ladder ends at
E L I T E.*

It runs in a browser, on a desktop or a phone, with no install and no
account. The galaxy is the original: the 1984 seeds make all 2,048 worlds,
and Lave is system 7. The ships are wireframes from the released ship data.
The suns and the planets are shaders. Two hand-written pilots fly the other
ships: a pursuit dogfighter for the pirates, and a three-phase attack run for
the traders that fight back. The combat computer you can buy flies the
pursuit pilot on your side.

![Approaching a Coriolis station with the docking aid live](docs/images/station-docking.jpg)

| | |
| --- | --- |
| ![A seeded shader planet](docs/images/planet.jpg) | ![The Short Range Chart](docs/images/short-range-chart.jpg) |

*Every planet comes from the 1984 seeds. Diso's violet coastlines above, and
"Population: 4.1 Billion (Black Furry Felines)", as the original's data
tables intend.*

## Play

Play it at https://harmless.atomic14.com/. You start docked at Lave Station
with 100.0 Cr, a full tank and 3 missiles.

**Saving.** COMMANDER FILE on the station menu names a save. The same name
again replaces it, and it asks first. The game also keeps its own saves. A
station autosave is written at every dock and every launch. The last three
flight autosaves are kept, one every 20 seconds. Close the tab mid-fight and you resume where
you were. Die, and the station autosave puts you back where you launched
from.

## New to Elite?

- The **[Flight Training Manual](https://harmless.atomic14.com/manual)**: how
  to trade, jump, dock and survive, with a first run worked against the
  game's own market.
- **[The Long Way Out](https://harmless.atomic14.com/novella)**: an original
  novella, with papers from the eight galaxies.
- The **[missions page](https://harmless.atomic14.com/missions)**: who has
  work for you, and what each job is.
- The **[encyclopaedia](https://harmless.atomic14.com/encyclopaedia)**: the
  256 worlds of the first galaxy, each with a portrait of its inhabitants.

In-game, the new pilot's briefing opens by itself the first time a commander
docks. **NEW PILOT'S BRIEFING** on the station menu reopens it, and **?**
shows the controls at any time.

## Run

```sh
npm install
npm run dev     # http://localhost:5173            the landing page
                # /play · /manual · /novella · /missions · /encyclopaedia
                # /viewer  the combat viewer   ·   /gallery  all 38 hulls
npm test        # the tests alone (no framework)
npm run check   # the whole gate: lint, tests, sizes, constants, prose, generators
npm run build   # runs the gate first (prebuild), then builds to dist/
```

The live site deploys from Cloudflare Pages with `npm run build`, so a commit
that fails the gate fails the deploy.

> **Editor and agent setup.** This project uses TypeScript 7. That version is
> a native compiler. It ships no `tsserver.js`. An editor or a coding agent
> that starts `typescript-language-server` therefore fails with "Could not
> find a valid TypeScript installation". Point the tool at the TypeScript 7
> language server instead. The command is `npx tsc --lsp --stdio`.

## Controls

Two flight layouts ship. **CLASSIC**, the 1984 keys, is the default.
**KEYBOARD LAYOUT** on the station menu switches to MODERN (WASD), and the
browser remembers the choice. **?** shows the in-game guide for the active
layout.

### Flight

| CLASSIC (default) | MODERN | Action |
| --- | --- | --- |
| S / X | W / S | dive / climb — pitch (in both: ↓ arrow pulls up) |
| `,` / `.` | A / D | roll (arrows work in both) |
| SPACE | SPACE | accelerate |
| `/` | X or `/` | decelerate |
| A (or F) | F | fire laser (watch the temperature) |

The original's `<` `>` roll and `/` slow-down work in both layouts. The arrow
keys always fly.

**Mouse flight**: **V** in flight pointer-locks the mouse as a self-centring
stick, and the left button fires. A flight key overrides it. ESC or V
releases it.

### Commands (identical in both layouts)

| Key | Action |
| --- | --- |
| 1 2 3 4 | front / rear / left / right view |
| T / M / U | arm missile (locks in your sights) / fire / unarm |
| E / TAB | E.C.M. / energy bomb (if fitted) |
| Z | cloaking device — nobody sees you while it runs (if you ever come by one; no shop sells it) |
| J | torus jump drive (8×, stars streak; cuts out when mass-locked) |
| C | docking computer — flies you in; press again or touch the controls to take over |
| ⇧C | contracts — the work you have signed for; the board itself is a station's |
| K | combat computer — a scripted co-pilot flies your ship onto your attacker's six (if fitted) |
| N / G | short range chart / galactic chart |
| H / ⇧H | hyperspace jump / galactic hyperdrive (if fitted) |
| B | distress beacon — GalCop tows you out of witch-space, for your cargo |
| Y / ⇧Y | jettison a tonne of cargo / five at once — pirates came for the goods, not for you |
| O | jettison a tonne of the ILLEGAL cargo — the evidence, which is rarely the most valuable thing aboard |
| L | offer the police ship in front of you money — he may refuse and report you; it never clears your record, and it always costs your name |
| I | commander status |
| R | missions — the ones on offer, the ones you hold, and the leads to the next |
| ⇧R | commander's log — every mission you took, told as a story, with the route flown |
| P | pause |
| Q | escape pod — abandon ship; the pod lands you at the station, and the ship and the cargo are gone (if fitted) |
| ⇧Q | **while paused only** — quit this flight; asks first, then puts you back at the station autosave you launched from |
| F | **while paused only** — arm the drive to mis-jump; every jump lands in witch-space, Thargoids and all, until you pause and press it again (the Spectrum's cheat) |
| V | mouse flight — pointer-locked analogue stick, left button fires |
| ? | controls guide |

Views are on 1-4 (the original used F0-F3) and screens on letters (F4-F9),
because browsers claim the function keys.

### The ship flies a course

A course is one thing the ship does next by itself. LAUNCH offers the jump,
the rocks and the star. In flight, the buttons over the view offer what is in
the sky. FLY TO THE STATION is always there. The mission target, a derelict,
the rock hermit and a canister to collect show when they exist. RUN FOR IT
shows when ships attack you. Tap one and a computer flies it. A header names what the ship is doing, and **▶▶** runs
time forward while nothing hostile is near. A flight key takes the stick
back.

FLY TO THE STATION lines the ship up on the slot. A fitted docking computer
then takes it in. Without one, the rails hold you on the slot's axis, and you
match the slot's roll and the speed yourself.

### On a phone

Every command is a button. The gun row under the view is FIRE LASER, ARM
MISSILE, FIRE MISSILE, E.C.M. and CLOAK. The **◎** icon with a count opens
the target list, and it reads red while a ship on the scanner attacks you.
The station menu is rows, and every screen has its buttons. Add the page to
the home screen and it opens as an app with no address bar. A double tap or a
pinch never zooms the cockpit.

### Docked

The station has no letter keys. Every command is a row on the menu: tap or
click a row, or move to it with ↑↓ and press ENTER. ESC goes back. The rows,
in order:

| Row | What it does |
| --- | --- |
| LAUNCH | launch |
| MARKET PRICES · CONTRACTS · EQUIP SHIP | buy and sell · the board and the work you signed for · fuel, missiles and upgrades |
| PAY FINE | clear an Offender or Fugitive record |
| LOCAL CHART · GALACTIC CHART · DATA ON SYSTEM | the charts, and a report on the world you stand on |
| COMMANDER STATUS | who you are, what you carry, how you rank |
| MISSIONS | every standing order you are under, in one place, and the offers here |
| COMMANDER'S LOG | every mission you took, told as a story |
| **COMBAT TRAINING** | **combat training simulator** — practise a fight; nothing in it reaches your commander |
| NEW PILOT'S BRIEFING | what to actually do, page by page |
| KEYBOARD LAYOUT | switch the flight keys between CLASSIC and MODERN |
| COMMANDER FILE | named saves and autosaves (on that screen: S saves the run · ENTER loads, asking first · D deletes · R changes what you are called) |
| EXPORT SAVE · IMPORT SAVE | a save file out, or in |
| TEST MODE | development levers; a career that switches them on says so on its status screen, for good |
| NEW COMMANDER | start again (confirms first) |

### Combat training simulator

Free, at every station, from the menu. Pick a mode: one scored fight, endless
sparring against one hull, or escalating waves. Then pick a scenario, a
threat tier and an optional seed, or build the opposition yourself. ENTER launches.
**L** re-opens the last report. **ESC** or **Q** ends the exercise.
**HOME/END** go to either end of a list.

It is the real game: real flight model, real pilots, real guns. But
**nothing that happens in it leaves it**: no kills, no rating, no credits, no
legal status, no save. The one exception is the furthest wave you reached,
kept with the commander and read by nothing else. Afterwards you get a
report, and it exports as JSON. **←→** walks the recent records.
**ENTER** holds two of them side by side when they are one fight flown twice.
[docs/COMBAT-SIM.md](docs/COMBAT-SIM.md) is the full description.

### Market

↑↓ select · B buy · V sell · ESC exit

### Charts

| Key | Action |
| --- | --- |
| click, or the arrows | move the cursor to a system |
| ENTER | set the hyperspace target |
| D | data on system |
| M | market estimate |
| F | find a system by name |
| T | cycle the trade overlay |
| ESC | exit |

A **red ring** marks a system where merchants report heavy pirate activity.
The trade overlay draws the lanes with more than one convoy on them, and then
the worlds whose prices sit well off the 1984 baseline.

### Docking and the console

Fly into the docking port with your wings matched to its rotation. An amber
marker shows the port, with an arrow at the screen edge when it is behind
you. It turns green and reads DOCKING PORT — LINED UP when you are on the
axis and rolled to match. Get it wrong and you bounce off with shield damage.

In a fight, a red arrow at the screen edge points at the nearest hostile you
cannot see. The console lights an **S** while the station is in scanner
range, and an **E** when an E.C.M. broadcast is detected.

## Game systems

- **Trading**: 17 commodities with the original price and quantity model. A
  20-tonne hold. Precious metals and gems take no hold space.
- **Combat**: pulse, beam and military lasers with heat, on four mounts.
  Homing missiles lock on what is in your sights, and an E.C.M. answers
  theirs. Kill ratings run from Harmless to E L I T E. Damage is the released game's own arithmetic
  ([docs/ELITE-A.md](docs/ELITE-A.md), [docs/DAMAGE-PATHS.md](docs/DAMAGE-PATHS.md)).
- **Hyperspace**: a 7.0 LY tank, fuel by chart distance, a 5-second countdown.
- **Death**: ENTER takes you back to the station autosave you launched from.
  An escape pod saves you, at the cost of the ship and the cargo. S opens the
  commander file instead.
- **The law**: CLEAN, OFFENDER, FUGITIVE. Police scan for slaves, narcotics
  and firearms. Bounty hunters stalk offenders. Fines on docking. Shoot the
  station and it scrambles Vipers.
- **A living galaxy**: traders, pirates and police work every system while
  you are in it. Convoys run between all 256 worlds while you are not. Prices
  drift up to 25% from the 1984 baseline, pirate hotspots emerge on dangerous
  routes, and the system data screen reports the news.
- **Pirates as businesses**: what waits for you depends on what you are
  visibly worth: cargo, hold, laser, reputation, and never your bank balance.
  An empty Cobra draws opportunists. A full hold draws professionals. They
  came for the cargo, so **jettisoning it (Y) buys them off**.
- **Witch-space**: a mis-jump drops you among Thargoids and their drones. Out
  of fuel out there, a distress beacon (B) brings GalCop, for your cargo.
- **Mining, scooping and survivors**: a mining laser breaks asteroids into
  ore. Fuel scoops take drifting cargo, and a sun skim refuels the tank. A
  scooped escape capsule holds a person, not cargo, and the dock asks what
  becomes of them.
- **Contracts**: every station board has cargo runs, courier jobs and
  bounties from your first landing, with deadlines in days.
- **Missions**: the Navy's Constrictor hunt after 16 kills in galaxy 1, as in
  1984. Five people on five worlds across the first galaxy each give you a
  chain of jobs, and each chain leads to the next. Every station board holds
  two or three side jobs of eight: hunt a gang, deliver, recover, rescue,
  clear a lane, smuggle, escort, scan. A gang hunt waits for eight kills, a
  lane or an escort for four, a recovery or a rescue for fuel scoops. At the
  higher ratings a secret organisation sends for you, with a reward no shop
  sells. **R** lists your missions and the offers, and **⇧R** tells each one
  as a story.
- **Encounters**: rock hermits deal ore among the asteroids, derelict
  generation ships drift between the stars, and someone sells a Trumble for
  2 credits. Buy it and see.
- **Two ship pilots**: pirates fly `pursuit`, which chases onto your six and
  breaks into an attack run when you turn on it. Armed traders fly
  `attack-run`, in three phases: close, fire through the pass, come round.
  Both are code. The neural pilots the project once trained were retired,
  and [docs/TRAINING-LOG.md](docs/TRAINING-LOG.md) keeps that history.

## Architecture

One world state exists. A fixed, seeded step advances it, and the renderer
only reads it. A module decides and returns an event, and the orchestrator
applies it. The platform stays behind `src/engine/shell.ts`, so the whole
game runs headlessly under Node for the tests.
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) is the map. The directories:

- `src/galaxy/`: the 1984 galaxy algorithm, and the trade that runs between
  its worlds while you play.
- `src/ships/`: all 38 released hulls as vertex, edge and face tables,
  generated from the vendored reference pack ([docs/ELITE-A.md](docs/ELITE-A.md)).
- `src/world/`: the shader sun and planet, the starfield, the scene.
- `src/game/`: the orchestrator, the world, the flight loop, the NPC pilots,
  the courses, the law, the market, the commander and the saves.
  `src/game/screens/` is one module per full-page screen.
- `src/missions/`: the mission machine. A skeleton is one mission's rules. A
  dossier is its generated words. One pure step reads an event and returns
  the effects the game applies.
- `src/hud/`, `src/ui/`: the console, the buttons over the view, and the
  screens' markup.
- `src/engine/`: the platform seam: the shell, the render stack, the key map,
  the phone chrome.
- `src/constants/`: every tunable, each with its rule beside it.
  `CATALOG.md` there is generated from them.
- `src/encyclopaedia/`, `src/viewer/`: the encyclopaedia page and the combat
  viewer.
- `src/ai-training/` and `train/`: the render-free combat simulator and the
  trainer that once bred neural pilots. The game loads no weights.
- `src/audio.ts`: a WebAudio synth in the spirit of the BBC sound chip.
  `src/music.ts` and `src/music-danube.ts` play the docking waltz.
- Rendering: three.js with UnrealBloom for the phosphor glow.

## Documents

Read first: [docs/INVARIANTS.md](docs/INVARIANTS.md) (the rules that must
not break), [docs/PROCESS.md](docs/PROCESS.md) (how work is delivered) and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
[docs/TODO/README.md](docs/TODO/README.md) indexes the active plans.

Reference: [the ship catalogue](docs/ELITE-A.md) ·
[every damage path](docs/DAMAGE-PATHS.md) ·
[the combat trainer](docs/COMBAT-SIM.md) ·
[browser play trials](docs/BROWSER-TRIALS.md) ·
[the Jameson trials](docs/JAMESON-TRIALS.md) ·
[the constants catalogue](src/constants/CATALOG.md)

History: [the development log](docs/DEVLOG.md) ·
[the AI design](docs/AI-TRAINING.md) ·
[the training log](docs/TRAINING-LOG.md) ·
[reproducing the training](train/README.md)

Reviews: [the combat computer](docs/COMBAT-COMPUTER-REVIEW.md) ·
[the missions](docs/MISSIONS-REVIEW.md) ·
[the missions in flight](docs/MISSIONS-FLIGHT-REVIEW.md) ·
[the README and the landing page](docs/PAGES-REVIEW.md)

## Acknowledgements & legal

This is a non-commercial fan homage, released under the MIT license (see
LICENSE). Elite (1984) was created by Ian Bell and David Braben and published
by Acornsoft. The "Elite" trademark belongs to Frontier Developments plc.
This project is affiliated with none of them. The galaxy generator follows
long-published descriptions of the original data. The hulls are generated
from a vendored analysis pack of the released ship files
([docs/ELITE-A.md](docs/ELITE-A.md)).

This repo ships no audio, textures or binaries from Elite. It does contain one
piece of the original that is not merely a description of it: the docking
music. `src/music-danube.ts` is Julie Dunn's 1985 arrangement of *The Blue
Danube* for three SID voices, decoded from the Commodore 64 release's music
data. The waltz is Strauss and public domain; that arrangement of it is a
separate work and is not. It is included as a deliberate decision, and
[reference/danube/README.md](reference/danube/README.md) sets out what it is
and where it came from.

## What remains

Gamepad support, and a shipyard: all 15 flyable hulls are in, and nothing
yet changes which one you fly. Combat balance is measured, not cited. The
damage model is the released game's own since 2026-08, and `npm run campaign`,
`npm run survivability` and the trainer's report are how to measure it.
