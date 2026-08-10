# Completed TODO plans

Historical plans live here so the active queue stays small. Open one plan when
its rationale is relevant; do not load this directory wholesale.

- [x] 17 — [NPC docking latch is missing from the snapshot](17-npc-dock-plan-snapshot.md)
- [x] 18 — [`draw()` advances the cockpit beam lifetime](18-beam-timer-in-step.md)
- [x] 19 — [Core rule modules still perform platform side effects](19-core-platform-side-effects.md)
- [x] 20 — [The portability gate does not follow imports](20-dependency-aware-portability.md)
- [x] 21 — [Vendor and generate the Elite-A reference catalogue](21-elite-a-reference-import.md)
- [x] 22 — [Implement the pure Elite-A combat oracle](22-elite-a-combat-oracle.md)
- [x] 23 — [Add stable ship and combat-profile identities](23-stable-ship-and-combat-profile-ids.md)
- [x] 24 — [Replace approximate geometry with all 38 Elite-A designs](24-exact-elite-a-geometry.md)
- [x] 25 — [Bring the complete Elite-A ship roster into runtime](25-complete-elite-a-runtime-roster.md)
- [x] 26 — [Use exact player lasers, NPC energy and defence](26-player-lasers-and-npc-energy.md)
- [x] 27 — [Use 255-point player defence and clean NPC lasers](27-player-defence-and-npc-lasers.md)
- [x] 28 — [Audit secondary damage and remove mixed units](28-secondary-damage-and-mixed-units.md)
- [x] 29 — [Rebaseline simulations, training and campaign combat](29-combat-training-and-balance-rebaseline.md)
- [x] 30 — [Add the permanent Elite-A alignment gate](30-elite-a-damage-alignment-gate.md)
- [x] 31 — [Give the setup panel a shape, and fence the career switch](31-trainer-setup-panel-hierarchy.md)
- [x] 32 — [Make choosing a brain a real choice](32-trainer-brain-choice-is-legible.md)
- [x] 33 — [Tell the pilot they are in an exercise, and how it is going](33-exercise-hud.md)
- [x] 34 — [Put the turret tell in the report](34-report-shows-how-they-flew.md)
- [x] 35 — [Compare two records without leaving the room](35-compare-two-records.md)
- [x] 36 — [Start the exercise where the pilot can see it](36-exercise-opening-geometry.md)
- [x] 37 — [Do not throw away a tap that arrived in a busy frame](37-input-taps-are-not-lost.md)
- [x] 38 — [The console still shows four energy banks](38-energy-reads-as-one-bank.md)
- [x] 39 — [Make the wave ramp keep getting harder](39-waves-keep-getting-harder.md)
- [x] 40 — [Named saves and recoverable autosaves](40-named-save-files.md)
- [x] 41 — [Name the opposition, not the file](41-name-the-opposition-not-the-file.md)
- [x] 42 — [They stop shooting when you get close](42-they-stop-shooting-when-you-close.md)
- [x] 43 — [Loading or importing a save eats a career's checkpoint](43-career-identity-has-two-homes.md)
- [x] 44 — [A full store deletes a pre-slots commander](44-a-full-store-deletes-a-legacy-commander.md)
- [x] 45 — [“NEW COMMANDER” does nothing](45-new-commander-does-nothing.md)
- [x] 46 — [Docking rerolls the board a restore just loaded](46-docking-rerolls-the-board-a-restore-just-loaded.md)
- [x] 47 — [The trainer credits no damage for ordnance](47-the-trainer-credits-no-damage-for-ordnance.md)
- [x] 48 — [The energy dead band, and dying at full shields](48-the-energy-dead-band.md)
- [x] 49 — [Guards that do not guard](49-guards-that-do-not-guard.md)
- [x] 50 — [Key bindings have six homes](50-key-bindings-have-six-homes.md)
- [x] 51 — [The market estimate lies](51-the-market-estimate-is-wrong.md)
- [x] 52 — [Say true things](52-say-true-things.md)
- [x] 53 — [Delete the legacy save migration](53-delete-the-legacy-save-migration.md)
- [x] 54 — [Import can write a save the shelf cannot read](54-import-can-write-an-unreadable-save.md)
- [x] 55 — [Make saving and loading legible](55-make-saving-legible.md)
- [x] 56 — [A commander, not a career](56-a-commander-not-a-career.md)
- [x] 57 — [Ship only what ships](57-ship-only-what-ships.md)
- [x] 58 — [Extended system descriptions, generated offline](58-extended-system-descriptions.md)
- [x] 59 — [The galaxy encyclopaedia](59-the-galaxy-encyclopaedia.md)
- [x] 60 — [The playtest agent strands itself after two or three legs](60-the-playtest-agent-strands-itself.md)
- [x] 61 — [Promote or delete the attack-run candidate](61-decide-the-attack-run-candidate.md)
- [x] 62 — [Missiles do not exist in training](62-missiles-do-not-exist-in-training.md)
- [x] 63 — [A training target's shields never come back](63-shields-never-come-back-in-training.md)
- [x] 64 — [One fire resolver](64-one-fire-resolver.md)
- [x] 65 — [The defender is selected for not fighting](65-the-defender-is-selected-for-not-fighting.md)
- [x] 66 — [The pass aims where you were](66-the-pass-aims-where-you-were.md)
- [x] 67 — [Short attack runs are not flyable](67-short-attack-runs-are-not-flyable.md)
- [x] 69 — [The setup panel says “HULL (0)”](69-the-panel-says-hull-zero.md)
- [x] 75 — [A gang never knows it is losing](75-a-gang-never-knows-it-is-losing.md)
- [x] 76 — [Wingman avoidance has no test](76-wingman-avoidance-has-no-test.md)
- [x] 77 — [A brain-flown ship is “evading” forever](77-a-brain-flown-ship-is-evading-forever.md)
- [x] 83 — [The one-warhead cap has no test](83-the-one-warhead-cap-has-no-test.md)
- [x] 87 — [Three parity checks assert `f(x) === f(x)`](87-three-checks-that-restate-their-own-implementation.md)
- [x] 88 — [The flight readout still quotes two stale words](88-the-readout-still-quotes-two-stale-words.md) — `flownBy` is re-decided every step, so the readout names the flight that moved the ship instead of the branch it entered or a phase it never ran
- [x] 90 — [One home for every constant](90-one-home-for-every-constant.md)
- [x] 93 — [One home for the phosphor](93-one-home-for-the-phosphor.md) — 90's
      other half: colour. `src/palette.ts` owns it, `src/palette.css` is
      generated from it, `npm run palette:check` holds the tree to it
- [x] 94 — [Parse a save at the door](94-parse-a-save-at-the-door.md)
- [x] 96 — [The character label drives nothing in the world yet](96-the-character-label-drives-nothing-yet.md) — phase 2 of Character: a name is now one more thing a pirate can see, and the rock hermit's credential up to the Dodgy rung and shut door at it. Landed on the campaign, not on a flight — `DISREPUTE_HEAT`, `COURTESY_RATE` and `HERMIT_FAVOUR` are unflown starting values and anything that plays wrong becomes a GitHub issue
- [x] 97 — [Site housekeeping](97-site-housekeeping.md) — closed GitHub issues #12–14
- [x] 98 — [The human-shape bands](98-the-human-shape-bands.md)
- [x] 99 — [`npm run survivability` cannot run](99-survivability-cannot-run.md)
- [x] 100 — [Who flies the combat computer?](100-who-flies-the-combat-computer.md)
- [x] 102 — [Retired brains still load in two places](102-two-things-still-load-the-retired-brains.md)
- [x] 103 — [Train tools still name retired brains](103-the-train-tools-still-name-the-retired-brains.md)
- [x] 104 — [The constants catalogue](104-the-constants-catalogue.md)
- [x] 105 — [The deterministic cycle orchestrator](105-the-cycle-orchestrator.md)
- [x] 106 — [A new pilot must see the instructions](106-new-pilot-instructions.md)
- [x] 92 — [The lead marker assumes every target is a freighter](92-the-lead-marker-assumes-a-freighter.md)
- [x] 108 — [A pod is not a canister](108-a-pod-is-not-a-canister.md)
- [x] 109 — [Passenger berths on the board](109-passenger-berths-on-the-board.md)
- [x] 110 — [Smuggling runs price the scan](110-smuggling-runs-price-the-scan.md)
- [x] 112 — [The consignment goes back](112-the-consignment-goes-back.md)
- [x] 113 — [What you cannot hand back, you are billed for](113-what-you-cannot-hand-back-you-are-billed-for.md) — closed GitHub #17
- [x] 111 — [The chart shows the danger it already reports](111-the-chart-shows-the-danger-it-reports.md) — GitHub #10, first slice
- [x] 114 — [The chart shows where the trade is](114-the-chart-shows-where-the-trade-is.md) — closed GitHub #10
- [x] 115 — [Point at a lane and it tells you what it carries](115-point-at-a-lane-and-it-tells-you-what-it-carries.md) — hover and cursor detail, lanes faded by traffic
- [x] 116 — [A loaded save jumps on its own](116-a-loaded-save-jumps-on-its-own.md) — restore puts the hyperspace countdown back at rest, and the in-flight ring will not write one down
- [x] 117 — [The galaxy was trading before you arrived](117-the-galaxy-was-trading-before-you-arrived.md) — a new career inherits 30 days of trade, and a galactic jump arrives in a galaxy of its own
- [x] 119 — [A constant that names nothing, and the exports around it](119-a-constant-that-names-nothing.md) — `BRAIN_HANDOVER_RANGE` and the prose asserting a handover no pilot makes; two dead functions, two dead re-exports, eleven narrowed visibilities
- [x] 120 — [The port marker says LINED UP when you are rolled wrong](120-the-port-marker-says-lined-up-when-you-are-rolled-wrong.md) — three states off the slot's own two tests, decided in the model: green now means the dock test would pass
- [x] 121 — [The test mode that has no door](121-the-test-mode-that-has-no-door.md) — closed GitHub #18. `GameState.cheat` was built, saved and unreachable; ⇧T at the station is the door and twenty levers are behind it — the commander's fuel, credits, legal status and Character, and a FIT-OUT that takes equipment OFF, which no shop in the game can. The jump stops asking about fuel. A career that switches it on is marked for good. A SPAWN key was built for M3 and removed at Chris's word; the plan doc records the amendment

<!-- append-completed-todos-here -->

Supporting records: [Elite-A alignment plan](ELITE-A-COMBAT-PLAN.md),
[constants survey](90-constants-survey.md), and
[constants cleanup ledger](90-constants-cleanup.md).
