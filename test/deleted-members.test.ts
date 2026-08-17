// A member deleted for having no reader stays deleted.
//
// docs/TODO/174 M2 took out four things that nothing called. Each one had
// already been REPORTED by an earlier item, which declined to delete it in the
// same pass. That is `tools/internal-claims.mjs`'s own rule.
//
// A deletion needs a gate for one reason: nothing else fails when the member
// comes back. An unread export compiles, lints and passes every other test in
// this suite. So the tree would re-grow it in silence.
//
// TWO SCANS, AND EACH ONE FAILS ALONE:
//
//  1. `approach` has ONE home, and `game/npc.ts` is no longer it.
//  2. `AS_SHIPPED`, `AS_THE_GAME_FLIES` and `SENTINEL_NAMES` are gone from
//     `game/brain-names.ts`. docs/TODO/81 reported them, and docs/TODO/174
//     measured the claim behind them.
//
// THE FIRST SCAN CHANGED IN docs/TODO/176 M2, and the rule under it changed
// first. 174 M2 held that `approach` was NOT exported, because eight lines in
// `game/npc.ts` spent it and no line outside it did. M2 moved four of the eight
// to `game/trader-flight.ts`, so a second file needed the helper. It is
// `game/flight-maths.ts`'s now, and it is exported because a reader exists.
//
// The claim this file holds is the same one either way: the helper has exactly
// one declaration, and nobody keeps a private copy.
//
// EACH SCAN CARRIES A CONTROL, and the control is the point. A scan can go
// green because the regular expression matches nothing, or because it read the
// wrong file. So each scan also reads something it MUST find.
//
// WHAT IS NOT HERE. Whether `approach` gives the right answer is asserted
// wherever a speed is.

import { readFileSync } from 'node:fs';
import { check } from './harness.ts';

const source = (path: string): string =>
  readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

// The comments go first. A comment may name a deleted member, and this file's
// own subject is what the CODE holds.
const code = (path: string): string =>
  source(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// --- approach has one home ---------------------------------------------------

console.log('\nthe speed ramp has one home, and two files reach for it');
{
  const maths = code('game/flight-maths.ts');
  const npc = code('game/npc.ts');
  const trader = code('game/trader-flight.ts');

  check('game/flight-maths.ts exports approach',
    /\bexport\s+function approach\s*\(/.test(maths));
  check('...and game/npc.ts declares no approach of its own',
    !/\bfunction approach\s*\(/.test(npc));
  check('...and neither does game/trader-flight.ts',
    !/\bfunction approach\s*\(/.test(trader));

  // The control. Without it, a renamed function would leave the two bans above
  // green, and each one would be green for saying nothing.
  check('...and the scan is not vacuous — src/player.ts declares its own',
    /\bfunction approach\s*\(/.test(code('player.ts')));

  // Both readers are why it left `game/npc.ts` rather than staying private. The
  // import line matches the same word, so it comes off each count.
  const spends = (src: string) =>
    (src.match(/\bapproach\(/g) ?? []).length;
  check(`...and game/npc.ts spends it (${spends(npc)} call sites)`,
    spends(npc) >= 4, `found ${spends(npc)}`);
  check(`...and game/trader-flight.ts spends it (${spends(trader)} call sites)`,
    spends(trader) >= 4, `found ${spends(trader)}`);
}

// --- the deleted picker's last three members ---------------------------------

console.log('\nthe career picker\'s sentinels are gone');
{
  const brains = code('game/brain-names.ts');
  const gone = ['AS_SHIPPED', 'AS_THE_GAME_FLIES', 'SENTINEL_NAMES'];

  for (const name of gone) {
    check(`game/brain-names.ts no longer writes ${name}`,
      !new RegExp(`\\b${name}\\b`).test(brains));
  }

  // `brainName` is one lookup now. The fallback is what read the table, so a
  // rebuilt table would show up here first.
  check('...and brainName reads BRAINS alone',
    /return BRAINS\[brain as BrainName\]\?\.name;/.test(brains));

  // The control, in the same shape as the one above.
  check('...and the scan is not vacuous — the file still writes BRAINS',
    /\bBRAINS\b/.test(brains) && /\bSHIPPED_BRAINS\b/.test(brains));
}
