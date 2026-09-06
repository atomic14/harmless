// The ladder-word rules: what a sentence may not call a ladder.
//
// The game has three ladders and one player word for each:
//
//   the disrepute ladder -> REPUTATION   (Honest … Cutthroat)
//   the legal ladder     -> LEGAL STATUS (Clean, Offender, Fugitive)
//   the combat ladder    -> RATING       (Harmless … Elite)
//
// docs/TODO/162 and docs/TODO/171 wrote these lists into
// test/ladder-words.test.ts, and the test held them alone until
// docs/TODO/191. A dossier is generated text a player reads, and its
// generator must refuse a line the test would fail. ONE HOME, TWO CALLERS:
// the test scans the tree, and tools/dossier-faults.ts scans a dossier before
// it is committed.
//
// THREE RULES OVER THREE SURFACES, and they stay apart. One list that served
// all three would ban a correct row of each. `NAME` is right on a screen that
// asks for one. `reputation` is right where it means the disrepute ladder. A
// comment about the ban has to be able to state the ban.

/**
 * The words a shouted line may not use, and why each one is here.
 *
 * `NAME` is not on it, and that is deliberate: a commander and a save each
 * have one, and three screens ask for it. The banned form is the
 * POSSESSIVE, which is the one GitHub #33 reported.
 */
export const SHOUTED: readonly (readonly [RegExp, string])[] = [
  [/\bYOUR NAME\b/, 'the ladder is REPUTATION; a NAME is what you type'],
  [/\bCHARACTER\b/, 'the player word for that ladder is REPUTATION'],
  [/\bDISREPUTE\b/, 'the score is not shown; the ladder is REPUTATION'],
  [/\bRECORD\b/, 'the player word for that ladder is LEGAL STATUS'],
];

/**
 * What a mixed-case sentence may not say about REPUTATION, and why.
 *
 * The word reached a player four times when docs/TODO/171 measured it, and
 * three of the four meant a different ladder. Neither rule is a ban on the
 * word: it is the right word for the disrepute ladder, and the only word a
 * player has for it.
 */
export const PROSE: readonly (readonly [RegExp, string])[] = [
  [/\b(?:no|any|little|without)\s+(?:[a-z]+\s+){0,2}reputation\b|\breputation\s+(?:whatsoever|at all)\b/i,
    'every commander has a reputation, and Honest is its best rung — a new'
    + ' pilot has no RATING, which is the other ladder'],
  [/\breputations\b/i,
    'REPUTATION is one commander\'s one ladder; a plural means something else'],
];

/** The combat ladder is the RATING. Calling it a reputation is the mirror fault. */
export const COMBAT = /\b(?:combat|kill|fighting)\s+reputation\b/i;

/**
 * The shouted rule, as a patron's mixed-case prose would break it.
 *
 * `RECORD` is banned outright on the console, where it only ever meant the
 * legal ladder. In prose "the survey record" is plain English, so the ban
 * here takes the forms that mean the ladder.
 */
const DOSSIER_PROSE: readonly (readonly [RegExp, string])[] = [
  [/\byour name\b/i, 'the ladder is reputation; a name is what you type'],
  [/\bcharacter\b/i, 'the player word for that ladder is reputation'],
  [/\bdisrepute\b/i, 'the score is not shown; the ladder is reputation'],
  [/\b(?:your|criminal|clean|legal|police)\s+record\b/i, 'the player word for that ladder is legal status'],
];

/** Every ladder offence in one field of generated prose, named. Empty means it passes. */
export function proseLadderOffences(text: string): string[] {
  const why: string[] = [];
  if (COMBAT.test(text)) why.push('the combat ladder is the RATING, not a reputation');
  for (const [re, reason] of [...PROSE, ...DOSSIER_PROSE]) if (re.test(text)) why.push(reason);
  return why;
}
