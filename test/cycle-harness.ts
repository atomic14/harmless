// The cycle orchestrator test fixture (docs/TODO/105): a fake claude whose
// behaviour is a queue in a control file, throwaway git repos with stubbed
// gate commands, and the shared good plan. test/cycle.test.ts drives the
// transitions; this file is the scaffolding, split out for the size gate.

import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CycleConfig, CyclePlan } from '../tools/cycle-state.ts';

export const tmp = mkdtempSync(join(tmpdir(), 'cycle-'));
export const ctrlPath = join(tmp, 'ctrl.json');
const fakeBin = join(tmp, 'fake-claude');

export const goodPlan: CyclePlan = {
  version: 1, todo: 900, declaredTier: 'tooling',
  milestones: [{
    id: 'm1', title: 'wire it', acceptance: ['src/thing/done exists'],
    scope: ['src/thing/'], tests: [{ cmd: 'node', args: ['check.js'] }],
  }],
};

writeFileSync(fakeBin, `#!/usr/bin/env node
const fs = require('node:fs');
const cp = require('node:child_process');
const C = ${JSON.stringify(ctrlPath)};
const ctrl = JSON.parse(fs.readFileSync(C, 'utf8'));
const prompt = process.argv[process.argv.indexOf('-p') + 1];
// Schema roles carry their payload in structured_output, exactly as the real
// CLI does (https://code.claude.com/docs/en/headless); result stays textual.
const done = (role, payload) => {
  ctrl.calls.push(role);
  fs.writeFileSync(C, JSON.stringify(ctrl));
  console.log(JSON.stringify(typeof payload === 'string'
    ? { result: payload, total_cost_usd: 0.01 }
    : { result: '', structured_output: payload, total_cost_usd: 0.01 }));
};
const commit = (msg) => {
  try { cp.execSync('git add -A && git commit -qm "' + msg + '"', { stdio: 'pipe' }); }
  catch (e) {
    console.error('FAKE-GIT:', String(e.stderr), String(e.stdout), 'cwd=' + process.cwd(),
      'status=' + cp.execSync('git status --porcelain --ignored', { encoding: 'utf8' }));
    process.exit(1);
  }
};
if (prompt.includes('read-only planner')) done('planner', ctrl.plan);
else if (prompt.includes('read-only verifier')) {
  const whole = prompt.includes('WHOLE item');
  const status = (whole ? ctrl.finalVerdict : ctrl.verdict).shift() ?? 'REWORK';
  done(whole ? 'final-verifier' : 'verifier', {
    status,
    findings: status === 'REWORK'
      ? [{ severity: 'high', file: 'x', problem: 'p', required_fix: 'f' }] : [],
  });
} else if (prompt.includes('closing worker')) {
  const mode = ctrl.closer.shift() ?? 'good';
  const doc = fs.readdirSync('docs/TODO').find((f) => f.startsWith('900-'));
  fs.appendFileSync('docs/TODO/' + doc, '\\nOutcome: filled by closer\\n');
  if (mode === 'bad') fs.writeFileSync('src/thing/sneak', 'x');
  commit('docs/TODO/900: outcome');
  done('closer', 'closed');
} else {
  const mode = ctrl.impl.shift() ?? 'none';
  ctrl.calls.push('impl:' + mode);
  fs.writeFileSync(C, JSON.stringify(ctrl)); // persist the draw BEFORE acting
  if (mode === 'die') process.exit(1);
  if (mode === 'good' || mode === 'good2' || mode === 'good-big') {
    fs.mkdirSync('src/thing', { recursive: true });
    fs.writeFileSync(mode === 'good2' ? 'src/thing/done2' : 'src/thing/done', 'ok');
    if (mode === 'good-big') fs.writeFileSync('src/thing/big', 'x'.repeat(100000));
    fs.rmSync('oops.txt', { force: true });
    commit('fake work');
  } else if (mode === 'oops-plus') {
    fs.mkdirSync('src/thing', { recursive: true });
    fs.writeFileSync('src/thing/done', 'ok');
    fs.writeFileSync('oops.txt', 'out of scope');
    commit('fake oops');
  }
  console.log(JSON.stringify({ result: 'report', total_cost_usd: 0.01 }));
}
`);
chmodSync(fakeBin, 0o755);

export interface Ctrl {
  plan: CyclePlan; impl: string[]; verdict: string[]; finalVerdict: string[];
  closer: string[]; calls: string[];
}
export const setCtrl = (c: Partial<Ctrl>): void => {
  writeFileSync(ctrlPath, JSON.stringify({
    plan: goodPlan, impl: [], verdict: [], finalVerdict: [], closer: [], calls: [], ...c,
  }));
};
export const calls = (): string[] => (JSON.parse(readFileSync(ctrlPath, 'utf8')) as Ctrl).calls;

export const harness = { execLog: [] as string[], execFail: new Set<string>() };

export function freshRepo(name: string, manifest: boolean): CycleConfig {
  const root = join(tmp, name);
  mkdirSync(join(root, 'docs/TODO'), { recursive: true });
  mkdirSync(join(root, 'docs/TODO/completed'), { recursive: true });
  writeFileSync(join(root, '.gitignore'), '.cycle/\n.claude/\n');
  writeFileSync(join(root, 'docs/TODO/QUEUE.json'),
    '{ "version": 1, "items": [900, 901] }\n');
  writeFileSync(join(root, 'docs/TODO/900-fake-item.md'), [
    '# 900 — fake item', '',
    ...(manifest ? ['```json cycle-manifest', JSON.stringify(goodPlan), '```'] : []),
    '', '## Outcome', '',
  ].join('\n'));
  writeFileSync(join(root, 'docs/TODO/901-other-item.md'), '# 901 — other\n');
  writeFileSync(join(root, 'docs/TODO/README.md'), '- [ ] 900 — fake item\n- [ ] 901 — other\n');
  writeFileSync(join(root, 'docs/TODO/completed/README.md'), [
    '# Completed TODO plans', '', '<!-- append-completed-todos-here -->', '',
  ].join('\n'));
  const sh = (c: string): void => { execFileSync('sh', ['-c', c], { cwd: root, stdio: 'pipe' }); };
  sh('git init -q && git config user.email t@t && git config user.name t');
  sh('git add -A && git commit -qm base');
  harness.execLog = []; harness.execFail = new Set();
  return {
    root, claudeBin: fakeBin, maxRework: 2, maxFinalRework: 2, maxMilestones: 6,
    diffCap: 60_000, maxBudgetUsd: 1, maxWorkers: 50, maxTotalBudgetUsd: 50,
    maxItems: 1, dryRun: false, land: false, push: false, log: () => {},
    exec: (cmd, args) => {
      const line = [cmd, ...args].join(' ');
      harness.execLog.push(line);
      if (harness.execFail.has(line)) throw { stdout: 'stub gate failed' };
      return '';
    },
  };
}
