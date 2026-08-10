// The character ladder: the name a disrepute score earns, and how a deed or a
// quiet week moves it.
//
// The rung thresholds are bisected out of the real `characterName` rather than
// restated, the same way economy.test.ts pins the fine and the combat ladder —
// a re-tuned threshold moves the test with the function, not against it. The
// deed hooks themselves (a hermit cracked, a trader murdered) are flown in
// combat.test.ts; this holds the arithmetic they spend.

import { check, eq } from './harness.ts';
import {
  characterName, characterVerdict, afterDeed, afterDecay, rungCrossed,
} from '../src/game/character.ts';
import {
  CHARACTER, DISREPUTE_DECAY, DISREPUTE_MAX, DISREPUTE_HERMIT_KILL, DISREPUTE_MURDER,
} from '../src/constants/character.ts';

console.log('\ncharacter');
{
  eq('Honest is the top of the ladder — the best a name can be', CHARACTER[0][1], 'Honest');
  eq('an unmarked pilot is Honest', characterName(0), 'Honest');

  // every rung, off the real function, and the point just below it is a lower rung
  for (const [threshold, name] of CHARACTER) {
    eq(`${threshold} disrepute reads as ${name}`, characterName(threshold), name);
    if (threshold > 0) {
      check(`...and a point below it does not (${name})`, characterName(threshold - 1) !== name);
    }
  }
  eq('the worst rung holds at the ceiling',
    characterName(DISREPUTE_MAX), CHARACTER[CHARACTER.length - 1][1]);

  // a deed raises it, clamped both ends
  eq('a deed adds its weight', afterDeed(0, DISREPUTE_HERMIT_KILL), DISREPUTE_HERMIT_KILL);
  eq('...never below Honest', afterDeed(5, -100), 0);
  eq('...never past the ceiling', afterDeed(DISREPUTE_MAX, 100), DISREPUTE_MAX);
  eq('one hermit kill takes an Honest pilot to Dodgy',
    characterName(afterDeed(0, DISREPUTE_HERMIT_KILL)), 'Dodgy');

  // time erodes it — people forget, slowly
  eq('a day of honest flying fades it by the decay rate', afterDecay(50, 1), 50 - DISREPUTE_DECAY);
  eq('...never below Honest', afterDecay(1, 100), 0);
  eq('...a paused or rewound clock does nothing', afterDecay(50, 0), 50);
  eq('...and neither does a NaN span', afterDecay(50, NaN), 50);
  check('a hermit kill is a fortnight-plus of honest flying to fully shed — slow, as memories are',
    DISREPUTE_HERMIT_KILL / DISREPUTE_DECAY > 14);
}

// --- and the moment the name changes (docs/TODO/129) -------------------------
//
// Seven deeds and the decay all ask the same question — did that move me onto a
// different rung? — and the answer must be the same wherever it is asked, which
// is why it is one function and not seven comparisons. Read off `CHARACTER`
// rather than off literals, so re-cutting the ladder re-cuts the test.

console.log('\nthe rung a deed puts you on');
{
  eq('nothing happened, nothing to say', rungCrossed(0, 0), null);

  for (const [threshold, name] of CHARACTER) {
    if (threshold > 0) {
      eq(`arriving at ${threshold} is a crossing onto ${name}`,
        rungCrossed(threshold - 1, threshold), name);
      eq(`...and the line names it (${characterVerdict(threshold - 1, threshold)})`,
        characterVerdict(threshold - 1, threshold), `CHARACTER: ${name.toUpperCase()}`);
      // ...and downward, which is the decay's half: the rung you LAND on, not
      // the one you left.
      eq(`...falling back off ${threshold} names the rung below`,
        rungCrossed(threshold, threshold - 1), characterName(threshold - 1));
    }
    // a move that stays inside the rung says nothing, in either direction
    eq(`a move inside ${name} says nothing`, rungCrossed(threshold, threshold + 0.5), null);
    eq(`...and so does the way back (${name})`,
      rungCrossed(threshold + 0.5, threshold), null);
  }

  // The two rungs a single deed can skip: `DISREPUTE_MURDER` is 40, which takes
  // an Honest commander past Dubious to Dodgy. It names where you ARE.
  const murdered = afterDeed(0, DISREPUTE_MURDER);
  eq(`one murder crosses two rungs and names the far one (${characterName(murdered)})`,
    rungCrossed(0, murdered), characterName(murdered));
  check('...which really is two rungs away from Honest',
    CHARACTER.filter(([t]) => t > 0 && t <= murdered).length === 2);

  // At the ceiling a deed moves nothing, so it must say nothing — `afterDeed`
  // clamps, and a line about a rung you were already on is a lie about a deed.
  eq('a deed at the ceiling crosses nothing',
    rungCrossed(DISREPUTE_MAX, afterDeed(DISREPUTE_MAX, DISREPUTE_HERMIT_KILL)), null);
  eq('...and says nothing',
    characterVerdict(DISREPUTE_MAX, afterDeed(DISREPUTE_MAX, DISREPUTE_HERMIT_KILL)), null);
  // ...and neither does the floor, which is where the decay parks everybody
  eq('a quiet week at Honest says nothing', characterVerdict(0, afterDecay(0, 30)), null);

  // The line cannot promise a rung the status screen does not show: it is
  // `characterName` and nothing else, asked at every threshold above.
  check('every line the ladder can produce names a rung the ladder has',
    CHARACTER.every(([threshold, name]) =>
      characterVerdict(threshold - 1, threshold) === null
      || characterVerdict(threshold - 1, threshold) === `CHARACTER: ${name.toUpperCase()}`));
}
