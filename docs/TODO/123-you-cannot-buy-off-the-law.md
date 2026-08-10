# 123 — You cannot buy off the law

**Kind:** feature · **Severity:** medium · **Size:** medium (three milestones)
**Depends on:** 122 M1 — M1 here is a choice inside the window 122 opens
**GitHub:** #21

## Where we are

You can buy off a pirate and you cannot buy off anybody else.

`jettison.ts` is the whole mechanism: `dumpCargo` throws the most valuable thing
overboard, `appetiteOf` prices one pirate against what you arrived carrying, and
`offerBribe` sets `npc.state.satisfied` on the ones who have had enough
(`jettison.ts:56-96`). `isHostileToPlayer` honours it first, before it asks what
role the ship is:

```ts
// npc.ts:299-301
// A pirate that has taken its payday stops caring about you: this is what
// makes jettisoning cargo a real escape rather than a donation.
if (npc.state.satisfied) return false;
```

`game.ts:1852-1862` filters `npc.role === 'pirate'` before offering, so police,
hunters and Thargoids are never asked. **The mechanism for "this ship stops
being your problem" already exists and is already honoured for every role. Only
the offer is missing.**

Which viper is being bribed matters, because a viper only troubles you in two
distinct situations (`npc.ts:307`): you are a **Fugitive**, or you **provoked**
it. And under 122 there is now a third moment — a patrol closing on scan range
with a dirty hold, which is a viper that has not yet done anything to you.
Chris asked for both halves: the inspection and the fight.

## What to do

