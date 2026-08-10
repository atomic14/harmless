// Test mode: the door, and the mark it leaves on the career.
//
// `GameState.cheat` already had a passing test — test/trade.test.ts fits a
// galactic drive with no money — and nothing in the shipped game could set it.
// So what is asserted here is the half that was missing: that the SCREEN sets
// it, that switching it on marks the career for good, that a save written
// before the mark existed reads as an unmarked one rather than as undefined —
// and that the fit-out rows do the thing no shop in the game can, which is take
// equipment OFF again.
//
// Everything runs headlessly through the real Screen interface: the screen is
// given a context, driven with taps the way `ScreenHost` drives it, and the
// state is read back. No Game, no DOM, no renderer.

import { TestModeScreen, type TestModeContext } from '../src/game/screens/test-mode.ts';
import { freshState } from '../src/game/state.ts';
import {
  defaultEquipment, markTested, newCommander, LASER_TYPES,
  type CommanderData, type Equipment,
} from '../src/game/commander.ts';
import { buyEquipment, type TradeContext } from '../src/game/screens/trade.ts';
import { EQUIPMENT_CATALOGUE } from '../src/constants/shop.ts';
import { characterName } from '../src/game/character.ts';
import { isHostileToPlayer } from '../src/game/npc.ts';
import { BINDINGS } from '../src/game/controls.ts';
import { COMMAND_HELP } from '../src/game/command-help.ts';
import { commanderOf, fileId } from '../src/game/save-file.ts';
import { makeRecord, readSave, writeSave } from '../src/game/storage.ts';
import {
  CHEAT_CREDIT_GRANT, MAX_FUEL, MAX_MISSILES,
} from '../src/constants/commander.ts';
import { CLEAN, FUGITIVE, LEGAL_NAMES, OFFENDER } from '../src/constants/law.ts';
import { CHARACTER } from '../src/constants/character.ts';
import { checkJump, resolveJump } from '../src/game/hyperspace.ts';
import { distanceTenths } from '../src/galaxy/navigation.ts';
import type { Input } from '../src/engine/input.ts';
import { check, cmds, eq, eqc } from './harness.ts';
import { installStore } from './save-fixtures.ts';
import { g1 } from './fixtures.ts';

// --- the door ----------------------------------------------------------------

console.log('\n⇧T is the door, and T is still the simulator');
{
  eqc('⇧T at the station asks for test mode', cmds('docked', ['KeyT'], ['ShiftLeft']),
    ['openTestMode']);
  // The reason the shifted entry has to come FIRST in the table: the plain one
  // is the fallback and `pressed()` consumes, so a plain entry ahead of it eats
  // the tap and the training simulator opens with shift held.
  eqc('...and T on its own is still the training simulator', cmds('docked', ['KeyT']),
    ['openCombatSim']);
  // A development door belongs on the keyline — keys that work here but are not
  // controls you arrow onto — not among the menu's rows. Invariant 9's own test
  // holds that it is one or the other; this says WHICH.
  check('the door is a keyline caption, not a menu row',
    COMMAND_HELP.openTestMode.keyline === 'TEST MODE'
    && COMMAND_HELP.openTestMode.menu === undefined);
  check('...and it is bound at the station and nowhere else',
    BINDINGS.docked.some((b) => b.command === 'openTestMode')
    && !BINDINGS.flight.some((b) => b.command === 'openTestMode')
    && !BINDINGS.simulator.some((b) => b.command === 'openTestMode'));
}

// --- the toggle, driven through the screen -----------------------------------

/** A keyboard that has already been pressed, as `Input` — taps are consumed. */
function taps(): { press(code: string): void; input: Input } {
  const queued: string[] = [];
  return {
    press: (code) => { queued.push(code); },
    input: {
      pressed: (code: string) => {
        const at = queued.indexOf(code);
        if (at < 0) return false;
        queued.splice(at, 1);
        return true;
      },
      held: () => false,
    } as unknown as Input,
  };
}

