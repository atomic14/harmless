// The shelf: how often the game saves on its own, how much it keeps, and how
// long a name may be.
//
// What a save IS — record shape, id grammar, name rules — is `game/save-file.ts`,
// and WHERE one lives is `game/storage.ts`, the only file that may touch
// localStorage. Format versions and the id prefix stay beside the shapes they
// version, and the storage namespaces stay module-private in storage.ts so
// nothing importable can compute a player's key.

/** Seconds between mid-flight world saves — see Game.autoSave(). */
export const AUTOSAVE_INTERVAL = 20;

/**
 * How many in-flight autosaves are kept, PER CAREER. Three at the
 * `AUTOSAVE_INTERVAL` cadence is the last minute of flying
 * (`test/saves.test.ts` pins the product at 60 seconds): far enough back to step
 * out of the fight you just lost, no further. Per career, never global: a global
 * ring silently belongs to whoever flew last.
 *
 * SHRINKING IT ORPHANS KEYS. The slots are storage keys
 * (`save:auto:<CAREER>:fly:<n>`), so a smaller ring leaves the higher slots on
 * the shelf where `flightIds` can no longer address them.
 */
export const FLIGHT_RING = 3;

/**
 * How many NAMED saves a player may keep. Reaching it refuses the write;
 * nothing is ever deleted to make room.
 *
 * THE ARITHMETIC MOVED (docs/TODO/117). This used to argue from "a snapshot is
 * ~10 kB against megabytes of localStorage". A snapshot now measures **~145 kB**
 * — a galaxy warmed up before the first launch (constants/living-galaxy.ts)
 * carries ~72 kB of price pressure and convoys from the first minute of a
 * career, and a record holds that twice: once as the world's live
 * `galaxyState` and once inside the commander it clones (measured on a fresh
 * docked career, galaxy 1).
 *
 * So 20 named saves is ~2.9 MB, plus ~0.6 MB for each career's own checkpoint
 * and `FLIGHT_RING`, against a typical 5 MB origin budget. 20 STAYS: it is
 * still the number a player can reach only deliberately, and lowering it would
 * take away slots to pay for a cost the shelf did not choose. But it is no
 * longer only a guard rail against a stuck finger — several careers with a full
 * shelf is now within sight of the budget, and a full store fails the write and
 * keeps what was there (`writeItem`) rather than corrupting it.
 *
 * The lever to pull first, if it ever binds, is that DUPLICATED galaxy state,
 * not this cap and not rounding the pressures — `LivingGalaxy.save()` explains
 * why quantising them lands a reload on a nearby galaxy instead of the same one.
 */
export const MAX_NAMED_SAVES = 20;

/**
 * Longest name a player may type. 16, because that is what the list column
 * holds without wrapping and what keeps an id short; the alphabet is letters,
 * digits and space.
 */
export const MAX_SAVE_NAME = 16;
