// A key named in WORDS comes from the table, or it does not appear.
//
// The other half of invariant 9, and the half nothing could see. A surface that
// renders from `controls.ts` cannot lie about a binding; a SENTENCE that spells
// the key out can, and three of them did:
//
//   - `NO FUEL TO JUMP — PRESS B FOR THE DISTRESS BEACON` (world-step.ts)
//   - `ALREADY LOCKED — U TO UNARM` (ordnance.ts)
//   - `PRESS ? FOR CONTROLS — QWERTY LAYOUT (B TO SWITCH)` (game.ts)
//
// Each was a sixth help surface, free to disagree with the table the moment
// anything was rebound, and nothing could see any of them. docs/TODO/128 deleted
// the first (being stranded is a cockpit PROMPT now), gave the second a
// `Prompt` for the edge to render, and made the third interpolate `boundKey`.
//
// So this file is the gate: a scan of the shipped source that fails on the next
// one, plus the join that shows the surviving refusal rendering from the table.
// test/key-help.test.ts holds the other half — that every binding reaches every
// GENERATED surface.

import { readdirSync, readFileSync } from 'node:fs';
import { BINDINGS } from '../src/game/controls.ts';
import { ordnanceMessage } from '../src/game/ordnance.ts';
import { ALL_BINDINGS, keyIfBound, keyLabel } from '../src/ui/key-help.ts';
import { check, eq } from './harness.ts';

console.log('\nno console message in src/game/ spells a key out');

console.log('\nno console message in src/game/ spells a key out');
{
  /** Every label the tables bind, as a message could write it. */
  const bound = new Set(ALL_BINDINGS.map((b) => keyLabel(b.key, b.shift)));

  // Two kinds of label are deliberately NOT hunted:
  //
  //   - the DIGITS. 1-4 select the cockpit's four views, and a message that
  //     contains a lone digit is almost always counting something — `1 DAY
  //     AGO`, `2 ORGANISED GANG`. The false positives would swamp the rule.
  //   - ESC and ENTER. Escape leaves a pointer lock and closes every overlay in
  //     every browser; a sentence naming it is describing the machine, not
  //     quoting a binding that could move.
  const HUNTED = [...bound].filter((k) => !/^[0-9]$/.test(k) && k !== 'ESC' && k !== 'ENTER');

  /**
   * Which bound keys this string writes out.
   *
   * A key is a WHOLE token: `E.C.M.` is not the E key and `PILOT'S` is not the
   * S key, so a token keeps its dots and apostrophes and is rejected for having
   * them. Only shouted strings are read, because that is the console's voice —
   * an identifier or a class name is not a message.
   */
  const offences = (text: string): string[] => {
    if (/[a-z]/.test(text)) return [];
    if ((text.match(/[A-Z]/g) ?? []).length < 3) return [];
    return text.split(/\s+/)
      .map((word) => word.replace(/^[^A-Z0-9?⇧']+|[^A-Z0-9?⇧']+$/g, ''))
      .filter((word) => HUNTED.includes(word));
  };

  // The controls, first and against the predicate itself: the three real
  // sentences above must be caught, and the words that replaced them must not.
  check('the scanner catches the message this gate was written for',
    offences('NO FUEL TO JUMP — PRESS B FOR THE DISTRESS BEACON').join(',') === 'B');
  check('...and the boot line that named two',
    offences('PRESS ? FOR CONTROLS —  LAYOUT (B TO SWITCH)').join(',') === '?,B');
  check('...and it is not fooled by an abbreviation or a possessive',
    offences('NO E.C.M. FITTED').length === 0
    && offences("NEW PILOT'S BRIEFING").length === 0
    && offences('ALREADY LOCKED — TO UNARM').length === 0);

  /** The source with its comments gone — this file deletes keys in prose. */
  const stripped = (url: URL): string =>
    readFileSync(url, 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');

  const walk = (dir: URL): URL[] => readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, dir))
      : /\.ts$/.test(e.name) ? [new URL(e.name, dir)] : []));

  const ROOT = new URL('../src/game/', import.meta.url);
  const files = walk(ROOT)
    .map((url) => ({ rel: url.pathname.slice(ROOT.pathname.length), url }))
    // `game/screens/` is PLATFORM (tools/portability.mjs) and its keys are its
    // own scheme: a screen reads raw codes (`i.pressed('KeyX')`) and prints its
    // own keyline, which is the station menu docs/TODO/128 put out of scope.
    .filter(({ rel }) => !rel.startsWith('screens/'));

  // ...and the one module outside `screens/` that writes a screen's keyline:
  // `overlayLegend` is spent by ui/screens.ts alone, for the chart's T, which
  // chart.ts reads as a raw code exactly as the other screens do.
  const KEYLINES: Record<string, string> = { 'chart-overlay.ts': 'T' };

  // Backticks FIRST, and every form takes ESCAPES: a template holds apostrophes
  // (`${name}'S SIX`) and a quoted string escapes its own (`COMPUTER\'S`).
  // Either would otherwise end a match early and leave the fragment after it
  // read as a string of its own — which is a lone S, which is a bound key.
  const LITERAL = /`((?:[^`\\]|\\.)*)`|'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g;
  const found: string[] = [];
  let messages = 0;
  for (const { rel, url } of files) {
    for (const m of stripped(url).matchAll(LITERAL)) {
      // An interpolation becomes a DIGIT rather than nothing: `${boundKey(...)}`
      // is the right way to name a key, so what is left is what was written by
      // hand — but `${qty}T RECLAIMED` must not become a bare T, so the
      // placeholder stays welded to whatever was written against it.
      const text = (m[1] ?? m[2] ?? m[3] ?? '').replaceAll(/\$\{[^}]*\}/g, '0');
      if (!/[a-z]/.test(text) && (text.match(/[A-Z]/g) ?? []).length >= 3) messages += 1;
      const keys = offences(text).filter((k) => k !== KEYLINES[rel]);
      if (keys.length) found.push(`${rel}: "${text}" names ${keys.join(', ')}`);
    }
  }

  check(`no module in src/game/ spells a bound key in a message (${files.length} files,`
    + ` ${messages} shouted strings, ${HUNTED.length} keys hunted)`,
  found.length === 0, found.join('\n     '));
  // The control: a scan that read nothing would say the same thing.
  check('...and the scan really read the console\'s voice',
    messages > 100 && HUNTED.includes('B') && HUNTED.includes('⇧Y'));
}

console.log('\n...and the refusal that survived renders from it');
{
// ...and the one reply that answers itself carries a COMMAND, not a letter.
// `ALREADY LOCKED — U TO UNARM` was a binding written into a rule module,
// free to lie the moment `disarmMissile` moved (docs/TODO/128 M3, which bans
// it by scanning the source). The words come from here, the key from the
// table, and this is the join game.ts composes.
const locked = ordnanceMessage('alreadyLocked');
eq('a refusal with an answer names the command', locked.offer?.command, 'disarmMissile');
eq('...and the cockpit says it in the key the table binds',
  `${locked.text} — ${keyIfBound('flight', locked.offer!.command)} ${locked.offer!.what}`,
  'ALREADY LOCKED — U TO UNARM');
// Rebind it and the line moves with it, which no string could do.
const entry = (BINDINGS.flight as { key: string; command: string }[])
  .find((b) => b.command === 'disarmMissile')!;
const was = entry.key;
entry.key = 'KeyZ';
try {
  eq('...and rebinding it rewrites the refusal',
    keyIfBound('flight', locked.offer!.command), 'Z');
} finally {
  entry.key = was;
}
}
