# 118 — The bloom and the pixel-ratio clamp are written out twice

**Kind:** cleanup · **Severity:** low · **Size:** small (one milestone) ·
**Depends on:** nothing · **GitHub:** none — the last entry on docs/TODO/93's
list, backed out of at the time

## Where we are

Three literals, in three files, byte-identical:

```ts
// engine/render-stack.ts:47 and viewer/stage.ts:32
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// engine/render-stack.ts:53 and viewer/stage.ts:44
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.5, 0.15));
// encyclopaedia/chart.ts:79
const dpr = Math.min(window.devicePixelRatio || 1, 2);
```

The game and the two dev pages are supposed to look the same — that is the
whole reason the viewer exists, to look at a ship the way the cockpit will —
and today they agree by coincidence. `viewer/stage.ts` says so in a comment:
*"byte-identical to engine/render-stack.ts and belong with it; that one is real
and is written up in docs/TODO/93 for its own item."*

**Why 93 backed out**, and why this sat in the backlog rather than being a
five-minute edit: the catalogue's duplicate-value check warns when a new
constant repeats a primitive that another one already has, unless BOTH sides
carry distinct `@rule` ids. `0.5` and `2` are popular numbers — 0.5 is four
other constants and `2` is more — so silencing the warning the tidy way means
handing `@rule` ids to nineteen unrelated constants across ten modules that
have no relationship to a bloom pass at all.

That is the actual work, and it is a policy question about the catalogue rather
than anything to do with rendering.

## Decisions already made

- **A warning is a question, not a defect.** `constants:check` already treats it
  that way — warnings do not fail it, and `npm run check` has shipped green with
  them since docs/TODO/96. The `@rule` mechanism exists for *equal-looking values
  whose meanings must stay apart*, and applying it to every constant that
  happens to be 0.5 would make the namespace mean "this number is common"
  instead. So: the new constants take `@rule` ids where the collision is worth
  naming, the unrelated nineteen are left alone, and the warning that remains is
  answered in the doc comment rather than suppressed.
- **The bloom is ONE constant, not three.** `PLAYER_FLIGHT` is the precedent: an
  object whose fields are read together and tuned together. It also happens to
  sidestep the collision entirely — the checker compares primitive values, and
  an object has none — which is a consequence rather than the reason.
- **This is not styling.** docs/TODO/90 ruled colours and canvas themes out of
  `src/constants/` by name, and `encyclopaedia/chart.ts`'s `THEME` stays put for
  exactly that reason. A bloom pass's strength and a device-pixel clamp are not
  a palette: they are what the picture is RENDERED at, shared by three entry
  points that must not drift apart. The line docs/TODO/90 drew is between a
  look somebody chose per surface and a number two surfaces must agree on.

## What to do

**M1 — one home, three readers.**

`src/constants/render.ts`, a new file:

- `BLOOM` — `{ strength: 0.55, radius: 0.5, threshold: 0.15 }`, the arguments
  `UnrealBloomPass` takes after its resolution vector.
- `MAX_PIXEL_RATIO` — `2`, with an `@rule` id, because that collision IS worth
  naming: this is a rendering cost ceiling and every other 2 in the catalogue is
  a count or a multiplier.

`engine/render-stack.ts`, `viewer/stage.ts` and `encyclopaedia/chart.ts` read
them. The camera FOV and far plane in `viewer/stage.ts` stay literals: that
file's comment records that nobody knows whether 55/200000 differs from the
game's 60/`CAMERA_FAR` deliberately, and reaching for the game's constants there
would reframe both dev pages — a decision to make having looked at them, not a
side effect of tidying.

## Open questions — answered here

- **Does `encyclopaedia/chart.ts` keep its `|| 1`?** Yes. It is a 2D canvas on a
  page that may be opened by anything, and a `devicePixelRatio` of 0 or
  undefined would collapse the canvas to nothing. The clamp is the shared rule;
  the fallback is that surface's own defensiveness.
- **Does `src/constants/` importing into `viewer/` cost portability?** No.
  `viewer/` is PLATFORM in tools/portability.mjs and constants are a leaf that
  imports nothing.

## Verification

Tier: a scan, because the defect is duplication rather than behaviour.

- The three literals appear nowhere outside `src/constants/render.ts` — a source
  scan over `src/`, in test/constants.test.ts's idiom, so a re-inlined 0.55 or a
  fourth `devicePixelRatio` clamp fails.
- Prove the gate can fail by re-inlining one.
- `npm run check` and `npm run portability` at the end.

## Where we are now

**Landed.** `src/constants/render.ts` is the home; `engine/render-stack.ts`,
`viewer/stage.ts` and `encyclopaedia/chart.ts` read it, and `viewer/stage.ts`'s
comment about the duplicate is now a note about where it went.

The policy call turned out cheaper than the backlog entry feared, and both
halves of the reason are worth recording:

- The duplicate-value check is **diff-scoped**, so it looks at the constants a
  change actually touches. Adding `MAX_PIXEL_RATIO` warns once, on the new
  constant, listing the twelve unrelated 2s — it does not go and demand ids from
  them. The nineteen-constant cascade the entry describes would only happen if
  somebody insisted on silencing that one warning.
- `BLOOM` as an object avoids the question entirely for the three bloom numbers,
  and it was the right shape anyway.

So the answer to "must every collision take a `@rule` id?" is **no, and it
should not**: `@rule` means *these equal values must stay free to move apart*,
and spending it on every constant that happens to be 0.5 would turn it into a
note that the number is common. One warning stands, answered in the doc comment
beside the constant.

**The gate is a new section in test/constants.test.ts**, and it walks every file
under `src/` rather than the ones with constants of their own — which matters,
because `viewer/stage.ts` declares none and is one of the two files the
duplicate lived in. Proven able to fail by re-inlining each literal in turn:
the bloom in `viewer/stage.ts` and the clamp in `encyclopaedia/chart.ts` are
both named by the scan when they come back.

`npm run check` green; `npm run portability` unchanged at one contaminated file
(music.ts), which is nothing to do with this.
