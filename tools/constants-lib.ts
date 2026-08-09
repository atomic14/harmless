// The constants catalogue's source model. TypeScript's AST finds exported
// declarations and their JSDoc; generation, search and checks all read this.

import { basename, join, relative } from 'node:path';

import { API } from 'typescript/unstable/sync';
import {
  createScanner, getTextOfJSDocComment, isAsExpression, isIdentifier, isJSDoc,
  isNoSubstitutionTemplateLiteral, isNumericLiteral, isParenthesizedExpression,
  isPrefixUnaryExpression, isPropertyAssignment, isSatisfiesExpression,
  isStringLiteral, isVariableStatement, LanguageVariant, NodeFlags, SyntaxKind,
  type Expression, type Node, type SourceFile,
} from 'typescript/unstable/ast';

export interface ConstantEntry {
  readonly domain: string;
  readonly symbol: string;
  readonly expression: string;
  readonly normalizedExpression: string;
  readonly literalKey: string | null;
  readonly doc: string;
  readonly docFirstSentence: string;
  readonly filePurpose: string;
  readonly ruleIds: readonly string[];
  readonly source: string;
  readonly line: number;
  readonly endLine: number;
}

export interface RuleOwner {
  readonly id: string;
  readonly owner: string;
  readonly source: string;
  readonly line: number;
}

export interface ConstantsModel {
  readonly entries: readonly ConstantEntry[];
  readonly rules: readonly RuleOwner[];
}

interface DocInfo {
  readonly text: string;
  readonly ruleIds: readonly string[];
}

/** Read every exported const under src/constants/ from the configured project. */
export function loadConstants(root: string): ConstantsModel {
  const api = new API({ cwd: root });
  const snapshot = api.updateSnapshot({ openProjects: [join(root, 'tsconfig.json')] });
  try {
    const project = snapshot.getProjects()
      .find((candidate) => candidate.configFileName === join(root, 'tsconfig.json'))
      ?? snapshot.getProjects()[0];
    if (!project) throw new Error('TypeScript did not load tsconfig.json');

    const entries: ConstantEntry[] = [];
    const rules: RuleOwner[] = [];
    const prefix = join(root, 'src', 'constants') + '/';
    const names = project.program.getSourceFileNames()
      .filter((name) => name.startsWith(prefix) && name.endsWith('.ts'))
      .sort();

    for (const name of names) {
      const sourceFile = project.program.getSourceFile(name);
      if (!sourceFile) throw new Error(`TypeScript did not return ${name}`);
      readSourceFile(root, sourceFile, entries, rules);
    }
    entries.sort((a, b) => a.domain.localeCompare(b.domain) || a.line - b.line);
    rules.sort((a, b) => a.id.localeCompare(b.id) || a.owner.localeCompare(b.owner));
    return { entries, rules };
  } finally {
    snapshot.dispose();
    api.close();
  }
}

function readSourceFile(
  root: string,
  sourceFile: SourceFile,
  entries: ConstantEntry[],
  rules: RuleOwner[],
): void {
  const source = relative(root, sourceFile.fileName).replaceAll('\\', '/');
  const domain = basename(sourceFile.fileName, '.ts');
  const filePurpose = headerPurpose(sourceFile.text);

  for (const statement of sourceFile.statements) {
    if (!isVariableStatement(statement)
      || !(statement.declarationList.flags & NodeFlags.Const)
      || !statement.modifiers?.some((modifier) => modifier.kind === SyntaxKind.ExportKeyword)) {
      continue;
    }
    const statementDoc = docInfo(statement);
    for (const declaration of statement.declarationList.declarations) {
      if (!isIdentifier(declaration.name) || !declaration.initializer) continue;
      const symbol = declaration.name.text;
      const line = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1;
      const endLine = sourceFile.getLineAndCharacterOfPosition(declaration.getEnd()).line + 1;
      const expression = withoutComments(declaration.initializer.getText(sourceFile));
      const nestedRuleIds: string[] = [];
      collectNestedRules(declaration.initializer, symbol, sourceFile, source, rules, nestedRuleIds);
      entries.push({
        domain,
        symbol,
        expression,
        normalizedExpression: normalizeExpression(declaration.initializer.getText(sourceFile)),
        literalKey: primitiveLiteralKey(declaration.initializer),
        doc: statementDoc.text,
        docFirstSentence: firstSentence(statementDoc.text),
        filePurpose,
        ruleIds: [...statementDoc.ruleIds, ...nestedRuleIds],
        source,
        line,
        endLine,
      });
      addRuleOwners(statementDoc.ruleIds, symbol, source, line, rules);
    }
  }
}

