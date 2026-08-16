# 172 — An empty console line still draws its box

**Kind:** defect · **Severity:** low · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #37

## Where we are

Chris flew it and reported one thing, with a screenshot: *"There's a left over
rectangle when there's no console text. I think it only happens if some console
text has been displayed and then removed."*

**The report is exact, and the cause is one rule.** `src/style.css:96` gives the
console line a box whenever a screen is open:

```css
body.screen-open #message {
  bottom: 3vh;
  background: rgba(0, 10, 2, 0.92);
  border: 1px solid rgba(var(--hud-amber-rgb), 0.35);
  padding: 6px 16px;
}
```

**Nothing there asks whether the line has any words in it.** `hud.ts:261` is the
one writer, and it empties the element rather than hiding it:

```ts
this.messageEl.textContent = frame.messageTimer > 0 ? frame.messageText : '';
```

`#message` is `position: absolute`, so it is a block box. An empty block with
12px of vertical padding and a 1px border still paints. That is the rectangle in
the screenshot.

**The box exists for a good reason, and this item keeps it.** A screen is 92%
opaque, so a console line drawn over it needs its own ground to be readable. In
flight there is no `screen-open` class, no background and no border, which is
why the defect is only ever seen on a screen.

### Why "after some text has been displayed"

The rectangle is there whenever a screen is open and the timer has run out. A
pilot notices it after a line fades, because that is the moment the words leave
and the box stays. The rule does not depend on a message ever having been shown.
**Confirm that when the fix is flown**, because the report and the code disagree
about it, and the code is the authority (`CLAUDE.md`).

## What to do

One milestone.

### M1 — the box belongs to the words

Hide the element when it holds nothing. `#message:empty { display: none; }` is
the whole of it, and `textContent = ''` is exactly what makes the selector
match.

**Do it in the stylesheet rather than in the painter.** `hud.ts` already states
the one fact it owns: whether the timer is still running. A painter that also
toggled a class would give one rule two homes, and the class would then have to
be cleared on every path that empties the line.

**Do not touch `#prompts`.** It carries no background and no border, so it has
nothing to leave behind.

## Verification

The gates always run: `npm run check`. The tier table puts this at "nothing
more". No probe is involved, because no rule of the world changes.

**A stylesheet gate is possible, and there is a precedent.**
`test/help-overlay.test.ts:24` reads `src/style.css` as text and asserts a
declaration in a named selector's own block. Copy that reader.

The assertion is a pair, and the pair is the point:

1. `body.screen-open #message` declares a `border` **or** a `background`;
2. and a rule exists that hides `#message` when it is empty.

**Written as a pair, the gate says why it exists**: the day somebody gives the
line a box, the box must already know how to disappear. A gate that only checked
for `:empty` would pass on a stylesheet that had dropped both.

**Prove it can fail.** Delete the `:empty` rule and the gate goes red. Then
delete the `border` line too, and the gate goes green again — which is correct,
and which the assertion's own message must explain.

**Chris flies it.** A stylesheet gate reads text and cannot see a painted pixel.
Two things need an eye: the rectangle is gone, and a real console line on a
screen still reads against the 92% ground.

## What landed, 2026-08-16

**M1 is one line of CSS, and it is `#message:empty { display: none; }`**, beside
the block that gives the line its plate. `hud.ts` is untouched.

**The open question is answered, and the code was right.** The rectangle is
there before any message is shown. Measured in Chrome at `play.html`, at the
first frame of a docked career: `#message` held `""`, held zero child nodes, and
painted a box of 34 by 14 pixels with the background and the border in force.
Those two numbers are the padding and the border alone — 16 + 16 + 1 + 1 across,
and 6 + 6 + 1 + 1 down. **So no second cause exists.** A pilot notices the box
after a line fades, because that is the moment the words leave.

**The fix was measured in the same browser.** With the rule in force, an empty
`#message` reads `display: none` and a box of 0 by 0. A line put back into the
element reads `display: block`, 527 by 37 pixels, and keeps both the 92%-opaque
background and the amber border. The screenshot after the change shows a clear
screen where the rectangle was.

**`test/console-plate.test.ts` is 4 assertions, and it holds three claims rather
than two.** The stylesheet pair is the first two. The third is behaviour, and
the plan named it as the risk the gate would not catch: `:empty` needs an
element with no child node, so the painter must leave none. The test drives the
real `Hud` through `test/screen-capture.ts` and reads the element back.

**THE PAIR IS ASSERTED DIRECTLY, AND THAT IS A DEVIATION.** The Verification
section asked for a gate that goes GREEN when the plate is deleted as well. It
does not. Both halves are asserted, so deleting the plate turns the first
assertion red. The reason is this plan's own "Decisions already made": the plate
stays, and a decision with no measurement is a preference. A gate that passed
on a stylesheet with no plate would let that decision go in silence. **The
plan's stated intent still holds** — a stylesheet that had dropped both fails,
which is what the section asked the pair to prevent. The failure message on each
half names the other half, so a reader who deliberately drops the plate is told
that the `:empty` rule is then unnecessary.

**Proved able to fail three ways, and each one alone.**

1. With the `:empty` rule deleted, the second assertion goes red and the other
   three stay green.
2. With the plate deleted as well, the first two go red and both messages read
   correctly.
3. With `hud.ts` writing `' '` in place of `''`, only the fourth goes red, and
   it reports `got " ", want ""`.

**`npm run check` passes at 4,719 assertions.** The tier table said "nothing
more", and nothing more was run.

**`#prompts` was not touched**, and the measurement supports the plan: it
carries no background and a border width of 0.

**Chris still flies it.** A stylesheet gate reads text, and a computed style
read from a console is not an eye. Two things want one: the rectangle is gone,
and a real console line raised by the game still reads against the 92% ground.

## Decisions already made

- **The box stays.** A screen is 92% opaque, and a line without its own ground
  is unreadable over one.
- **The fix is in the stylesheet.** The painter owns one fact already.

## Open questions

- ~~**Does the rectangle appear before any message is shown?**~~ **Answered in
  the browser, and the answer is yes.** The empty element painted 34 by 14
  pixels at the first frame, which is its padding and its border and nothing
  else. There is one cause, and M1 is the whole of it.

## Watch out for

- **`:empty` matches an element with no child nodes at all.** A stray whitespace
  text node would defeat it. `hud.ts:261` assigns `''`, which leaves none, so
  the selector holds today. A future writer that assigns `' '` or an empty
  `<span>` would break it silently. **The gate covers this now.**
  `test/console-plate.test.ts` drives the real painter and asserts the element
  is left exactly empty. The `' '` case was one of the three failure proofs.
- **`#message` is also the queued line's home** (`session.ts`, `tickMessage`).
  Hiding an empty box changes nothing about the queue, which decides words
  rather than paint.
