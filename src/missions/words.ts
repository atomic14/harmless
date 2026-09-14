// The words a model writes: a patron, and a mission's dossier.
//
// A PATRON is the person who offers a mission, by name, role and voice
// (`patrons.ts`). A DOSSIER is one mission's generated words, written
// offline and committed as JSON (`dossiers.ts`, docs/TODO/191). The machine
// never reads either, so generated text can never change what a mission
// does (docs/TODO/190). These shapes left `model.ts` when docs/TODO/213 M5
// pushed it over the size ceiling. The rules stay there.

export interface Patron {
  id: string;
  world: number | 'navy' | 'wheel';
  name: string;
  role: string;
  species: string;
  voice: string;
  /** image path; '' uses the world's portrait */
  portrait: string;
}

/**
 * A mission's generated words. Each field may carry the slots its comment
 * names and no other, and `tools/dossier-faults.ts` holds that (docs/TODO/191).
 */
export interface Dossier {
  skeleton: string;
  /** the prompt hash it was written from, which covers the skeleton's shape */
  hash: string;
  /** a name for the mission, with no slot */
  title: string;
  /** pages the patron speaks, with {PATRON} {HERE} */
  briefing: string[];
  /** by leg: the console's word on the leg, with {TARGET} {PAY} */
  legs: Record<string, { arrive: string; success: string; fail: string }>;
  /** the LEADS row, with {PATRON} {WORLD} */
  lead: string;
  /** the board's rumour inside the rumour range, and the message one jump out, with {PATRON} {WORLD} */
  rumour: { far: string; near: string };
  /** the DATA ON line, with {PATRON} {WORLD} */
  news: string;
  /** paths under `public/`; an absent file degrades to no image */
  images: { target?: string; place?: string };
  story: {
    /** with {WORLD} {DAY} */
    opening: string;
    closing: { complete: string; fail: string };
    /** by leg, then by trigger label (`triggerLabel`, machine.ts), with {WORLD} {DAY} */
    legs: Record<string, Record<string, string>>;
  };
}

/** One committed dossier file, with what the run that wrote it cost. */
export interface DossierFile {
  promptVersion: number;
  model: string;
  generated: string;
  usage: { requests: number; inputTokens: number; outputTokens: number };
  dossier: Dossier;
}
