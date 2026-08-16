// Saves that leave the browser: the JSON file you can keep, mail, or attach to
// a bug report.
//
// Split from `screens/saves.ts`, because it is not a screen. It is a Blob, an
// anchor and a file picker, with no keys, no state and no outcome. What it
// shares with the list is the SavesContext.
//
// An exported file carries its NAME and its world. An import never lands on top
// of an existing save: the name is made unique first, and the player is told
// which name it took.
//
// AN IMPORT EITHER BECOMES A RECORD THIS BUILD CAN READ, OR IS REFUSED OUT
// LOUD. The file's payload is the only thing taken from it, and that is its
// world and its commander. Every field that says what the RECORD is is minted
// here. So `readSave` never faces a version or a shape it will later reject.
//
// THE DOM IS AT THE EDGE. Three pure functions split the job:
//
//   - `exportedSaveFile` says what a file contains;
//   - `adoptSaveFile` says what name and CAREER it takes on this shelf;
//   - `receiveSaveFile` says what the player is told.
//
// None of the three touches a Blob, an anchor, a file picker or `location`. All
// three are synchronous, so all three are testable without a file picker.

import type { CommanderData } from '../commander.ts';
import {
  freshCareerName, listSaves, makeRecord, setBootId, writeSave,
} from '../storage.ts';
import {
  SAVE_RECORD_VERSION, commanderOf, fileId, uniqueSaveName, type SaveRecord,
} from '../save-file.ts';
import type { WorldSnapshot } from '../snapshot.ts';
import type { SavesContext } from './saves.ts';

/**
 * The current career, as the bytes of a file and the name to offer them under.
 *
 * A whole SAVE RECORD, name included, rather than a bare commander. An export
 * that lost the save name comes back untitled. One that lost its world puts you
 * somewhere you never went.
 */
export function exportedSaveFile(ctx: SavesContext): { fileName: string; json: string } {
  const record = makeRecord(ctx.career, ctx.career, 'file', ctx.capture());
  return {
    fileName: `harmless-save-${ctx.career.toLowerCase().replace(/\s+/g, '-')}.json`,
    json: JSON.stringify(record, null, 2),
  };
}

/** Write the current career out as a JSON file. */
export function exportSaveFile(ctx: SavesContext): void {
  const { fileName, json } = exportedSaveFile(ctx);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
  ctx.message(`EXPORTED ${ctx.career}`, 3);
}

/** The lines a refused import says, so each of them has one home. */
const NOT_A_SAVE = 'IMPORT FAILED — NOT A SAVE FILE';
const WRONG_VERSION = 'IMPORT FAILED — SAVE FROM ANOTHER VERSION';
const STORE_FULL = 'IMPORT FAILED — STORAGE FULL. NOTHING WAS CHANGED';

/**
 * What a file CONTAINS: the name it asks for, and the career inside it.
 *
 * Deliberately NOT a `SaveRecord`. A record has a version and a `savedAt`. A
 * parser that returned one would hand its caller two fields that came off a
 * stranger's disk. A file gets to say what is in it. What the record IS is
 * minted here (see `adoptSaveFile`).
 */
interface SaveFileContents {
  /** the name it asks for — the shelf decides whether it gets one */
  name: string;
  world: WorldSnapshot | null;
  commander: CommanderData | null;
}

/**
 * A file that might be a save — its contents, or the line that refuses it.
 *
 * THE VERSION IS CHECKED HERE, where the bytes are still a file rather than a
 * record. `readSave` refuses anything whose `v` is not this build's. So a file
 * this build cannot READ is a file it must not WRITE. A write puts bytes on the
 * shelf under a boot pointer aimed at nothing. `listSaves` cannot see them, the
 * file list cannot show them, and no delete can reach them.
 *
 * A RECORD IS THE ONLY SHAPE. A bare `CommanderData` is not a save FILE, so it
 * gets `NOT_A_SAVE` rather than `WRONG_VERSION`. The second would be a lie about
 * bytes that carry no `v` to be wrong.
 */
function readSaveFile(parsed: unknown): SaveFileContents | { why: string } {
  const rec = parsed as Partial<SaveRecord>;
  if (!rec || typeof rec !== 'object') return { why: NOT_A_SAVE };
  // The record shape: a save name, and a commander somewhere inside it.
  if (typeof rec.name === 'string' && (rec.world || rec.commander)) {
    if (rec.v !== SAVE_RECORD_VERSION) return { why: WRONG_VERSION };
    const whole = rec as SaveRecord;
    const commander = commanderOf(whole);
    // A world is kept only when it carries the commander. That is what the
    // record shape means by a world (save-file.ts), and `makeRecord` holds the
    // two to it. Anything else is a commander and no world.
    if (commander) {
      return { name: whole.name, world: whole.world?.commander ? whole.world : null, commander };
    }
  }
  return { why: NOT_A_SAVE };
}