function collectNestedRules(
  node: Node,
  parentOwner: string,
  sourceFile: SourceFile,
  source: string,
  rules: RuleOwner[],
  entryRuleIds: string[],
): void {
  const owner = isPropertyAssignment(node)
    ? `${parentOwner}.${propertyName(node.name, sourceFile)}`
    : parentOwner;
  const info = docInfo(node);
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  addRuleOwners(info.ruleIds, owner, source, line, rules);
  entryRuleIds.push(...info.ruleIds);
  node.forEachChild((child) => collectNestedRules(
    child, owner, sourceFile, source, rules, entryRuleIds,
  ));
}

function propertyName(node: Node, sourceFile: SourceFile): string {
  if (isIdentifier(node) || isStringLiteral(node) || isNumericLiteral(node)) return node.text;
  return node.getText(sourceFile);
}

function addRuleOwners(
  ids: readonly string[],
  owner: string,
  source: string,
  line: number,
  rules: RuleOwner[],
): void {
  for (const id of ids) rules.push({ id, owner, source, line });
}

function docInfo(node: Node): DocInfo {
  const docs = (node.jsDoc ?? []).filter(isJSDoc);
  const text = docs.map((doc) => getTextOfJSDocComment(doc.comment) ?? '')
    .filter(Boolean).join('\n\n').replace(/\s+/g, ' ').trim();
  const ruleIds = docs.flatMap((doc) => [...(doc.tags ?? [])]
    .filter((tag) => tag.tagName.text === 'rule')
    .map((tag) => (getTextOfJSDocComment(tag.comment) ?? '').replace(/\s+/g, ' ').trim()));
  return { text, ruleIds };
}

function headerPurpose(source: string): string {
  const lines = source.split(/\r?\n/);
  const result: string[] = [];
  for (const line of lines) {
    if (line.startsWith('//')) { result.push(line.replace(/^\/\/\s?/, '')); continue; }
    if (line.trim() === '' && result.length > 0) break;
    if (line.trim() !== '') break;
  }
  return result.join(' ').replace(/\s+/g, ' ').trim();
}

