// The slots in a mission line, and how they fill.
//
// A skeleton's `line` and `say` strings carry `{TARGET}` and `{PAY}`. A
// dossier's pages carry more. One filler serves both, so a slot spelt one way
// in the skeleton cannot be spelt another way in the renderer.

import type { StarSystem } from '../galaxy/galaxy.ts';
import { formatCredits } from '../game/commander.ts';

/** Replace every `{NAME}` in `template` with `slots[NAME]`. An unknown slot stays. */
export function fillSlots(template: string, slots: Record<string, string>): string {
  return template.replace(/\{([A-Z]+)\}/g, (whole, name: string) => slots[name] ?? whole);
}

/** The slots a leg line or a settlement line can use. */
export function lineSlots(
  systems: readonly StarSystem[], target: number | null, pay = 0,
): Record<string, string> {
  return {
    TARGET: target === null ? 'ANY STATION' : systems[target].name.toUpperCase(),
    PAY: formatCredits(pay),
  };
}
