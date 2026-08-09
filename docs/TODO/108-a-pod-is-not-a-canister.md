# 108 — A pod is not a canister

**Kind:** feature / world-object · **Severity:** medium · **Size:** medium
**Depends on:** none
**GitHub:** #8

## Why

Escape pods and cargo canisters are the same object with different contents.
The minimal legal fix landed (a rescued pilot is `commander.survivors`, not
`cargo[3]`, so rescue does not read as smuggling — `world-step.ts:424-429`,
pinned by `test/combat.test.ts:496-522`). The rest of the split remains, and
`cargo.ts:9-13` already names this file as where it belongs: "the `kind` field
is the seam."

What is still wrong, confirmed in the running code:

- **The pod is drawn as a canister.** All three mesh sites build
  `CANISTER_HULL`; a capsule is only a colour and a 0.8 scale
  (`cargo.ts:81, 99-100, 116-117`). The registry comment "Harmless has no pod
  MESH" (`ships/registry.ts:84-91`) is out of date as a statement of
  availability: design 2 ("Escape pod", 4 vertices, radius 16) is converted
  eagerly with every other released hull (`elite-a-hulls.ts:126`,
  `designs.generated.ts:18`) and `requireShipDef(OBJECT_DESIGNS.escapePod)`
  returns a real def today. Only its combat profile is used
  (`cargo.ts:51-54`).
- **A rescue costs a tonne.** `cargoTonnes` adds `survivors`
  (`commander.ts:216-218`), and a full hold refuses the rescue outright:
  `HOLD FULL — CAPSULE LOST` (`world-step.ts:421-423`). Issue #8's words:
  "you rescue a pilot, you do not gain a tonne."
- **The HUD calls it cargo.** `hud-model.ts:41` pushes every drifting object
  as `kind: 'cargo'`; the signature narrows the item to `{ object }` so the
  `kind` field is thrown away one call before the blip is painted, and the pod
  shows in canister blue `#8ad0ff` (`hud.ts:41`) — not even its own mesh
  colour.
- **Ramming one without scoops says the wrong thing.** The no-scoops branch
  reads `CANISTER DESTROYED ON HULL` for a capsule (`world-step.ts:417-420`),
  while shooting one is a named, FUGITIVE-grade act
  (`combat.ts:157-160`).
- **`spawnCapsule` writes `commodity: 3`** — Slaves — into a field documented
  as "ignored for capsules" (`cargo.ts:38, 103`). Nothing reads it today; it
  is a live trap for the first generic reader.

## What to do

1. **Keep the pool, keep the seam.** Pods stay `Canister` entries with
   `kind: 'capsule'` in `CargoField`, per the file's own note. No second
   field class, no snapshot shape change: `CanisterSnapshot.kind` already
   carries `'cargo' | 'capsule'` (`snapshot.ts:126-138`), the parse gate
   already checks it (`snapshot.ts:303`), and `SNAPSHOT_VERSION` stays at 1
   because the saved shape does not move.
2. **Give the capsule its own hull.** Build design 2 via
   `requireShipDef(OBJECT_DESIGNS.escapePod)` at the two capsule mesh sites
   (`spawnCapsule`, `restore`); drop the 0.8 canister scale. Update the
   registry comment, which becomes wrong the moment this lands. Invariant 7
   applies: the pod is one of the asymmetric hulls (`geometry.ts:44`) and must
   go through `buildShip`'s rotation, never a mirror.
3. **A rescue stops costing a tonne.** Remove `survivors` from `cargoTonnes`
   and remove the hold-full refusal for capsules in the scoop path. A survivor
   rides in the crew spaces, not the hold; docking still hands them to station
   medical (`station.ts:164-171`). The `survivors` field, its save repair
   (`storage.ts:486`) and the trainer zeroing (`combat-sim-safety.ts:89`) all
   stay as they are.
4. **Its own blip.** Widen `scannerContacts`' canister parameter so `kind`
   survives to the model, add a `pod` contact kind to `ScannerContact` and a
   colour to `CONTACT_COLORS` (`hud.ts:19, 34-42`) — `#ffd24d`, the colour the
   mesh already wears. No new one-off hex beyond that one entry (docs/TODO/93
   is counting).
5. **Its own words on impact.** The no-scoops collision says
   `ESCAPE CAPSULE DESTROYED ON HULL`. Damage source stays `'cargo'` — the
   `DamageSource` list is pinned (`test/world-step.test.ts:415`) and a new
   source buys nothing.
6. **Its own graze.** `CANISTER_GRAZE = 20` is sized to the canister
   (`constants/player-gun.ts:77-82`); the pod's radius is 16. Add a pod graze
   constant beside it with its own `@rule`, route `canisterCone`
   (`gunnery.ts:79`) by kind, and follow the constants process
   (`constants:find`, `generate:constants`, `constants:check`).
7. **Stop writing `commodity: 3`.** `spawnCapsule` writes `commodity: 0`; the
   field remains ignored for capsules and the comment stays true.

## Decisions already made