console.log('\nthe screen is what sets GameState.cheat');
{
  const state = freshState(newCommander());
  let checkpoints = 0;
  const screen = new TestModeScreen(() => ({
    state,
    checkpoint: () => { checkpoints += 1; },
  } satisfies TestModeContext));

  const kb = taps();
  screen.open();
  check('a fresh career starts with the mode off and unmarked',
    state.cheat === false && state.commander.tested === false);

  kb.press('Enter');
  eq('ENTER on the first row switches it on', screen.input(kb.input), 'stay');
  check('...and `cheat` is now the true the outfitters read', state.cheat === true);
  check('...and the career is marked', state.commander.tested === true);
  check('...and the mark is written down rather than left for the next autosave',
    checkpoints === 1);

  // The latch. A live toggle can be switched off before a screenshot, which is
  // the whole reason the career carries a second, one-way field.
  kb.press('ArrowLeft');
  screen.input(kb.input);
  check('switching it off again clears `cheat`', state.cheat === false);
  check('...and does NOT clear the mark', state.commander.tested === true);

  // ESC leaves; it does not toggle anything on the way out.
  kb.press('Escape');
  eq('ESC closes the screen', screen.input(kb.input), 'back');
  check('...and changed nothing', state.cheat === false && checkpoints === 2);
}

// --- the commander levers ----------------------------------------------------
//
// Each one is asserted against the constant that DEFINES its ceiling or its
// rung — MAX_FUEL, MAX_MISSILES, FUGITIVE — rather than against a literal, so a
// balance change that moves the constant moves the assertion with it. And each
// is asserted twice: once with the mode on, once with it off, because "the door
// is what opens these" is the claim the whole item is about.

/**
 * A screen over a fresh career, and a hand to pull its levers with.
 *
 * `pull` finds the row BY LABEL rather than by index, so a panel that grows or
 * is re-grouped — it has done both — moves these tests with it instead of
 * silently pointing them at the wrong lever.
 */
function rig(cheat: boolean): {
  screen: TestModeScreen;
  state: ReturnType<typeof freshState>;
  saves: () => number;
  pull: (label: string, key?: string) => void;
} {
  const state = freshState(newCommander());
  state.cheat = cheat;
  let saves = 0;
  const screen = new TestModeScreen(() => ({
    state,
    checkpoint: () => { saves += 1; },
  } satisfies TestModeContext));
  screen.open();
  const kb = taps();
  return {
    screen,
    state,
    saves: () => saves,
    pull: (label, key = 'Enter') => {
      const at = screen.panel().rows.findIndex((r) => r.label === label);
      if (at < 0) throw new Error(`test-mode: no row labelled '${label}'`);
      // Through `select()` and `input()`, which are the two doors a click and a
      // key come in by — not by reaching for the cell.
      screen.select(at);
      kb.press(key);
      screen.input(kb.input);
    },
  };
}

/** What a row currently reads, for the assertions about the panel itself. */
const valueOf = (screen: TestModeScreen, label: string): string =>
  screen.panel().rows.find((r) => r.label === label)?.value ?? '';

console.log('\nthe commander levers, with the door open');
{
  const { screen, state, saves, pull } = rig(true);
  const c = state.commander;

  c.fuel = 0;
  pull('FILL TANK');
  eq('FILL TANK fills it to the tank the game defines', c.fuel, MAX_FUEL);

  c.missiles = 0;
  pull('FILL MISSILE RAILS');
  eq('FILL MISSILE RAILS fills every rail there is', c.missiles, MAX_MISSILES);

  const before = c.credits;
  pull('GRANT CREDITS');
  eq('GRANT CREDITS hands over the named sum', c.credits, before + CHEAT_CREDIT_GRANT);
  pull('GRANT CREDITS', 'ArrowLeft');
  eq('...and ← takes the same sum back', c.credits, before);
  // Broke, not overdrawn: money is unsigned tenths (invariant 8), and a
  // negative balance is a state no rule in the game knows how to read.
  pull('GRANT CREDITS', 'ArrowLeft');
  eq('...and cannot take you past broke', c.credits, 0);

  eq('a fresh career is Clean', c.legalStatus, CLEAN);
  pull('LEGAL STATUS');
  eq('LEGAL STATUS steps to Offender', c.legalStatus, OFFENDER);
  pull('LEGAL STATUS');
  eq('...then Fugitive', c.legalStatus, FUGITIVE);
  eq('...and the row says so in the law\'s own words',
    valueOf(screen, 'LEGAL STATUS'), LEGAL_NAMES[FUGITIVE].toUpperCase());
  pull('LEGAL STATUS');
  eq('...and round to Clean again', c.legalStatus, CLEAN);

  eq('a fresh career is Honest', characterName(c.disrepute), CHARACTER[0][1]);
  pull('CHARACTER');
  eq('CHARACTER steps onto the next rung of the ladder', c.disrepute, CHARACTER[1][0]);
  eq('...and the status screen would call it that',
    characterName(c.disrepute), CHARACTER[1][1]);
  pull('CHARACTER', 'ArrowLeft');
  eq('...and ← walks back down it', c.disrepute, CHARACTER[0][0]);

  // A score mid-decay sits BETWEEN rungs. → must land on the rung above the one
  // it has cleared rather than skipping it.
  c.disrepute = CHARACTER[1][0] + 1;
  pull('CHARACTER');
  eq('a score between rungs steps to the next one up', c.disrepute, CHARACTER[2][0]);

  eq('every pull was written to the shelf', saves(), 11);
}

