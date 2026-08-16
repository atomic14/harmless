// A ladder is named to the player in the player's word, or it is not named.
//
// GitHub #33, and docs/TODO/162. Chris read one line and said what was wrong
// with it: *"'Cost you name' doesn't mean anything. We use it in a lot of
// places and 'name' is a bit confusing - what are we saying."*
//
// The word `name` carried five meanings. Four of them were a ladder — the
// disrepute ladder, the legal ladder, the combat ladder — and the fifth is the
// only correct one: what a thing is CALLED. A commander types a name. A save
// takes a name. A system has one.
//
// The item then grew, on Chris's second reading: *"a user does not have the
// context we have and they don't understand all our internal ways of naming
// things."* So `CHARACTER` was no better than `NAME`. It is the directory's
// word, the module's word and the constants' word, and a pilot has met none of
// them.
//
// THE RULE THIS FILE HOLDS. The game has three ladders and one player word for
// each:
//
//   the disrepute ladder -> REPUTATION   (Honest … Cutthroat)
//   the legal ladder     -> LEGAL STATUS (Clean, Offender, Fugitive)
//   the combat ladder    -> RATING       (Harmless … Elite)
//
// A console line or a screen uses that word, and never the code's own. The code
// keeps `character`, `disrepute` and `record`, because those name modules and
// fields rather than sentences.
//
// THREE RULES OVER THREE SURFACES, and docs/TODO/171 is why there are three.
// The first version read one surface: a shouted string, in TypeScript, under
// two directories. It therefore read about a third of what a player reads, and
// it stripped every comment before it read.
//
//   the console's voice  -> a banned word, shouted   (docs/TODO/162)
//   the pages and screens-> REPUTATION means one thing (docs/TODO/171)
//   the tree's comments  -> `name` is not a ladder    (docs/TODO/171)
//
// The three rules are deliberately apart. One list that served all three would
// ban a correct row of each: `NAME` is right on a screen that asks for one,
// `reputation` is right where it means the disrepute ladder, and a comment
// about the ban has to be able to state the ban.
//
// `test/ladder-scan.ts` decides what each rule reads. `test/key-prose.test.ts`
// is the shape both halves copy: a scan of the shipped source that fails on the
// next offence, rather than a list somebody maintains.

import { newCommander } from '../src/game/commander.ts';
import { renderStatus } from '../src/ui/screens.ts';
import { characterVerdict } from '../src/game/character.ts';
import { recordVerdict } from '../src/game/law.ts';
import { CHARACTER } from '../src/constants/character.ts';
import { CLEAN, FUGITIVE, OFFENDER } from '../src/constants/law.ts';
import { PAGES, commentParagraphs, playerSentences, shoutedStrings } from './ladder-scan.ts';
import { capture } from './screen-capture.ts';
import { check, eq } from './harness.ts';

console.log('\nno console line calls a ladder by the code\'s word');
{
  /**
   * The words a sentence may not use, and why each one is here.
   *
   * `NAME` is not on it, and that is deliberate rather than an omission: a
   * commander and a save each have one, and three screens ask for it. The
   * banned form is the POSSESSIVE, which is the one the issue reported.
   */
  const BANNED: readonly (readonly [RegExp, string])[] = [
    [/\bYOUR NAME\b/, 'the ladder is REPUTATION; a NAME is what you type'],
    [/\bCHARACTER\b/, 'the player word for that ladder is REPUTATION'],
    [/\bDISREPUTE\b/, 'the score is not shown; the ladder is REPUTATION'],
    [/\bRECORD\b/, 'the player word for that ladder is LEGAL STATUS'],
  ];

  const offences = (text: string): string[] => {
    // the console's voice, and `key-prose.test.ts`'s test for it: a shouted
    // string with real words in it. An identifier is not a message.
    if (/[a-z]/.test(text)) return [];
    if ((text.match(/[A-Z]/g) ?? []).length < 3) return [];
    return BANNED.filter(([re]) => re.test(text)).map(([, why]) => why);
  };

  // The predicate first, against the line this gate was written for and against
  // the words that must survive it. A gate nobody has seen fail is a guess.
  check('the scanner catches the line the issue reported',
    offences('V AND L BOTH COST YOUR NAME').length === 1);
  check('...and the first fix, which swapped one internal word for another',
    offences('V AND L BOTH DAMAGE YOUR CHARACTER').length === 1);
  check('...and a record line in the code\'s word',
    offences('RECORD: FUGITIVE').length === 1);
  check('...while the three screens that ask for a real name are untouched',
    offences('A COMMANDER NEEDS A NAME').length === 0
    && offences('A SAVE NEEDS A NAME').length === 0
    && offences('0 IS ALREADY FLYING — CHOOSE ANOTHER NAME').length === 0);
  check('...and so are the words that replaced the offences',
    offences('V AND L BOTH DAMAGE YOUR REPUTATION').length === 0
    && offences('LEGAL STATUS: FUGITIVE — POLICE WILL ATTACK YOU').length === 0);

  const shouted = shoutedStrings();
  const found = shouted.flatMap((l) => offences(l.text)
    .map((why) => `${l.where}:${l.line}: "${l.text}" — ${why}`));

  check(`no shouted string in src/game/ or src/ui/ names a ladder in the code's`
    + ` word (${shouted.length} shouted strings)`,
  found.length === 0, found.join('\n     '));
  // The control: a scan that read nothing would report the same success.
  check('...and the scan really read the console\'s voice', shouted.length > 100);
}

