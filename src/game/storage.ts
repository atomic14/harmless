// Where a save is kept. It is the only file that may touch localStorage for a
// SAVE. `engine/keymap.ts` is the one carve-out. It holds the single
// `elite-web-keymap` key, which is a display preference and not a career
// (docs/INVARIANTS.md invariant 3).
//
// THE KEY SPACE:
//
//     <ns>save:file:<NAME>            a save the player named
//     <ns>save:auto:<CAREER>:dock     the docked checkpoint
//     <ns>save:auto:<CAREER>:fly:<n>  the in-flight ring
//     <ns>boot                        which of them the next boot resumes —
//                                     or `new:<NAME>`, meaning none of them and
//                                     here is who to start instead
//
// `<CAREER>` is WHICH COMMANDER A SAVE BELONGS TO. It is the name they were
// created under (docs/INVARIANTS.md invariant 3's word). `SaveRecord.career` in
// save-file.ts argues the choice of word.
//
// An autosave cannot overwrite a named save, because it cannot ADDRESS one. The
// two live under different id shapes, built here from a name the player typed
// through `save-file.ts`'s alphabet. That is a property of the key space, and
// not a rule to remember.
//
// `<ns>` is the namespace. It is `elite-web-` for a player, and
// `elite-web-harness-` once a caller calls `useHarnessSaves()`. That switch
// goes ONE WAY, for the life of the page.
//
// A switched page cannot switch back. It cannot compute a player's key, because
// every key is built from `ns` right here. It cannot leave a running tab that
// autosaves into a career. Reload to play again. `withoutSaving()` refuses
// writes for a span rather than redirects them.
//
// A store left over under any other key shape boots as a fresh commander. That
// is structural rather than a check. `listSaves()` scans for `<ns>save:` and
// hands every id to `parseSaveId`, so a key of any other shape is not a save
// and cannot become one. Whatever sits under old keys stays there, unread.

import { COMMODITIES } from '../galaxy/galaxy.ts';
import {
  newCommander, defaultEquipment,
  type CommanderData,
} from './commander.ts';
import { DEFAULT_NAME } from '../constants/commander.ts';
import { requirePlayerHullId } from './ship-identity.ts';
import type { WorldSnapshot } from './snapshot.ts';
import {
  SAVE_ID_PREFIX, SAVE_RECORD_VERSION,
  dockId, fileId, flightIds, parseSaveId, uniqueSaveName,
  commanderOf, normaliseSaveName,
  type SaveRecord,
} from './save-file.ts';

// --- the namespace ----------------------------------------------------------

const PLAYER_NS = 'elite-web-';
const HARNESS_NS = 'elite-web-harness-';

let ns = PLAYER_NS;

/**
 * Send every save this page writes or reads to the harness namespace, for good.
 *
 * Deliberately NO way back. A one-way switch cannot be forgotten, and a missing
 * `finally` cannot unwind it. It covers the running game as well as the
 * harness. The moment it is called, nothing on this page can write a player's
 * save. Reload the page to play your career again.
 */
export function useHarnessSaves(): void {
  ns = HARNESS_NS;
}

/** Which namespace is live. For a harness to print, and for tests to assert. */
export function saveNamespace(): string {
  return ns;
}

/** True once this page can no longer reach a player's saves. */
export function harnessSaves(): boolean {
  return ns === HARNESS_NS;
}

// --- writes, and the one thing allowed to refuse them ------------------------
//
// Every write and every removal goes through `writeItem` and `dropItem`. So
// `withoutSaving()` can make a span of code INCAPABLE of touching a save,
// rather than merely observed not to.
//
// It exists for the combat simulator (docs/COMBAT-SIM.md). A restore of the
// entry snapshot ends at `Station.dock`, which writes a checkpoint. If
// `restore()` were subtly wrong, that write would persist the corruption over a
// good save. Fail safe first, verify second.

let suspended = 0;
/** Keys a suspended write or removal was about to touch. */
const refused: string[] = [];

