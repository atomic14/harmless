// Which named pilot flies, what each is LIKE, and the flags that change it.
//
// One home for a rule that three places ask:
//
//   - `NpcShip.update` needs the pilot;
//   - the combat trainer's report needs the NAME;
//   - the exercise picker needs the LIST.
//
// The names, the flags and the table between them live here. brains.ts turns a
// name into a loaded policy. This module imports no weights. So the trainer's
// pure rules ask the same question, and no JSON enters their module graph.
//
// The CHARACTER of each pilot lives here too: one line of behaviour, with the
// number that shows it. So a picker names what a playtester is about to fly.
// `npm test` refuses a name the pickers offer with no line beside it.

/**
 * Every pilot the game flies, by name. Three code paths, zero weights files.
 *
 * `npm test` holds the weights directory to exactly what brains.ts imports. So
 * a name here with no file fails, and so does a file with no name. Neither
 * lingers.
 *
 * A name promises that brains.ts imports it. It does not promise that the file
 * parsed. brains.ts loads defensively, and a mismatched file becomes null
 * there.
 */
export type BrainName =
  | 'attack-run'
  | 'pursuit'
  | 'scripted';

/**
 * The two picker values that are not pilots.
 *
 * "As shipped" is how the career picker says no override. "As the game flies"
 * is the exercise picker's: leave every ship on what it would fly.
 *
 * They are listed beside the names, so that "every value on this row has a
 * name" has an answer for them too.
 */
export const AS_SHIPPED = 'as-shipped';
export const AS_THE_GAME_FLIES = 'live';

/** What a pilot is called on a row, and what it is like to fight. */
export interface BrainProfile {
  /** two or three words for how it FLIES — the row's value, never a version or file stem */
  name: string;
  /** the one line of behaviour, with the measured number that shows it */
  character: string;
}

/**
 * What each pilot is CALLED and what it is LIKE in a fight — one line, behaviour
 * first, with the one measured number that shows it. A line describes behaviour,
 * not provenance; where a number would be guessed it says NEVER PROBED instead.
 *
 * Figures are traceable: flight shapes are `train/flight-probe.ts` over 30
 * held-out episodes; damage shares are the 60-episode `npm run evaluate`
 * tournament (docs/TRAINING-LOG.md, run 19).
 *
 * The two pickers offer one sentinel each (SAME AS OUTSIDE, THE ORIGINAL) which
 * are not pilots; their lines live in `screens/combat-sim-notes.ts`.
 */
export const BRAINS: Readonly<Record<BrainName, BrainProfile>> = Object.freeze({
  // The DEFENCE slots' name — one name, two flights, and the comment on
  // `SHIPPED_DEFENCE` below says which slot flies which. The trader's half is
  // the same code path as `scripted` (tournament: 58% accuracy, ~5 attack runs
  // a minute); the co-pilot's pursuit post-dates the tournament. Either
  // trigger is the gun's own hit cone, so it shoots only what it can hit.
  'attack-run': {
    name: 'FIGHTS BACK',
    character: 'ONE NAME, TWO FLIGHTS: AN ARMED TRADER TURNS AND FIGHTS WITH THE '
      + 'THREE-PHASE ATTACK RUN (CLOSE, FIRE THROUGH THE PASS, COME ROUND — ABOUT 5 RUNS '
      + 'A MINUTE), WHILE THE COMBAT COMPUTER YOU BUY FLIES A PURE-PURSUIT DOGFIGHTER ON '
      + 'YOUR OWN SHIP: ONTO THE TARGET\'S SIX, SHOOTING ONLY WHEN LINED UP.',
  },
  // tournament: 58% accuracy, 31.8s on a hauler's six, loses 0.93 ships an
  // episode to a commander who fights back
  scripted: {
    name: 'MAKES ATTACK RUNS',
    character: 'THE HAND-WRITTEN ATTACK RUN PIRATES FLEW BEFORE PURSUIT: CLOSES, FIRES '
      + 'THROUGH THE PASS AND COMES ROUND AGAIN — ABOUT 5 RUNS A MINUTE. THE A/B THAT '
      + 'PUTS THE PIRATES BACK ON IT AND SWITCHES THE DEFENCE OFF: NO CO-PILOT, AND AN '
      + 'ARMED TRADER RUNS INSTEAD OF TURNING TO FIGHT.',
  },
  // The pursuit dogfighter the combat computer flies, turned on the pirates as
  // the shipped opposition. A hybrid: it holds the six but breaks into the
  // attack run when the commander faces it. NOT PROBED (post-dates the tournament).
  pursuit: {
    name: 'GETS ON YOUR SIX',
    character: 'THE COMBAT COMPUTER\'S OWN PILOT, FLOWN BY THE PIRATES: IT CHASES ONTO YOUR '
      + 'TAIL AND HOLDS THERE WHEN IT IS ASTERN — BUT BREAKS INTO THE ATTACK RUN\'S SLASHING '
      + 'PASS THE MOMENT YOU TURN YOUR NOSE ONTO IT, SO IT WILL NOT SIT IN YOUR GUNS. NEVER '
      + 'PROBED (IT IS NEWER THAN THE TOURNAMENT).',
  },
});

