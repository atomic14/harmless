// How long does a commander survive an organised gang? A FLOOR, measured in
// the training world.
//
//   node --experimental-strip-types train/survivability.ts [episodes]
//   DEFEND_BRAIN=<file stem> npm run survivability   # research override
//
// BOTH SIDES OF THIS FIGHT ARE THE TRAINING WORLD'S STAND-INS. `Episode`
// drives `brainFly`/`attack` directly and never `NpcShip.update`, so it can
// fly neither of the pilots the live game actually uses (`game/brain-names.ts`
// is that rule's home):
//
//   - THE ATTACKERS fly the scripted attack run — the game's own `attack()`,
//     called directly. What a player meets is `pursuit`, the dogfighter that
//     chases onto your six; in the live game the scripted run is the A/B
//     control. `Episode` cannot fly `pursuit` (docs/TODO/98), and making it
//     able to is a real design change, not a fix this file may smuggle in.
//   - THE DEFENDER defaults to the training world's scripted armed trader in
//     the commander's hull: ambles between waypoints, runs flat out once
//     hurt, and fires her laser only when an attacker crosses her nose. It is
//     NOT the defence the game sells — the combat computer's co-pilot
//     (game/scripted-co-pilot.ts) and the armed trader's defensive attack run
//     (game/npc.ts) both live behind update paths `Episode` cannot drive. Her
//     E.C.M. is
//     fitted but never pressed: only a policy with an E.C.M. head asks, so
//     a warhead here always lands. `DEFEND_BRAIN` names a research candidate in
//     `src/ai-training/brains/` to fly instead; nothing trained ships
//     (game/brains.ts is an empty socket), so there is no trained default.
//
// SO WHAT IS A ROW EVIDENCE OF? A floor: how a gang of each size ends a
// fight against close to the least defence a fighting-back commander can
// have, in her own points — how much of her pools a gang can strip, how often
// it gets all the way through, and what it costs them. The shipped defence
// outflies this stand-in, and the real game adds the escape capsule, the
// torus drive and a station to run to — every difference favours the player,
// so the live game sits above these rows. What a row is NOT is the shipped
// fight: `pursuit` attackers against the defence the game sells is a fight
// this world cannot stage; evidence about what actually ships comes from
// harnesses that fly real `NpcShip`s through `update()` (docs/TODO/98).
//
// Units: this script used to exist to CORRECT a number — an episode's target
// was a stand-in at hp 1.0, so every figure was in the wrong ship's units,
// and this file divided the game's own `durability()` back in. TODO 29
// removed the need: the episode's target IS the commander now, three
// 255-point pools from `game/systems.ts`, hit by `applyDamage`.
//
// POOL RECHARGE IS IN IT (docs/TODO/63), and it is the biggest single thing
// these rows ever left out: a shield face recovers 8.9 points a second, which
// is more than a gang of three lands. The episode runs `systems.ts`'s
// `regenerate` exactly as the game does. **Every figure this tool printed
// before 2026-08-04 is on the old world and is not comparable with one
// printed after it.**
//
// THE E.C.M. IS FITTED, NOT ROTATED (docs/TODO/72), because the commander
// being modelled is a fitted one — a warhead is 250 of her 765 points, and a
// policy fitted in a world with an E.C.M. and measured in one without is
// being scored on a distribution nothing trained for. Whether anything
// PRESSES it is the defender's affair, per the bullet above. **A row printed
// before 2026-08-04 is on the old world twice over.**
//
// Not a substitute for flying it. `T` at any station is.

import { Episode, type Controller } from '../src/ai-training/scenario.ts';
import { brainFromFile, type Brain, type BrainFile } from '../src/ai-training/policy.ts';
import { readFileSync } from 'node:fs';
import { durability } from '../src/game/systems.ts';
import { MAX_SHIELD } from '../src/constants/pools.ts';
import { FIXED_DT } from '../src/constants/world-clock.ts';

