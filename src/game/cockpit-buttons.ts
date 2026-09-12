// The buttons over the flight view, built from what the cockpit sees
// (docs/TODO/205 M5, docs/TODO/206 M3 and M5).
//
// Two columns. The courses sit top right: where the ship can go next, the
// course it flies now, fast forward, and the offers that the situation
// raises. The pilot's hands sit bottom right: the target list, the E.C.M.,
// the missile and the laser. The laser is the lowest of them, where a right
// thumb finds it without a look.
//
// PURE, and it decides nothing. Each function takes what the cockpit already
// read and returns `HudButton`s. `hud/hud-buttons.ts` paints them, and a
// click or a tap sends the button's code, as a station menu row does.
//
// THE WORDS ARE THE PLAYER'S (Chris, 2026-09-11: *"A user does not have all
// our context."*). No button says "course". A button under way says what the
// ship is doing, and a button the ship cannot use says what it needs.

import type { HudButton } from '../hud/hud-buttons.ts';
import type { CoursePanel } from './course-actions.ts';
import type { TargetPanel } from './target-actions.ts';
import type { Prompt } from './prompts.ts';
import type { ControlMode } from './controls.ts';
import { COURSE_NAMES } from './courses.ts';
import {
  COURSE_KEYS, COURSE_SKIP_KEY, COURSE_TOGGLE_KEY, TARGET_NONE_KEY, TARGETS_KEY,
} from './bindings.ts';
import { keyCodeIfBound, keyIfBound } from '../ui/key-help.ts';
import { SKIP_SPEED } from '../constants/course.ts';
import { LASER_RANGE } from '../constants/player-gun.ts';

/**
 * The course panel as buttons (docs/TODO/205 M5). With no course, each course
 * is a button, and the galactic chart follows them. Over a course that flies,
 * one lit button names it and opens the list.
 */
export function courseButtonsFor(p: CoursePanel, chart: string | null): HudButton[] {
  if (p.rows === null) {
    return p.current === null ? [] : [
      { code: COURSE_TOGGLE_KEY, label: COURSE_NAMES[p.current], lit: true, hint: 'CHOOSE SOMEWHERE ELSE' },
      skipButton(p),
    ].filter((b): b is HudButton => b !== null);
  }
  const out: HudButton[] = p.rows.map((c) => ({
    code: COURSE_KEYS[c.kind], label: c.what, ...(c.why === null ? {} : { note: c.why }),
  }));
  if (chart) out.push({ code: chart, label: 'LOCAL CHART' });
  if (p.current !== null) out.push({ code: COURSE_TOGGLE_KEY, label: 'CLOSE' });
  return out;
}

/** What the pilot's buttons are built from (docs/TODO/206 M3). */
export interface ActionSource {
  /** the fire key of the live layout, which the laser button holds */
  readonly fireKey: string | null;
  readonly missiles: number;
  readonly armed: boolean;
  readonly locked: boolean;
  readonly armKey: string | null;
  readonly launchKey: string | null;
  /** the E.C.M.'s key, or null when none is fitted */
  readonly ecmKey: string | null;
  /** a hostile missile is on its way, so the E.C.M. is the button to press */
  readonly missileInbound: boolean;
  /** the pilot flies the last stretch into the slot (docs/TODO/207 M2) */
  readonly trial: boolean;
  /** the keys that open and close the throttle, for the two held buttons */
  readonly accelKey: string | null;
  readonly decelKey: string | null;
  /** the code the roll strip reports under */
  readonly rollStripCode: string;
  readonly targets: TargetPanel | null;
}

/**
 * The pilot's hands as buttons, top to bottom (docs/TODO/206 M3). The target
 * list opens above the rest. The laser comes last, at the bottom, where a
 * thumb finds it without a look.
 */
