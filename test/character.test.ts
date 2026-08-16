// The character ladder: the name a disrepute score earns, and how a deed or a
// quiet week moves it.
//
// The rung thresholds are bisected out of the real `characterRung` rather than
// restated, the same way economy.test.ts pins the fine and the combat ladder —
// a re-tuned threshold moves the test with the function, not against it. The
// deed hooks themselves (a hermit cracked, a trader murdered) are flown in
// combat.test.ts; this holds the arithmetic they spend.

import { check, eq } from './harness.ts';
import {
  characterRung, characterVerdict, afterDeed, afterDecay, rungCrossed,
} from '../src/game/character.ts';
import {
  CHARACTER, DISREPUTE_BRIBE, DISREPUTE_DECAY, DISREPUTE_MAX, DISREPUTE_HERMIT_KILL,
  DISREPUTE_MURDER,
} from '../src/constants/character.ts';
import { MAX_FUEL } from '../src/constants/commander.ts';
import { distanceTenths, daysForJump } from '../src/galaxy/navigation.ts';
import { g1 } from './fixtures.ts';

console.log('\ncharacter');
{
  eq('Honest is the top of the ladder — the best a name can be', CHARACTER[0][1], 'Honest');
  eq('an unmarked pilot is Honest', characterRung(0), 'Honest');

  // every rung, off the real function, and the point just below it is a lower rung
  for (const [threshold, name] of CHARACTER) {
    eq(`${threshold} disrepute reads as ${name}`, characterRung(threshold), name);
    if (threshold > 0) {
      check(`...and a point below it does not (${name})`, characterRung(threshold - 1) !== name);
    }
  }
  eq('the worst rung holds at the ceiling',
    characterRung(DISREPUTE_MAX), CHARACTER[CHARACTER.length - 1][1]);

  // a deed raises it, clamped both ends
  eq('a deed adds its weight', afterDeed(0, DISREPUTE_HERMIT_KILL), DISREPUTE_HERMIT_KILL);
  eq('...never below Honest', afterDeed(5, -100), 0);
  eq('...never past the ceiling', afterDeed(DISREPUTE_MAX, 100), DISREPUTE_MAX);
  eq('one hermit kill takes an Honest pilot to Dodgy',
    characterRung(afterDeed(0, DISREPUTE_HERMIT_KILL)), 'Dodgy');

  // time erodes it — people forget, slowly
  eq('a day of honest flying fades it by the decay rate', afterDecay(50, 1), 50 - DISREPUTE_DECAY);
  eq('...never below Honest', afterDecay(1, 100), 0);
  eq('...a paused or rewound clock does nothing', afterDecay(50, 0), 50);
  eq('...and neither does a NaN span', afterDecay(50, NaN), 50);
  check('a hermit kill is a fortnight-plus of honest flying to fully shed — slow, as memories are',
    DISREPUTE_HERMIT_KILL / DISREPUTE_DECAY > 14);
}