- Chris (issue #8): a rescue does not gain a tonne; the pod gets its own
  model, scoop behaviour and message.
- Chris (triage comment, #8): the capsule becomes a distinct object with
  rescue semantics, capacity rules, messages, persistence and tests.

## Open questions — answered here

- **Ramming a pod without scoops: is it an offence?** No. Shooting one is a
  deliberate act and stays FUGITIVE (`combat.ts:157-160`); flying into one
  with no scoops fitted is the same accident it is for a canister, and
  punishing scoopless early commanders for passing a wreck would be a
  balance change this item has no mandate for. Message only.
- **Does a rescue pay?** Not in this milestone. No credits, no disrepute
  credit — `afterDeed` accepts a negative delta so a good-deed hook is one
  line when wanted, but docs/TODO/96 (character consequences) is deferred and
  this must not smuggle a piece of it in.
- **Cap on survivors?** None. They occupy nothing, they cannot be sold, and
  docking clears them; a cap would be a rule with no consequence attached.

## What is NOT in scope

- Paying for rescues, reputation effects, or a rescue contract kind
  (`Contract` union — that would be docs/TODO/109 territory or later).
- The escape-pod *fitting* the player buys (`shop.ts:51`,
  `hull-breach.ts:27`) — same name, different thing, untouched.
- Any change to `ESCAPE_CHANCE` spawn rates or wreck contents.

## Watch out for

- **Tests that pin the old rule, to re-baseline deliberately:**
  `test/combat.test.ts:496-522` asserts a survivor "still takes up a bay" —
  that assertion inverts. The spawn-rate sweep (`combat.test.ts:213-234`)
  counts `kind === 'capsule'` and survives this plan unchanged. The pod
  combat-profile test (`test/damage-paths.test.ts:254-271`) should keep
  passing — the bank was already the pod's.
- **`test/constants.test.ts:241-249`** allow-lists `game/cargo.ts`'s furniture
  (`CANISTER_HULL`, `POLICY`, `SPIN_RATE`); a pod hull const there needs a
  list entry, and any new colour or graze number belongs in `src/constants/`
  instead.
- **The HUD boundary narrows types on purpose** (`hud-binding.ts:51` has the
  real `Canister`, `hud-model.ts:27` drops it). Widen the model's parameter,
  not the binding.
- **`world.cargo.clear()` sites** (`station.ts:182`, `world.ts:50`,
  `combat-sim.ts:849`) — pods living in the same pool keep this free; a
  separate pool would have had to visit all three, which is a reason the seam
  stays where it is.

## Acceptance

- [x] A spawned capsule renders design 2's geometry, not the canister's, in
      game and on restore from a snapshot — `test/geometry.test.ts`, counting
      the edge buffer the field actually built against one built straight from
      each design (pod 12, canister 30), at both build sites, plus that the
      0.8 scale is gone. `cargo.ts`'s two sites are now one `build(kind)`
      through `buildShip`, so invariant 7's rotation is unavoidable.
- [x] Scooping a pod with a full hold rescues the pilot; `cargoTonnes` is
      unchanged by survivors — `test/world-step.test.ts`, through the real
      `CargoField.update` → step path, with a canister into the same full hold
      as the control. Red when `survivors` goes back into `cargoTonnes` and red
      when the hold is tested before the rescue again.
- [x] The scanner shows a pod as its own contact kind and colour —
      `test/hud-model.test.ts`. `scannerContacts`' parameter widened (the
      binding always had the real `Canister`), `pod`/`#ffd24d` added to
      `ContactKind` and `CONTACT_COLORS`; the painter is unchanged and
      `CONTACT_COLORS` is exported so the test can prove the two differ.
- [x] Ramming a pod without scoops names the capsule — and is not an offence:
      the step's `raiseLegal` is now counted by the test host, and it stays 0.
- [x] Snapshot round-trip still returns the capsule as a capsule; the parse
      gate still refuses a bad `kind`. `SNAPSHOT_VERSION` did not move. One
      check added: a capsule states `commodity: 0` on the object and the wire.
- [x] Full gates: `npm run check` (lint, 3353 tests, sizes, constants, the
      generated catalogues) exits 0, and `npm run campaign` passes — 38/40
      never broke, median Below Average, unchanged in shape by the tonnage.

Also landed, from "What to do": `POD_GRAZE = 16` beside `CANISTER_GRAZE` with
its own `@rule`, and `canisterCone` became `driftingCone(kind, dist)` — the old
name claimed a pod was cargo, which is this item's whole complaint. The graze is
four fifths of the canister's because the pod's catalogue radius is 16 source
units against the canister's 20, the ratio the two had while a capsule was a
canister at 0.8 scale. `constants:check` warns that 16 also appears as
`MISSION_KILL_THRESHOLD`, `WITCHPOINT_RADII` and `MAX_SAVE_NAME`: confirmed
coincidental, four unrelated domains.

## Verify

Confirmed by reading, 2026-08-09: three `CANISTER_HULL` build sites in
`cargo.ts`; `spawnCapsule` writes `commodity: 3`; `hud-model.ts:41` discards
`kind`; the no-scoops branch does not test `kind`; design 2 is present in
`geometry.generated.ts:29` and eagerly built by `elite-a-hulls.ts:126`.