/**
 * The store, or null when there is not one.
 *
 * Under node there is no `localStorage`. It degrades to null rather than
 * throws, which is the same bargain `world/corona-texture.ts` makes with
 * `document`. The file that knows about the platform is the file that copes
 * with its absence.
 */
function store(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

/** @returns whether the bytes actually went anywhere. */
function writeItem(key: string, value: string): boolean {
  if (suspended > 0) { refused.push(key); return false; }
  const s = store();
  if (!s) return false;
  try {
    s.setItem(key, value);
    return true;
  } catch {
    // quota or private browsing. setItem either lands or throws, so the
    // previous value of this key is still exactly where it was.
    return false;
  }
}

function dropItem(key: string): void {
  if (suspended > 0) { refused.push(key); return; }
  try { store()?.removeItem(key); } catch { /* storage unavailable */ }
}

/** A read. Null with no store, which every caller already handles. */
function readItem(key: string): string | null {
  try { return store()?.getItem(key) ?? null; } catch { return null; }
}

/**
 * Run `fn` with every save write and removal refused.
 *
 * @returns what `fn` returned, and the keys it tried to touch. A caller that
 * suppressed a write it EXPECTED can then assert the suppression was
 * load-bearing rather than vacuous. Re-entrant, and `finally`-safe.
 */
export function withoutSaving<T>(fn: () => T): { value: T; refused: string[] } {
  const mark = refused.length;
  suspended += 1;
  try {
    return { value: fn(), refused: refused.slice(mark) };
  } finally {
    suspended -= 1;
    refused.length = mark;
  }
}

// --- records ----------------------------------------------------------------

const BOOT_KEY = (): string => `${ns}boot`;

/** Read one save. Null when it is absent, corrupt, or not a save at all. */
export function readSave(id: string): SaveRecord | null {
  const raw = readItem(ns + id);
  if (!raw) return null;
  try {
    const rec = JSON.parse(raw) as SaveRecord;
    if (!rec || typeof rec !== 'object' || rec.v !== SAVE_RECORD_VERSION) return null;
    // Every commander off the shelf goes through the same repairs — see
    // `repairCommander`. It REFUSES a commander on a hull it cannot resolve.
    // The refusal arrives here as a throw, and the catch below turns that into
    // the same null a bad `v` gets.
    if (rec.world?.commander) rec.world.commander = repairCommander(rec.world.commander);
    if (rec.commander) rec.commander = repairCommander(rec.commander);
    return rec;
  } catch {
    return null;
  }
}

/**
 * Write one save, as ONE key and one `setItem`.
 *
 * @returns false when nothing was written — no store, writes refused, or the
 * store is full. A false is never partial: the record that was there before is
 * still there, byte for byte.
 */
export function writeSave(id: string, rec: SaveRecord): boolean {
  try {
    return writeItem(ns + id, JSON.stringify(rec));
  } catch {
    return false;   // a world that will not serialise must not take the tab down
  }
}

export function deleteSave(id: string): void {
  dropItem(ns + id);
}

/** Every save on the shelf, whatever career it belongs to. */
export function listSaves(): { id: string; record: SaveRecord }[] {
  const s = store();
  if (!s) return [];
  const out: { id: string; record: SaveRecord }[] = [];
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i);
    if (!key || !key.startsWith(ns + SAVE_ID_PREFIX)) continue;
    const id = key.slice(ns.length);
    if (!parseSaveId(id)) continue;
    const record = readSave(id);
    if (record) out.push({ id, record });
  }
  return out;
}

/**
 * The last stamp handed out, so two saves in the same millisecond still order.
 *
 * Module-level and mutable, held to `rng.ts`'s bar: nothing branches on it, it
 * is not a rule, and losing it costs at most one tie. Without it the ring's
 * "overwrite the oldest" cannot tell equal timestamps apart.
 */
let lastStamp = 0;

/**
 * Build a record. Here rather than at the call sites so `savedAt` has one
 * source and the version cannot be forgotten.
 */
export function makeRecord(
  name: string, career: string, kind: SaveRecord['kind'],
  world: WorldSnapshot | null, commander: CommanderData | null = null,
): SaveRecord {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return {
    v: SAVE_RECORD_VERSION,
    name, career, kind,
    savedAt: lastStamp,
    world,
    commander: world ? null : commander,
  };
}

