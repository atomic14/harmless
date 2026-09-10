// The sight sits at the centre of the view above the console (docs/TODO/200).
//
// `SIGHT_Y` was 0.42, and the stylesheet repeated it. The shell measures the
// console now, and this function is the one rule. The three cases are the
// ones a shell can hand it: no console, a console, and a console taller
// than the view, which a resize in the middle of a reflow can produce.

import { sightFraction } from '../src/engine/sight.ts';
import { check, eq } from './harness.ts';

console.log('\nthe sight sits at the centre of the view above the console');
{
  eq('no console: the centre of the view', sightFraction(0, 757), 0.5);
  check('a console of 197 in 757: the centre of the 560 above it, at 37%',
    Math.abs(sightFraction(197, 757) - 280 / 757) < 1e-9);
  check('a console of 242 in 844: the centre of the 602 above it, at 36%',
    Math.abs(sightFraction(242, 844) - 301 / 844) < 1e-9);
  eq('a console taller than the view: the top, never above it', sightFraction(900, 757), 0);
  eq('no view yet: the centre, not a division by zero', sightFraction(197, 0), 0.5);
}