/**
 * What became of a file.
 *
 * A refusal carries THE LINE THE PLAYER IS TOLD. Three refusals differ: "that
 * is not a save", "that save is from another build", and "there is no room on
 * the disk". Which one it is is the only part anybody can act on, and a single
 * IMPORT FAILED tells them none of it.
 */
export type AdoptedFile =
  | { ok: true; id: string; name: string }
  | { ok: false; why: string };

/**
 * Put a file on this shelf, under a name and a career that are ours to give.
 *
 * TWO things are made unique, against two different sets, and both matter:
 *
 *   - the NAME, against the names already on the shelf, so the file cannot land
 *     on top of a save you meant to keep. `save:file:<NAME>`.
 *   - the CAREER, against the careers already on the shelf, so the file cannot
 *     land on top of an autosave GROUP. Everybody's commander is called JAMESON
 *     by default, so without this a friend's export shares your keys. The
 *     imported career is also what `bootCareer()` reads into the next boot, so
 *     it is the career the session then autosaves into. The career the file
 *     claims is discarded whatever it says: to name a career is the same act as
 *     to write to it.
 *
 * AND THE RECORD IS MINTED, NOT SPREAD. `makeRecord` is the one place a record
 * is built. So `v` is this build's by construction, and `savedAt` is when the
 * import happened. That matters twice: the flight ring evicts by `savedAt`, and
 * `bootSave()`'s fallback resumes the newest record on the shelf. Only the world
 * and the commander come from the file, because only they are its to give.
 *
 * @returns the id it took and the name to tell the player, or a refusal and the
 * line that says why. Nothing is ever overwritten — a false from `writeSave` is
 * a full store, and a full store leaves every save byte-identical.
 */
export function adoptSaveFile(text: string): AdoptedFile {
  let file: SaveFileContents | { why: string };
  try {
    file = readSaveFile(JSON.parse(text));
  } catch {
    return { ok: false, why: NOT_A_SAVE };
  }
  if ('why' in file) return { ok: false, why: file.why };
  const shelf = listSaves();
  const name = uniqueSaveName(file.name, shelf.map((s) => s.record.name));
  const record = makeRecord(name, freshCareerName(name), 'file', file.world, file.commander);
  const id = fileId(name);
  if (!writeSave(id, record)) return { ok: false, why: STORE_FULL };
  return { ok: true, id, name };
}

/**
 * A file arrives. Put it on the shelf, then boot into it.
 *
 * It NEVER lands on top of an existing save (see `adoptSaveFile`). The boot
 * pointer then moves to it, and the page reloads. Every load in this file works
 * that way. A career leaves state across the living galaxy, the contracts, the
 * chart target and the mission progress. A clean boot is more trustworthy than
 * a zero of all of it.
 *
 * THE POINTER IS MOVED HERE, beside the reload it authorises. A refused pointer
 * is honoured the way `saves.ts` and `new-commander.ts` honour theirs. A reload
 * on a pointer that never landed resumes whatever `bootSave()` falls back to,
 * which is the career the player was already flying. So it says so, rather than
 * claim the import.
 *
 * The record stays on the shelf and loads from the file list. A delete would be
 * a destructive write on the strength of a write that failed.
 *
 * Takes the TEXT rather than the file, so everything a player can observe about
 * an import is reachable without a file picker. `importSaveFile` below is then
 * only the picker.
 */
export function receiveSaveFile(
  ctx: SavesContext, text: string, onFailure: (why: string) => void,
): void {
  const taken = adoptSaveFile(text);
  if (!taken.ok) { onFailure(taken.why); return; }
  if (!setBootId(taken.id)) {
    onFailure(`IMPORTED AS ${taken.name} — BUT COULD NOT SWITCH TO IT`);
    return;
  }
  ctx.message(`IMPORTED AS ${taken.name}`, 4);
  location.reload(); // boot cleanly from the imported save
}

/** Ask for a file, and hand what comes back to `receiveSaveFile`. */
export function importSaveFile(ctx: SavesContext, onFailure: (why: string) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    void file.text().then(
      (text) => receiveSaveFile(ctx, text, onFailure),
      () => onFailure(NOT_A_SAVE),   // unreadable bytes are not a save either
    );
  };
  input.click();
}