// --- what the game asks for -------------------------------------------------

/** Store the docked checkpoint for `career` — on docking, and before launch. */
export function writeDockSave(career: string, world: WorldSnapshot): boolean {
  const ok = writeSave(dockId(career), makeRecord(career, career, 'dock', world));
  if (ok) setBootId(dockId(career));
  return ok;
}

/**
 * Store the next in-flight autosave for `career`.
 *
 * Round-robin over the OLDEST slot. It is derived from what is on the shelf
 * rather than from a counter. So a reload cannot restart the ring, and cannot
 * bury the entry it was meant to keep.
 */
export function writeFlightSave(career: string, world: WorldSnapshot): boolean {
  const ids = flightIds(career);
  let target = ids[0];
  let oldest = Infinity;
  for (const id of ids) {
    const rec = readSave(id);
    if (!rec) { target = id; oldest = -Infinity; break; }
    if (rec.savedAt < oldest) { oldest = rec.savedAt; target = id; }
  }
  const ok = writeSave(target, makeRecord(career, career, 'fly', world));
  if (ok) setBootId(target);
  return ok;
}

/**
 * Store a save the player named.
 *
 * @returns 'ok', 'full' when the cap is reached, or 'failed' when the store
 * refused the bytes. Nothing is deleted in any of the three cases.
 */
export function writeNamedSave(
  name: string, career: string, world: WorldSnapshot, cap: number,
): 'ok' | 'full' | 'failed' {
  const id = fileId(name);
  const replacing = readSave(id) !== null;
  if (!replacing && namedSaves().length >= cap) return 'full';
  return writeSave(id, makeRecord(normaliseSaveName(name), career, 'file', world))
    ? 'ok' : 'failed';
}

/** The named saves, for the cap, for the list, and for name collisions. */
export function namedSaves(): { id: string; record: SaveRecord }[] {
  return listSaves().filter((s) => s.record.kind === 'file');
}

/** Is there already a save under this name? */
export function namedSaveExists(name: string): boolean {
  return readSave(fileId(name)) !== null;
}

/**
 * Forget a career's in-flight ring.
 *
 * Two callers, and both are deliberate. A dock is one, because the checkpoint
 * you just wrote supersedes the flight you just finished. A death is the other,
 * because the last twenty seconds of a lost fight would make death optional on
 * a reload. Neither can reach the docked checkpoint or a named save.
 */
export function clearFlightSaves(career: string): void {
  for (const id of flightIds(career)) deleteSave(id);
  // The boot pointer may point at one of them. Aim it at the checkpoint
  // instead. A dangling pointer leaves the fallback scan to guess, and after a
  // death that pointer IS the way back.
  if (readSave(dockId(career))) setBootId(dockId(career));
}

// --- which save the next boot resumes ---------------------------------------

/**
 * The pointer's other value: START A NEW COMMANDER, and who they are.
 *
 * `bootSave()` falls back to the newest record on the shelf when the pointer is
 * MISSING, so a lost pointer resumes the run you were playing. "None of them"
 * is a distinct thing the pointer can say. So a commander set aside cannot
 * resume the very run it meant to put down.
 *
 * IT CARRIES THE NAME, because there is nowhere else to put it. A new commander
 * is chosen on one side of a `location.reload()`, and created on the other. The
 * store is the only thing that survives that.
 *
 * This is the name's home for exactly one boot. `bootCommander()` reads it, the
 * first checkpoint writes it into a record, and `SaveRecord.career` is the home
 * from then on.
 *
 * A pointer is told from a save id STRUCTURALLY rather than by a comparison.
 * Every save id starts `save:` (`SAVE_ID_PREFIX`), so a pointer that does not
 * is a new commander, whatever else it says. The name needs no encoding
 * because
 * `normaliseSaveName` leaves only `A-Z 0-9 space`, so it cannot contain the
 * colon it is written after.
 */
const NEW_COMMANDER = 'new';

