// Cycle orchestrator: worker invocation and prompts (docs/TODO/105).
// Safety is in the ARGUMENTS, not the prompt: closed tool lists per role, no
// session persistence, per-worker budgets, and for implementers an explicit
// allow/deny list of Bash command families under acceptEdits — never
// bypassPermissions. A worker whose needed command is denied is told to
// output BLOCKED, and the orchestrator never relaxes permissions.

import { execFileSync } from 'node:child_process';
import {
  CycleError, CycleStop, type CycleConfig, type CyclePlan, type RunState,
} from './cycle-state.ts';

export type Role = 'planner' | 'implementer' | 'verifier' | 'closer';

const ALLOWED_BASH = [
  'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)',
  'Bash(git add:*)', 'Bash(git commit:*)', 'Bash(node:*)', 'Bash(npm:*)',
];
const DENIED_BASH = [
  'Bash(git push:*)', 'Bash(git merge:*)', 'Bash(git -C:*)', 'Bash(git worktree:*)',
  'Bash(git remote:*)', 'Bash(curl:*)', 'Bash(wget:*)', 'Bash(rm:*)', 'Bash(sudo:*)',
];

export const VERDICT_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    status: { enum: ['PASS', 'REWORK', 'BLOCKED'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { enum: ['high', 'medium', 'low'] },
          file: { type: 'string' }, line: { type: 'number' },
          problem: { type: 'string' }, required_fix: { type: 'string' },
        },
        required: ['severity', 'file', 'problem', 'required_fix'],
      },
    },
  },
  required: ['status', 'findings'],
});

/** The mechanical flag set per role — exported so tests assert it directly. */
export function workerArgs(cfg: CycleConfig, role: Role): string[] {
  const common = ['--no-session-persistence', '--no-chrome', '--autocompact', '100000',
    '--max-budget-usd', String(cfg.maxBudgetUsd), '--output-format', 'json'];
  if (role === 'verifier' || role === 'planner') {
    return [...common, '--tools', 'Read,Grep,Glob', '--permission-mode', 'plan',
      '--json-schema', role === 'verifier' ? VERDICT_SCHEMA : PLAN_SCHEMA];
  }
  return [...common, '--tools', 'Read,Grep,Glob,Bash,Edit,Write',
    '--permission-mode', 'acceptEdits',
    '--allowedTools', ...ALLOWED_BASH, '--disallowedTools', ...DENIED_BASH];
}

export interface WorkerResult { text: string; costUsd: number }

/** Run one fresh worker; enforce the run-wide worker and budget caps. */
export function runWorker(
  cfg: CycleConfig, s: RunState, role: Role, prompt: string, cwd: string,
): WorkerResult {
  if (cfg.dryRun) {
    cfg.log(`[dry] claude (${role}) ${workerArgs(cfg, role).join(' ')}`);
    cfg.log(`--- ${role} prompt ---\n${prompt}\n---`);
    return { text: '', costUsd: 0 };
  }
  if (s.workerInvocations.length >= cfg.maxWorkers) {
    throw new CycleStop(`worker cap (${cfg.maxWorkers}) reached — rerun to continue`);
  }
  const spent = s.workerInvocations.reduce((a, w) => a + w.costUsd, 0);
  if (spent >= cfg.maxTotalBudgetUsd) {
    throw new CycleStop(`total budget ($${cfg.maxTotalBudgetUsd}) reached — rerun to continue`);
  }
  let raw: string;
  try {
    raw = execFileSync(cfg.claudeBin, ['-p', prompt, ...workerArgs(cfg, role)],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // A worker/API/rate-limit death is a resumable pause, never a rework round.
    const err = e as { stderr?: string; message?: string };
    throw new CycleStop(`${role} died: ${(err.stderr ?? err.message ?? '').slice(0, 300)}`);
  }
  let text = raw; let costUsd = 0;
  try {
    const env = JSON.parse(raw) as { result?: string; total_cost_usd?: number };
    if (typeof env.result === 'string') { text = env.result; costUsd = env.total_cost_usd ?? 0; }
  } catch { /* plain-text worker output is acceptable */ }
  s.workerInvocations.push({ role, costUsd });
  return { text, costUsd };
}

// --- verdicts ----------------------------------------------------------------

export interface Finding {
  severity: string; file: string; line?: number; problem: string; required_fix: string;
}
export interface Verdict { status: 'PASS' | 'REWORK' | 'BLOCKED'; findings: Finding[] }

/** Strict: structured output, exact enum, PASS carries no findings, REWORK
 *  carries at least one actionable one. No greedy-regex extraction. */
export function parseVerdict(text: string): Verdict {
  let v: Verdict;
  try { v = JSON.parse(text.trim()) as Verdict; } catch {
    throw new CycleError(`verifier output is not JSON: ${text.slice(0, 300)}`);
  }
  if (!['PASS', 'REWORK', 'BLOCKED'].includes(v.status) || !Array.isArray(v.findings)) {
    throw new CycleError(`verifier verdict malformed: ${text.slice(0, 300)}`);
  }
  if (v.status === 'PASS' && v.findings.length) throw new CycleError('PASS with findings');
  if (v.status === 'REWORK' && !v.findings.some((f) => f.problem && f.required_fix)) {
    throw new CycleError('REWORK without an actionable finding');
  }
  return v;
}

// --- prompts -----------------------------------------------------------------

export const PLAN_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    version: { const: 1 }, todo: { type: 'number' },
    declaredTier: { enum: ['docs', 'tooling', 'src', 'gameplay'] },
    milestones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' }, title: { type: 'string' },
          acceptance: { type: 'array', items: { type: 'string' } },
          scope: { type: 'array', items: { type: 'string' } },
          scopeReason: { type: 'string' },
          tests: {
            type: 'array',
            items: {
              type: 'object',
              properties: { cmd: { type: 'string' }, args: { type: 'array', items: { type: 'string' } } },
              required: ['cmd', 'args'],
            },
          },
        },
        required: ['id', 'title', 'acceptance', 'scope', 'tests'],
      },
    },
  },
  required: ['version', 'todo', 'declaredTier', 'milestones'],
});