console.log('\na bribe is priced against the decay, not against a feeling');
{
  // WHAT SETTLED docs/TODO/129 M2 (docs/TODO/132). The plan parked
  // `DISREPUTE_BRIBE` on a playtest, and the missing input turned out not to be
  // a flight: a deed's weight only means something against the rate that
  // forgives it, and nobody had put the two numbers side by side.
  //
  // Measured over the real galaxy rather than a remembered figure — every jump
  // a full tank allows — because the decay is spent in DAYS and only the chart
  // knows how many a jump costs.
  const legs: number[] = [];
  for (let i = 0; i < g1.length; i++) {
    for (let j = 0; j < g1.length; j++) {
      if (i === j) continue;
      const d = distanceTenths(g1[i], g1[j]);
      if (d > 0 && d <= MAX_FUEL) legs.push(daysForJump(d));
    }
  }
  legs.sort((a, b) => a - b);
  const medianJump = legs[Math.floor(legs.length / 2)];
  const forgiven = medianJump * DISREPUTE_DECAY;
  check(`the galaxy really is jumpable (${legs.length} legs, ${legs[0]}–`
    + `${legs[legs.length - 1]} days, median ${medianJump})`,
    legs.length > 1000 && legs[0] < medianJump && medianJump < legs[legs.length - 1]);

  // THE RULE, in both directions. One bad afternoon must wash off, and a habit
  // must not — which is a claim about the deed AND the decay together, so it is
  // stated as flying rather than as arithmetic on one constant.
  const quietJumps = (score: number, n: number) => {
    let s = score;
    for (let i = 0; i < n; i++) s = afterDecay(s, medianJump);
    return s;
  };
  eq('one bribe marks an Honest commander',
    characterRung(afterDeed(0, DISREPUTE_BRIBE)), 'Dubious');
  eq('...and two quiet jumps wash it off completely',
    characterRung(quietJumps(afterDeed(0, DISREPUTE_BRIBE), 2)), 'Honest');
  check(`...because the deed is worth about two median jumps of decay`
    + ` (${DISREPUTE_BRIBE} vs ${forgiven})`,
    DISREPUTE_BRIBE > forgiven && DISREPUTE_BRIBE <= forgiven * 2.5);

  // ...and the habit, which is the half that must NOT wash off: a bribe in every
  // system, jumping between them, is a reputation being built on purpose.
  let habit = 0;
  const reached: Record<string, number> = {};
  for (let n = 1; n <= 12; n++) {
    habit = afterDeed(quietJumps(habit, 1), DISREPUTE_BRIBE);
    const rung = characterRung(habit);
    if (reached[rung] === undefined) reached[rung] = n;
  }
  check(`a bribe every system reaches Dodgy by the 4th and Shady by the 8th`
    + ` (${Object.entries(reached).map(([r, n]) => `${r}@${n}`).join(' ')})`,
    reached.Dodgy !== undefined && reached.Dodgy <= 4
    && reached.Shady !== undefined && reached.Shady <= 8);

  // THE CONTROL: the habit is the thing, not the travelling. A commander who
  // bribes once and then flies must not drift upward on his own.
  check('...while one bribe and a career of honest flying stays Honest',
    characterRung(quietJumps(afterDeed(0, DISREPUTE_BRIBE), 40)) === 'Honest');
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
      // The rung, and which WAY it went (docs/TODO/162). A rung name alone is a
      // word the player has never met, and the decay crosses rungs downward.
      eq(`...and the line names it (${characterVerdict(threshold - 1, threshold)})`,
        characterVerdict(threshold - 1, threshold),
        `REPUTATION: ${name.toUpperCase()} — WORD IS GETTING ROUND`);
      eq('...and the way back says the news is good',
        characterVerdict(threshold, threshold - 1),
        `REPUTATION: ${characterRung(threshold - 1).toUpperCase()} — WORD IS DYING DOWN`);
      // ...and downward, which is the decay's half: the rung you LAND on, not
      // the one you left.
      eq(`...falling back off ${threshold} names the rung below`,
        rungCrossed(threshold, threshold - 1), characterRung(threshold - 1));
    }
    // a move that stays inside the rung says nothing, in either direction
    eq(`a move inside ${name} says nothing`, rungCrossed(threshold, threshold + 0.5), null);
    eq(`...and so does the way back (${name})`,
      rungCrossed(threshold + 0.5, threshold), null);
  }

  // The two rungs a single deed can skip: `DISREPUTE_MURDER` is 40, which takes
  // an Honest commander past Dubious to Dodgy. It names where you ARE.
  const murdered = afterDeed(0, DISREPUTE_MURDER);
  eq(`one murder crosses two rungs and names the far one (${characterRung(murdered)})`,
    rungCrossed(0, murdered), characterRung(murdered));
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
  // `characterRung` and nothing else, asked at every threshold above.
  check('every line the ladder can produce names a rung the ladder has',
    CHARACTER.every(([threshold, name]) =>
      characterVerdict(threshold - 1, threshold) === null
      || characterVerdict(threshold - 1, threshold)
        === `REPUTATION: ${name.toUpperCase()} — WORD IS GETTING ROUND`));
}
