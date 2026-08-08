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
 * How many NAMED saves a player may keep. A snapshot is ~10 kB against megabytes
 * of localStorage, so this is a guard rail against a stuck finger filling the
 * store and failing the AUTOSAVES, not a real capacity limit. Reaching it
 * refuses the write; nothing is ever deleted to make room.
 */
export const MAX_NAMED_SAVES = 20;

/**
 * Longest name a player may type. 16, because that is what the list column
 * holds without wrapping and what keeps an id short; the alphabet is letters,
 * digits and space.
 */
export const MAX_SAVE_NAME = 16;
