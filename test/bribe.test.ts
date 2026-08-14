// Buying the law, as rules: what an offer costs, what it buys, and what it
// never buys.
//
// The pirate half of this idea is `test/combat.test.ts` (cargo, and an appetite
// sized off your hold). This is the half that spends CREDITS on a policeman —
// docs/TODO/123 — and the claims it has to hold are as much about what does NOT
// move as what does:
//
//   - the record never clears, and never rises either: an inspection bought off
//     is an inspection that did not happen;
//   - the NAME always pays, whichever half of the feature you used, and whether
//     or not he takes the money;
//   - an offer you cannot cover buys nothing and spends nothing. A bribe that
//     half-works is the worst outcome there is.
//
// The prices are asserted from the constants and `VALUE_PER_TONNE` rather than
// from literals, so retuning the numbers does not silently retune the rules,
// and the refusal is measured at two sample sizes off a seeded stream of its
// own. `test/bribe-flight.test.ts` is the other half: the same rules with a
// real Game and a real Viper around them, which is where a price nobody obeys
// would show up.

import { makeRng } from '../src/game/rng.ts';
import {
  bribeOffered, fineFor, inspectionPrice, patrolPrice, patrolReach, refusalChance,
} from '../src/game/law.ts';
import { check, cmds, eq, eqc } from './harness.ts';
import {
  BRIBE_FLOOR, BRIBE_REFUSED, BRIBE_SHARE, CLEAN, CONTRABAND, FUGITIVE,
  FUGITIVE_FINE, OFFENDER, PATROL_BRIBE_FINES, SCAN_RANGE, SCAN_WARN_RANGE,
} from '../src/constants/law.ts';
import {
  CHARACTER, DISREPUTE_BRIBE, DISREPUTE_MAX,
} from '../src/constants/character.ts';
import { VALUE_PER_TONNE } from '../src/constants/jettison.ts';
import { COMMODITIES } from '../src/galaxy/galaxy.ts';
import {
  NOT_IN_THE_SIMULATOR,
} from '../src/game/bindings.ts';
import { COMMAND_HELP } from '../src/game/command-help.ts';

const NARCOTICS = CONTRABAND[1];

// --- the key -----------------------------------------------------------------

console.log('\nL offers the law money — and never in the simulator');
{
  eqc('L in the cockpit makes the offer', cmds('flight', ['KeyL']), ['bribePolice']);
  eqc('...and the arena has no law to buy, so it answers nothing',
    cmds('simulator', ['KeyL']), []);
  check('...which is what NOT_IN_THE_SIMULATOR is doing',
    NOT_IN_THE_SIMULATOR.includes('bribePolice'));
  eqc('L at the station is still LAUNCH', cmds('docked', ['KeyL']), ['launch']);
  check('the guide says what it never buys',
    COMMAND_HELP.bribePolice.what.includes('never clears your record')
    && COMMAND_HELP.bribePolice.what.includes('costs your name'));
}

// --- the price ---------------------------------------------------------------

console.log('\nwhat a policeman charges to not read your hold');
{
  const hold = (tonnes: number): number[] => {
    const cargo = COMMODITIES.map(() => 0);
    cargo[NARCOTICS] = tonnes;
    return cargo;
  };
  // The rule, not the number: his cut of what the market pays for the evidence.
  const worth = (tonnes: number): number =>
    tonnes * COMMODITIES[NARCOTICS].basePrice * VALUE_PER_TONNE;

  eq('ten tonnes of narcotics cost his share of what they are worth',
    inspectionPrice(hold(10)), Math.round(worth(10) * BRIBE_SHARE));
  check('...and a fatter hold costs more than a thin one',
    inspectionPrice(hold(10)) > inspectionPrice(hold(4))
    && inspectionPrice(hold(4)) > inspectionPrice(hold(2)));
  check('...but never less than the floor, whatever you are carrying',
    inspectionPrice(hold(1)) === BRIBE_FLOOR
    && inspectionPrice(hold(0)) === BRIBE_FLOOR
    && worth(1) * BRIBE_SHARE < BRIBE_FLOOR);
  // Money is integer tenths (invariant 8): a price with a fraction in it would
  // leave a commander holding 0.03 of a credit for the rest of the career.
  check('every price is a whole number of tenths',
    [0, 1, 3, 7, 13, 35].every((t) => Number.isInteger(inspectionPrice(hold(t)))));
  // Legal cargo is not evidence: the sum is over CONTRABAND and nothing else,
  // so a hold of platinum does not raise the price of hiding one tonne of
  // slaves. Priced off the whole hold, the key would ask a fortune of a trader
  // running one crate.
  const withFurs = hold(3);
  withFurs[9] = 20;
  eq('a legal cargo alongside it changes nothing',
    inspectionPrice(withFurs), inspectionPrice(hold(3)));
}

