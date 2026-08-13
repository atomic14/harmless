# 146 — A click cannot press a shifted key

**Kind:** defect · **Severity:** low · **Size:** small · **Depends on:** nothing
· **Blocks:** nothing · **Source:** Chris, 2026-08-13, reading 144 M6: *"Why
don't shifted keys work from the menus - it sounds like it's the mouse click
that is not working properly? It dispatches just a letter press?"* — and the
requirement, in his words: *"If a click is on a row that has a capital letter
then the capital letter should be sent."*

## Where we are

**He is right, and the diagnosis is exact.** The keyboard was never broken. ⇧I
resolved correctly through the binding table, and `test/standing-orders.test.ts`
proved it. The CLICK is the broken half, and it dispatches a bare letter.

Three lines do it:

1. `ui/key-help.ts` writes `data-key="${b.key}"`. `b.shift` is dropped.
2. `ui/screen-host.ts` reads that attribute and calls `i.injectPress(key)`.
3. `engine/input.ts` records the tap as a count against the code, and nothing
   else.

The matcher in `game/controls.ts` then asks
`b.shift !== i.held('ShiftLeft', 'ShiftRight')`, and `held` only knows what a
real keydown put there. So an injected tap is unshifted **by construction**, and
the plain entry answers it. `ScreenHost.runMenuCursor` injects the same
attribute on Enter, so arrowing onto a row fails the same way.

**144 M6 fixed the rule, not the capability.** A docked menu row must take a
plain letter, and `test/key-help.test.ts` now presses every row to enforce it.
That is a real gate and it stays. This item removes the reason for it.

## What the triage found that the question did not report

**The obvious fix is wrong, and the harm is silent.** `commandsFor` asks a
FRAME-GLOBAL question: is shift down right now? Make an injected tap set that
flag and the answer changes for every binding tested in the same frame — so a
plain `Y` tap would satisfy the `⇧Y` jettison-five binding, and a click on any
row would arm every shifted key in the table. Five tonnes over the side instead
of one, from a click on a menu.

So shift must become a property of **the tap**, not of the frame.

**`held` is still needed, and must not change.** The flight axes read it for
real modifier state, and `Binding.shift` is checked before the tap is consumed
(`controls.ts`'s third load-bearing rule). The matcher has to prefer the TAP's
shift where the tap carries one, and fall back to `held` where it does not —
which is every key a person actually presses.

## What to do

### M1 — a tap carries its own shift

`engine/input.ts`:

```
injectPress(code: string, shift = false): void
```

`tapped` stops being `Map<string, number>` and becomes a queue per code that
remembers each tap's shift. `pressed(code)` keeps its signature and its meaning.
A new reader answers the matcher's question:

```
/** Was the tap now being consumed a shifted one? null when nothing was injected. */
tapShift(code: string): boolean | null
```

`null` for a real keydown, because a real one is answered by `held` exactly as
it is today. That keeps the change to the matcher additive.

### M2 — the matcher prefers the tap

In `controls.ts`, the shift test becomes: use the tap's own shift when it has
one, and `i.held(...)` when it does not. `CommandInput` gains `tapShift`, and
`engine/input.ts` still satisfies it structurally.

### M3 — the row sends what it shows

`dockedMenuHtml` writes `data-shift="1"` beside `data-key` for a shifted
binding. `ScreenHost.click` and `runMenuCursor` both pass it to `injectPress`.
Chris's requirement is then literally true: the row displays `⇧I`, and clicking
it sends ⇧I.

### M4 — retire the rule 144 M6 needed

`Binding.shift`'s prohibition and the note in `ui/key-help.ts` come down. The
GATE does not: `test/key-help.test.ts`'s "clicking a menu row asks for the
command the row advertises" becomes the check that this item WORKS, rather than
the check that nobody writes a shifted row. Its wording changes; its claim does
not.

## Decisions already made

- **Do it as its own item** (Chris, 2026-08-13), rather than inside 145.
- **`R` stays the missions key.** It is a plain letter, it works from the
  keyboard, the click and the cursor, and it frees ⇧I. This item does not
  re-open it.

## Open questions, and the answers

**1. Should a click be able to send any modifier, or only shift?** Only shift.
`Binding` models only shift, and no binding in the game uses another. A general
modifier set would be a type nothing populates.

**2. Does this widen the menu cursor, which invariant 14 warns about?** No. The
cursor still touches nothing but arrows and Enter, and still only when a `.menu`
with shortcuts is on screen. It passes one more attribute through the door it
already uses.

**3. Does anything else call `injectPress`?** `ScreenHost.click`,
`runMenuCursor` and the tests. The default `shift = false` keeps every existing
caller correct.

## Watch out for

- **The tap carry.** `engine/input.ts` holds an unconsumed tap briefly into the
  next frame, which is what lets a mashed key reach the game twice. The shift
  must travel with the tap across that boundary, or a carried tap loses its
  modifier and presses the plain key a frame later.
- **`pressed()` consumes.** `tapShift` must be readable for the tap being
  consumed in the same call — reading it after `pressed` has taken the tap is
  reading the next one.
- **`test/input.test.ts` pins the carry.** A change to `tapped`'s shape touches
  it.

## Verification

**The gates always run**, and they are `npm run check`. This item changes the
input layer, a matcher and a renderer. It changes no ship, no combat rule and no
price, so docs/PROCESS.md's tier table asks for nothing more.

**The gate that matters is the false-fire one, and it is the reason for the
whole design:**

1. A click on a row with `data-shift` presses the shifted binding.
2. A click on a plain row presses the plain binding.
3. **A plain `Y` tap does NOT satisfy the `⇧Y` jettison-five binding**, in the
   same frame as a shifted tap on another key.
4. A real shift held with a real keydown still works, unchanged.
5. A carried tap keeps its shift into the next frame.

Each shown to fail.

**Flown in the browser**, with a click on a shifted menu row put back for the
purpose. The saves in that browser are real, so the page switches to the harness
namespace first (invariant 3).

## What landed

Not started.
