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

## Decisions already made

- **The box stays.** A screen is 92% opaque, and a line without its own ground
  is unreadable over one.
- **The fix is in the stylesheet.** The painter owns one fact already.

## Open questions

- **Does the rectangle appear before any message is shown?** The code says yes,
  and the report says no. **Recommendation: check it before M1**, in the browser,
  because the answer decides nothing about the fix and everything about whether
  a second cause exists.

## Watch out for

- **`:empty` matches an element with no child nodes at all.** A stray whitespace
  text node would defeat it. `hud.ts:261` assigns `''`, which leaves none, so
  the selector holds today. A future writer that assigns `' '` or an empty
  `<span>` would break it silently, and the gate above would not catch that.
- **`#message` is also the queued line's home** (`session.ts`, `tickMessage`).
  Hiding an empty box changes nothing about the queue, which decides words
  rather than paint.