console.log('\nan offer is taken, refused, or short — exactly one of the three');
{
  const price = inspectionPrice([]);
  // A roll of 1 is above every refusal chance there is, so these are the
  // arithmetic with the gamble held still; the gamble itself is measured below.
  const TAKEN = 1;
  const rich = bribeOffered(price, price * 4, 0, TAKEN);
  check('a commander who can cover it pays exactly the price',
    rich.outcome === 'paid' && rich.creditsLeft === price * 3);
  check('...and it costs the name DISREPUTE_BRIBE, every time',
    rich.outcome === 'paid' && rich.disrepute === DISREPUTE_BRIBE);

  const broke = bribeOffered(price, price - 1, 40, TAKEN);
  eq('a commander one tenth short buys nothing', broke.outcome, 'short');
  check('...and is told what the shortfall is',
    broke.outcome === 'short' && broke.short === 1);
  // The one thing the failure must not do is take the money anyway — there is
  // no `creditsLeft` on that branch of the type at all, so this is the type
  // system's claim as much as the test's.
  check('...and it carries nothing to spend',
    !('creditsLeft' in broke) && !('disrepute' in broke));
  // ...nor is it an offer: a price you cannot meet is not spoken out loud, so
  // it costs no name and consumes no draw off the seeded stream.
  check('...and no name is spent on an offer that was never made',
    bribeOffered(price, 0, 40, 0).outcome === 'short');

  // Exactly affordable is affordable: the boundary belongs to the commander.
  const exact = bribeOffered(price, price, 0, TAKEN);
  check('the last tenth in the account still buys it',
    exact.outcome === 'paid' && exact.creditsLeft === 0);

  // A roll of 0 is below every refusal chance an honest commander has.
  const turned = bribeOffered(price, price * 4, 0, 0);
  eq('a roll under the chance is a refusal', turned.outcome, 'refused');
  check('...which costs the name exactly what a taken offer does',
    turned.outcome === 'refused' && turned.disrepute === DISREPUTE_BRIBE);
  check('...and carries no money to move', !('creditsLeft' in turned));
}

console.log('\nwhat a Viper already shooting charges to break off');
{
  check('a Fugitive is asked for more than an Offender',
    patrolPrice(FUGITIVE) > patrolPrice(OFFENDER));
  // THE RULE THAT MATTERS: a bribe that undercut the fine would delete the
  // fine. Docking and paying is always the cheaper way to deal with a record.
  check('...and both are worse than docking and paying the fine at that rung',
    patrolPrice(FUGITIVE) > fineFor(FUGITIVE, Infinity)
    && patrolPrice(OFFENDER) > fineFor(OFFENDER, Infinity));
  eq('...by the multiple the constant states, not a number of its own',
    patrolPrice(FUGITIVE), PATROL_BRIBE_FINES * FUGITIVE_FINE);
  // A clean commander can only be shot at by the law for something he did, and
  // the deed is the same deed: he pays the bottom rung's rate rather than the
  // nothing `fineFor` would return.
  eq('a Clean commander pays the Offender rate rather than nothing',
    patrolPrice(CLEAN), patrolPrice(OFFENDER));
  check('...and that is not nothing', patrolPrice(CLEAN) > 0);
}

console.log('\nthe cop who says no, and the Character that changes his mind');
{
  eq('an Honest commander is refused at the top of the ramp',
    refusalChance(0), BRIBE_REFUSED);
  check('...and a name fully made is never turned in',
    refusalChance(DISREPUTE_MAX) === 0 && refusalChance(DISREPUTE_MAX * 3) === 0);
  check('...with every rung of the ladder between them worth something',
    CHARACTER.every(([at], i) => i === 0
      || refusalChance(at) < refusalChance(CHARACTER[i - 1][0])));
  check('a score below Honest cannot bend it past the top', refusalChance(-50) === BRIBE_REFUSED);

  // MEASURED, at two sample sizes (CLAUDE.md: before a sampled number drives a
  // decision, check at two sample sizes). An independent seeded stream, so this
  // does not disturb the world's — and seeded, so the sequence is reproducible.
  const rateAt = (disrepute: number, n: number, seed: number): number => {
    const rng = makeRng(seed);
    let refused = 0;
    for (let i = 0; i < n; i++) {
      if (bribeOffered(100, 10_000, disrepute, rng()).outcome === 'refused') refused += 1;
    }
    return refused / n;
  };
  for (const n of [200, 2000]) {
    const honest = rateAt(0, n, 4_281);
    const notorious = rateAt(80, n, 4_282);
    const cutthroat = rateAt(120, n, 4_283);
    check(`at ${n} offers an Honest pilot is refused about BRIBE_REFUSED of the`
      + ` time (${honest.toFixed(3)} against ${BRIBE_REFUSED})`,
      Math.abs(honest - BRIBE_REFUSED) < 0.08);
    check(`...and the rate falls as the name is made (${honest.toFixed(3)} >`
      + ` ${notorious.toFixed(3)} > ${cutthroat.toFixed(3)}, n=${n})`,
      honest > notorious && notorious > cutthroat);
    check(`...tracking the rule rather than a curve of its own (n=${n})`,
      Math.abs(notorious - refusalChance(80)) < 0.08);
  }
}

console.log('\nthe window an offer fits in is the window the warning names');
{
  eq('inside scan range he is reading you', patrolReach(SCAN_RANGE * 0.5), 'scan');
  eq('...between the two ranges he is closing', patrolReach(SCAN_RANGE + 1), 'warn');
  eq('...just inside the band, still closing', patrolReach(SCAN_WARN_RANGE - 1), 'warn');
  eq('...and beyond it there is nobody to talk to', patrolReach(SCAN_WARN_RANGE), 'none');
  eq('...nor at the far side of the system', patrolReach(Infinity), 'none');
}
