# 157 — The console line runs off both edges

**Kind:** defect · **Severity:** medium · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #29 — *"Constrictor mission - popup
text didn't show all lines"*

Chris confirmed the surface on 2026-08-15: it is the amber console line, the one
that gets a bordered plate while a station screen is open. It is not the NAVY
MISSIONS screen and it is not the docked menu.

## Where we are

**The console is one line, and that line cannot wrap.** `#message`
(`src/style.css:370`) declares `white-space: nowrap` and no width at all. It is
centred on `left: 50%` with `transform: translateX(-50%)`.

**So a line wider than the window hangs off BOTH edges.** The commander reads
the middle of the sentence. The two ends are the parts that leave the screen.

**The Constrictor gun warning is the longest string the console can print.**
`constrictorWarning` (`src/game/missions.ts:172`) says, for a beam laser fitted:

```
NAVY: TARGET ARMOUR HALVES LASER FIRE — YOUR BEAM LASER SCORES 3 A HIT, A MILITARY LASER 8
```

That is about 90 characters. At `font-size: 15px` with `letter-spacing: 3px`
that is roughly 1080 unbreakable pixels, before the plate's own padding.

**It is queued behind the transmission, so it arrives alone.** `station.ts:238`
sends it with `later`, and `tickMessage` (`src/game/session.ts:108`) promotes it
when the console frees up. The queue is correct. Nothing is dropped. The line
arrives whole and is then painted off the screen.

**It is the one line a commander must not miss.** The Constrictor halves a
player hit before its own defence subtracts, so a beam laser does nothing to it.
`station.ts:226` says in as many words that the commander would otherwise find
that out forty light years away. The two numbers that make the sentence useful
sit at the two ends — the ends that clip.

## What the triage found that the issue did not report

**The words are not the fault, and must not be shortened to fit.**
`constrictorWarning` is the one home of that sentence, and docs/TODO/144 M1 cut
it once already on a length argument, then put it back when length stopped being
the constraint (`src/game/orders.ts:173`). Writing a rule to a width is what
this item exists to stop repeating.

**Every other surface that carries the sentence already wraps.** The docked menu
draws it in `#screen .info`, which has a bounded width and no `nowrap`
(`src/ui/screens.ts:50`). The NAVY MISSIONS panel is the same. The console line
is the only clipped one.

## What to do

One milestone.

### M1 — the console line wraps

`#message` loses `white-space: nowrap` and gains:

```
max-width: min(92vw, 1100px);
text-align: center;
line-height: 1.5;
```

`min()` rather than a flat cap: 92vw keeps a margin on a narrow window, and
1100px stops a wide one stretching a line so far that the eye loses the start of
it. Centred text, because the box is centred and a ragged second row under a
centred first one reads as a mistake.

**Growth goes upward.** The element is anchored by `bottom`, so a second row
never covers the cockpit console it sits above. That is why no other rule
changes.

`#prompts` keeps its `nowrap`. A prompt is a key and a verb. Nothing there is
close to a window's width, and the two elements are not one rule.

## Verification

The gates always run: `npm run check`. The tier table puts a stylesheet change
at "nothing more", and there is no probe for a text width.

The gate is `test/ui.test.ts`, which already reads `src/style.css` for the
crosshair's decided CSS twin. It gains one block, and the claim is tied to a
MEASURED fact rather than to the stylesheet itself:

1. Derive the longest `constrictorWarning` the game can produce, over every
   laser a Cobra Mk III can mount.
2. Show that it cannot fit one row at the declared type size — so the element
   MUST be allowed to wrap.
3. Assert that `#message` therefore declares no `nowrap` and does declare a
   `max-width`.

Prove the gate can fail: put `white-space: nowrap` back and watch step 3 go red.

Chris flies it. His verdict is the only answer to whether two rows read better
than one long one (docs/PROCESS.md, the human channel).

## Decisions already made

- **The surface is the console line** (Chris, 2026-08-15), and not the MISSIONS
  screen or the docked menu.

## Watch out for

- Do not shorten `constrictorWarning`. See "What the triage found".
- `body.screen-open #message` adds a plate and 16px of side padding
  (`src/style.css:96`). The cap is on the content box, so the plate is wider
  than the cap by that padding. 92vw leaves room for it.

## Outcome — landed 2026-08-15

M1 landed as planned. `npm run check` passes.

**The measurement.** The worst `constrictorWarning` is **91 characters**. Menlo's
advance is 0.602em, so at 15px with 3px of tracking that is **1095px**. One row
of a 1024px window is 942px. The line has never fitted on an ordinary window.

**The gate was proved able to fail.** Putting `white-space: nowrap` back turned
two assertions red.

### What the work found that the plan did not have

**The naive selector matched the wrong rule.** `body.screen-open #message`
appears earlier in the stylesheet than the bare `#message`, so
`/#message\s*\{...\}/` read the plate rule and found no `max-width` in it. The
gate is anchored on a newline before the selector. A CSS gate that greps needs
to say WHICH rule it means.

**1100px is not the binding number, and the first draft of the gate assumed it
was.** Comparing the line against the 1100px cap put 91 characters against a
91-character row — a coin flip on the advance estimate. The honest comparison is
against an ordinary window, where 92vw binds and the margin is 153px.
