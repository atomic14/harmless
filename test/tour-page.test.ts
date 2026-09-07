// The mission tour as data, and the one log builder the game and the site
// share (docs/TODO/193 M1).
//
// The model is what the page prints, so the test reads it as the page
// would: the arcs in tour order, a patron per arc, the jumps between them,
// every side job under its verb, and the plain words when the dossier
// table is emptied. The builder is proved shared by capturing the game's
// LOG screen and finding the builder's own markup inside it.

import { readFileSync } from 'node:fs';
import { TOUR_STEP_JUMPS } from '../src/constants/missions.ts';
import { escapeHtml } from '../src/engine/escape-html.ts';
import config, { FOOTER_MARKER } from '../vite.config.ts';
import { LogScreen } from '../src/game/screens/log.ts';
import { newCommander, type CommanderData } from '../src/game/commander.ts';
import type { Dossier } from '../src/missions/model.ts';
import { patronFor } from '../src/missions/patrons.ts';
import { routeMapSvg } from '../src/missions/route-map.ts';
import { ARC_TOUR, SKELETONS } from '../src/missions/skeletons/index.ts';
import { SIDE_JOBS } from '../src/missions/skeletons/side.ts';
import { ARC_VETITICE } from '../src/missions/skeletons/arcs/vetitice.ts';
import { storyPages } from '../src/missions/story.ts';
import { tourHtml } from '../src/missions/tour-html.ts';
import { recoveryLegs, tourModel } from '../src/missions/tour-page.ts';
import { logHtml } from '../src/ui/screens-log.ts';
import { captureById } from './screen-capture.ts';
import { g1 } from './fixtures.ts';
import { check, eq } from './harness.ts';

console.log('\nthe tour as data: five arcs in order, each with a patron and a face');
{
  const m = tourModel(g1);
  eq('the arcs are in tour order', m.arcs.map((a) => a.id).join(), ARC_TOUR.join());
  eq('...on the tour\'s worlds', m.arcs.map((a) => a.world.name).join(' > '), 'Lave > Rabedira > Vetitice > Xeer > Edle');
  check('each arc\'s patron is the world patron of its world, with a face',
    m.arcs.every((a) => a.patron.name === patronFor({ kind: 'world', seedSlot: a.world.index }, { galaxy: 1, systemIndex: 0, kills: 0, combatScore: 0, legalStatus: 0, day: 0, cargo: [] }, g1).name
      && a.patron.portrait.startsWith('species/')));
  const jumps = m.arcs.slice(0, -1).map((a) => a.jumpsToNext);
  check(`each arc's world is ${TOUR_STEP_JUMPS.min} to ${TOUR_STEP_JUMPS.max} jumps from the next (${jumps.join(', ')})`,
    jumps.every((j) => j !== null && j >= TOUR_STEP_JUMPS.min && j <= TOUR_STEP_JUMPS.max));
  check('...and the last arc has no next', m.arcs[4].next === null && m.arcs[4].jumpsToNext === null);
  check('each arc names its next', m.arcs.slice(0, -1).every((a, i) => a.next === ARC_TOUR[i + 1]));
  check('a briefing is the dossier\'s, with the patron and the world filled',
    m.arcs.every((a) => a.briefing.length >= 1 && a.briefing.every((p) => !p.includes('{PATRON}') && !p.includes('{HERE}'))));
  check('...and a leg line names no world of its own',
    m.arcs.every((a) => a.legs.every((l) => !l.line.includes('{TARGET}'))));
  check('every arc has a recovery leg, and not every leg is one',
    m.arcs.every((a) => a.legs.some((l) => l.recovery) && a.legs.some((l) => !l.recovery)));
  eq('Vetitice\'s recovery leg is the route home', [...recoveryLegs(ARC_VETITICE)].join(), 'route');
  check('the route is the SVG of the five start worlds',
    m.routeSvg === routeMapSvg(g1, m.arcs.map((a) => a.world.index)) && m.routeSvg.startsWith('<svg'));
}

