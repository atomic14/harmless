// Are any files getting away from us?
//
// Two files in this project reached 3,244 and 4,729 lines, and both got there
// the same way: they were the default place to put things, so nobody ever
// decided. The cost was not tidiness. A kitchen-sink file is where one rule
// quietly grows two homes — the failure this codebase is organised against —
// and it is where parallel work collides: three agents on unrelated modules
// still conflicted in the same test file, and one merge spliced a section
// inside another's block and left an unbalanced brace.
//
// So the ceiling is checked rather than encouraged. Exceeding it is allowed;
// exceeding it SILENTLY is not. Anything over the limit must be listed below
// with a reason, which makes the list itself the review surface — the same
// shape as the purity list and the seeded-rng exemptions, both of which have
// held.
//
// THE ANSWER THIS GATE WANTS IS A SPLIT. The list below is for the file that
// genuinely reads worse in pieces, and it is the last answer rather than the
// second one. There is a third answer nobody should take: cut a comment until
// the number falls. That leaves the file exactly as large and the reasoning
// thinner, and `CLAUDE.md` forbids it. docs/TODO/148 is the worked example —
// `game/controls.ts` was trimmed six times across three items and split zero
// times, and the split it was avoiding took one commit.
//
// Run: node tools/sizes.mjs   (also `npm run sizes`, and part of `npm run check`)

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Above this, a file needs a stated reason.
 *
 * IT IS A DETECTOR, NOT THE RULE. The rule is one responsibility per file
 * (Chris, 2026-08-14: *"the rules should be single responsibility - files that
 * have multiple responsibilities are the problem"*). Length is only the symptom
 * that usually gives a second responsibility away, because a file rarely
 * reaches 400 lines doing one thing.
 *
 * So the number is a place to look, and it cuts both ways. A 900-line file that
 * does one thing is fine and says so below. A 200-line file that does three is
 * wrong and this gate will never notice — that one is caught by reading, and by
 * the module header every file has to carry.
 */
const LIMIT = 400;

/**
 * Files allowed to exceed the limit, each with the ONE responsibility it holds.
 *
 * A reason is not "it is long", and it is not "splitting would be awkward". It
 * NAMES THE SINGLE RESPONSIBILITY: this file is one table, one grammar, one
 * bijection, one lifecycle. A reader should be able to check the claim by
 * opening the file, and to see immediately when it stops being true.
 *
 * AND THEN IT HAS TO CLEAR A SECOND BAR, which is the one most of these entries
 * were written before anybody stated (Chris, 2026-08-14: *"single responsibility
 * does not mean put everything in one file. A file can import child files. The
 * key is to keep files small so they can be easily understood"*).
 *
 * One responsibility does NOT mean one file. A responsibility can be a parent
 * that imports its children: `world-step.ts` is one thing — advance the world a
 * slice of time — and the ORDER of its five phases is the load-bearing part, but
 * the order is five lines and the phases are eight hundred. The parent can hold
 * the order and import a file per phase, and every file gets small enough to
 * hold in your head. "These parts belong together" argues for one DIRECTORY, not
 * for one file.
 *
 * So an entry survives only when the file cannot be composed that way at all:
 * a generated table where splitting loses the diff, or a console paste that
 * cannot import. "It is cohesive" is not enough, and most of the entries below
 * were written to a bar that only asked for cohesion.
 *
 * That bar is what makes the list a review surface. "One render function per
 * screen; they share layout helpers and nothing else" sat here for months
 * describing TWENTY-FIVE responsibilities, and read as a reason because it was
 * a sentence in the right shape. It was the argument for a split, and
 * docs/TODO/149 eventually took it.
 *
 * Anything here that is really just unfinished work should say so, with the
 * split it is waiting for, so the list does not become a place to hide.
 */
const ALLOWED = {
  // AUDITED 2026-08-14, at Chris's asking, and five entries came out. All five
  // named a file that had fallen back under the ceiling — `galaxy/goatsoup.ts`
  // (152), `game/brain-names.ts` (240), `game/screens/combat-sim-setup.ts`
  // (339), `game/systems.ts` (359) and `test/brain-names.test.ts` (303) — so
  // each was a reason for a thing that was no longer true. Nothing was lost:
  // every one of them states its own purpose in its own module header, which is
  // where that argument belongs. The `ships/geometry.ts` and `game/brains.ts`
  // notes below are the same event, recorded the same way.
  //
  // The audit's other finding is not fixed here, and it is about this list
  // rather than about any file in it: the reasons get SHORTER as the files get
  // BIGGER. Everything at 402-464 lines carries 490-1,090 characters of
  // argument; everything over 1,000 carries 48-118. The gate only bites at the
  // moment a file crosses, so a file already over when the gate arrived was
  // never made to argue.
  //
  // A SIXTH ENTRY CAME OUT THE SAME DAY, by being split rather than by shrinking
  // on its own — and it was the finding above made concrete. `ui/screens.ts` was
  // 1,954 lines behind the weakest reason in this list: "one render function per
  // screen; they share layout helpers and nothing else", which states the
  // precondition for a clean cut and offers it as the argument against one.
  // docs/TODO/149 took it apart into eight files, the largest 340 lines, and
  // none of them needs an entry here.

  // one data table each: splitting a table is strictly worse
  //
  // `ships/geometry.ts` used to be here — "every hull as vertex/edge/face
  // tables". It is 118 lines now and holds no tables at all: the released hulls
  // are generated and converted in ships/elite-a-hulls.ts, so what is left is
  // the ShipDef contract and the two builders. Nothing to allow.
  'tools/species-prompts.ts': 'generation prompts, one per species — a data file',
  'music-danube.ts': "GENERATED: the docking waltz, one 50 Hz frame per line — 454 of them, carrying 916 note triggers across three SID voices, decoded from the C64 Elite music data vendored under reference/danube. Its length is the piece's; the only way to shorten it is to lose frames or to pack several onto a line and lose the diff. The ENGINE that plays it is src/music.ts and is under the limit; this is data, and splitting a score by section would put one piece of music in five files. Regenerated by `npm run generate:danube`, never edited.",
  'game/elite-a/slots.generated.ts': 'GENERATED: the 23 x 31 Elite-A blueprint-slot table, one released slot per line. Its length is 713 because the pack has 713 slots; the only way to shorten it is to lose rows or to pack several onto a line and lose the diff. Regenerated by `npm run generate:elite-a`, never edited.',

  // cohesive single subsystems
  //
  // `game/brains.ts` used to be here too — nine loaded policies. TODO 57 deleted
  // the six the game did not fly and it came in under the limit on its own.
  'ui/screens.ts': 'one render function per screen; they share layout helpers and nothing else',
  'game/storage.ts': "the ONE file allowed to keep a SAVE in localStorage (engine/keymap.ts holds a layout preference and nothing else), so everything that touches the store has to be in it — the namespace, the write guard, the record read/write, the enumeration and the boot pointer. Splitting any of it out would mean exporting raw key access, which is the exact hole the namespace closes: every key in the program is built here from `ns`. `save-file.ts` already holds everything about a save that does NOT need the store. It shed the slot migration in TODO 53 and took on the boot pointer's other value in TODO 56 — `new:<NAME>`, which is how a commander a player has just named reaches the boot on the far side of a reload. The next thing to leave is `repairCommander`, if a home can be found for it that is not a second file knowing about the store.",
  'hud/hud.ts': 'the cockpit console — one painter, one canvas set',
  'ai-training/scenario.ts': 'one Episode plus its four fitness functions; the fitness is the methodology and reads as a unit',
  'ai-training/observation.ts': "the four encoders and the choice between them — one file so that a genome the trainer can produce is, by construction, a genome the game can fly (`observeFor` picks the encoder from the brain's own input count, and the choice being made twice is how wide brains once had no way into the game). It crossed 400 on TODO 90's policy-seam slice, which gave the thrice-written log-distance rule one home and the reasoning that stops the two fitted scales (OBS_SPEED_SCALE, TURN) being re-inlined.",
  'game/world-step.ts': 'the five phases of flight in the order they must run — the order IS the content',
  'game/combat-sim-report.ts': 'one recorder plus its derivations; splitting the maths from the accumulation would put a statistic in two files',
  'game/combat-sim-scenarios.ts': 'the scenario table, the wave ramp and the mode rules — data, and the pure functions over it. The ramp is here rather than in a file of its own because "who you fight" is one question: the wave steps are the same shape as the scenario rows and are resolved by the same `Opposition`, and a second file would mean two places to look for what the trainer can send at you.',
  'test/combat-sim-scenarios.test.ts': 'the mirror of the file above, and one file for the same reason: the wave ramp is asserted against the scenario table it shares a resolver with (a wave is never bigger than the count ramp allows; every step changes the fight it names), and those are claims about both halves at once.',
  'train/evolve.ts': 'the trainer: one search loop with its selection and logging',
  'game/ordnance.ts': "everything that is not the laser: missiles in flight, the E.C.M. and the energy bomb. It was eight methods scattered through game.ts between docking and the trumbles, and being ONE file is the fix rather than an accident of growth. It crossed 400 when docs/TODO/72 gave a training target and the combat computer the same button — `EcmFit`, the narrow surface `triggerEcm` reads, and `fireEcm`, which is the burst AND its price in one call because there are two orchestrators now and every rule split across them has drifted (docs/TODO/64). The obvious split is 'the E.C.M. into its own file', and it is the wrong one: it would put the press in one file and the burst it pays for in another, which is precisely the scatter this file exists to have ended.",
  'test/campaign.ts': 'one career simulation, run thousands of times',
  'test/world-step.test.ts': 'the five phases of the step in the order they run, mirroring world-step.ts — the order IS the content on both sides',
  'test/combat-sim-career.test.ts': "the combat trainer's one rule — nothing that happens in the simulator leaves it — argued across three enforcement layers. Splitting it would put half a safety argument in another file.",
  'test/combat-model.test.ts': "invariant 5 argued end to end: the target's hull, the pirate roster, per-hull accel, the speed floor, the gun, the rate ramp, the turn caps, ramming and the target's pools are nine ways of asking the ONE question the file's name asks — does the trainer fly the game? Split by subsystem and each piece stops being an answer to that; the sections also share the account of the parallel simulator that was deleted, which is what makes any of them make sense. Same argument as test/damage-paths.test.ts's inventory below. It crossed 400 in docs/TODO/87, which replaced three assertions that expanded to `f(x) === f(x)` with ones that pin all four rate-ramp constants against the linear rule they were re-fitted from, drive `brainFly` against `ccRamp`, and hold the combat computer's caps to the roster row they name — plus the reasoning for each, which is the part that stops them being reverted to the cheap version. The commander's two constants are here rather than in test/flight.test.ts, where half the pair used to sit, because the re-fit is one rule and it was living in two files.",
  'test/damage-paths.test.ts': 'the damage-path audit: the enforcement half of docs/DAMAGE-PATHS.md, which is ONE inventory. It holds the impact anchors, the crossfire rule, the player-laser-only properties and five source scans to the same table; split, each half would stop being a complete answer to "which numbers are in which units", which is the question the whole file exists to make answerable.',
  'test/playtest.js': 'a console paste — it cannot import, so it must be self-contained',
  'test/galaxy.test.ts': "the 1984 generator, the jump and the living galaxy over it — one seeded pipeline: the living-galaxy blocks trade across the same g1 the generator blocks pin, and the chart-metric scan guards the distance rule every block above it measures with. It crossed 400 on TODO 90's career slice, which added the measured-decay checks for the three rates that moved to constants/living-galaxy.ts (each solved back out of one pure-decay day of the real advance) and the notoriety-spread sweep that holds the convoy range to MAX_FUEL from the outside. THE SPLIT IT IS WAITING FOR: the living galaxy is a subject of its own (galaxy/living.ts already is one file), and its blocks — trade statistics, decay rates, notoriety, persistence — can leave together with makeRng and g1; nothing in them reads the goat-soup or jump blocks.",
  'test/economy.test.ts': "prices, contracts, the law and what a pirate thinks you are worth — the career's rules, tested where they interlock: the threat block reads the market the price block built, and the notoriety block feeds the threat one. It crossed 400 on TODO 90's threat slice, which added the measured-threshold checks for the tuning that moved to constants/threat.ts — the saturation point, the challenge roll and the fame rung bisected out of the real pirateThreat rather than probed at the constants — plus the reasoning that stops them being reverted to the cheap version. THE SPLIT IT IS WAITING FOR: the pirate-economics half (markOf, pirateThreat, memberTier, notoriety) is a subject of its own and can take its fixtures with it; nothing in it reads the market rows the first half builds except through markOf.",
  'test/combat.test.ts': "resolving a hit, end to end: destroy/wreck consequences, the collision-rate ceilings and the breach path are one chain — the same seeded World, the same Combat, and the collision block divides by the IMPACT.ram the first block spends. It crossed 400 on TODO 90's threat slice, which added the wreck-path measurements (the escape-pod rate per role and the mining yield band, flown through the real wreck/destroy over seeded kills and held against constants/wreck.ts), which belong beside the destroy tests that share their setup.",
  'test/ship-identity.test.ts': "TODO 23's gate, and it is one claim rather than two: an id is only worth minting if the SAVE carries it, and every defect this file has ever caught was at the save end — a fleet re-derived on reload, a commander migrated onto the Cobra. Splitting the serialization boundary out would put the rule in one file and the only place it has ever broken in another. It crossed 400 on 2026-08-04, when the three identity fallbacks were deleted: a refusal costs more lines than a fallback did, because each of the three boundaries — the shelf, the fleet, the orchestrator — has to be shown refusing a save that says nothing AND still accepting one that does, which is the control that stops `savedShipIdentity` becoming a bare throw.",
  'test/ship-roles.test.ts': "TODO 25's gate: every hull the galaxy can put in the sky is one the released sets filed under that job, at a tier the pack's own numbers give it, in geometry that can be built — one question about the roster, asked from every side that can rot. It was at exactly 399 lines before 2026-08-04 and crossed on the saves slice, which replaced the legacy-snapshot test with a roster-drift one: proving what `persistence.ts`'s tier fallback is FOR now means establishing that a retired design exists and that the row it falls back to is not the default, where deleting two fields off a snapshot did not. THE SPLIT IT IS WAITING FOR is `every source file is searchable text` — a repo-wide scan for a NUL byte that lives here because `ship-specs.ts` is where the byte was, is not about the roster, and is not in the file's own header. Rehoming it brings this back under the limit without losing a line.",
  'test/constants.test.ts': "the constants gate plus THE LIST it enforces — every constant still outside src/constants/, grouped by the slice that will take it. Most of the file is that list, and splitting it from the scan would put a policy in one file and its review surface in another, which is the same argument this list itself makes for sizes.mjs. It is over the ceiling because docs/TODO/90 is unfinished, and it is the one entry here that SHRINKS on its own: every slice that lands deletes lines from it, and when the last group goes the file is about a hundred lines and comes off this list.",
  'test/ui.test.ts': "the console's screens and the two co-pilots' engage/hand-back contract, tested where they share the one rig — the combat computer swings the view, refuses an empty sky, produces a demand and hands back on manual input, and the warnings precede the rules they warn about, all off the same freshState harness. It crossed 400 on 2026-08-05: with no shipped defence weights, the brain-co-pilot block flies a SHAPED fixture and keeps its 'produces a demand at the cruise limits' coverage rather than deleting it, so the socket stays tested for a future candidate. Splitting the co-pilot block from the screens it shares a rig with would duplicate the rig.",
  'test/snapshot.test.ts': "the save round-trip: every field a flight can dirty on the player's ship and an NPC's, saved and restored identically, in one file because the claim is about the WHOLE snapshot and a field checked in isolation is a field whose absence from the walk goes unnoticed. It crossed 400 on 2026-08-05: with the trained line gone the shipped armed trader flies the scripted run (which caches no brain decision), so proving the cached-decision field still round-trips means driving `brainFly` directly with the shaped fixture ON TOP of the scripted flight's dirt — two flights where there was one, because both dirty different fields and the snapshot must carry both.",

  // WAITING TO BE SPLIT — not exceptions, debts
  'game/game.ts': "THE ORCHESTRATOR, and it can state one responsibility: which mode the game is in, and who gets the frame. It owns baseMode, gives the frame to flight.ts while the ship is flying, routes every key to the child that answers it, and says what those children report. A reader can check that by opening the file, which is this list's actual bar (Chris, 2026-08-14: 'we should not obsess over the 300 lines. What we are looking for is a clean architecture').\n\nIT IS A PARENT WITH NINE CHILDREN, which is the second bar: docked.ts and flight.ts are the two halves (155), over flight-weapons.ts and flight-instruments.ts; law-actions.ts, world-build.ts, cockpit-view.ts, hyperspace-actions.ts and career.ts are the five subjects 150 took out. 1,233 lines is what is left after wiring all nine, plus the 81-line command table that is deliberately the whole surface a replay, an AI or a test drives the game through.\n\nTHERE IS NO LINE TARGET, and its removal was a measurement rather than a surrender: the '~300' this entry carried for months was checked by 150 M6, and 75% of the file at that point could not leave — an applier IS the orchestrator by this project's decides/applies rule, a host literal travels with the module it is handed to, and the constructor is where the children are wired. The history, because it is useful: 3,244 -> 2,528 -> 2,251 -> 2,153 -> 2,021, then 2,049 where 151 corrected twenty-one comments that named a caller the file no longer had, then 1,910 -> 1,810 -> 1,240 -> 1,222, and back to 1,233 where 152 repaired this header.\n\nWHAT COULD STILL LEAVE, so this entry is not a place to hide: the screen openers (openChart, openLocalChart, openSystemData, openReadingScreen, showBaseScreen, handleScreenClick) are about 85 lines and are the one group left that names a subject rather than the orchestrator's own job.",
  'game/npc.ts': "DEBT: one ship's decision loop, plus two subjects that are not it. THIS ROW USED TO NAME ONE SPLIT — 'behaviour and brain flight in one file; the flight half wants its own' — and docs/TODO/169 measured the file rather than trusting it. There were four candidates, and the flight half the old row named is the SMALLEST of them at 244 lines of the class.\n\nTHE CHEAPEST CUT WAS THE FLEET QUERIES, which the old row never named, and M2 took them: isHostileToPlayer, hostilesNear, nearestEngaging and nearestNpc are game/hostility.ts now, at 169 lines. They take a narrow interface rather than the class, so the rule six surfaces read (docs/TODO/158) names no ship class at all, and test/hostility.test.ts holds that. The file went 1,677 lines to 1,566.\n\nTWO CANDIDATES ARE LEFT. The flight half is 244 lines of the class, plus 29 of module-level maths that the HUD's lead marker also reads — steerQuatToward and velocityOf. NpcState is 184 lines, and it is the saved shape of a ship rather than a behaviour. Taking the flight half and the maths together leaves about 1,293 lines.\n\nTHE FILE STATES ITS OWN RESPONSIBILITY. It was the one file of 259 in src/ with no module header at all, and docs/TODO/169 M1 wrote one before any split, so the header could not be written to fit a decision already made. M4 of that item measures again and reports what is left.",
  'game/combat-sim.ts': 'the exercise lifecycle: begin, the round loop, teardown. 42% of it is the safety argument in prose, and the three layers of that argument now read together in combat-sim-safety.ts. What is left is one session and it does not read better in pieces.',
};

const roots = ['src', 'test', 'train', 'tools'];
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  return e.isDirectory() ? walk(p) : /\.(ts|js|mjs)$/.test(e.name) ? [p] : [];
});

