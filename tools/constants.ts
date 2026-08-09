// Generate, search and check src/constants/.
//
//   npm run generate:constants
//   npm run constants:find -- "missile lock range"
//   npm run constants:check

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  findConstants, loadConstants, renderCatalogue,
} from './constants-lib.ts';
import {
  changedConstantDiagnostics, changedConstantKeys, ruleDiagnostics,
} from './constants-check.ts';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const cataloguePath = join(root, 'src', 'constants', 'CATALOG.md');
const command = process.argv[2];

try {
  const model = loadConstants(root);
  if (command === 'generate') generate(model);
  else if (command === 'find') find(model, process.argv.slice(3).join(' '));
  else if (command === 'check') check(model);
  else usage();
} catch (error) {
  console.error(`constants: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

function generate(model: ReturnType<typeof loadConstants>): void {
  const wanted = renderCatalogue(model);
  const current = existsSync(cataloguePath) ? readFileSync(cataloguePath, 'utf8') : null;
  if (current === wanted) console.log(`constants: CATALOG.md already current (${model.entries.length} exports)`);
  else {
    writeFileSync(cataloguePath, wanted);
    console.log(`constants: wrote CATALOG.md (${model.entries.length} exports)`);
  }
}

function find(model: ReturnType<typeof loadConstants>, query: string): void {
  if (!query.trim()) {
    console.error('usage: npm run constants:find -- "<name, meaning, or value>"');
    process.exitCode = 1;
    return;
  }
  const matches = findConstants(model, query);
  console.log(`constants: ${matches.length} match(es) for "${query}"`);
  for (const entry of matches.slice(0, 25)) {
    const expression = entry.expression.length > 180
      ? `${entry.expression.slice(0, 177)}...` : entry.expression;
    console.log(`\n${entry.symbol} = ${expression}`);
    console.log(`  ${entry.source}:${entry.line} · domain ${entry.domain}`
      + (entry.ruleIds.length ? ` · @rule ${entry.ruleIds.join(', ')}` : ''));
    if (entry.docFirstSentence) console.log(`  ${entry.docFirstSentence}`);
  }
  if (matches.length > 25) console.log(`\n...and ${matches.length - 25} more`);
}

function check(model: ReturnType<typeof loadConstants>): void {
  const diagnostics = [
    ...ruleDiagnostics(model),
    ...changedConstantDiagnostics(model, changedConstantKeys(root, model)),
  ];
  const wanted = renderCatalogue(model);
  const current = existsSync(cataloguePath) ? readFileSync(cataloguePath, 'utf8') : null;
  if (current !== wanted) diagnostics.push({
    level: 'error', code: 'catalogue',
    message: 'src/constants/CATALOG.md is stale; run npm run generate:constants',
  });

  for (const diagnostic of diagnostics) {
    const stream = diagnostic.level === 'error' ? console.error : console.warn;
    stream(`${diagnostic.level.toUpperCase()} [${diagnostic.code}] ${diagnostic.message}`);
  }
  const errors = diagnostics.filter((diagnostic) => diagnostic.level === 'error').length;
  const warnings = diagnostics.length - errors;
  if (errors) {
    console.error(`constants: ${errors} error(s), ${warnings} warning(s)`);
    process.exitCode = 1;
  } else {
    console.log(`constants: ${model.entries.length} exports, ${model.rules.length} rule ids,`
      + ` ${warnings} warning(s) — catalogue current`);
  }
}

function usage(): void {
  console.error('usage: constants.ts <generate | find QUERY | check>');
  process.exitCode = 1;
}
