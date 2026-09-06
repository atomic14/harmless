// The LOG screen: the commander's missions as a story, with the route flown.
//
// It reads the journal through `missions/story.ts`, draws the worlds through
// `missions/route-map.ts`, and paints through `ui/screens-log.ts`. It changes
// nothing. Escape is its only key.

import type { Screen, ScreenOutcome } from '../../ui/screen-host.ts';
import { renderLog } from '../../ui/screens-log.ts';
import { portraitUrl } from '../../ui/portrait.ts';
import type { CommanderData } from '../commander.ts';
import type { StarSystem } from '../../galaxy/galaxy.ts';
import type { Input } from '../../engine/input.ts';
import { storyPages, type StoryPage } from '../../missions/story.ts';
import { routeMapSvg } from '../../missions/route-map.ts';
import { skeletonById } from '../../missions/skeletons/index.ts';

export interface LogContext {
  readonly commander: CommanderData;
  readonly systems: StarSystem[];
}

/** The latest page's patron, as a face: a world's portrait, or none for the Navy. */
function patronPortrait(page: StoryPage | undefined, systems: StarSystem[], galaxy: number): string {
  if (!page) return '';
  const s = skeletonById(page.skeleton);
  if (!s || s.patron.kind === 'navy') return '';
  const world = s.patron.kind === 'world' ? s.patron.seedSlot : page.origin;
  return portraitUrl(systems[world], galaxy);
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
    renderLog({
      pages,
      route: routeMapSvg(systems, worlds),
      portrait: patronPortrait(pages[pages.length - 1], systems, commander.galaxy),
    });
  }

  input(i: Input): ScreenOutcome {
    return i.pressed('Escape') ? 'back' : 'stay';
  }
}
