// The phone holds its zoom, hides its bar, and reads the chart
// (docs/TODO/220).
//
// Three faults from Chris's phone, and the fix for each is read here: the
// page's meta and manifest, and the chart's names drawn in CSS pixels.

import { readFileSync } from 'node:fs';
import { newCommander } from '../src/game/commander.ts';
import { drawLocalChart, labelScale } from '../src/ui/chart-local.ts';
import { CHART_LABEL_PX, LOCAL_CANVAS } from '../src/constants/chart-metric.ts';
import { g1 } from './fixtures.ts';
import { captureCanvas } from './screen-capture.ts';
import { check, eq } from './harness.ts';

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

console.log('\nthe page refuses a zoom, and opens as an app from the home screen');
{
  for (const page of ['play.html', 'index.html']) {
    const html = read(page);
    check(`${page} tells the viewport no user scale`,
      /<meta name="viewport" content="[^"]*user-scalable=no[^"]*"/.test(html)
      && /maximum-scale=1/.test(html));
    check('...and links the manifest', /<link rel="manifest" href="\/manifest.webmanifest"/.test(html));
    check('...and carries the two app meta tags',
      /<meta name="mobile-web-app-capable" content="yes"/.test(html)
      && /<meta name="apple-mobile-web-app-capable" content="yes"/.test(html));
  }
  const manifest = JSON.parse(read('public/manifest.webmanifest')) as Record<string, string>;
  eq('the manifest opens the game standalone', manifest.display, 'standalone');
  eq('...at the play page', manifest.start_url, '/play.html');
  check('the root refuses the pinch and the double tap',
    /html, body \{[^}]*touch-action: pan-x pan-y;/s.test(read('src/style.css')));
  check('the entry point holds the zoom and asks for the whole screen',
    /holdZoom\(\);\s*askFullscreen\(\);/.test(read('src/main.ts')));
}

console.log('\nthe chart draws its names in CSS pixels');
{
  eq('a canvas shown at half its width scales by two', labelScale({ width: 560, clientWidth: 280 }), 2);
  eq('...and one with no width on the page scales by one', labelScale({ width: 560, clientWidth: 0 }), 1);
  eq('...as does one that reports none', labelScale({ width: 560 }), 1);
  const c = newCommander();
  c.systemIndex = 7;
  const chart = { cursorX: g1[7].x, cursorY: g1[7].y, targetIndex: null };
  const ops = captureCanvas(() => drawLocalChart(g1, c, chart, {
    mode: 'none', lanes: [], prices: [], danger: [], marks: [],
  } as never), LOCAL_CANVAS, LOCAL_CANVAS);
  const names = (ops.get('local-canvas') ?? []).filter((op) => op.method === 'fillText');
  check(`the names are drawn at the constant, ${CHART_LABEL_PX}px, under no page width`,
    names.length > 0 && names.every((op) => op.font.startsWith(`${CHART_LABEL_PX}px`)),
    names[0]?.font ?? 'no name drawn');
}