/**
 * The name the next boot's fresh commander was given, or null when no new
 * commander is pending. `''` when one is pending with no name, which is a bare
 * `new` pointer and means "a fresh commander, called whatever the default is".
 */
function pendingCommanderName(): string | null {
  const id = readItem(BOOT_KEY());
  if (id === null || id.startsWith(SAVE_ID_PREFIX)) return null;
  const colon = id.indexOf(':');
  return colon < 0 ? '' : normaliseSaveName(id.slice(colon + 1));
}

/** @returns whether the pointer actually moved. */
export function setBootId(id: string): boolean {
  return writeItem(BOOT_KEY(), id);
}

function clearBootId(): void {
  dropItem(BOOT_KEY());
}

/**
 * Put every save on the shelf DOWN: the next boot starts `name`.
 *
 * Nothing is written and nothing is removed. A commander is set aside by an
 * aim of the pointer away from them, which is why this cannot cost anybody a
 * save. The name goes with it, because the boot on the other side of the reload
 * has no other way to learn it.
 *
 * @returns false when the store would not take the pointer.
 */
export function bootNewCommander(name: string): boolean {
  return writeItem(BOOT_KEY(), `${NEW_COMMANDER}:${normaliseSaveName(name)}`);
}

/**
 * The save this session continues.
 *
 * It is the pointer, where the pointer names something that is still there. It
 * is nothing at all where the pointer names no save, which is what a request
 * for a new commander leaves it saying.
 *
 * Otherwise it is the newest record on the shelf, which is the best guess left
 * after a pointer is LOST. It is null where the shelf is empty, which is a new
 * commander too.
 */
export function bootSave(): { id: string; record: SaveRecord } | null {
  const id = readItem(BOOT_KEY());
  if (id !== null && !id.startsWith(SAVE_ID_PREFIX)) return null;
  if (id) {
    const record = readSave(id);
    if (record) return { id, record };
  }
  const all = listSaves();
  if (!all.length) return null;
  return all.reduce((a, b) => (b.record.savedAt > a.record.savedAt ? b : a));
}

/**
 * The commander this session starts as — the boot save's, or a fresh one.
 *
 * The Game needs a commander before it has anything to capture a world from,
 * which is why this exists beside `bootSave()` rather than inside it.
 *
 * A fresh one is called whatever the player typed at the prompt. A FIRST-EVER
 * boot has no pointer, and so has nobody to ask. That one is Commander
 * Jameson, as it was in 1984.
 */
export function bootCommander(): CommanderData {
  const boot = bootSave();
  if (boot) return commanderOf(boot.record) ?? newCommander();
  const c = newCommander();
  const chosen = pendingCommanderName();
  if (chosen) c.name = chosen;
  return c;
}

/**
 * Which commander's autosaves this session writes. THE ONE HOME FOR THE ANSWER.
 *
 * It is the boot save's. For a commander with no save yet it is their own name,
 * which the prompt that created them already refused to hand out twice
 * (`commanderNameTaken`).
 *
 * `freshCareerName` is the belt to that braces. It can never adopt an existing
 * commander's autosave group, and evict their docked checkpoint, whatever the
 * name arrived as.
 *
 * The RECORD decides, and not the snapshot. The record is what the
 * `save:auto:<CAREER>:*` keys are built from, and `state.career` is a read of
 * it rather than a second copy.
 */
export function bootCareer(commander: CommanderData): string {
  const boot = bootSave();
  if (boot) return boot.record.career || boot.record.name;
  return freshCareerName(commander.name);
}

/**
 * `base`, or the first free name after it, so no two commanders share a key.
 *
 * For the case with no player at the keyboard: an IMPORTED file
 * (`adoptSaveFile`). Its commander is somebody else's JAMESON, and must land
 * beside yours rather than on it. The same file imported twice counts up rather
 * than invents a name, which is what `uniqueSaveName` is for.
 */
export function freshCareerName(base: string): string {
  return uniqueSaveName(base || DEFAULT_NAME, listSaves().map((s) => s.record.career));
}