export function actionButtonsFor(a: ActionSource): HudButton[] {
  // The last stretch into the slot asks for two things and nothing else: the
  // roll, and the speed (docs/TODO/207 M2). So the pilot's buttons are those
  // two while it runs, and the guns wait.
  if (a.trial) {
    const out: HudButton[] = [{ code: a.rollStripCode, label: 'DRAG TO ROLL', strip: true }];
    if (a.accelKey) {
      out.push({ code: a.accelKey, label: 'THRUST', hint: 'HOLD TO SPEED UP', hold: true });
    }
    if (a.decelKey) {
      out.push({ code: a.decelKey, label: 'BRAKE', hint: 'HOLD TO SLOW DOWN', hold: true });
    }
    return out;
  }
  const out: HudButton[] = [];
  const t = a.targets;
  if (t && t.open) {
    for (const { code, row } of t.rows) {
      const reach = row.range <= LASER_RANGE ? 'IN LASER RANGE' : 'OUT OF LASER RANGE';
      out.push({
        code, label: row.name, lit: row.picked,
        // A rock's name IS its standing, so the hint says the range alone.
        hint: row.name === row.standing ? reach : `${row.standing} · ${reach}`,
        ...(row.cost ? { note: row.cost } : {}),
      });
    }
    if (t.picked) out.push({ code: TARGET_NONE_KEY, label: 'LET THE COMPUTER CHOOSE' });
  }
  if (t && (t.rows.length > 0 || t.open)) {
    out.push({
      code: TARGETS_KEY, label: t.open ? 'CLOSE THE LIST' : 'TARGETS',
      hint: t.picked ? `AIMING AT THE ${t.picked.name}` : 'CHOOSE WHAT TO FIGHT',
    });
  }
  if (a.ecmKey) {
    out.push(a.missileInbound
      ? { code: a.ecmKey, label: 'E.C.M.', lit: true, hint: 'A MISSILE IS COMING — PRESS NOW' }
      : { code: a.ecmKey, label: 'E.C.M.', hint: 'DESTROYS MISSILES NEARBY' });
  }
  if (a.missiles > 0 && a.armKey && a.launchKey) {
    out.push(a.armed
      ? {
        code: a.launchKey, label: 'FIRE THE MISSILE', lit: a.locked,
        hint: a.locked ? 'LOCKED ON' : 'IT LOCKS ON A SHIP IN YOUR SIGHTS',
      }
      : { code: a.armKey, label: 'ARM A MISSILE', hint: `${a.missiles} LEFT` });
  }
  if (a.fireKey) out.push({ code: a.fireKey, label: 'FIRE LASER', hint: 'HOLD TO FIRE', hold: true });
  return out;
}

/** The fast forward button, while a course flies (docs/TODO/205 M7). */
function skipButton(p: CoursePanel): HudButton | null {
  if (!p.skip) return null;
  if (p.skip.on) {
    return { code: COURSE_SKIP_KEY, label: 'FAST FORWARD IS ON', lit: true, hint: 'BACK TO NORMAL SPEED' };
  }
  return {
    code: COURSE_SKIP_KEY, label: 'FAST FORWARD',
    ...(p.skip.block === null ? { hint: `TIME RUNS ${SKIP_SPEED} TIMES FASTER` } : { note: p.skip.block }),
  };
}


/**
 * The offers as buttons (docs/TODO/206 M5): what a key can do about the
 * situation right now (`prompts.ts`). A click or a tap sends the command's own
 * key, and the key is named under the words for a pilot at a keyboard.
 *
 * The E.C.M.'s offer is left out, because it lights the E.C.M. button instead
 * of showing twice.
 */
export function offerButtons(offers: readonly Prompt[], mode: ControlMode): HudButton[] {
  return offers.filter((p) => p.command !== 'fireEcm').flatMap((p) => {
    const code = keyCodeIfBound(mode, p.command);
    const key = keyIfBound(mode, p.command);
    return code ? [{ code, label: p.what, ...(key ? { hint: `OR PRESS ${key}` } : {}) }] : [];
  });
}
