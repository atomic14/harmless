// The commander's log: the journal, told as a story.
//
// The JOURNAL is the record of what happened: one entry per acceptance, per
// branch taken, and per ending. This file turns it into pages, one per run
// of a mission. A dossier's words are used where a dossier exists, and the
// skeleton's plain words where none does (docs/TODO/190 M5). The path she
// took is the story. A branch she did not take is never mentioned.
//
// It is pure, and it knows nothing about a screen. The LOG screen and the
// site page (item 193 of docs/TODO/190) both render what it returns.

import type { StarSystem } from '../galaxy/galaxy.ts';
import { dossierFor } from './dossiers.ts';
import type { Dossier, JournalEntry, MissionState } from './model.ts';
import { SKELETONS, skeletonById } from './skeletons/index.ts';
import { fillSlots } from './text.ts';

/** One run of one mission, as lines a reader reads top to bottom. */
export interface StoryPage {
  skeleton: string;
  title: string;
  /** the world the run was accepted at */
  origin: number;
  /** every world the journal names on this run, in order, without repeats */
  worlds: number[];
  lines: string[];
  /** how it ended, or null while it runs */
  ending: 'complete' | 'fail' | null;
}

/** `side-hunt` reads as `SIDE HUNT` on a page with no dossier. */
function plainTitle(id: string): string {
  return id.replace(/-/g, ' ').toUpperCase();
}

/** `targetDestroyed` reads as `TARGET DESTROYED`; `survivor:landed` as `SURVIVOR LANDED`. */
function plainOutcome(outcome: string): string {
  return outcome.replace(/([a-z])([A-Z])/g, '$1 $2').replace(':', ' ').toUpperCase();
}

const ENDINGS = new Set(['complete', 'fail', 'abandoned', 'galaxyLeft']);

function lineFor(
  e: JournalEntry, dossier: Dossier | null, systems: readonly StarSystem[],
): string {
  const slots = { WORLD: systems[e.world].name.toUpperCase(), DAY: String(e.day) };
  const own = dossier?.story.legs[e.leg]?.[e.outcome];
  if (own) return fillSlots(own, slots);
  if (e.outcome === 'accepted') {
    return fillSlots(dossier?.story.opening ?? 'DAY {DAY}: TOOK THE JOB AT {WORLD}.', slots);
  }
  if (e.outcome === 'complete' || e.outcome === 'fail') {
    const closing = dossier?.story.closing[e.outcome]
      ?? (e.outcome === 'complete' ? 'DAY {DAY}: DONE, AT {WORLD}.' : 'DAY {DAY}: FAILED, AT {WORLD}.');
    return fillSlots(closing, slots);
  }
  if (e.outcome === 'abandoned') return fillSlots('DAY {DAY}: GAVE IT UP AT {WORLD}.', slots);
  if (e.outcome === 'galaxyLeft') return fillSlots('DAY {DAY}: LEFT THE GALAXY FROM {WORLD}.', slots);
  return fillSlots(`DAY {DAY} AT {WORLD}: ${plainOutcome(e.outcome)}.`, slots);
}

/**
 * The pages, oldest first. A run opens at its `accepted` entry and closes
 * at its ending. A run with no ending yet is the last page for its mission.
 */
export function storyPages(
  st: MissionState, systems: readonly StarSystem[],
  skeletons = SKELETONS, dossiers: (id: string) => Dossier | null = dossierFor,
): StoryPage[] {
  const pages: StoryPage[] = [];
  const open = new Map<string, StoryPage>();
  for (const e of st.journal) {
    if (e.outcome === 'accepted') {
      const dossier = dossiers(e.skeleton);
      const page: StoryPage = {
        skeleton: e.skeleton,
        title: dossier?.title ?? plainTitle(skeletonById(e.skeleton, skeletons)?.id ?? e.skeleton),
        origin: e.world, worlds: [], lines: [], ending: null,
      };
      pages.push(page);
      open.set(e.skeleton, page);
    }
    const page = open.get(e.skeleton);
    if (!page) continue;
    page.lines.push(lineFor(e, dossiers(e.skeleton), systems));
    if (page.worlds[page.worlds.length - 1] !== e.world) page.worlds.push(e.world);
    if (e.outcome === 'complete' || e.outcome === 'fail') {
      page.ending = e.outcome;
      open.delete(e.skeleton);
    } else if (ENDINGS.has(e.outcome)) {
      // `abandoned` and `galaxyLeft` are reasons; the `fail` that follows closes the page.
    }
  }
  return pages;
}