export function plannerPrompt(planDoc: string): string {
  return `You are a read-only planner. Read ${planDoc} and docs/PROCESS.md, then emit a cycle
plan as JSON only, matching the schema you were given: the item's gate tier as declared by
what it will touch, and 1-4 milestones, each with concrete acceptance criteria, a scope of
repository path prefixes (relative, no '..'), and targeted test commands (node/npm only)
that a machine can run. Small items are ONE milestone. Do not invent work the doc does not
ask for.`;
}

export function implementerPrompt(
  s: RunState, plan: CyclePlan, planDoc: string, findings: string | null,
): string {
  // Past the last milestone this is the FINAL fixer: whole-item framing.
  const m = plan.milestones[s.currentMilestone] ?? {
    title: 'final integration across all milestones',
    acceptance: plan.milestones.flatMap((x) => x.acceptance),
    scope: [...new Set(plan.milestones.flatMap((x) => x.scope))],
    scopeReason: undefined, id: 'final', tests: [],
  };
  const rework = findings
    ? `This is a REWORK round. Address ONLY these findings, nothing else:\n${findings}\n` : '';
  return `You are one disposable implementation worker in the HARMLESS repo's cycle loop.
Work ONLY in this directory (worktree, branch ${s.branch}, based on ${s.milestoneBase.slice(0, 7)}).
${rework}Contract: ${planDoc} — milestone "${m.title}" (${s.currentMilestone + 1}/${plan.milestones.length}).
Acceptance criteria:\n${m.acceptance.map((a) => `- ${a}`).join('\n')}
Allowed paths (mechanically enforced): ${m.scope.length ? m.scope.join(', ') : m.scopeReason} and docs/TODO/.
Read docs/PROCESS.md step 2 and the contract, then implement THIS milestone only.
Your Bash is limited to git status/diff/log/show/add/commit, node and npm, in this
directory. If a command you genuinely need is denied, commit what is safe and end your
report with the single word BLOCKED and the command — do not work around the denial.
Do not push or merge. Use targeted tests while working; the orchestrator runs the gates.
Stop after at most 50 tool calls; commit what is complete (checkpoint note if unfinished).
End every commit message with:
Co-Authored-By: Claude (cycle orchestrator, docs/TODO/105) <noreply@anthropic.com>
Final output: a report under 300 words.`;
}

export function verifierPrompt(
  s: RunState, plan: CyclePlan, planDoc: string, checksSummary: string, diff: string,
  whole: boolean,
): string {
  const m = plan.milestones[s.currentMilestone];
  const subject = whole
    ? `the WHOLE item ${planDoc} — every milestone landed; judge the integrated result`
    : `milestone "${m?.title}" of ${planDoc}`;
  const criteria = whole
    ? plan.milestones.map((x) => `${x.title}: ${x.acceptance.join('; ')}`).join('\n')
    : m?.acceptance.join('\n') ?? '';
  return `You are a read-only verifier (tools: Read/Grep/Glob only — no Bash, no edits, no
agents). Judge whether this complete diff satisfies ${subject}. Read that file; criteria:
${criteria}
Deterministic checks already ran:\n${checksSummary}
The complete diff:\n${diff}
Answer with the JSON schema you were given. REWORK only for contract or repo-rule
failures, each finding actionable; BLOCKED only if the contract itself cannot be
satisfied. Style preferences are not findings.`;
}

export function closerPrompt(s: RunState, planDoc: string, gateSummary: string): string {
  return `You are the closing worker for ${planDoc}. Edit ONLY that file (mechanically
enforced): fill its "## Outcome" section from what actually happened — the accepted
commits on ${s.branch} (git log ${s.itemBase.slice(0, 7)}..HEAD), the gate results below,
and any recorded deviations. Say what is true; cite commits. Then git add and commit that
one file with a message starting "docs/TODO/${s.todo}: outcome".
Gate results:\n${gateSummary}
End the commit message with:
Co-Authored-By: Claude (cycle orchestrator, docs/TODO/105) <noreply@anthropic.com>
Final output: under 100 words.`;
}
