// The commander's log: the journal told as a story, the route drawn, and
// the LOG screen that shows both (docs/TODO/190 M5).
//
// The story is the path she took. A dossier carries a line for every branch
// a leg can take, and the page carries the one she took. That is the whole
// assertion of the first block, on a dossier built here, because no dossier
// ships until the pipeline plan (item 191) writes one.

import { dossierFor } from '../src/missions/dossiers.ts';
import { storyPages } from '../src/missions/story.ts';
import { routeMapSvg } from '../src/missions/route-map.ts';
import { emptyMissionState } from '../src/missions/state.ts';
import type { Dossier, MissionState } from '../src/missions/model.ts';
import { SIDE_RESCUE } from '../src/missions/skeletons/side.ts';
import { renderLog } from '../src/ui/screens-log.ts';
import { LogScreen } from '../src/game/screens/log.ts';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { newCommander } from '../src/game/commander.ts';
import { CHART_SPAN_X, CHART_SPAN_Y } from '../src/constants/chart-metric.ts';
import { captureById } from './screen-capture.ts';
import { constrictorAt, g1 } from './fixtures.ts';
import { check, cmds, dismissBriefing, eq, eqc } from './harness.ts';

const LAVE = 7;

console.log('\nthe story tells the branch she took, and not the other one');
{
  const dossier: Dossier = {
    skeleton: SIDE_RESCUE.id, hash: 'test', title: 'THE SURVEY PILOT',
    briefing: [], legs: {}, lead: '', rumour: { far: '', near: '' }, news: '', images: {},
    story: {
      opening: 'ON DAY {DAY} THE STATION AT {WORLD} ASKED FOR A PILOT.',
      closing: { complete: 'THE JOB WAS DONE ON DAY {DAY}.', fail: 'THE JOB FAILED ON DAY {DAY}.' },
      legs: {
        pod: {
          'survivor:landed': 'SHE WALKED OFF THE PAD AT {WORLD}.',
          targetDestroyed: 'THE POD BROKE UP OVER {WORLD}. THE DATA CAME ACROSS FIRST.',
        },
        data: { success: 'THE SURVEY DATA REACHED {WORLD} ON DAY {DAY}.' },
      },
    },
  };
  const dossiers = (id: string): Dossier | null => (id === SIDE_RESCUE.id ? dossier : null);

  const lost: MissionState = {
    ...emptyMissionState(),
    journal: [
      { skeleton: SIDE_RESCUE.id, leg: 'pod', outcome: 'accepted', day: 3, world: LAVE },
      { skeleton: SIDE_RESCUE.id, leg: 'pod', outcome: 'targetDestroyed', day: 5, world: 12 },
      { skeleton: SIDE_RESCUE.id, leg: 'data', outcome: 'success', day: 7, world: LAVE },
      { skeleton: SIDE_RESCUE.id, leg: 'data', outcome: 'complete', day: 7, world: LAVE },
    ],
  };
  const [page] = storyPages(lost, g1, undefined, dossiers);
  eq('one run is one page', storyPages(lost, g1, undefined, dossiers).length, 1);
  eq('...titled by the dossier', page.title, 'THE SURVEY PILOT');
  const text = page.lines.join(' ');
  check('the opening fills its slots', text.includes('ON DAY 3 THE STATION AT LAVE ASKED'));
  check('the branch she took is told', text.includes('THE POD BROKE UP OVER ' + g1[12].name.toUpperCase()));
  check('...and the branch she did not take is not', !text.includes('WALKED OFF THE PAD'));
  check('the recovery leg is told', text.includes('THE SURVEY DATA REACHED LAVE ON DAY 7'));
  check('...and the closing', text.includes('THE JOB WAS DONE ON DAY 7'));
  eq('the page ends complete', page.ending, 'complete');
  eq('the worlds are the journey, without repeats', page.worlds.join(), `${LAVE},12,${LAVE}`);

  const landed: MissionState = {
    ...emptyMissionState(),
    journal: [
      { skeleton: SIDE_RESCUE.id, leg: 'pod', outcome: 'accepted', day: 3, world: LAVE },
      { skeleton: SIDE_RESCUE.id, leg: 'pod', outcome: 'survivor:landed', day: 6, world: LAVE },
      { skeleton: SIDE_RESCUE.id, leg: 'pod', outcome: 'complete', day: 6, world: LAVE },
    ],
  };
  const other = storyPages(landed, g1, undefined, dossiers)[0].lines.join(' ');
  check('the other branch tells the other line', other.includes('WALKED OFF THE PAD AT LAVE')
    && !other.includes('BROKE UP'));

  // No dossier: the plain words, and every entry still has a line. The
  // table is emptied here, because nine dossiers ship since docs/TODO/191.
  const none = (): Dossier | null => null;
  const plain = storyPages(lost, g1, undefined, none)[0];
  eq('without a dossier the title is the job\'s id in words', plain.title, 'SIDE RESCUE');
  eq('...and every entry has a line', plain.lines.length, 4);
  check('...in plain words', plain.lines[1].includes('TARGET DESTROYED') && plain.lines[0].includes('DAY 3'));

  // A run still open is a page with no ending, and a second run is a second page.
  const twice: MissionState = {
    ...emptyMissionState(),
    journal: [
      ...lost.journal,
      { skeleton: SIDE_RESCUE.id, leg: 'pod', outcome: 'accepted', day: 20, world: 12 },
      { skeleton: 'constrictor', leg: 'hunt', outcome: 'accepted', day: 21, world: 12 },
      { skeleton: 'constrictor', leg: 'hunt', outcome: 'abandoned', day: 22, world: 12 },
      { skeleton: 'constrictor', leg: 'hunt', outcome: 'fail', day: 22, world: 12 },
    ],
  };
  const pages = storyPages(twice, g1, undefined, none);
  eq('three runs are three pages, oldest first', pages.map((p) => `${p.title}:${p.ending}`).join('|'),
    'SIDE RESCUE:complete|SIDE RESCUE:null|CONSTRICTOR:fail');
  check('an abandonment is told as the reason', pages[2].lines.some((l) => l.includes('GAVE IT UP')));
}

