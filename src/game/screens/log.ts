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
import type { Patron } from '../../missions/words.ts';
import { NAVY_PATRON, patronFor } from '../../missions/patrons.ts';
import { storyPages, type StoryPage } from '../../missions/story.ts';
import { routeMapSvg } from '../../missions/route-map.ts';
import { skeletonById } from '../../missions/skeletons/index.ts';
import { missionFacts } from '../mission-bridge.ts';
import { galaxySystems } from '../../galaxy/galaxies.ts';

export interface LogContext {
  readonly commander: CommanderData;
  readonly systems: StarSystem[];
}

/**
 * The latest page's patron, by name and face. A local patron ran the
 * origin's station, in the page's own galaxy (docs/TODO/213 M4).
 */
function patronOf(page: StoryPage | undefined, c: CommanderData): Patron {
  const s = page ? skeletonById(page.skeleton) : null;
  if (!page || !s) return NAVY_PATRON;
  return patronFor(s.patron, { ...missionFacts(c), galaxy: page.galaxy }, galaxySystems(page.galaxy), page.origin);
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
    // Every page names its worlds through its own galaxy. The route is the
    // chart of the galaxy the commander is in, so it draws the pages from this
    // one.
    const pages = storyPages(commander.missions,
      (galaxy) => (galaxy === commander.galaxy ? systems : galaxySystems(galaxy)));
    const worlds = pages.filter((p) => p.galaxy === commander.galaxy).flatMap((p) => p.worlds);
    const patron = patronOf(pages[pages.length - 1], commander);
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
