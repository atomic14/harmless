# 128 — The cockpit never says what to press

**Kind:** feature · **Severity:** medium · **Size:** medium (three milestones)
**Depends on:** 122 (the window) and 123 (the offer) — this is what makes both
findable · **GitHub:** none — asked directly by Chris, 2026-08-10

> "What would be really useful for the player would be on screen instructions —
> eg press X to bribe the police for Y, press Z to jettison contraband…"

## Where we are

The game has just grown two keys that only matter for a few seconds at a time,
and it tells you about neither.

`POLICE PATROL CLOSING` names a problem and no answer. The two answers — **O**,
which dumps a tonne of the evidence, and **L**, which offers him money — are
discoverable from the `?` guide, the manual and the README, all of which are
places you are not looking while a Viper closes on your narcotics. The price of
the bribe is not anywhere at all until you press the key and find out.

The one place the game already does this right is the strand:

```ts
// world-step.ts:550
out.push(say('NO FUEL TO JUMP — PRESS B FOR THE DISTRESS BEACON', 5));
```

...and it is also the shape of the problem, because **that B is a literal in a
string**. Invariant 9 says a binding has one home and every surface renders from
it; this line is a sixth surface, hand-written, and it lies the moment anything
rebinds `distressBeacon`. `game.ts:611` does the same with `?` and `B`.

So the feature Chris is asking for and the defect next door are the same job:
**the cockpit should say what a key can do about what is happening right now,
and it must say it in the key the table actually binds.**

## What to do

Three parts, and only the first is new machinery.

### The rule: `game/prompts.ts`

A new pure module. It answers ONE question — *what can a key do about this,
right now?* — and returns data, never text with a key in it:

```ts
export interface Prompt {
  /** which command; the LABEL is looked up from the binding table, never here */
  readonly command: Command;
  /** what pressing it does about this, in the player's words */
  readonly what: string;
}

export function flightPrompts(view: PromptWorld): Prompt[];
```

It is pure and portable, so it is tested headlessly at both ends: the condition
that raises a prompt, and the words the prompt carries. It may price things —
`inspectionPrice`, `patrolPrice` and `formatCredits` are all pure — because
"press L to pay **141.0 Cr**" is exactly what was asked for and a prompt with no
number in it is a worse answer.

**The key label is applied at the edge.** `boundKey('flight', command)` lives in
`ui/key-help.ts`, which a headless step may not import (`tools/portability.mjs`
counts `ui/` as PLATFORM). `game.ts` is the composition root, already imports
`boundKey`, and already hands the HUD finished strings for the message line — so
it renders `${boundKey('flight', p.command)} ${p.what}` and passes them down.
That is the whole of invariant 9's compliance: no letter is ever written in a
rule module.

### The surface: a prompt line of its own

A new `#prompts` element under `#message`, painted by `hud/hud.ts` from a new
`HudFrame.prompts: readonly string[]`.

**Not the message line.** The console is deliberately ONE line — 122's whole
verdict mechanism exists to queue behind it — and a prompt is not an event: it
is true for as long as the situation is, and it must not fight `CONTRABAND
DETECTED` for the same space or expire while the patrol is still there.

Capped, and ranked by urgency. Two at once is the most the cockpit should carry;
a third is a menu. The cap is a constant with the reason beside it.

### The moments

M1 does the police window; M2 does the rest; each one is a condition that is
already computed somewhere and a phrase.

| when | prompt |
| --- | --- |
| patrol in 122's band, dirty hold | `L PAY 141.0 Cr` · `O DUMP EVIDENCE` |
| police engaging you | `L PAY 300.0 Cr TO BREAK OFF` |
| pirates engaging, cargo aboard | `Y JETTISON A TONNE` |
| hostile missile in the air | `E FIRE E.C.M.` (only if fitted) |
| stranded in witch-space, no fuel | `B DISTRESS BEACON` |
| station in scanner range | `C DOCKING COMPUTER` (only if fitted) |

Every one is gated on the equipment actually being aboard: a prompt for a key
that will answer `NOT FITTED` is worse than silence.

## Decisions already made

- **Every moment a key is the answer** (Chris, 2026-08-10), not the police
  window alone — and not a permanent key strip, which spends screen the 1984
  cockpit deliberately leaves empty.
- **Ahead of 127 and 126** (Chris, same): a feature nothing points at is a
  feature nobody finds.
- **Prompts are state, not messages.** They appear and disappear with the
  condition and have no timer of their own.
- **No rule module ever writes a key letter.** The prompt carries a `Command`;
  the label comes from `controls.ts` through `boundKey`, at the edge.
- **Prices belong in the prompt.** "Press L to bribe the police for Y" is the
  request; the pure price functions make it free to answer honestly.

## Open questions — answered here

- **Does a prompt repeat like `POLICE PATROL CLOSING` does?** No — it is not a
  message. The warning keeps its two-second repeat because it is an event about
  a geometry; the prompt simply IS while the geometry is.
- **Does the training simulator get prompts?** Only for the keys it has. The
  arena has no hold, no law and no station, so every M1/M2 moment except the
  missile is impossible there by construction; nothing extra is needed, and a
  test says so rather than a filter.
- **What about the station menu?** Out of scope. The menu already renders its
  keys from the table (`ui/key-help.ts`), which is exactly what this brings to
  the cockpit.

## Watch out for

- **`ui/` is PLATFORM.** `game/prompts.ts` must not import it, or the
  portability gate fails and the step stops running headlessly.
- **Invariant 9's four surfaces** are untouched — no new binding — but the new
  `#prompts` host must exist in `play.html` for the painter, the way every other
  HUD element does.
- **The snapshot.** Prompts are derived, not state: nothing new goes in
  `SessionState`, so nothing new goes in the save.
- **Allocation per frame.** `buildHudFrame` is called every frame and allocates
  nothing today by design; the prompt list must stay small and must not build
  strings when there is nothing to say.
- **The strand line already exists.** M2 deletes it rather than leaving a
  hard-coded `B` beside a rendered one — two surfaces saying the same thing is
  what this plan exists to end.

## Verification

Tier: pure tests for the rule (the condition and the words), one HUD-frame test
that the strings carry the key the table binds, and one flown assertion per
milestone that the line appears and clears with the situation.

- **M1** — pure: a patrol in the band with contraband raises exactly the two
  prompts, in urgency order, with the bribe's price equal to `inspectionPrice`
  of that hold; a clean hold raises neither; a patrol beyond the band raises
  neither; once `policeScanned` latches, both go quiet. Flown: through the real
  Game, the prompt line appears while the warning does and is empty after the
  offer is taken.
- **M1 join** — the rendered string starts with `boundKey('flight',
  'bribePolice')`, and REBINDING the command in the table rewrites the prompt.
  That is the test that stops the letter drifting back into the words.
- **M2** — one pure case per moment, each with its control (no ECM fitted → no
  E.C.M. prompt; no docking computer → no docking prompt; empty hold → no
  jettison prompt). Flown: the strand prompt replaces the deleted message.
- **M2 cap** — with three conditions true at once, exactly the cap's worth
  appear, and they are the most urgent ones.
- **M3** — a source scan: no message string in `src/game/` names a key. Prove it
  fails by putting `PRESS B` back in a message.
- Prove the gates can fail: drop the `policeScanned` guard (prompts survive a
  scan that has already happened), and hard-code a letter (M3's scan fires).
- `npm run check` at the end of each milestone; commit per milestone.
