// The buttons over the flight view, built from what the cockpit sees
// (docs/TODO/205 M5, docs/TODO/206 M3 and M5).
//
// Two headers over the sky, and a row in the console. The course header sits
// top right, closed by default, and its list opens as one row under it that
// scrolls sideways (docs/TODO/215 M2). A course under way is the header, lit,
// with fast forward beside it. A run from a fight and the offers the
// situation raises sit under the header at all times, because each is
// urgent. The target header sits bottom left, and its list opens as one row
// above it. The guns are a row at the bottom of the console (docs/TODO/215
// M1): the laser, the missile as two buttons, and the E.C.M.
//
// The guns and the target list sat bottom right until 2026-09-13, and the
// list opened upward over the action. Chris: *"the buttons cover up the
// area where all the action is happening"*, and then *"I think the buttons
// should be at the bottom"*. He drew the row, with the missile split in two.
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
import { COURSE_NAMES, type Course } from './courses.ts';
import {
  COURSE_KEYS, COURSE_LIST_KEY, COURSE_SKIP_KEY, COURSE_STOP_KEY, TARGET_NONE_KEY, TARGETS_KEY,
} from './bindings.ts';
import { keyCodeIfBound, keyIfBound } from '../ui/key-help.ts';
import { SKIP_SPEED } from '../constants/course.ts';
import { LASER_RANGE } from '../constants/player-gun.ts';

/** A course as a button: its words, and what stops it, under them. */
const courseButton = (c: Course): HudButton =>
  ({ code: COURSE_KEYS[c.kind], label: c.what, ...(c.why === null ? {} : { note: c.why }) });

/**
 * The course header (docs/TODO/205 M5, docs/TODO/215 M2). Over a course that
 * flies, one lit button names it, and fast forward sits beside it. With no
 * course, one header opens the list, closed by default. A run from a fight
 * stays under it, because a pilot in a fight has no time for a tap.
 */
export function courseButtonsFor(p: CoursePanel): HudButton[] {
  if (p.rows === null) {
    return p.current === null ? [] : [
      { code: COURSE_STOP_KEY, label: COURSE_NAMES[p.current], lit: true, hint: 'TAP TO STOP' },
      skipButton(p),
    ].filter((b): b is HudButton => b !== null);
  }
  const ways = p.rows.filter((c) => c.kind !== 'run');
  const out: HudButton[] = [{
    code: COURSE_LIST_KEY, label: p.open ? 'ACTIONS ▴' : 'ACTIONS ▾', lit: p.open,
    hint: p.open ? 'TAP TO FOLD' : `${ways.length} WAYS TO GO`,
  }];
  const run = p.rows.find((c) => c.kind === 'run');
  if (run) out.push(courseButton(run));
  return out;
}

/**
 * The course row (docs/TODO/215 M2): every course but the run, and the local
 * chart, as one row that scrolls sideways under the header. Empty while the
 * header is closed, or while a course flies.
 */
export function courseRowFor(p: CoursePanel, chart: string | null): HudButton[] {
  if (p.rows === null || !p.open) return [];
  const out = p.rows.filter((c) => c.kind !== 'run').map(courseButton);
  if (chart) out.push({ code: chart, label: 'LOCAL CHART' });
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
  /** the disarm key, so the missile is two buttons: arm or disarm, and fire */
  readonly disarmKey: string | null;
  readonly launchKey: string | null;
  /** the E.C.M.'s key, or null when none is fitted */
  readonly ecmKey: string | null;
  /** the cloak's key, or null with no cloaking device fitted (docs/TODO/219 M5) */
  readonly cloakKey: string | null;
  /** ...and whether it runs */
  readonly cloaked: boolean;
  /** a hostile missile is on its way, so the E.C.M. is the button to press */
  readonly missileInbound: boolean;
  /**
   * The docking computer's key, or null where none is fitted. It is offered as
   * a button for the whole of the pilot's stretch at the slot (Chris,
   * 2026-09-12). A commander who paid for the fitting may use it at any point,
   * rather than fly a line-up they did not ask for.
   */
  readonly dockKey: string | null;
  /** the pilot flies the last stretch into the slot (docs/TODO/207 M2) */
  readonly trial: boolean;
  /** ...and the rails have it, so the mini game is on (docs/TODO/212) */
  readonly rails: boolean;
  /** the keys that open and close the throttle, for the two held buttons */
  readonly accelKey: string | null;
  readonly decelKey: string | null;
  /** the code the roll strip reports under */
  readonly rollStripCode: string;
  readonly targets: TargetPanel | null;
}

/**
 * The target header, bottom left (docs/TODO/206 M3, docs/TODO/215 M2). It
 * is one button that opens the list and folds it. Its hint is the count, or
 * the pick. It is empty while the pilot flies the slot, when the guns wait,
 * and while nothing is on the scanner.
 */
export function targetButtonsFor(a: ActionSource): HudButton[] {
  if (a.trial) return [];
  const t = a.targets;
  if (!t || (t.rows.length === 0 && !t.open)) return [];
  const count = `${t.rows.length} ON THE SCANNER`;
  return [{
    code: TARGETS_KEY, label: t.open ? 'TARGETS ▴' : 'TARGETS ▾', lit: t.open,
    hint: t.open ? 'TAP TO FOLD' : t.picked ? `AIMING AT THE ${t.picked.name}` : count,
  }];
}

