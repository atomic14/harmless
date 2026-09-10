# 201 — A held mission keeps its briefing

**Kind:** bug · **Severity:** high · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

**Chris accepted a mission on 2026-09-10 and could not read the details of
the accepted mission.** He asked for it on the cockpit branch, docs/TODO/200's, and it
lands there.

**An offer row shows everything, and a held row shows the order alone.**
`renderMissions` in `ui/screens.ts` draws an offer with the dossier's title
and its briefing pages. On acceptance the same mission becomes a held row.
`HeldRow` extends `MissionOrder`, and a `MissionOrder` carries the current
leg's line, its destination, its fee and its warning. So the held row shows
`GOVERNOR: SCOOP THE LEDGER CANISTER ADRIFT AT LEESTI` and nothing of the
title or the briefing.

**Nowhere else shows them.** The commander's log tells the journal, which for
a fresh mission is one line. The station's summary line names the mission
and its world. The dossier's words for each leg are spoken at the moment they
apply, and never shown on a screen.

## What to do

One milestone.

### M1 — a held row keeps the title and the briefing

`HeldRow` gains `title` and `pages`, filled as an offer's are, in
`game/screens/missions.ts`. The painter draws a held row as it draws an
offer. The title comes in bold, then the pages. Then the current order
follows in amber, as the thing to do now. The patron, the destination, the fee and ABANDON
stay in their columns. A mission with no dossier shows its plain name from
`missionName` and no pages, so the order line stands alone as it did.

`test/dossiers.test.ts` already builds a `MissionsScreen` over a held
mission. A check there holds that a held row carries its title and its
briefing, and that the order line follows them.

## Decisions already made

- **The order goes under the briefing.** The row reads as what she agreed
  to, then where she is in it.
- **The pages are the same pages the offer showed.** The `{HERE}` slot fills
  with the world it was accepted at, which `acceptedAt` already answers for
  the patron's name.

## Open questions

None.

## Watch out for

- **Three tests build a `HeldRow` by hand.** `mission-offers`,
  `standing-orders` and `dossiers` spread a `MissionOrder` and add `patron`
  and `choices`. Each gains the two fields.

## Verification

The gates always run: `npm run check`.

The tier: a view model, a painter and a test. Nothing more runs.

Evidence: the check in `test/dossiers.test.ts` fails on the painter as it is
today, and passes after M1.

## Outcome

M1 landed on 2026-09-10, on docs/TODO/200's branch, as Chris asked. 5,567
assertions, from 5,564.

A held row shows the dossier's title in bold, its briefing pages with the
patron and the world it was accepted at filled in, and then the current
order in amber. A mission with no dossier shows its plain name over the
order. The three checks in `test/dossiers.test.ts` failed on the old
painter: the title and the briefing were absent, and so was the plain name.

### What the plan did not have

- **Four tests build a `HeldRow` by hand, not three.** `mission-pieces`
  builds one for the choice prompt. It gained the two fields as well.
