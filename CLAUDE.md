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
- `constants:check` has no warning level. Every finding fails the build. Two of
  them are answered in the doc comment rather than by changing the number. Give
  each of two equal values its own `@rule` ID. Write `@domain <file>` when the
  owner check names the wrong home. Argue the right one first.
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
- Maintain a module header that states each file's purpose. A header names its
  neighbours, so a move invalidates one. **The milestone that takes a
  responsibility out of a file repairs that file's header in the same commit**
  (docs/TODO/152). It repairs `docs/ARCHITECTURE.md` in the same commit when the
  map names the file (docs/TODO/166).
- Commit by milestone. Explain what changed, and explain why.

## Communication

Use ASD-STE100 Simplified Technical English in all output to the user. The user
did not read the documents you read. Do not assume that the user knows them.

## Prose

Write the technical prose of this repository in ASD-STE100 Simplified Technical
English. STE is a controlled language for one reader: somebody who must act on a
written instruction, and who cannot ask the author what it meant. This is a
house style.

**A gate checks part of it, over two surfaces.** `npm run ste:check` fails on two
of the rules below: the sentence caps, and the tense. `npm run check` calls it.
It never fails on an `-ing` word. It was report-only until 2026-08-16, and it
gates because a swept file drifted back in one day with nothing to say so
(docs/TODO/154). The two surfaces are:

1. every comment in `src/`;
2. the ten documents this section lists, plus every active TODO item
   (docs/TODO/168).

It reads a document as prose. A code block, a table row and the target of a link
are dropped. A heading takes the title rules above rather than the caps, so this
gate leaves one to `npm run titles:check`.

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

**A title is a sentence, and the same rules hold.** A plan title, an index label
and a commit subject each name a thing to a reader of the title alone. So a
title states a subject and a verb, in the active voice and a simple tense. It
never carries a term that the document defines, because a reader cannot look a
term up from a title.

**A SECTION HEADING IS A LABEL, AND THE RULE STOPS SHORT OF IT** (Chris,
2026-08-16). This sentence said "a heading" until docs/TODO/168 measured the
cost. 73 of the 88 headings in the ten documents below carry no verb.
`docs/PROCESS.md` also mandates a plan shape whose own section names are noun
phrases. A reader of a section heading is already inside the document.

| | title |
| --- | --- |
| write this | The briefing says reputation when it means rating |
| not this | The ban cannot read the pages a player reads |
| not this | The map was not repaired with the headers |
| not this | Behaviour and flight in one file |

The second one hides `the ban`, which only docs/TODO/162 defines. The third is
in the passive voice. The fourth carries no verb at all.

**THE PLAN ARCHIVE IS NOT THE CONVENTION.** Every title under `docs/TODO/` was
written by an agent. Measured on 2026-08-16, 16 of 162 were in the passive
voice, and about 31 were a bare noun phrase. A title copied from that archive
repeats the drift. Read the rule instead.

**`npm run titles:check` holds it**, and `npm run check` calls it. It reads
every plan heading and every index label, and it fails on the two rules a title
can break. Rename the file with the heading. A slug is a title that a code
search reads.

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
  `docs/TODO/completed/`, `research/` and `retired/` reports what happened. So do
  `docs/DEVLOG.md` and `docs/TRAINING-LOG.md`. They instruct nobody. **The index
  at `docs/TODO/README.md` is the one exception, on Chris's call of 2026-08-16.**
  It holds the queue and the dated sections in one file. He chose to hold the
  whole file rather than to split its scope in two.
- **`README.md`'s opening.** It is Chris's own writing, in the first person.
- **The player-facing pages.** The manual, `index.html`, the in-game briefing
  and the novella (Chris, 2026-08-12).
- **`src/constants/CATALOG.md` by hand.** A generator writes it. Edit the doc
  comment in `src/constants/*.ts`, then run `npm run generate:constants`.