/**
 * The target row (docs/TODO/215 M2): a button per ship with the range and
 * the standing, and one that lets the computer choose again. It is one row
 * that scrolls sideways above the header. Empty while the header is closed.
 */
export function targetRowFor(a: ActionSource): HudButton[] {
  const t = a.targets;
  if (a.trial || !t || !t.open) return [];
  const out: HudButton[] = t.rows.map(({ code, row }) => {
    const reach = row.range <= LASER_RANGE ? 'IN LASER RANGE' : 'OUT OF LASER RANGE';
    return {
      code, label: row.name, lit: row.picked,
      // A rock's name IS its standing, so the hint says the range alone.
      hint: row.name === row.standing ? reach : `${row.standing} · ${reach}`,
      ...(row.cost ? { note: row.cost } : {}),
    };
  });
  if (t.picked) out.push({ code: TARGET_NONE_KEY, label: 'LET THE COMPUTER CHOOSE' });
  return out;
}

/**
 * The gun row, left to right (docs/TODO/215 M1). FIRE LASER is held. ARM A
 * MISSILE or DISARM reads by the missile's state, with the count. FIRE THE
 * MISSILE is lit on a lock. E.C.M. is lit while a missile is inbound. The
 * row is always four buttons in the same places. A button the ship cannot
 * use stays dim and says why, so a thumb can learn the row. During the
 * pilot's stretch into the slot the row holds the stretch's own buttons.
 */
export function gunButtonsFor(a: ActionSource): HudButton[] {
  // The last stretch into the slot asks for two things and nothing else: the
  // roll, and the speed (docs/TODO/207 M2). So the pilot's buttons are those
  // two while it runs, and the guns wait.
  // THE FITTING THE COMMANDER PAID FOR, offered for the whole stretch. It
  // flies the rest of the approach and the slot, and it ends the trial.
  const handOver = (): HudButton[] => (a.dockKey === null ? []
    : [{ code: a.dockKey, label: 'DOCKING COMPUTER', hint: 'IT FLIES YOU IN' }]);
  if (a.trial && !a.rails) {
    // The computer is lining the ship up, and the pilot has nothing else to do
    // yet (docs/TODO/212). A strip that did nothing would be a lie.
    return [
      ...handOver(),
      { code: 'dock-lining-up', label: 'LINING UP', hint: 'STAND BY FOR THE SLOT' },
    ];
  }
  if (a.trial) {
    const out: HudButton[] = [
      ...handOver(),
      { code: a.rollStripCode, label: 'DRAG TO ROLL', strip: true },
    ];
    if (a.accelKey) {
      out.push({ code: a.accelKey, label: 'THRUST', hint: 'HOLD TO GO IN', hold: true });
    }
    if (a.decelKey) {
      out.push({ code: a.decelKey, label: 'BRAKE', hint: 'HOLD TO SLOW DOWN', hold: true });
    }
    return out;
  }
  const out: HudButton[] = [];
  if (a.fireKey) out.push({ code: a.fireKey, label: 'FIRE LASER', hint: 'HOLD TO FIRE', hold: true });
  // The missile as two buttons (Chris, 2026-09-13): arm or disarm, and fire.
  const left = `${a.missiles} LEFT`;
  if (a.missiles === 0 || !a.armKey || !a.disarmKey) {
    out.push({ code: a.armKey ?? 'missile-none', label: 'ARM A MISSILE', note: 'NONE LEFT' });
  } else if (a.armed) {
    out.push({ code: a.disarmKey, label: 'DISARM', lit: true, hint: left });
  } else {
    out.push({ code: a.armKey, label: 'ARM A MISSILE', hint: left });
  }
  if (a.armed && a.launchKey) {
    out.push({
      code: a.launchKey, label: 'FIRE THE MISSILE', lit: a.locked,
      hint: a.locked ? 'LOCKED ON' : 'IT LOCKS ON A SHIP IN YOUR SIGHTS',
    });
  } else {
    out.push({ code: a.launchKey ?? 'missile-none', label: 'FIRE THE MISSILE', note: 'NOT ARMED' });
  }
  if (a.ecmKey) {
    out.push(a.missileInbound
      ? { code: a.ecmKey, label: 'E.C.M.', lit: true, hint: 'A MISSILE IS COMING — PRESS NOW' }
      : { code: a.ecmKey, label: 'E.C.M.', hint: 'DESTROYS MISSILES NEARBY' });
  } else {
    out.push({ code: 'ecm-none', label: 'E.C.M.', note: 'NOT FITTED' });
  }
  // The cloak, which no shop sells (docs/TODO/219 M5). The button stays, so
  // a thumb learns the row, and it says why it does nothing.
  if (a.cloakKey) {
    out.push(a.cloaked
      ? { code: a.cloakKey, label: 'CLOAK', lit: true, hint: 'IT DRAINS THE BANK — A SHOT GIVES YOU AWAY' }
      : { code: a.cloakKey, label: 'CLOAK', hint: 'NOBODY SEES YOU WHILE IT RUNS' });
  } else {
    out.push({ code: 'cloak-none', label: 'CLOAK', note: 'NOT FITTED' });
  }
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
