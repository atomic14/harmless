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
// `test/key-prose.test.ts` is the shape this copies: a scan of the shipped
// source that fails on the next offence, rather than a list somebody maintains.
// The scan reads the CONSOLE'S VOICE — a shouted string — for the same reason
// that file does, and `test/screen-capture.ts` covers the screens, which are
// mixed case and which a scan would miss.

import { readdirSync, readFileSync } from 'node:fs';
import { newCommander } from '../src/game/commander.ts';
import { renderStatus } from '../src/ui/screens.ts';
import { characterVerdict } from '../src/game/character.ts';
import { recordVerdict } from '../src/game/law.ts';
import { CHARACTER } from '../src/constants/character.ts';
import { CLEAN, FUGITIVE, OFFENDER } from '../src/constants/law.ts';
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

  /** The source with its comments gone — this file discusses the banned words. */
  const stripped = (url: URL): string =>
    readFileSync(url, 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');

  const walk = (dir: URL): URL[] => readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, dir))
      : /\.ts$/.test(e.name) ? [new URL(e.name, dir)] : []));

  // key-prose.test.ts's literal reader, and for its reasons: backticks first,
  // and every form takes escapes, so an apostrophe cannot end a match early.
  const LITERAL = /`((?:[^`\\]|\\.)*)`|'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g;
  const found: string[] = [];
  let shouted = 0;
  for (const root of ['../src/game/', '../src/ui/']) {
    const ROOT = new URL(root, import.meta.url);
    for (const url of walk(ROOT)) {
      const rel = url.pathname.slice(ROOT.pathname.length);
      for (const m of stripped(url).matchAll(LITERAL)) {
        const text = (m[1] ?? m[2] ?? m[3] ?? '').replaceAll(/\$\{[^}]*\}/g, '0');
        if (!/[a-z]/.test(text) && (text.match(/[A-Z]/g) ?? []).length >= 3) shouted += 1;
        const why = offences(text);
        if (why.length) found.push(`${rel}: "${text}" — ${why.join('; ')}`);
      }
    }
  }

  check(`no shouted string in src/game/ or src/ui/ names a ladder in the code's`
    + ` word (${shouted} shouted strings)`,
  found.length === 0, found.join('\n     '));
  // The control: a scan that read nothing would report the same success.
  check('...and the scan really read the console\'s voice', shouted > 100);
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
  // The screens are mixed case, so the scan above cannot see them. This is the
  // one screen that prints all three ladders at once, which is also the reason
  // the three words have to differ: they are six lines apart.
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
