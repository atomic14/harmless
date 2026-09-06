// The LOG screen: the commander's missions as a story, with the route flown.
//
// It reads the journal through `missions/story.ts`, draws the worlds through
// `missions/route-map.ts`, and paints through `ui/screens-log.ts`. It changes
// nothing. Escape is its only key.

import type { Screen, ScreenOutcome } from '../../ui/screen-host.ts';
import { renderLog } from '../../ui/screens-log.ts';
import type { CommanderData } from '../commander.ts';
import type { StarSystem } from '../../galaxy/galaxy.ts';
import type { Input } from '../../engine/input.ts';
import type { Patron } from '../../missions/model.ts';
import { NAVY_PATRON, patronFor } from '../../missions/patrons.ts';
import { storyPages, type StoryPage } from '../../missions/story.ts';
import { routeMapSvg } from '../../missions/route-map.ts';
import { skeletonById } from '../../missions/skeletons/index.ts';
import { missionFacts } from '../mission-bridge.ts';

export interface LogContext {
  readonly commander: CommanderData;
  readonly systems: StarSystem[];
}

/** The latest page's patron, by name and face. A local patron ran the origin's station. */
function patronOf(page: StoryPage | undefined, c: CommanderData, systems: StarSystem[]): Patron {
  const s = page ? skeletonById(page.skeleton) : null;
  if (!page || !s) return NAVY_PATRON;
  return patronFor(s.patron, missionFacts(c), systems, page.origin);
}

export class LogScreen implements Screen {
  readonly id = 'log' as const;
  private readonly ctx: () => LogContext;

  constructor(ctx: () => LogContext) {
    this.ctx = ctx;
  }

  open(): void {
    this.render();
  }

  render(): void {
    const { commander, systems } = this.ctx();
    const pages = storyPages(commander.missions, systems);
    const worlds = pages.flatMap((p) => p.worlds);
    const patron = patronOf(pages[pages.length - 1], commander, systems);
    renderLog({
      pages,
      route: routeMapSvg(systems, worlds),
      portrait: patron.portrait,
      patron: patron.name,
    });
  }

  input(i: Input): ScreenOutcome {
    return i.pressed('Escape') ? 'back' : 'stay';
  }
}
