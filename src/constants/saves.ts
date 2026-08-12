// The shelf: how often the game saves on its own, how much it keeps, and how long
// a name may be.
//
// What a save IS — the record shape, the id grammar, the name rules — is
// `game/save-file.ts`. WHERE one lives is `game/storage.ts`, the only file that
// may touch localStorage. The format versions and the id prefix stay beside the
// shapes they version. The storage namespaces stay module-private in storage.ts,
// so nothing importable can compute a player's key.

/** Seconds between mid-flight world saves — see Game.autoSave(). */
export const AUTOSAVE_INTERVAL = 20;

/**
 * How many in-flight autosaves are kept, PER CAREER. Three, at the
 * `AUTOSAVE_INTERVAL` cadence, is the last minute of flight
 * (`test/saves.test.ts` pins the product at 60 seconds). That is far enough back
 * to step out of the fight you just lost, and no further. It is per career, never
 * global: a global ring silently belongs to whoever flew last.
 *
 * A SMALLER RING ORPHANS KEYS. The slots are storage keys
 * (`save:auto:<CAREER>:fly:<n>`). A smaller ring therefore leaves the higher
 * slots on the shelf, where `flightIds` can no longer address them.
 */
export const FLIGHT_RING = 3;

/**
 * How many NAMED saves a player may keep. At the limit the write is refused.
 * Nothing is ever deleted to make room.
 *
 * THE ARITHMETIC MOVED (docs/TODO/117). This used to argue from "a snapshot is
 * about 10 kB against megabytes of localStorage". A snapshot now measures about
 * **145 kB**. A galaxy warmed up before the first launch
 * (constants/living-galaxy.ts) carries about 72 kB of price pressure and convoys
 * from the first minute of a career, and a record holds that twice: once as the
 * world's live `galaxyState`, and once inside the commander it clones. Both
 * figures are measured on a fresh docked career, galaxy 1.
 *
 * So 20 named saves is about 2.9 MB, plus about 0.6 MB for each career's own
 * checkpoint and `FLIGHT_RING`, against a typical 5 MB origin budget. 20 STAYS.
 * It is still the number that a player can reach only deliberately, and a lower
 * cap would take slots away to pay for a cost the shelf did not choose. But it is
 * no longer only a guard rail against a stuck finger. Several careers with a full
 * shelf is now within sight of the budget. A full store fails the write and keeps
 * what was there (`writeItem`), rather than corrupt it.
 *
 * If it ever binds, the first lever to pull is that DUPLICATED galaxy state. It
 * is not this cap, and it is not a round-off of the pressures.
 * `LivingGalaxy.save()` explains why a quantisation of them lands a reload on a
 * nearby galaxy instead of the same one.
 */
export const MAX_NAMED_SAVES = 20;

/**
 * The longest name a player may type. 16, because that is what the list column
 * holds without a wrap, and what keeps an id short. The alphabet is the letters,
 * the digits and the space.
 */
export const MAX_SAVE_NAME = 16;