/**
 * Is a commander of this name already on the shelf?
 *
 * What the new-commander prompt asks before it takes a name.
 *
 * An identity is a STORAGE KEY: `save:auto:<CAREER>:dock` and the flight ring.
 * So two commanders of one name would share an autosave group, and the second
 * one's first dock would evict the first one's way back.
 *
 * It is asked against every record's `career` rather than its `name`, because
 * that is the field the keys are built from. A named save called LAVE RUN
 * belongs to a commander, and is not one.
 */
export function commanderNameTaken(name: string): boolean {
  const wanted = normaliseSaveName(name);
  return listSaves().some((s) => normaliseSaveName(s.record.career) === wanted);
}

// --- what comes off the shelf, repaired --------------------------------------

/**
 * Every commander that comes off the shelf, repaired the same way.
 *
 * IT IS NOT A SAVE MIGRATION. Nothing this build writes needs a repair, because
 * `capture()` clones a whole `CommanderData`.
 *
 * What arrives incomplete is an IMPORTED FILE. `adoptSaveFile` takes the
 * commander straight out of a stranger's JSON, and writes it to the shelf
 * unexamined. So the next `readSave` is the first look anything gives it.
 *
 * A hand-edited file reaches this function with a ten-entry `cargo`, an
 * `equipment` of `{}`, or a `day` of `"soon"`. Everything below is what stops
 * it reaching the trade screen. It repairs a RECORD's contents, and has nothing
 * to do with the key it was found under.
 *
 * The top-level spread supplies an ABSENT field, so each guard below is only
 * reached by a field that is present and the wrong type. The `combatScore` line
 * is not a migration — the spread already answers an absent score; it repairs a
 * spoiled score from the body count beside it.
 *
 * THE HULL IS NOT REPAIRED, IT IS REQUIRED. A missing or unresolvable `shipId`
 * throws. The throw lands where every other refusal in this file lands, inside
 * `readSave`'s `try`. The record then reads as nothing at all, exactly as a bad
 * `v` or an unparseable key does. A shelf of only such records boots a fresh
 * commander, and never puts an error in front of a player.
 */
function repairCommander(stored: Partial<CommanderData>): CommanderData {
  const parsed = { ...newCommander(), ...stored };
  parsed.equipment = { ...defaultEquipment(), ...(stored.equipment ?? {}) };
  parsed.mission = { stage: 0, targetIndex: null, ...(stored.mission ?? {}) };
  if (!Array.isArray(parsed.contracts)) parsed.contracts = [];
  if (typeof parsed.day !== 'number') parsed.day = 0;
  // 0 is "never briefed". So a hand-edited or pre-marker record earns the one
  // automatic briefing a fresh commander gets. That is the safe default of
  // docs/TODO/106, rather than a lost preference.
  if (typeof parsed.briefingSeen !== 'number') parsed.briefingSeen = 0;
  if (typeof parsed.trumbles !== 'number') parsed.trumbles = 0;
  if (typeof parsed.survivors !== 'number') parsed.survivors = 0;
  if (typeof parsed.furthestWave !== 'number') parsed.furthestWave = 0;
  // The LENGTH matters as much as the type. Every screen that touches the hold
  // indexes it by commodity, so a short array is a hold with no shelves.
  if (!Array.isArray(parsed.cargo) || parsed.cargo.length !== COMMODITIES.length) {
    parsed.cargo = COMMODITIES.map(() => 0);
  }
  // ...and the score falls back to the body count beside it — see above.
  if (typeof parsed.combatScore !== 'number') parsed.combatScore = parsed.kills ?? 0;
  // `stored`, not `parsed`. The spread above already filled in a fresh
  // commander's Cobra. A read of `parsed` would accept a record that never
  // said which hull it flew.
  parsed.shipId = requirePlayerHullId(stored.shipId);
  if (typeof parsed.name !== 'string' || !parsed.name) parsed.name = DEFAULT_NAME;
  return parsed;
}

// --- what the console and the harnesses need ---------------------------------

/** Wipe the harness namespace. Refuses point-blank outside it. */
export function clearHarnessSaves(): void {
  if (!harnessSaves()) return;
  for (const { id } of listSaves()) deleteSave(id);
  clearBootId();
}