console.log('\n...and no page tells a player REPUTATION means something else');
{
  /**
   * What a mixed-case sentence may not say about REPUTATION, and why.
   *
   * The word reached a player four times when docs/TODO/171 measured it, and
   * three of the four meant a different ladder. Neither rule is a ban on the
   * word: it is the right word for the disrepute ladder, and it is the only
   * word a player has for it.
   *
   * A shouted line is `shoutedStrings`'s, and it is banned on other words. The
   * two lists never merge. `Your legal status follows you` is a correct
   * sentence of the manual, and one merged list would fail on it.
   */
  const PROSE: readonly (readonly [RegExp, string])[] = [
    [/\b(?:no|any|little|without)\s+(?:[a-z]+\s+){0,2}reputation\b|\breputation\s+(?:whatsoever|at all)\b/i,
      'every commander has a reputation, and Honest is its best rung — a new'
      + ' pilot has no RATING, which is the other ladder'],
    [/\breputations\b/i,
      'REPUTATION is one commander\'s one ladder; a plural means something else'],
  ];

  const misread = (text: string): string[] =>
    PROSE.filter(([re]) => re.test(text)).map(([, why]) => why);

  // The predicate first, against the three sentences docs/TODO/171 measured and
  // against the one it measured as correct.
  check('the scanner catches the briefing\'s sentence',
    misread('You are docked at a space station with 100 credits and no reputation at all.').length === 1);
  check('...and the manual\'s, which says it the other way round',
    misread('You have a Cobra Mk III, a pulse laser and no reputation whatsoever.').length === 1);
  check('...and the one that means a route rather than a commander',
    misread('Convoys are lost, reputations build along lawless routes.').length === 1);
  check('...while the manual\'s one correct row is untouched',
    misread('Your legal status follows you across the galaxy.').length === 0);
  check('...and so is a sentence that uses the word for the ladder it names',
    misread('It never clears your legal status, and it always costs your reputation.').length === 0
    && misread('Commanders of established reputation are advised of the hazard.').length === 0);

  const read = playerSentences();
  const pages = new Set(read.map((l) => l.where));
  const found = read.flatMap((l) => misread(l.text)
    .map((why) => `${l.where}:${l.line}: "${l.text}" — ${why}`));

  check(`no sentence a player reads gives REPUTATION a second meaning`
    + ` (${read.length} sentences, ${PAGES.length} pages)`,
  found.length === 0, found.join('\n     '));
  // The two controls. A walk pointed at a directory with no pages would report
  // the same success, and so would one that read the markup and no prose.
  check('...and the scan really read the pages of the site',
    PAGES.length >= 5 && ['index.html', 'manual.html', 'novella.html'].every((p) => pages.has(p)));
  check('...and the game\'s own mixed-case voice', pages.has('src/ui/briefing.ts'));
}