/** What the two sentinels read as. What they MEAN is the panel's own prose. */
const SENTINEL_NAMES: Readonly<Record<string, string>> = Object.freeze({
  [AS_THE_GAME_FLIES]: 'SAME AS OUTSIDE',
  [AS_SHIPPED]: 'THE ORIGINAL',
});

/**
 * What a picker VALUE reads as: the pilot's two or three words, or a sentinel's
 * own words. Undefined for a value no picker offers. Plain string because the
 * two pickers speak different unions.
 */
export function brainName(brain: string): string | undefined {
  return BRAINS[brain as BrainName]?.name ?? SENTINEL_NAMES[brain];
}

/** What a named pilot is like in a fight, or undefined for a name no picker offers. */
export function brainCharacter(brain: string): string | undefined {
  return BRAINS[brain as BrainName]?.character;
}

/** Is this a policy with a weights file behind it, rather than a sentinel? */
export function isNamedBrain(brain: string): brain is BrainName {
  return brain in BRAINS;
}

/**
 * Which pilots fly, when the answer is not "the shipped ones".
 *
 * It is a field of `GameState`. AI state is game state: anything the step READS
 * is state. So a snapshot takes it, a test passes it as an argument, and the
 * trainer's ordinary teardown restores it. It is never an ambient global.
 *
 * From a console, go through the one documented handle:
 * `__game.state.brains.pursuit = true`. In the game, the LIVE BRAINS row on the
 * combat trainer's setup panel (`T` at any station) writes the same field. An
 * old save may carry an unknown key (a deleted flag); it rides along unread, and
 * `npm test` checks exactly that.
 */
export interface BrainSelection {
  /**
   * The A/B control. It puts every pirate on the `scripted` hand-written
   * attack run, and it switches the defence OFF. The combat computer then
   * refuses to engage (autopilot.ts). An armed trader then runs, and never
   * turns to fight (npc.ts's defence gate).
   *
   * An old save may carry a deleted trained-pirate flag, `pack` or `trained`.
   * It rides along unread.
   */
  scripted?: boolean;
  /**
   * The explicit name of the pirates' default (`pursuit`). It is kept so that a
   * career or an exercise can name it out loud, rather than reach it only
   * through "as shipped".
   *
   * It does not switch them onto it. `pirateBrainNameFor` returns `pursuit`
   * unless `scripted` is set.
   */
  pursuit?: boolean;
}

/**
 * The NAME the defence slots fly under with no overrides: one name, two
 * hand-written flights.
 *
 * An armed trader turns and fights with the three-phase attack run that the
 * name is called after. The defence gate in npc.ts compares against this name,
 * then calls its own `attack()`.
 *
 * The combat computer you buy flies a PURE-PURSUIT dogfighter on the
 * commander's own ship. That is scripted-co-pilot.ts, chosen by this name in
 * game.ts's `pilotDemand`. It first flew the attack run, and it diverged
 * deliberately: the run's steer-nowhere pass read as a released grip on a close
 * target (git 3c7b8ea).
 *
 * Neither slot follows the pirates' rule. A pirate defaults to `pursuit`, via
 * `pirateBrainNameFor`.
 */
