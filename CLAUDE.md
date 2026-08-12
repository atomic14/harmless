# CLAUDE.md — working on HARMLESS

HARMLESS is an unofficial, non-commercial browser tribute to Elite (1984). It
uses TypeScript, Vite and three.js. Keep that description. Keep the
MIT/fan-project notice.

## Code intelligence

LSP means Language Server Protocol. The LSP tool reads code structure.
Prefer the LSP tool to Grep, Glob and Read for code navigation.

- `goToDefinition` and `goToImplementation` jump to the source.
- `findReferences` lists every use in the codebase.
- `workspaceSymbol` finds a symbol by name.
- `documentSymbol` lists every symbol in one file.
- `hover` gives type information. It does not load the file.
- `incomingCalls` and `outgoingCalls` give the call hierarchy.

Use `findReferences` before you rename a function. Use it before you change
a signature. It finds every call site.

Use Grep and Glob for text searches only. Examples are comments, strings and
config values. LSP does not help with those.

The LSP server reports type errors after each edit. Fix an error at once.

## Sources of truth

- When the documentation and the code disagree, the code that runs is correct.
- `docs/INVARIANTS.md` lists the rules that must not break. The code cites those
  rules by number. Never renumber a rule. Append a new rule instead.
- `docs/ARCHITECTURE.md` maps the system. `docs/TODO/README.md` indexes the
  active plans. Open `completed/`, `research/` or `retired/` only to find one
  specific historical decision. `docs/PROCESS.md` defines delivery.

## Working rules

- Diagnose from the code that runs. Do this before you edit. Fix the cause. Do
  not fix a symptom that merely looks correct.
- Correctness beats speed, but context is finite. Read the files that the change
  touches. Use targeted tests while you work. Run the full gates
  (`npm run check`) one time at the end. Hand off at a clear checkpoint.
- Report only what you measured or ran. State a failure plainly. State
  uncertainty plainly.
- Give every rule one home. Delete a duplicate rule. Do not hold two copies in
  step with each other.
- Use `src/constants/CATALOG.md` as the index before you add or change a
  constant. Do not load the whole directory. Run
  `npm run constants:find -- "<query>"` first. Query the proposed name, at least
  two conceptual synonyms, and the value. Read the likely owner and the matches.
  Document the rule. Add a distinct `@rule` ID for each constant when two equal
  values must stay independent. Run `npm run generate:constants` after you add,
  change or remove a constant. Then run `npm run constants:check`.
- Put a constant's rationale beside it. Record the alternatives that matter where
  the next maintainer will look.

## Design direction

One world state exists. A fixed, seeded step advances it. Rendering only reads
it.

- Training uses the real game rules. It never uses a copy of the physics or of
  the combat logic.
- A module decides and returns an event. An orchestrator applies the
  consequence.
- Data that changes behaviour is saved state. It is never an ambient global.
- Platform access stays behind `engine/shell.ts`, so the game runs headlessly.
- `game/brain-names.ts` owns the pilot assignments. The shipped pilots are
  hand-written today. The code loads no trained weights.

## Validation

- New behaviour needs a test. A change to a rule updates the test that pins that
  rule.
- Prove that a new gate can fail. To prove it, break the protected rule for a
  moment.
- Assert behaviour. Do not assert an implementation against itself.
- Check a sampled number at two sample sizes before it drives a decision.
- Keep lint and tests in the build path.

## Style

- Prefer small files with one purpose each. Exceed the size ceiling only with a
  stated reason. Never delete useful content only to fit that ceiling.
- Maintain a module header that states each file's purpose.
- Commit by milestone. Explain what changed, and explain why.

## Prose

Write the technical prose of this repository in ASD-STE100 Simplified Technical
English. STE is a controlled language for one reader: somebody who must act on a
written instruction, and who cannot ask the author what it meant. This is a
house style. No gate checks it (Chris, 2026-08-12).

The rules are countable:

| rule | limit |
| --- | --- |
| sentence length | 20 words for an instruction; 25 for descriptive text |
| one instruction per sentence | do not join two instructions with "and" or "then" |
| voice | active. Use the passive only in descriptive text, and only where the actor does not matter |
| tense | the infinitive, the imperative, the simple present, the simple past and the simple future. A past participle is an adjective only |
| `-ing` forms | a technical noun only — `rendering`, `training`, `spawning`, `docking` — never a verb |
| noun clusters | 3 words as a modifier |
| one word, one meaning | repeat the term; never reach for a synonym for variety |
| domain terms | define a term at its first use |
| ellipsis | none. Keep the subject, the verb and the article |
| vertical lists | 3 or more steps or conditions become a list |

**Length is not terseness.** The caps are per sentence, never per document. A
long answer in short sentences is the correct outcome. Never drop a fact, a
condition or a scope qualifier to meet a limit. Split the sentence instead.

**"One word, one meaning" already holds here, and it cuts both ways.** `brain`,
`commander`, `face`, `rung`, `gate`, `probe` and `tell` are used precisely.
Keep each of them.

It covers `CLAUDE.md`, `docs/INVARIANTS.md`, `docs/PROCESS.md`,
`docs/ARCHITECTURE.md`, the six reference docs in `docs/`, the doc comments on
the constants in `src/constants/`, and each TODO item. It also covers every new
or changed comment in `src/`, so that surface converts as you edit the files.

It never touches:

- **Code.** An identifier, the syntax and a string literal stay as they are.
- **Text where the exact wording carries the meaning.** A command to run, an API
  name, a config key, an exact error string, and quoted command output.
- **Anything quoted from a person.** To rewrite a quotation is falsification,
  not simplification.
- **A record of what somebody decided or measured.** The plan archive under
  `docs/TODO/`, `docs/DEVLOG.md` and `docs/TRAINING-LOG.md` report what
  happened. They instruct nobody.
- **`README.md`'s opening.** It is Chris's own writing, in the first person.
- **The player-facing pages.** The manual, `index.html`, the in-game briefing
  and the novella (Chris, 2026-08-12).
- **`src/constants/CATALOG.md` by hand.** A generator writes it. Edit the doc
  comment in `src/constants/*.ts`, then run `npm run generate:constants`.
