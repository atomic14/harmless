// Diff-scoped duplicate/ownership checks and the global @rule uniqueness gate.
// The AST model is in constants-lib.ts; this file decides what must fail.

import { execFileSync } from 'node:child_process';

import type { ConstantEntry, ConstantsModel, RuleOwner } from './constants-lib.ts';

export interface ConstantDiagnostic {
  readonly level: 'error' | 'warning';
  readonly code: 'catalogue' | 'doc' | 'domain' | 'expression' | 'name' | 'rule' | 'value';
  readonly message: string;
}

const entryKey = (entry: ConstantEntry): string => `${entry.source}:${entry.symbol}`;

/** Global @rule validation: ids are namespaced and have exactly one owner. */
export function ruleDiagnostics(model: ConstantsModel): readonly ConstantDiagnostic[] {
  const diagnostics: ConstantDiagnostic[] = [];
  const byId = new Map<string, RuleOwner[]>();
  for (const rule of model.rules) {
    if (!/^[a-z][a-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/.test(rule.id)) {
      diagnostics.push({
        level: 'error', code: 'rule',
        message: `${rule.source}:${rule.line} has invalid @rule id "${rule.id}"`,
      });
    }
    const owners = byId.get(rule.id) ?? [];
    owners.push(rule);
    byId.set(rule.id, owners);
  }
  for (const [id, owners] of byId) {
    if (owners.length !== 1) diagnostics.push({
      level: 'error', code: 'rule',
      message: `@rule ${id} has ${owners.length} owners: `
        + owners.map((owner) => `${owner.owner} (${owner.source}:${owner.line})`).join(', '),
    });
  }
  return diagnostics;
}

/** Find current constants whose declarations/initialisers intersect the git diff. */
export function changedConstantKeys(root: string, model: ConstantsModel): ReadonlySet<string> {
  const ranges = changedRanges(root);
  const result = new Set<string>();
  for (const entry of model.entries) {
    const fileRanges = ranges.get(entry.source) ?? [];
    if (fileRanges.some(([start, end]) => start <= entry.endLine && end >= entry.line)) {
      result.add(entryKey(entry));
    }
  }
  return result;
}

function changedRanges(root: string): ReadonlyMap<string, readonly (readonly [number, number])[]> {
  const ranges = new Map<string, [number, number][]>();
  let diff = '';
  let untracked = '';
  try {
    diff = execFileSync('git', ['diff', '--unified=0', '--no-color', 'HEAD', '--', 'src/constants'], {
      cwd: root, encoding: 'utf8',
    });
    untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'src/constants'], {
      cwd: root, encoding: 'utf8',
    });
  } catch { return ranges; }

  let file = '';
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) { file = line.slice(6); continue; }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!file || !hunk) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    if (count > 0) addRange(ranges, file, start, start + count - 1);
  }
  for (const name of untracked.trim().split('\n').filter(Boolean)) {
    addRange(ranges, name, 1, Number.MAX_SAFE_INTEGER);
  }
  return ranges;
}

function addRange(
  ranges: Map<string, [number, number][]>,
  file: string,
  start: number,
  end: number,
): void {
  const current = ranges.get(file) ?? [];
  current.push([start, end]);
  ranges.set(file, current);
}

/** Diff-scoped documentation, duplication and likely-owner checks. */
export function changedConstantDiagnostics(
  model: ConstantsModel,
  changed: ReadonlySet<string>,
): readonly ConstantDiagnostic[] {
  const diagnostics: ConstantDiagnostic[] = [];
  const seen = new Set<string>();
  const added = (diagnostic: ConstantDiagnostic): void => {
    const key = `${diagnostic.level}:${diagnostic.code}:${diagnostic.message}`;
    if (!seen.has(key)) { diagnostics.push(diagnostic); seen.add(key); }
  };

  for (const entry of model.entries.filter((candidate) => changed.has(entryKey(candidate)))) {
    const at = `${entry.source}:${entry.line} ${entry.symbol}`;
    if (!entry.doc) added({
      level: 'error', code: 'doc', message: `${at} needs a JSDoc comment explaining its rule`,
    });

    const others = model.entries.filter((other) => entryKey(other) !== entryKey(entry));
    const sameName = others.filter((other) => other.symbol === entry.symbol);
    if (sameName.length) added({
      level: 'error', code: 'name', message: `${at} duplicates the name at ${locations(sameName)}`,
    });

    const sameExpression = others.filter((other) => other.normalizedExpression
      === entry.normalizedExpression && !separateRules(entry, other));
    if (entry.literalKey === null && sameExpression.length) added({
      level: 'error', code: 'expression',
      message: `${at} duplicates the expression at ${locations(sameExpression)}`,
    });

    if (entry.literalKey !== null) {
      const sameValue = others.filter((other) => other.literalKey === entry.literalKey
        && !separateRules(entry, other));
      if (sameValue.length) added({
        level: 'warning', code: 'value',
        message: `${at} repeats ${entry.expression} at ${locations(sameValue)}; confirm the meanings differ`
          + ' or give both rules distinct @rule ids',
      });
    }

    const owner = likelyOwner(entry, model.entries);
    if (owner) added({
      level: 'warning', code: 'domain',
      message: `${at} resembles the ${owner} domain more than ${entry.domain}; confirm its owner`,
    });
  }
  return diagnostics;
}

const locations = (entries: readonly ConstantEntry[]): string => entries.slice(0, 5)
  .map((entry) => `${entry.source}:${entry.line} (${entry.symbol})`).join(', ')
  + (entries.length > 5 ? ` and ${entries.length - 5} more` : '');

function separateRules(a: ConstantEntry, b: ConstantEntry): boolean {
  return a.ruleIds.length > 0 && b.ruleIds.length > 0
    && a.ruleIds.every((id) => !b.ruleIds.includes(id));
}

const OWNER_STOP = new Set([
  'a', 'an', 'and', 'base', 'constant', 'default', 'extra', 'for', 'from', 'in',
  'limit', 'max', 'min', 'of', 'per', 'rate', 'range', 'scale', 'seconds', 'span',
  'the', 'to', 'value', 'with',
]);

function likelyOwner(entry: ConstantEntry, entries: readonly ConstantEntry[]): string | null {
  const tokens = [...new Set(entry.symbol.toLowerCase()
    .split(/[^a-z0-9]+/).filter((token) => token.length > 1 && !OWNER_STOP.has(token)))];
  if (tokens.length < 2) return null;
  const domains = new Map<string, string>();
  domains.set(entry.domain, entry.filePurpose.toLowerCase());
  for (const candidate of entries) {
    if (entryKey(candidate) === entryKey(entry)) continue;
    domains.set(candidate.domain, (`${domains.get(candidate.domain) ?? ''} ${candidate.symbol}`
      + ` ${candidate.doc} ${candidate.filePurpose}`).toLowerCase());
  }
  const scores = [...domains].map(([domain, corpus]) => ({
    domain,
    score: tokens.filter((token) => corpus.includes(token)).length,
  })).sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
  const current = scores.find((score) => score.domain === entry.domain)?.score ?? 0;
  const best = scores.find((score) => score.domain !== entry.domain);
  return best && best.score >= 2 && best.score > current ? best.domain : null;
}