The prices and the outcomes go in **`game/law.ts`**, whose header already claims
the ground: *"everything about your standing with the Galactic Government is
still decided here and nowhere else."* A bribe is what a scan costs you to
avoid. The module decides and returns; `game.ts` spends the credits, writes
`satisfied` and says the lines (invariant 15, and CLAUDE.md's "modules decide
and return events; orchestrators apply consequences").

One new cockpit command, **OFFER** on `KeyO` — free in the flight table, which
has L, O, Q, R and Z left. What it offers depends on what is in front of you,
and the two cases cannot overlap: M1's is a cop that has not scanned you, M2's
is a cop already shooting.

### M1 — buy off the inspection

Inside 122's window — contraband aboard, `policeScanned` not yet latched, a
police ship in the warning band — OFFER pays and the scan does not happen:
`session.policeScanned` latches true with **no** `raiseLegal`.

The price scales with what you are protecting, using `VALUE_PER_TONNE` —
already the one home for *"what the market values a tonne at ... the toll and
the assessment must agree on what a hold is worth"* (`constants/jettison.ts`).
A cop shaking down a smuggler is a third party doing that same sum. Floor it,
the way `OPPORTUNIST_FLOOR` floors a pirate, so a near-empty run is not free.

**It costs your name, not your record.** `disrepute` rises — a separate constant
from `DISREPUTE_CAUGHT`, because being caught and buying a cop are different
deeds — while `legalStatus` stays where it was. That is the whole shape of the
thing: the Galactic Government's paperwork stays clean and the people who
actually watch you know exactly what you did. It also gives `disrepute` a third
thing to drive, which is what docs/TODO/96 closed asking for.

### M2 — call off the vipers on you

A police ship that is hostile — Fugitive or provoked — takes credits to break
off: `satisfied = true`, the same field, honoured by the same line. Per ship,
so a pair costs twice, exactly as a gang does.

Priced off your **standing**, not your cargo: what a cop wants to look away from
a Fugitive is not a function of the hold. `FUGITIVE_FINE` and `OFFENDER_FINE`
(`constants/law.ts:26-27`) are the existing statement of what each rung is
worth to the law; the bribe is expressed from them, at a multiple that is worse
than docking and paying — because it has to be. A bribe that undercuts the fine
deletes the fine.

**It does not clear the record.** You are still a Fugitive; you have bought this
ship, now, out of this fight. The next patrol is a fresh problem and the station
still wants its money.

### M3 — the cop who says no

Optional, and the interesting half: the offer can be **refused**, on a roll
against the seeded stream (invariant 11), and a refusal is an offence — you have
just tried to bribe an officer in front of him. `provokedByPlayer` goes true, so
he engages under the rule that already exists.

Weight it by **Character**. A Notorious pilot knows who to ask; an Honest one
gets reported. This is `disrepute` as a credential, precisely the shape 96 built
for the rock hermit — *"a credential up to a point and a shut door past it"* —
and it makes the two channels of that number consistent rather than adding a
third idea.

**M3 is cuttable.** Without it, M1 and M2 are a flat purchase: reliable, dull,
and shippable. Say so in the commit rather than leaving the roll half-built.

## Decisions already made

- **Both halves** (Chris, 2026-08-10): the inspection and the fight.
- **`satisfied` is the mechanism for both.** It is already role-agnostic in
  `isHostileToPlayer`; only its comment says "pirate". Widening the comment is
  part of the work — the rule and its stated reason must not diverge.
- **`law.ts` owns the prices, `game.ts` spends the money.** No arithmetic in the
  orchestrator (invariant 10), no `satisfied` written from a pure module.
- **A bribe never clears a record.** Buying your name back is `payFine` at a
  station (`controls.ts:233`), by choice, and it is the only thing that does.
- **A bribe always costs your name.** Both halves raise `disrepute`. The one
  thing every version of this feature must not become is a way to make
  consequences go away with money.
- **One key, two cases, no mode.** OFFER reads the situation; if there is
  nothing to buy it says so and spends nothing, the way an empty hold answers
  `HOLD EMPTY` today (`game.ts:1841`).

## Open questions — answered here

- **What if you cannot afford it?** The same answer the pirate bribe gives: the
  console names the shortfall (`game.ts:1858-1861` prints "THEY WANT MORE" with
  the figure). Reuse that shape rather than inventing a second failure message.
- **Can you bribe a bounty hunter?** Not in this plan. A hunter is a private
  contractor whose whole business is the bounty; there is no paperwork to look
  away from. It is a real design question and it is not what #21 asks.
- **Does M2 work while the station defence is launched?** Yes, and it should —
  `launchStationDefence` vipers are `provokedByPlayer` (`spawning.ts:386-387`),
  which is exactly the state M2 prices. Buying off two vipers off the slot is a
  legitimate, expensive escape.
- **Does a bribed cop stay bribed after you dock?** No: `satisfied` is NPC state
  and the sky is rebuilt on arrival. Nothing to do; noted so nobody adds it.

## Watch out for

- **Money is integer tenths** (invariant 8). Both prices, the shortfall message
  and the floor are tenths of a credit; `formatCredits` does the conversion at
  the edge.
- **Invariant 9's four surfaces** for the new binding: `command-help.ts` will not
  compile without a caption, the `?` guide needs it in exactly one section, the
  manual renders from the same table, and the README's hand-written table is
  held in both directions by `test/key-help.test.ts`.
- **Coordinate the key with 122 M2**, which also wants a letter from L/O/Q/R/Z.
  OFFER takes `KeyO`; the contraband dump takes another.
- **`NOT_IN_THE_SIMULATOR`.** The exercise clone has no hold, no credits worth
  spending and no police; OFFER joins the list for the same reason `jettison1`
  is on it (`controls.ts:176-198`).
- **Do not price M1 off `OFFENDER_FINE`.** 25 credits is what the *station*
  charges for the paperwork; a cop looking away from a hold of narcotics is not
  selling the same thing, and anchoring them together makes one change move the
  other.
- **M3 must not read `Math.random`** (invariant 11). Every roll goes through the
  seeded stream, or the fight stops being reproducible and the training harness
  stops being trustworthy.

## Verification

Tier: pure-function tests for the prices and the outcomes, plus one live-step
assertion per milestone that the sky actually changes — the claim is about what
a viper does, and a price nobody obeys is not a feature.

- **M1** — pure: the price rises with hold value and never falls below the
  floor, both asserted from `VALUE_PER_TONNE` and the constant rather than from
  literals. Live: through the real step, a cop in 122's warning band with a
  dirty hold; OFFER latches `policeScanned`, leaves `legalStatus` at Clean,
  raises `disrepute` by the new constant, and no `POLICE SCAN` message is ever
  emitted however long the patrol stays alongside.
- **M1 control** — with `credits` below the price, nothing is spent, nothing
  latches, and the scan still happens when the cop closes. A bribe you cannot
  afford must not half-work.
- **M2** — pure: a Fugitive's price exceeds an Offender's, and both exceed
  `fineFor` at the same rung. Live: a provoked viper is hostile
  (`isHostileToPlayer` true), OFFER is accepted, and the same call returns false
  afterwards while `legalStatus` is unchanged — the rule and the record moving
  independently is the point of the milestone.
- **M3** — at two sample sizes (CLAUDE.md: *"before a sampled number drives a
  decision, check at two sample sizes"*): refusal rate falls as `disrepute`
  rises, and a refusal leaves `provokedByPlayer` true. Seeded, so the sequence
  is reproducible.
- Prove the gates can fail: remove the `satisfied` write (M2's viper stays
  hostile), and remove the `disrepute` write (M1's name stays clean — the one
  outcome this feature must never have).
- `npm run check` at the end of each milestone; commit per milestone.
