# docs/TODO/139 — the measurements

What is here, and how to take it again. Every table was printed by a tool in the
tree; nothing was typed by hand.

## M1 — the baseline (`npm run aim-probe`)

| file | command |
| --- | --- |
| `aim-probe-before.txt` | `npm run aim-probe -- 200` |
| `aim-probe-before-600.txt` | `npm run aim-probe -- 600` |
| `aim-probe-before-grid2.txt` | `npm run aim-probe -- 200 77000023` |
| `aim-probe-before-tier2.txt` | `npm run aim-probe -- 200 50000017 2` |
| `survivability-before.txt` | `npm run survivability` |

The `-after` files are the same commands after M2 moved
`SHIELD_REGEN_FRACTION`. **Both sets were printed by the tool as it stands
now**, so the pair differs only by the constant: the before-files were re-taken
at 0.035 once the ENERGY LOW and they-lost columns existed, and every figure
they already carried came back identical, which is the control this pairing
rests on.

## M2 — the sweep

`sweep-shield-regen-tier2.txt` and `-tier0.txt` are
`SHIELD_REGEN_FRACTION ∈ {0.035, 0.028, 0.021, 0.014, 0.010, 0.007}` at 100
episodes a point; `sweep-confirm-tier2-grid1.txt` and `-grid2.txt` re-take the
{0.014, 0.012, 0.010} band at 200 on two independent seed bases;
`sweep-tier1-before-after.txt` is the middle tier at the two values that matter.

**There is no sweep harness in the tree, deliberately.** A constant that a
runtime hook can vary is a constant with two homes, and an env var read by
`constants/recharge.ts` would be exactly the ambient global CLAUDE.md's design
direction forbids. A sweep is a measuring SESSION: patch the constant, run the
probe, restore it — which is how docs/TODO/137 swept `DC_ROLL_LEAD` and
`DC_SLOT_MARGIN` before it. To repeat one:

```sh
# for each candidate value: edit SHIELD_REGEN_FRACTION in
# src/constants/recharge.ts, then
npm run aim-probe -- 200 50000017 2     # tier-2 gangs, the gate's own tier
npm run survivability                    # the control
git checkout src/constants/recharge.ts   # and put it back
```

The rows to read are `knife-fights | pursuit` — the fight a player actually
flies, per docs/TODO/139 M1. `runs` is survivability's chase, kept as a control.