const BRAINS = new URL('../src/ai-training/brains/', import.meta.url);
const load = (name: string): Brain =>
  brainFromFile(JSON.parse(readFileSync(new URL(`${name}.json`, BRAINS), 'utf8')) as BrainFile);

const N = Number(process.argv[2]) || 200;
const DT = FIXED_DT;
// distinct from the trainer's stream AND from evaluate.ts's held-out base, so
// this is not scoring on seeds anything was selected against
const SEED_BASE = 918_273;
const MAX_TIME = 45;

// The defender: the scripted armed trader unless DEFEND_BRAIN names a
// research candidate's weights file — the header says what each is and is not.
const DEFEND_BRAIN = process.env.DEFEND_BRAIN;
const defender: Controller = DEFEND_BRAIN
  ? { kind: 'policy', brain: load(DEFEND_BRAIN) }
  : { kind: 'scripted' };
const defenderName = DEFEND_BRAIN ?? 'the scripted armed trader (a stand-in — see header)';

interface Result {
  /** share of episodes the commander was destroyed in */
  kill: number;
  /** mean seconds to the kill, of the fights that ended in one */
  ttk: number;
  /**
   * Mean share of her three pools STRIPPED OVER THE FIGHT — cumulative, which
   * is `Episode.targetDamageShare()`. It was `1 - trader.hp` at the end, and
   * once the pools come back that answers "how recently was she hit" instead.
   */
  poolLost: number;
  /**
   * Share of episodes a shield face was flattened AT ANY POINT. Watched every
   * step for the same reason: a face that was taken down and recovered is still
   * a face that was taken down, and the end-of-episode reading would miss it.
   */
  shieldDown: number;
  /** attackers destroyed per episode */
  lost: number;
}

function run(gang: number): Result {
  let kills = 0; let ttk = 0; let lost = 0; let poolLost = 0; let shieldDown = 0;
  const pirates: Controller[] = Array.from({ length: gang },
    () => ({ kind: 'scripted' as const }));
  for (let e = 0; e < N; e++) {
    const ep = new Episode({
      seed: SEED_BASE + e * 7919,
      pirates,
      trader: defender,
      traderArmed: true,
      traderClass: 'playerCobra',
      targetEcm: true,
      maxTime: MAX_TIME,
    });
    let death = MAX_TIME;
    let flattened = false;
    while (!ep.done) {
      ep.step(DT);
      if (!ep.trader.alive && death === MAX_TIME) death = ep.t;
      if (ep.trader.sys.foreShield <= 0 || ep.trader.sys.aftShield <= 0) flattened = true;
    }
    if (!ep.trader.alive) { kills += 1; ttk += death; }
    poolLost += ep.targetDamageShare();
    if (flattened) shieldDown += 1;
    for (const p of ep.pirates) if (!p.alive) lost += 1;
  }
  return {
    kill: kills / N,
    ttk: kills ? ttk / kills : MAX_TIME,
    poolLost: poolLost / N,
    shieldDown: shieldDown / N,
    lost: lost / N,
  };
}

console.log(`\n${N} episodes per row · ${MAX_TIME}s · defender flies ${defenderName}`);
console.log(`the commander's own pools: ${durability(true)} points across two ${MAX_SHIELD}-point`
  + ' shields and the bank, recharging as the game does — see the header\n');
console.log('| gang | attackers | destroyed | pools stripped | a shield flattened | they lost |');
console.log('| --- | --- | --- | --- | --- | --- |');
for (const gang of [1, 2, 3, 4]) {
  const r = run(gang);
  console.log(`| ${gang} | scripted run (stand-in) | ${(r.kill * 100).toFixed(0)}% in `
    + `${r.ttk.toFixed(1)}s | ${(r.poolLost * 100).toFixed(0)}% | `
    + `${(r.shieldDown * 100).toFixed(0)}% | ${r.lost.toFixed(2)}/ep |`);
}
console.log('\npools stripped = mean share of fore + aft + bank gone when the fight ended');
console.log('they lost = attackers destroyed per episode, by her guns or their own flying\n');