const SHIPPED_DEFENCE: BrainName = 'attack-run';

/**
 * No overrides: what the live game flies. It is frozen, because it is a shared
 * default. A caller that mutated it would move every other caller's pilots.
 *
 * **THE LINE THAT CHANGES THE SHIPPED DEFAULT.** Everything downstream comes
 * off it:
 *
 *   - `pirateBrainFor`;
 *   - `defenceBrain`;
 *   - the trainer's `liveBrainFor`;
 *   - the `SHIPPED_*_BRAIN` ids in the report.
 *
 * It is deliberately `{}`, and `npm test` asserts that it is empty. So a change
 * to what ships is a decision taken twice.
 */
export const SHIPPED_BRAINS: BrainSelection = Object.freeze({});

/**
 * Which policy a pirate of this tier flies, BY NAME. It is `pursuit` by
 * default. It is `scripted` when the A/B control asks for the hand-written
 * attack run instead.
 *
 * The shipped opposition is the pursuit dogfighter: the combat computer's own
 * pilot, turned on the pirates. Tier and organisation stay in the signature,
 * even though the answer does not read them today.
 */
export function pirateBrainNameFor(
  _tier: number, _organised: boolean, sel: BrainSelection = SHIPPED_BRAINS,
): BrainName {
  return sel.scripted ? 'scripted' : 'pursuit';
}

/** Which policy an armed trader or a player-assist ship flies, BY NAME. */
export function defenceBrainNameFor(sel: BrainSelection = SHIPPED_BRAINS): BrainName {
  return sel.scripted ? 'scripted' : SHIPPED_DEFENCE;
}

/**
 * A named policy, as the selection that makes the whole game fly it.
 *
 * Which pilot a pirate flies is a decision per ROLE, not per ship. So
 * "everybody flies the gang policy" is a selection, and "this one ship flies
 * it" is not.
 *
 * The trainer's `ExerciseSpec.brain` sets one per exercise. The LIVE BRAINS row
 * sets one for the career. Every name has an entry: a policy a picker offers is
 * one the game can be put into.
 */
const SELECTIONS: Partial<Record<BrainName, BrainSelection>> = {
  'attack-run': {},
  pursuit: { pursuit: true },
  scripted: { scripted: true },
};

/**
 * The selection a named brain flies under, or undefined where the game cannot
 * fly it. It takes a plain string, because the callers speak two different
 * unions, and a saved career can hand over anything at all.
 */
export function selectionForBrain(brain: string): BrainSelection | undefined {
  const sel = SELECTIONS[brain as BrainName];
  return sel ? { ...sel } : undefined;
}

// THE CAREER-WIDE PICKER'S MODEL WAS HERE, AND IT IS GONE (docs/TODO/81).
//
// `LiveBrainId`, `LIVE_BRAIN_IDS`, `liveBrainSelection` and `liveBrainId` served
// one row of the combat trainer. That row was taken out of the UI, and the four
// members stayed. Nothing in `src/` called any of them, and only tests kept them
// alive.
//
// The model was also false. It offered `attack-run`, whose selection is the same
// empty object `AS_SHIPPED` means, so a pilot who picked that row read it back
// as "as shipped". The round trip was where the collision showed.
//
// TWO SENTINELS AND THEIR TABLE ARE THE SAME DEFECT, AND THEY ARE REPORTED
// RATHER THAN DELETED. `AS_SHIPPED`, `AS_THE_GAME_FLIES` and `SENTINEL_NAMES`
// are read by `brainName`'s fallback alone. Every live caller hands it a
// `BrainId`, which is a `BrainName`, so that fallback answers nobody. The
// exercise picker is a second surface, and this item did not measure it.