const over = [];
for (const root of roots) {
  for (const path of walk(root)) {
    const n = readFileSync(path, 'utf8').split('\n').length;
    if (n <= LIMIT) continue;
    // match on the shortest suffix that appears in the allowlist
    const key = Object.keys(ALLOWED).find((k) => path.endsWith(k));
    over.push({ path, n, why: key ? ALLOWED[key] : null });
  }
}
over.sort((a, b) => b.n - a.n);

const unlisted = over.filter((f) => !f.why);
const debts = over.filter((f) => f.why?.startsWith('DEBT'));

for (const f of over) {
  const tag = f.why ? (f.why.startsWith('DEBT') ? 'DEBT ' : 'ok   ') : 'SPLIT';
  console.log(`${tag} ${String(f.n).padStart(5)}  ${f.path}`);
  if (f.why) console.log(`              ${f.why}`);
}
console.log(`\n${over.length} files over ${LIMIT} lines · ${debts.length} known debts`
  + ` · ${unlisted.length} unlisted`);

if (unlisted.length) {
  console.error(`\nFAIL: ${unlisted.length} file(s) over ${LIMIT} lines with no stated reason.\n`);
  for (const f of unlisted) console.error(`  ${f.path}  (${f.n} lines)`);
  console.error(`
SPLIT THE FILE. That is what this gate asks for.

The rule is ONE RESPONSIBILITY PER FILE. This ceiling is only the detector: a
file rarely reaches 400 lines doing one thing, so crossing it is a place to
look rather than the fault itself.

So name the responsibilities out loud. If you can say "it does X, and also Y",
that is the seam. Common shapes: a grammar and the data it reads, a rule and
the table that states it, or a second subject that arrived later and stayed.

AND IF IT REALLY IS ONE THING, IT CAN STILL BE SEVERAL FILES. One responsibility
does not mean one file: a parent can import a child per part, hold the bit that
is genuinely shared — the order, the type, the seam — and stay small. "These
parts belong together" is an argument for one directory, not for one file. The
point is a file you can hold in your head.

Then move one side out. Take every comment with the code it explains.

DO NOT DELETE PROSE TO GET UNDER THE LINE. A shorter comment is not a smaller
file. It is the same file with less of the reasoning that made it readable, and
CLAUDE.md forbids it: "Never delete useful content only to fit that ceiling."
See docs/TODO/148 for what that mistake looks like: one file trimmed six times
across three items, and split zero times.

An exemption is the LAST answer, not the second one, and it has two bars. NAME
THE SINGLE RESPONSIBILITY the file holds — one table, one grammar, one
bijection, one lifecycle — so a reader can check the claim by opening the file.
THEN SAY WHY IT CANNOT BE A PARENT PLUS CHILDREN, because one responsibility
does not mean one file. Almost nothing clears the second bar: a generated table
where splitting loses the diff, and a console paste that cannot import.

"It is long" is not a reason. Neither is "splitting would be awkward". And a
sentence in the right shape is not an argument: "one render function per screen"
described twenty-five responsibilities and sat in this list for months.`);
  process.exit(1);
}
console.log('no unlisted oversize files');