console.log('\n...every side job under its verb, and the plain words without a dossier');
{
  const m = tourModel(g1);
  const listed = m.sideJobs.flatMap((g) => g.jobs.map((j) => `${g.verb}:${j.id}`));
  eq('every side job appears once, under its own verb',
    listed.sort().join(),
    SIDE_JOBS.map((s) => `${s.legs[0].verb.kind.charAt(0).toUpperCase()}${s.legs[0].verb.kind.slice(1)}:${s.id}`).sort().join());
  eq('eight verbs, one job each', m.sideJobs.length, 8);

  const none = (): Dossier | null => null;
  const plain = tourModel(g1, 1, none);
  eq('with the dossier table emptied, the titles are the ids in words', plain.arcs[0].title, 'ARC LAVE');
  eq('...and the briefing is the pitch', plain.arcs[0].briefing.join(), SKELETONS.find((s) => s.id === 'arc-lave')?.pitch);
  check('...and the side jobs still list', plain.sideJobs.length === 8);

  // The proofs the plan names: a swapped order and a dropped job are seen.
  const swapped = tourModel(g1, 1, none, SKELETONS, [ARC_TOUR[1], ARC_TOUR[0], ...ARC_TOUR.slice(2)]);
  check('a swapped tour order is a different model', swapped.arcs[0].id !== m.arcs[0].id);
  const dropped = tourModel(g1, 1, none, SKELETONS.filter((s) => s.id !== 'side-scan'));
  check('a dropped side job leaves its verb without a job', !dropped.sideJobs.some((g) => g.verb === 'Scan'));
}

console.log('\n...and the game\'s LOG and the page share one builder');
{
  const c: CommanderData = { ...newCommander(), systemIndex: 7, contracts: [] };
  c.missions.journal.push({ skeleton: 'side-rescue', leg: 'pod', outcome: 'accepted', day: 3, world: 7 });
  const html = captureById(() => { new LogScreen(() => ({ commander: c, systems: g1 })).render(); }).get('screen') ?? '';
  const pages = storyPages(c.missions, g1);
  const patron = patronFor({ kind: 'local' }, { galaxy: 1, systemIndex: 7, kills: 0, combatScore: 0, legalStatus: 0, day: 0, cargo: [] }, g1, 7);
  const built = logHtml({ pages, route: routeMapSvg(g1, [7]), portrait: patron.portrait, patron: patron.name });
  check('the screen contains the builder\'s markup verbatim', html.includes(built.trim()));
  check('...with the title and the BACK key around it', html.includes("COMMANDER'S LOG") && html.includes('data-key="Escape"'));
}

console.log('\n...and the page has its four homes, and a clean link to each');
{
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const page = read('missions.html');
  check('the page carries the tour marker and the footer marker',
    page.includes('<!--TOUR-->') && page.includes(FOOTER_MARKER));
  check('...and a canonical link with no .html', page.includes('href="https://harmless.atomic14.com/missions"'));
  check('the page is a Vite input',
    Object.values((config.build?.rollupOptions?.input ?? {}) as Record<string, string>).some((p) => p.endsWith('missions.html')));
  check('...and the tour plugin is wired in',
    ((config.plugins ?? []) as { name?: string }[]).some((p) => p.name === 'harmless:mission-tour'));
  check('the sitemap lists it', read('public/sitemap.xml').includes('<loc>https://harmless.atomic14.com/missions</loc>'));
  const landing = read('index.html');
  check('the landing page links it with a clean link',
    landing.includes('href="/missions"') && !landing.includes('missions.html'));
  check('...and no internal link on the page carries .html',
    !/href="\/[a-z-]+\.html"/.test(page));

  // The markup: every arc, every face, every side job, and every word escaped.
  const html = tourHtml(tourModel(g1), '<p>EXAMPLE</p>');
  check('the markup carries the five arcs in order',
    ARC_TOUR.every((id) => html.includes(`id="${id}"`)) && html.indexOf('id="arc-lave"') < html.indexOf('id="arc-edle"'));
  check('...each with its face', (html.match(/<img src="\/species\//g) ?? []).length === 5);
  check('...every side job', SIDE_JOBS.every((s) => html.includes(escapeHtml(s.pitch))));
  check('...and the example where the marker for it is', html.includes('<p>EXAMPLE</p>'));
  const hostile = tourModel(g1, 1, () => ({
    skeleton: 'x', hash: '', title: '<b>x</b>', briefing: ['<script>'], legs: {}, lead: '', rumour: { far: '', near: '' }, news: '', images: {},
    story: { opening: '', closing: { complete: '', fail: '' }, legs: {} },
  }));
  check('a dossier\'s markup is escaped, never set', !tourHtml(hostile, '').includes('<script>') && tourHtml(hostile, '').includes('&lt;script&gt;'));
}