// --- the fit-out, which is the half the outfitter cannot do ------------------

console.log('\nthe fit-out rows take equipment OFF, which no shop in the game can');
{
  const { screen, state, pull } = rig(true);
  const c = state.commander;
  const ctx: TradeContext = {
    commander: c,
    system: g1[7],
    market: [],
    atHermit: false,
    cheat: true,                      // the outfitter at its most permissive
    message: () => {},
    addNotoriety: () => {},
    checkpoint: () => {},
    leaveHermit: () => {},
  };

  // Every fitting the commander HAS is a row, derived from the record rather
  // than from a list here: a field added to `Equipment` gets a lever the day it
  // is added, and this is what says so.
  const labels = screen.panel().rows.map((r) => r.label);
  const missing = (Object.keys(defaultEquipment()) as (keyof Equipment)[])
    .filter((k) => k !== 'laser')
    .filter((k) => !labels.includes(
      (EQUIPMENT_CATALOGUE.find((i) => i.id === k)?.name ?? k).toUpperCase()));
  check(`every fitting on the commander has a row (${labels.length} rows)`,
    missing.length === 0, missing.join(', '));

  // THE GAP, stated as the two halves it has. The outfitter fits it...
  buyEquipment('ecm', ctx);
  check('the outfitter fits an E.C.M. free with the mode on', c.equipment.ecm);
  // ...and then will not touch it again, because `equipmentOwned` gates the row.
  buyEquipment('ecm', ctx);
  check('...and buying it again cannot take it off (it never could)', c.equipment.ecm);
  pull('E.C.M. SYSTEM');
  check('the test-mode row DOES take it off', !c.equipment.ecm);
  pull('E.C.M. SYSTEM');
  check('...and puts it back', c.equipment.ecm);

  // The same asymmetry on the gun: the shop's ladder only ever climbs.
  buyEquipment('military', ctx);
  eq('the outfitter climbs the gun ladder', c.equipment.laser, 'military');
  pull('FRONT LASER', 'ArrowLeft');
  eq('...and the row walks back down it, which the shop cannot',
    c.equipment.laser, LASER_TYPES[LASER_TYPES.indexOf('military') - 1]);
  pull('FRONT LASER');
  eq('...and round again', c.equipment.laser, 'military');
  pull('FRONT LASER');
  eq('...wrapping to the gun a fresh commander flies', c.equipment.laser, LASER_TYPES[0]);

  // The one shelf item that is a quantity. The shop sells one and there is no
  // way back short of a hot cabin.
  buyEquipment('trumble', ctx);
  eq('the outfitter sells you a trumble', c.trumbles, 1);
  pull('TRUMBLES', 'ArrowLeft');
  eq('...and the row is the only way to be rid of it', c.trumbles, 0);
  pull('TRUMBLES', 'ArrowLeft');
  eq('...and it cannot go negative', c.trumbles, 0);
}

console.log('\n...and with the door shut, every one of them is a no-op');
{
  const { screen, state, saves, pull } = rig(false);
  const c = state.commander;
  c.fuel = 0;
  c.missiles = 0;
  const was = JSON.stringify(c);

  const levers = screen.panel().rows.slice(1).map((r) => r.label);
  for (const label of levers) {
    pull(label);
    pull(label, 'ArrowLeft');
  }
  eq(`the commander is untouched by all ${levers.length} of them`,
    JSON.stringify(c), was);
  eq('...and nothing was written', saves(), 0);
  check('...and the panel says why: every lever is dimmed, the door is not',
    screen.panel().rows.slice(1).every((r) => r.dim === true)
    && screen.panel().rows[0].dim !== true);
}

