# 120 — The port marker says LINED UP when you are rolled wrong

**Kind:** bug / UI · **Severity:** medium · **Size:** small
**Depends on:** none · **GitHub:** #19

## Where we are

The docking port marker paints two states off one boolean:

```ts
// hud/hud.ts:263
this.drawSlotMarker(frame.slotMarker, frame.dockAid?.inSlot ?? false);
// hud/hud.ts:447, :467
const colour = inSlot ? GREEN : AMBER;
ctx.fillText(inSlot ? 'DOCKING PORT — LINED UP' : 'DOCKING PORT', x - r, y - r - 6);
```

`inSlot` is `inSlotChannel(local.x, local.y)` — the LATERAL test alone. It says
your nose is inside the letterbox's rectangle. It says nothing about roll, and
roll is the half of docking this game went out of its way to model: `docking.ts`
exists because "the hard part — roll — is identical for both" the NPC trader and
the player's docking computer.

**The world already knows the third state and the HUD already carries it.**
`dockingOutcome` (`docking.ts:190+`) returns four answers, and one of them is
`'slotMiss'` — *"in the channel but rolled wrong"*, which is the exact state the
marker calls LINED UP. `dockingAid` (`hud-model.ts:158-170`) computes
`rollOk: rollAlignedWithSlot(right.x, right.y)` and `roll` in radians, from
`docking.ts`'s own rules rather than a copy of them, and puts both in the frame.
**Nothing reads `rollOk`.** Grep it: one write, no reads.

So this is not a missing measurement. It is a painter throwing away a field that
was computed, documented and plumbed through for it, and then telling the pilot
the opposite of what the dock test is about to do to them.

The comment above the code is the promise being broken (`hud/hud.ts:99-105`):

> the port marker says whether you are lined up, and saying it twice in two
> places was worse than saying it once. Only `inSlot` is read now.

The separate docking-aid overlay was deleted on the strength of that sentence.
One reading of the marker is right; the marker is the one that has to be true.

## What to do

**The three-state choice becomes a decision in `hud-model.ts`, not a ternary in
the painter.** Today the model computes both facts and the painter picks the
words; moving the CHOICE up is what makes it testable, since the painter is a
canvas and the model is a pure function. `dockingAid` gains one field:

```ts
/** what the port marker should say: off the channel, in it but rolled, or in and rolled right */
port: 'off' | 'roll' | 'lined';
```

derived from the `inSlot` and `rollOk` it already computes, and nothing else.
`drawSlotMarker` takes it and maps it to a colour and a string:

| `port` | colour | text |
| --- | --- | --- |
| `off` | AMBER | `DOCKING PORT` |
| `roll` | AMBER | `DOCKING PORT — ROLL` |
| `lined` | GREEN | `DOCKING PORT — LINED UP` |

Green means the dock test would pass. That is the whole change: green stops
lying.

`dockAid.inSlot`/`rollOk` stay as they are — `port` is expressed from them, not
instead of them — so nothing else that reads the aid moves.

## Decisions already made

- **Three states, not two.** Turning green off for a rolled ship and leaving one
  amber state would tell the pilot "you are not lined up" when they are centred
  in the letterbox and 30° out — which is the same information gap one rung
  down. The player needs to know WHICH thing is wrong, because they are two
  different stick inputs.
- **No roll DIRECTION in the readout.** `slotRollOffset` is deliberately
  unsigned — *"a ship upside down in the slot still fits through it"*
  (`docking.ts:162-172`) — so there is no correct direction to print without
  giving that measurement a sign it does not want. `ROLL` says which control to
  touch; the pilot can see which way the slot leans. A signed hint is a separate
  question and a bigger one, and it is not what #19 reports.
- **Two colours, three states.** AMBER already means "not yet"; a third palette
  entry to distinguish two kinds of not-yet is a colour decision buying what a
  word buys for nothing.
- **The word is `ROLL`, not `ROLLED` or `MATCH ROTATION`.** The marker is drawn
  in 10px monospace beside a bracket at 26px; it is a label, not a sentence, and
  every other string on the marker is one or two words.

## Open questions — answered here

- **Does the edge arrow change too?** Yes, and only in colour: `drawEdgeArrow`
  is called with `colour` and the fixed label `'DOCKING PORT'` (`hud.ts:471`).
  `inSlot` is a lateral test at ANY distance along the axis, so a ship in the
  channel but far behind the station can, in principle, be `lined` with the slot
  off screen. Feeding the arrow the same colour keeps that consistent, and the
  arrow's label stays as it is — an off-screen marker is answering "which way",
  not "am I aligned".
- **Should the marker read `roll` when the aid is null?** No. `dockAid` is null
  when you are not facing the station (`hud-model.ts:151`), which is by design
  — departures launch facing away. `port` is only defined where `dockAid` is,
  and the painter's fallback stays `off`, exactly as `?? false` is today.

## Watch out for

- **`drawSlotMarker`'s second parameter is one of two calls in `render()` that
  reads `frame.dockAid` at all.** Changing its shape is contained, but check
  `hud-binding.ts:122-187` — the frame is assembled there and `dockAid` is
  spread through it.
- **Do not recompute the roll test in the painter.** The one thing
  `hud-model.ts:163-165` records is that this aid used to hardcode the channel
  and the tolerance, and *"the aid and the dock test could — and, when the
  letterbox turned upright, would — disagree"*. The painter must not learn what
  `ROLL_TOLERANCE` is.
- **`hud.ts` is 567 lines.** This change is roughly net-zero there; do not let
  it grow.

## Verification

Tier: pure-model assertions, because the whole point of the change is to move
the choice somewhere a test can reach it.

- `test/hud-model.test.ts` (76 lines, room to grow) — drive `dockingAid` with a
  station and three player poses:
  - off the channel → `port === 'off'`;
  - inside the channel, wings rolled past `ROLL_TOLERANCE` → `port === 'roll'`;
  - inside the channel, wings within it → `port === 'lined'`.
  Build the rolled pose from `ROLL_TOLERANCE` itself (just over, just under), not
  from a hardcoded angle, so the test pins the rule rather than a number.
- **The claim that matters, asserted against the dock test rather than against
  itself:** for the middle pose, `dockingOutcome` at the slot returns
  `'slotMiss'` while the old code would have painted `LINED UP`. That is the bug
  in one line, and it fails if the fix is reverted.
- Prove the gate can fail: restore `port` to `inSlot ? 'lined' : 'off'` and watch
  the middle case go.
- `npm run check` at the end.