console.log('\n...and no comment in src/ calls a ladder by another ladder\'s word');
{
  /** A word that says the paragraph is about one of the three ladders. */
  const LADDER = /disrepute|notoriet|notorious|infam|reputation|cutthroat|fugitive|offender|\bladder\b|\brung\b|\bhonest\b|\brecord\b|\bfame\b|\brating\b/i;

  /**
   * A word before `name` that says WHAT is named, so the sentence is correct.
   *
   * This is the rule rather than an exception list: a name belongs to a thing,
   * and a comment that says which thing cannot be read as a ladder. A new kind
   * of name adds a word here, and the failure message asks for exactly that.
   */
  const NAMED_THING = /\b(?:save|file|system|ship|brain|rung|scenario|display|phase|commander|pilot|class|field|key)$/i;

  /** `name` as a bare noun. A possessive is excluded; `name's` names a thing. */
  const BARE_NAME = /\b(?:a|an|the|your|my|his|her|their|its)\s+((?:[A-Za-z]+\s+){0,3})name\b(?!')/gi;

  /** The combat ladder is the RATING. Calling it a reputation is the mirror fault. */
  const COMBAT = /\b(?:combat|kill|fighting)\s+reputation\b/i;

  /**
   * The two files that state the rule, which a blanket ban would fail on.
   *
   * `constants/character.ts` says *"The word `name` never means this ladder"*
   * and then says what it does mean. `game/character.ts` explains why a rung
   * name alone is not enough for the console. Both must be able to say so.
   */
  const EXEMPT = ['constants/character.ts', 'game/character.ts'];

  const miscalled = (text: string): string[] => {
    const why: string[] = [];
    if (COMBAT.test(text)) why.push('the combat ladder is the RATING, not a reputation');
    if (!LADDER.test(text)) return why;
    // A backtick holds an identifier, and the style does not reach code.
    for (const m of text.replaceAll(/`[^`]*`/g, ' CODE ').matchAll(BARE_NAME)) {
      if (NAMED_THING.test(m[1].trim())) continue;
      why.push(`"${m[0].trim()}" — say which ladder, or say what has the name`);
    }
    return why;
  };

  // The predicate first, against comments docs/TODO/171 measured on both sides.
  check('the scanner catches a name that means the disrepute ladder',
    miscalled('What a fully notorious name is worth as HEAT.').length === 1
    && miscalled('That term is what a tonne of narcotics costs a name. Its disrepute'
      + ' term is not added on top.').length === 1);
  check('...and one that means the legal ladder',
    miscalled('A fugitive may dock and trade, and a cleared name is a choice.').length === 1);
  check('...and the combat ladder called a reputation',
    miscalled('Combat reputation. Ships destroyed weighted by how hard they were.').length === 1);
  check('...while a comment that says WHAT is named is untouched',
    miscalled('A rung name alone is a word the player never met, and the decay'
      + ' crosses rungs downward.').length === 0
    && miscalled('The display name is for a human; these are for a record.').length === 0);
  check('...and so is a name with no ladder anywhere near it',
    miscalled('A commander has a name, and it is the word the player types.').length === 0);

  const paras = commentParagraphs();
  const found = paras.filter((l) => !EXEMPT.includes(l.where))
    .flatMap((l) => miscalled(l.text).map((why) => `${l.where}:${l.line}: ${why}`));

  check(`no comment in src/ names a ladder in another ladder's word`
    + ` (${paras.length} comment paragraphs)`,
  found.length === 0, found.join('\n     '));
  // The control: the first version of this gate stripped every comment, and a
  // reader that stripped them all would report the same success.
  check('...and the scan really read the comments', paras.length > 5000);
}

console.log('\n...and the two verdict lines say the player\'s word');
{
  // The one home of each ladder's line, so asserting here covers every caller.
  // Both are asked at a real crossing rather than at a number of this file's
  // own: `CHARACTER`'s second rung, and the two rungs the law can put you on.
  const dubious = CHARACTER[1][0];
  eq('a reputation that gets worse says so, and says which way',
    characterVerdict(dubious - 1, dubious), 'REPUTATION: DUBIOUS — WORD IS GETTING ROUND');
  eq('...and one that recovers says the other way',
    characterVerdict(dubious, dubious - 1), 'REPUTATION: HONEST — WORD IS DYING DOWN');

  check('the record line says LEGAL STATUS and who is coming',
    recordVerdict(FUGITIVE).startsWith('LEGAL STATUS: FUGITIVE')
    && recordVerdict(FUGITIVE).includes('WILL ATTACK YOU'));
  check('...at every rung the ladder holds',
    [CLEAN, OFFENDER, FUGITIVE].every((s) => recordVerdict(s).startsWith('LEGAL STATUS: ')));
  // A Clean commander is told where they stand and nothing more, because
  // nobody is coming. That rule is docs/TODO/130's and this pins it survives.
  check('...and a clean commander is promised no fight',
    !recordVerdict(CLEAN).includes('WILL ATTACK YOU'));
}

console.log('\n...and the COMMANDER screen labels all three ladders');
{
  // The screens are mixed case, so the shouted scan cannot see them. This is
  // the one screen that prints all three ladders at once, which is also the
  // reason the three words have to differ: they are six lines apart.
  const LAVE = { name: 'Lave', economy: 0, government: 5, techLevel: 4 } as never;
  const c = newCommander();
  c.disrepute = CHARACTER[2][0];              // Dodgy, so the row is not the default
  const systems: never[] = [];
  systems[c.systemIndex] = LAVE;
  const html = capture(() => renderStatus(systems, c, null, 'Fugitive'));

  check('the disrepute ladder is Reputation on the screen',
    html.includes('Reputation: Dodgy'));
  check('...and the legal ladder is Legal status',
    html.includes('Legal status: Fugitive'));
  check('...and the combat ladder is Rating', /Rating:/.test(html));
  // The claim that makes the three worth checking together: no row on this
  // screen calls a ladder Character, which is what it said before
  // docs/TODO/162.
  check('...and no row calls a ladder Character', !/Character/.test(html));
  // ...and the fifth meaning is still here and still correct, on the same
  // screen, which is what made `characterName(c.disrepute)` beside `c.name` the
  // sharpest case in the item.
  check('...while the commander still has a name of her own',
    html.includes(`COMMANDER ${c.name}`));
}
