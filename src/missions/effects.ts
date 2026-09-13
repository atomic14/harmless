// The consequences the machine returns, and the game applies.
//
// `MissionEffect` came out of `model.ts` for the size gate (docs/TODO/219
// M5). `model.ts` re-exports the type, so every reader keeps its import.
// The bridge (`game/mission-bridge.ts`) applies each kind, and the machine
// (`machine.ts`) and the settlement (`settlement.ts`) emit them.

import type { Deed, DossierWord, TaggedShip, WorldChange } from './model.ts';

/**
 * A consequence the game applies. The machine never touches the commander.
 * A `say` or a `later` with an empty `text` and a `word` is a line only a
 * dossier can supply. The bridge drops it when none does.
 */
export type MissionEffect =
  | { kind: 'say'; text: string; command?: 'openMissions'; word?: DossierWord }
  | { kind: 'later'; text: string; word?: DossierWord }
  | { kind: 'pay'; tenths: number }
  | { kind: 'deed'; deed: Deed }
  | { kind: 'legal'; delta: number }
  | { kind: 'lead'; skeleton: string; galaxy: number; world: number }
  | { kind: 'worldOverride'; world: number; until: number; change: WorldChange }
  | { kind: 'standingSpawn'; world: number; until: number; ships: TaggedShip[] }
  /** the patron's goods go aboard: a smuggle leg starts with them */
  | { kind: 'cargo'; commodity: number; tonnes: number }
  /** the patron's goods leave the hold: a smuggle leg ends with them delivered */
  | { kind: 'unload'; commodity: number; tonnes: number }
  /** ships that jump in around the commander now: an ambush a leg sprang */
  | { kind: 'spawn'; ships: TaggedShip[] }
  /** passengers a finished mission leaves in the crew spaces, as survivors */
  | { kind: 'survivors'; people: number }
  /** a fit the settlement grants, and the game puts on the ship (docs/TODO/219 M4) */
  | { kind: 'grant'; fit: 'cloak' };
