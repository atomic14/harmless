// The cycle orchestrator's state machine, driven against a FAKE claude in a
// throwaway git repo (docs/TODO/105): no real worker is spawned and no branch
// of this repo is touched. The fake's behaviour is a queue in a control file,
// so every transition the audit asked for is demonstrated: the happy path, an
// out-of-scope diff caught mechanically, a failing targeted test, rework
// consuming capped rounds, and the cap ending BLOCKED. Costs a few seconds of
// npm overhead (the temp repo's gate scripts are stubs) — the price of never
// discovering these transitions on a paid live run.

import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check, eq } from './harness.ts';
import { gateTier, parseMilestones, runCycle, type RunState } from '../tools/cycle-lib.ts';

console.log('\nthe cycle orchestrator (docs/TODO/105)');

// --- units -------------------------------------------------------------------

const plain = parseMilestones('# 900 — item\n\ntext\n', 'docs/TODO/900-x.md');
eq('no Milestones block means one milestone', plain.length, 1);

const parsed = parseMilestones([
  '# 900', '', '## Milestones', '',
  '1. wire it [scope: src/thing/, tools/] [tests: test -f src/thing/done]',
  '   the file exists and is wired', '', '## Verification', 'x',
].join('\n'), 'docs/TODO/900-x.md');
eq('a tagged milestone parses its scope', parsed[0].scope.join('|'), 'src/thing/|tools/');
eq('...its targeted test', parsed[0].tests[0], 'test -f src/thing/done');
check('...and its criteria', parsed[0].criteria.includes('wired'));

eq('docs-only diffs owe lint', gateTier(['docs/TODO/x.md', 'README.md']).name, 'docs');
eq('tooling diffs owe the build', gateTier(['tools/x.ts', 'test/y.ts']).name, 'tooling');
eq('src diffs owe build + elite-a', gateTier(['src/world/sun.ts']).name, 'src');
const g = gateTier(['src/game/npc.ts']);
check('gameplay diffs owe the campaign and a flown check',
  g.name === 'gameplay' && g.flown && g.cmds.some((c) => c.includes('campaign')));

// --- a throwaway repo with a fake claude -------------------------------------

const tmp = mkdtempSync(join(tmpdir(), 'cycle-test-'));
const ctrlPath = join(tmp, 'ctrl.json');
const fakeBin = join(tmp, 'fake-claude');

// The fake pops one action per invocation from the control file. Implementer
// actions: "good" (write the tested file, drop any oops.txt, commit), "oops"
// (commit an out-of-scope file), "none". Verifier actions are verdicts.
writeFileSync(fakeBin, `#!/usr/bin/env node
const fs = require('node:fs');
const cp = require('node:child_process');
const ctrl = JSON.parse(fs.readFileSync(${JSON.stringify(ctrlPath)}, 'utf8'));
const prompt = process.argv[process.argv.indexOf('-p') + 1];
if (prompt.includes('read-only verifier')) {
  const status = ctrl.verdict.shift() ?? 'REWORK';
  fs.writeFileSync(${JSON.stringify(ctrlPath)}, JSON.stringify(ctrl));
  console.log(JSON.stringify({ status, findings: [] }));
} else {
  const mode = ctrl.impl.shift() ?? 'none';
  fs.writeFileSync(${JSON.stringify(ctrlPath)}, JSON.stringify(ctrl));
  const run = (c) => cp.execSync(c, { stdio: 'pipe' });
  if (mode === 'good') {
    fs.mkdirSync('src/thing', { recursive: true });
    fs.writeFileSync('src/thing/done', 'ok');
    fs.rmSync('oops.txt', { force: true });
    run('git add -A && git commit -qm "fake work"');
  } else if (mode === 'oops') {
    fs.writeFileSync('oops.txt', 'out of scope');
    run('git add -A && git commit -qm "fake oops"');
  } else if (mode === 'oops-plus') {
    fs.mkdirSync('src/thing', { recursive: true });
    fs.writeFileSync('src/thing/done', 'ok');
    fs.writeFileSync('oops.txt', 'out of scope, tests green');
    run('git add -A && git commit -qm "fake oops-plus"');
  }
  console.log('fake report');
}
`);
chmodSync(fakeBin, 0o755);

function freshRepo(name: string): string {
  const root = join(tmp, name);
  mkdirSync(join(root, 'docs/TODO'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'fake', version: '0.0.0',
    scripts: { lint: 'exit 0', build: 'exit 0', 'elite-a': 'exit 0', campaign: 'exit 0' },
  }));
  writeFileSync(join(root, 'docs/TODO/900-fake-item.md'), [
    '# 900 — fake item', '', '## Milestones', '',
    '1. wire it [scope: src/thing/] [tests: test -f src/thing/done]',
    '   src/thing/done exists', '',
  ].join('\n'));
  const sh = (c: string): void => { execFileSync('sh', ['-c', c], { cwd: root, stdio: 'pipe' }); };
  sh('git init -q && git add -A');
  sh('git -c user.email=t@t -c user.name=t commit -qm base');
  return root;
}

function drive(name: string, impl: string[], verdict: string[]): RunState {
  const root = freshRepo(name);
  writeFileSync(ctrlPath, JSON.stringify({ impl, verdict }));
  return runCycle({
    root, claudeBin: fakeBin, maxRework: 2, maxBudgetUsd: 1, dryRun: false, log: () => {},
  }, '900');
}

// --- the transitions ---------------------------------------------------------

const happy = drive('happy', ['good'], ['PASS']);
eq('happy path: implement, checks, verify, accept', happy.phase, 'accepted');
check('...and the accepted commit is recorded', Boolean(happy.accepted));

// The oops commit fails BOTH mechanical checks (scope and the targeted test);
// the findings brief goes to a fixer whose good commit nets the oops file out
// of the three-dot diff, and the round is consumed.
const rework = drive('rework', ['oops', 'good'], ['PASS']);
eq('an out-of-scope diff is caught mechanically and reworked to acceptance',
  rework.phase, 'accepted');
eq('...consuming rework rounds that reset on acceptance', rework.rounds, 0);

// Scope alone must gate: this commit passes its targeted test but drops a file
// outside the milestone's scope, and no fixer ever repairs it — only the
// mechanical scope check stands between it and a PASS verdict.
const scoped = drive('scoped', ['oops-plus'], ['PASS', 'PASS', 'PASS']);
eq('a diff that is green but out of scope is refused to the cap', scoped.phase, 'blocked');

// Three REWORK verdicts against the cap of two: the finding survives, BLOCKED.
const blocked = drive('blocked', ['good', 'none', 'none'], ['REWORK', 'REWORK', 'REWORK']);
eq('a surviving finding stops as BLOCKED at the retry cap', blocked.phase, 'blocked');
eq('...after exactly the capped number of rounds', blocked.rounds, 2);

rmSync(tmp, { recursive: true, force: true });
