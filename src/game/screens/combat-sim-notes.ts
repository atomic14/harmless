// What the setup panel says under its rows, and the tallest it can ever say it.
//
// The prose half of the combat trainer's setup panel, split from
// combat-sim-setup.ts (which owns the draft and the cells that mutate it). This
// one only ever READS a draft to describe it. Pure: no DOM, no Input, no Game.
//
// The second half of the file is the unusual part. Every note here is
// conditional, so one appearing mid-interaction pushes every row below it down a
// line — enough that the row under the cursor stops being the row the cursor is
// on. So each block also states the tallest it could EVER be, for any draft, and
// the renderer paints that invisibly underneath to hold the height open. That is
// why the reserves take no argument: an upper bound that moved with the draft
// would not be one.

import {
  SCENARIOS, WAVE_SATURATION, WAVE_STEPS, waveOfStage, type SimMode,
} from '../combat-sim-scenarios.ts';
import { brainCharacter } from '../brain-names.ts';
import { PIRATE_CHOICES, type SimDraft } from './combat-sim-setup.ts';

const MODE_BLURB: Record<SimMode, string> = {
  scenario: 'ONE NAMED FIGHT, SCORED, ENDS BY ITSELF',
  sparring: 'ONE OPPONENT, RESPAWNING, PATCHED UP BETWEEN ROUNDS',
  waves: 'ESCALATING WAVES UNTIL YOU DIE — HOW MANY CAN YOU TAKE?',
};

/**
 * What the waves mode escalates, and where it stops — DERIVED from the ramp.
 *
 * Typed out, this would be a second home for the step table, wrong the day
 * somebody moves the cadence. The pilot needs to know the ramp has a top, and
 * that it is not just more ships.
 */
const wavesRamp = (): string =>
  `PAST WAVE ${waveOfStage(1) - 1} THE NUMBERS STOP AND THE FIGHT CHANGES: `
  + `${WAVE_STEPS.map((s, i) => `${s.name} AT ${waveOfStage(i + 1)}`).join(', ')} `
  + `— AND NO HARDER FROM ${WAVE_SATURATION} ON.`;

/** `YOUR FURTHEST: WAVE 13.` — the one thing a run leaves behind. */
const bestWave = (n: number): string =>
  (n > 0 ? ` YOUR FURTHEST: WAVE ${n}.` : ' YOU HAVE NOT FLOWN ONE YET.');

/**
 * The longest of a set of strings.
 *
 * A proxy for "the tallest", honest here: the panel is set in a monospace face
 * at a fixed size, so more characters is more lines.
 */
const longest = (xs: readonly string[]): string =>
  xs.reduce((a, b) => (b.length > a.length ? b : a), '');

// --- the contextual help ----------------------------------------------------

/** What the panel says under the rows: the mode, the fight, and any warning. */
export function draftNotes(d: SimDraft): string[] {
  const out: string[] = [MODE_BLURB[d.mode] + (d.mode === 'waves' ? bestWave(d.furthestWave) : '')];
  // The waves mode sends the RAMP, and only the ramp: `nextOpposition` builds
  // every one of its rounds from the wave number.
  if (d.mode === 'waves') { out.push(wavesRamp()); return out; }
  out.push(SCENARIOS[d.scenario].blurb.toUpperCase());
  return out;
}

/**
 * The tallest `draftNotes` can ever be, slot for slot.
 *
 * TWO slots, not three: the fight's blurb is only shown when the opposition
 * comes from the scenario table, so the second and third notes can never both be
 * there. One slot holds whichever is longer.
 *
 * Each slot holds the longest thing it can ever hold, for ANY draft — wrapping
 * included, because the panel is set in a monospace face at a fixed size.
 */
export function draftNotesReserve(): string[] {
  return [
    // The waves blurb carries the best wave, so the bound has to include every
    // tail it can grow — the never-flown line, and a three-digit wave nobody
    // will ever reach.
    longest(Object.values(MODE_BLURB).flatMap((b) => [b + bestWave(999), b + bestWave(0)])),
    longest([...SCENARIOS.map((s) => s.blurb.toUpperCase()), wavesRamp()]),
  ];
}

// --- what the brain on the selected row does --------------------------------
//
// Its own block rather than a fourth line of the help above: the help's slots
// are per-draft, but this line comes and goes with the CURSOR, so it would land
// in a different slot depending on the fight and a per-slot upper bound would
// stop meaning anything. Its own block is its own bound.

/**
 * What the brain named on the selected row DOES — or null when the row names
 * none, which is most of them. The only brain row is PIRATES FLY;
 * `game/brain-names.ts` owns the sentence.
 */
export function brainNote(id: string | null | undefined): string | null {
  if (!id) return null;
  const character = brainCharacter(id);
  if (!character) return null;
  // The stem last, for whoever is cross-referencing docs/TRAINING-LOG.md.
  return `${character} (${id.toUpperCase()})`;
}

/**
 * The tallest `brainNote` can ever be — measure the SENTENCE, never the longest
 * ingredient, or the panel jumps a line when a long-charactered brain is
 * selected.
 */
export function brainNoteReserve(): string {
  return longest(PIRATE_CHOICES.map((id) => brainNote(id) ?? ''));
}