function firstSentence(text: string): string {
  if (!text) return '';
  const end = text.search(/[.!?](?=\s+(?:[A-Z`“"']|$)|$)/);
  return end < 0 ? text : text.slice(0, end + 1);
}

/** Remove comment trivia without being fooled by comment markers inside strings. */
function withoutComments(source: string): string {
  const scanner = createScanner(false, LanguageVariant.Standard, source);
  let result = '';
  for (let kind = scanner.scan(); kind !== SyntaxKind.EndOfFile; kind = scanner.scan()) {
    if (kind !== SyntaxKind.SingleLineCommentTrivia
      && kind !== SyntaxKind.MultiLineCommentTrivia) result += scanner.getTokenText();
  }
  return result.replace(/\s+/g, ' ').trim();
}

/** Whitespace, comments and numeric separators do not make expressions distinct. */
function normalizeExpression(source: string): string {
  const scanner = createScanner(true, LanguageVariant.Standard, source);
  const tokens: string[] = [];
  for (let kind = scanner.scan(); kind !== SyntaxKind.EndOfFile; kind = scanner.scan()) {
    const value = kind === SyntaxKind.NumericLiteral
      ? scanner.getTokenText().replaceAll('_', '')
      : kind === SyntaxKind.StringLiteral
        ? JSON.stringify(scanner.getTokenValue())
        : scanner.getTokenText();
    tokens.push(`${kind}:${value}`);
  }
  return tokens.join('|');
}

function primitiveLiteralKey(expression: Expression): string | null {
  let current = expression;
  while (isParenthesizedExpression(current)
    || isAsExpression(current)
    || isSatisfiesExpression(current)) current = current.expression;

  if (isNumericLiteral(current)) return `number:${Number(current.text.replaceAll('_', ''))}`;
  if (isStringLiteral(current) || isNoSubstitutionTemplateLiteral(current)) {
    return `string:${current.text}`;
  }
  if (isPrefixUnaryExpression(current) && isNumericLiteral(current.operand)) {
    const sign = current.operator === SyntaxKind.MinusToken ? -1
      : current.operator === SyntaxKind.PlusToken ? 1 : null;
    if (sign !== null) return `number:${sign * Number(current.operand.text.replaceAll('_', ''))}`;
  }
  return null;
}

/** Render the committed, generated review surface. */
export function renderCatalogue(model: ConstantsModel): string {
  const rows = model.entries.map((entry) => {
    const rules = entry.ruleIds.length ? entry.ruleIds.map(codeCell).join('<br>') : '';
    return `| ${cell(entry.domain)} | ${codeCell(entry.symbol)} | ${codeCell(entry.expression)}`
      + ` | ${cell(entry.docFirstSentence)} | ${rules}`
      + ` | [${entry.source.replace('src/constants/', '')}:${entry.line}]`
      + `(./${entry.source.replace('src/constants/', '')}#L${entry.line}) |`;
  });
  return `# Constants catalogue

<!-- Generated by tools/constants.ts. Do not edit by hand. -->

${model.entries.length} exported constants. Regenerate with \`npm run generate:constants\`;
search names, meanings and values with \`npm run constants:find -- "<query>"\`.

| Domain | Symbol | Literal / expression | Purpose | Rule ID | Source |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
`;
}

const cell = (value: string): string => value.replaceAll('&', '&amp;')
  .replaceAll('|', '&#124;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const codeCell = (value: string): string => `<code>${cell(value)}</code>`;

/** Ranked semantic-text search over the model; no generated file is parsed. */
export function findConstants(model: ConstantsModel, query: string): readonly ConstantEntry[] {
  const phrase = query.trim().toLowerCase();
  if (!phrase) return [];
  const terms = phrase.split(/\s+/).filter(Boolean);
  return model.entries.map((entry) => {
    const fields = {
      symbol: entry.symbol.toLowerCase(),
      domain: entry.domain.toLowerCase(),
      expression: entry.expression.toLowerCase(),
      doc: entry.doc.toLowerCase(),
      purpose: entry.filePurpose.toLowerCase(),
      rules: entry.ruleIds.join(' ').toLowerCase(),
    };
    const haystack = Object.values(fields).join(' ');
    if (!terms.every((term) => haystack.includes(term))) return { entry, score: -1 };
    let score = fields.symbol === phrase ? 100 : 0;
    if (fields.symbol.includes(phrase)) score += 30;
    if (fields.rules.includes(phrase)) score += 24;
    if (fields.domain.includes(phrase)) score += 18;
    if (fields.expression.includes(phrase)) score += 12;
    if (fields.doc.includes(phrase)) score += 10;
    if (fields.purpose.includes(phrase)) score += 5;
    score += terms.filter((term) => fields.symbol.includes(term)).length * 4;
    return { entry, score };
  }).filter((result) => result.score >= 0)
    .sort((a, b) => b.score - a.score || a.entry.symbol.localeCompare(b.entry.symbol))
    .map((result) => result.entry);
}
