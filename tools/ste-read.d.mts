// The types for `tools/ste-read.mjs`, so a TypeScript file may read it.
//
// `tools/` is plain JavaScript, and `tsconfig.json` sets no `allowJs`. So an
// import from `test/` or `src/` has no type at all without this file.
// `test/ladder-scan.ts` is the first such reader, and docs/TODO/171 M1 is why.
//
// This file declares the module's whole surface rather than the three members
// that one caller wants. A partial declaration would make the next import an
// error for no reason a reader could see.

/** One comment, as the reader found it in the source. */
export interface Comment {
  /** The 1-based line the comment starts on. */
  line: number;
  /** The comment body, with the opening marker taken off. */
  text: string;
  /** True for a block comment, false for a line comment. */
  block: boolean;
}

/** One physical line of a comment run. */
export interface RunLine {
  line: number;
  text: string;
}

/** One paragraph, joined from its lines, with the line it starts on. */
export interface Paragraph {
  line: number;
  text: string;
}

/** One prose sentence, with the line its paragraph starts on. */
export interface ProseSentence {
  line: number;
  sentence: string;
}

export function comments(src: string): Comment[];
export function runs(pieces: Comment[]): RunLine[][];
export function paragraphs(run: RunLine[]): Paragraph[];
export function prose(text: string): string;
export function sentences(text: string): string[];
export function words(s: string): string[];
export function proseOf(src: string): ProseSentence[];