console.log('\nthe route map draws the worlds a story names');
{
  eq('no worlds, no map', routeMapSvg(g1, []), '');
  const svg = routeMapSvg(g1, [LAVE, 12, LAVE]);
  check('the map is an SVG in the chart\'s own frame', svg.startsWith('<svg')
    && svg.includes(`viewBox="0 0 ${CHART_SPAN_X} ${CHART_SPAN_Y}"`));
  check('every system is a dot', (svg.match(/class="star"/g) ?? []).length === g1.length);
  eq('the visited worlds are marked', (svg.match(/class="visited"/g) ?? []).length, 3);
  check('...and joined in order', svg.includes(`points="${g1[LAVE].x},${g1[LAVE].y / 2} ${g1[12].x},${g1[12].y / 2} ${g1[LAVE].x},${g1[LAVE].y / 2}"`));
}

console.log('\nthe LOG screen, painted and opened');
{
  const c = { ...newCommander(), missions: constrictorAt('hunt', 12) };
  c.missions.journal.push({ skeleton: 'constrictor', leg: 'hunt', outcome: 'targetDestroyed', day: 4, world: 12 });
  const screen = new LogScreen(() => ({ commander: c, systems: g1 }));
  const html = captureById(() => { screen.render(); }).get('screen') ?? '';
  // The title is the dossier's where one ships, and the id's words where none does.
  const title = (dossierFor('constrictor')?.title ?? 'CONSTRICTOR').toUpperCase();
  check('the screen carries the story', html.includes("COMMANDER'S LOG") && html.includes(title)
    && html.includes('IN PROGRESS'));
  check('...and the route', html.includes('<svg') && html.includes('class="visited"'));
  check('...and no face for the Navy', !html.includes('<figure'));
  const empty = captureById(() => { renderLog({ pages: [], route: '', portrait: '', patron: '' }); }).get('screen') ?? '';
  check('a commander with no story still gets a page, and it says so', empty.includes('Nothing yet'));

  // The station has rows, not letters, since docs/TODO/202.
  eqc('the COMMANDER\'S LOG row at the station opens the log', cmds('docked', ['VirtOpenLog'], []), ['openLog']);
  eqc('...and ⇧R in the cockpit', cmds('flight', ['KeyR'], ['ShiftLeft']), ['openLog']);
  eqc('plain R is still the standing orders', cmds('flight', ['KeyR'], []), ['openMissions']);

  const g = withoutSaving(() => {
    seedWorld(1907);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
  g.input.injectPress('VirtOpenLog');
  g.step(1 / 60, 1);
  eq('the row opens the screen through a real Game', g.screens.topId, 'log');
  g.input.injectPress('Escape');
  g.step(1 / 60, 1 + 1 / 60);
  eq('...and Escape closes it', g.screens.topId, null);
}