// --- the legal lever, proved against a rule rather than against itself -------

console.log('\nthe legal-status lever is the one 122 and 123 are tested through');
{
  const { state, pull } = rig(true);
  // The narrowest thing `isHostileToPlayer` reads — the idiom is
  // test/combat.test.ts's police-hostility block.
  const police = { role: 'police', state: {
    alive: true, inert: false, satisfied: false, provoked: false, provokedByPlayer: false,
  } } as unknown as Parameters<typeof isHostileToPlayer>[0];

  check('a clean commander is nobody the police want',
    !isHostileToPlayer(police, state.commander.legalStatus));
  pull('LEGAL STATUS');
  pull('LEGAL STATUS');
  eq('two pulls and you are a Fugitive', state.commander.legalStatus, FUGITIVE);
  check('...and the same police ship now comes for you',
    isHostileToPlayer(police, state.commander.legalStatus));
}

// --- the flight lever -------------------------------------------------------
//
// One, not two. A SPAWN key was built here and taken out again at Chris's word
// ("we don't need to spawn anything"), so what is left in the cockpit is the
// jump — and it is not a binding at all, but a refusal that stops applying.

console.log('\nJUMP ANYWHERE lifts the fuel refusal, and nothing else');
{
  const systems = g1;
  const here = 7;                            // Lave
  /** The furthest system in the galaxy — nothing has the range for it. */
  const far = systems.reduce((worst, s, i) => (
    distanceTenths(systems[here], s) > distanceTenths(systems[here], systems[worst]) ? i : worst
  ), 0);
  const cmdr = (fuel: number) => ({ ...newCommander(), systemIndex: here, fuel });

  check('the far target really is out of range',
    distanceTenths(systems[here], systems[far]) > MAX_FUEL);
  check('a full tank is refused for it', (() => {
    const r = checkJump(cmdr(MAX_FUEL), systems, far, false, false);
    return !r.ok && r.reason === 'noFuel';
  })());
  check('...and test mode takes it', checkJump(cmdr(MAX_FUEL), systems, far, false, false, true).ok);

  // What it must NOT lift. A free jump is still a jump, and both of these are
  // refusals about something other than the tank.
  check('no target is still no target',
    !checkJump(cmdr(MAX_FUEL), systems, null, false, false, true).ok);
  check('...and a countdown already running still refuses',
    !checkJump(cmdr(MAX_FUEL), systems, far, false, true, true).ok);

  // The jump is CHARGED either way; what it may not do is leave a negative
  // tank, which is a number no gauge, shop or chart reads correctly.
  const broke = cmdr(1);
  resolveJump(broke, systems, far, false, () => 1);
  eq('a free jump empties the tank rather than overdrawing it', broke.fuel, 0);
  eq('...and it still arrives', broke.systemIndex, far);
}

console.log('\nthe mark is one way, wherever it is asked for');
{
  const c = newCommander();
  check('marking an unmarked career moves it', markTested(c) === true && c.tested === true);
  check('...and marking it again does not', markTested(c) === false && c.tested === true);
  // The control: the rule is the only writer that matters, so a career that
  // never called it is not marked by anything else here.
  check('...and a career nobody tested is unmarked', newCommander().tested === false);
}

// --- an old save has no such key ---------------------------------------------

console.log('\na save written before the mark reads as an unmarked career');
{
  const { restore } = installStore();
  try {
    // A commander exactly as an older build wrote one: every field it had, and
    // no `tested` key at all. `repairCommander` spreads `newCommander()` under
    // whatever it loaded, which is what makes the default false rather than
    // undefined — asserted through the real read path, not by reasoning.
    const old = { ...newCommander() } as Partial<CommanderData>;
    delete old.tested;
    check('the fixture really is missing the key', !('tested' in old));

    const id = fileId('OLD CAREER');
    // A commander-only record ('file' with no world) is the one shape a save
    // can be in without one — an imported file, which is exactly the route an
    // old career takes back into a new build (save-file.ts).
    writeSave(id, makeRecord('OLD CAREER', 'OLD CAREER', 'file', null,
      old as CommanderData));
    const loaded = commanderOf(readSave(id)!);
    check('it loads', loaded !== null);
    eq('...and reads as never having been tested', loaded?.tested, false);
  } finally {
    restore();
  }
}
