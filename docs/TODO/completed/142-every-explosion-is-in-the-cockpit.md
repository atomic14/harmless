# 142 — Every explosion is in the cockpit

**Kind:** defect · **Severity:** medium · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #25 — *"An explosion far away has
the same volume as an explosion next to you,"*

The issue is the distance. The stereo place is Chris's addition on 2026-08-13,
and it is M3. The two are one item because they need the same seam: an event
that carries where it happened. Neither is possible without it, and building it
twice is how a rule grows a second home.

**M1, M2 and M3 all landed on 2026-08-13.** `npm run check` passes at 4,374
assertions, 30 of them new in `test/sound-place.test.ts`, and every one of the
five gates was shown to fail by breaking the rule it protects.

**Chris flew it the same day and closed the item on it.** He reported the
playtest done and asked for the issue to be marked off. That answers the two
questions no assertion reaches, and both numbers stay where they were chosen:
`AUDIBLE_RANGE` at the scanner's reach, and `STEREO_WIDTH` at 0.7.

## What the milestones found that the plan did not have

**No test had ever played a noise, and the fake said so by throwing.** The
recording `AudioContext` in `test/audio-fixtures.ts` had no `createBuffer` and no
`createBufferSource`, so the first call to `explosion` under it died on
`a.createBuffer is not a function`. Seven sounds start with a `noiseBurst` —
`explosion`, `hit`, `damage`, `ecm`, `bomb`, `hyperspace` and `tunnel` — and not
one of them had ever been called in a test. `test/audio.test.ts` names 32 sounds
and every one of them is built from `tone`, which is a `sweep`. The fake has the
two members now. They record nothing, because a noise has no pitch to assert.

**The envelope's floor decides two things, so it is written once.** A voice
scaled below the level the envelope decays TO would ramp upwards over its own
length, which is a bang played backwards. So `env` returns null under the floor
rather than building a voice, and `sweep` and `noiseBurst` return early. A wreck
beyond earshot now costs no oscillator and no buffer, and `tones.length === 0` is
what a test reads to say a sound was not made at all.

**The zero-distance guard is defensive, not live, and the plan said otherwise.**
The plan called a warhead on your own hull "the live case". It is not:
`hitPlayer` carries the MISSILE's position (`ordnance.ts:358`), which is inside
`MISSILE_HIT_RANGE` and never equal to the player's. The guard stays, because the
failure it prevents is a silence with no error, but the comment beside it now
says what is true.

**Two unrelated constants needed a `@rule` id.** `STEREO_WIDTH` is 0.7, and so
are `CARGO_LOSS_CHANCE` (hull-breach.ts) and `THARGOID_FIRE_RATE` (npc-gun.ts).
`separateRules` in `tools/constants-check.ts` only counts two constants as
independent when BOTH carry an id, and neither of those did. Both have one now,
and each doc says which of the three it is.

**The plan's `PAN_WIDTH` is called `STEREO_WIDTH`, and `Place` carries a `side`
rather than a `pan`.** Two names for two things: `side` is the raw direction the Game measures,
&minus;1 to 1, and `pan.value` is what `audio.ts` writes after it applies the
width. Calling the input a pan invited the two to be confused, and WebAudio has
already taken the word for the output.

**The domain check reads the FILE PURPOSE, not the file.** `likelyOwner` scores
every OTHER domain over its symbols, docs and header, and scores the constant's
OWN domain over the module header alone. So a constant is warned about unless its
own file header uses its words. `src/constants/audio.ts` names the reach and the
width in its first two lines for that reason, and the repository is back at zero
warnings.

**Two comments were wrong before this item touched them.** `world-step.ts:141`
said *"A tone, in hertz"* above `heard`, which described a `beep` helper deleted
when every sound took a name. And `Combat.fire`'s station branch worked out where
the bolt struck AFTER it asked for the bang; the impact point moves above the
sound now, because a station is big enough that where you scraped it is not where
its centre is.

## Where we are

A rule module asks to be heard. It returns `{ kind: 'sound'; name }`
(`src/game/sounds.ts`). `Game.playSound` is the one place that turns the request
into a noise, and it calls `sfx[e.name]()` (`src/game/game.ts:1547`).

No sound event carries a place. So `sfx.explosion()` opens at gain 0.3 whether
the ship went up against the hull or at the edge of the scanner
(`src/audio.ts:86`). The issue reports that. The defect is wider.

Five emitters name a sound that happens somewhere in the world. None of them
attenuates:

| sound | emitted by | the place it happens |
| --- | --- | --- |
| `explosion` | `Combat.wreck` (`combat.ts:311`) | the wreck |
| `explosion` | `applyOrdnance` (`world-step.ts:511`, `:515`) | the warhead |
| `hit` | `Combat.fire` (`combat.ts:159`, `:178`, `:192`) | what the bolt struck |
| `enemyLaser` | `applyNpcFire` (`world-step.ts:776`) | the ship that fired |
| `ecm` | `applyOrdnance` (`world-step.ts:521`) | the missile that died |

Every other sound is the cockpit's own: your gun, the console beeps, the
warnings, the dock and the launch. Those are correct at full gain. They happen
where you are.

**The enemy laser is neither, and M1 found it.** Chris asked whether a bolt
should be judged by where it was fired from or by how close it passes. The code
answers: `heard('enemyLaser')` is pushed only inside the `shot.at === 'target'`
branch of `resolveNpcFire` (`world-step.ts:770`). An NPC shooting ANOTHER NPC
draws a tracer and plays nothing. So the sound already means one thing — someone
is shooting at YOU — and the beam always ends on the hull, or within 80 to 220
units of it on a miss.

To attenuate it by the shooter's range would therefore quieten the one sound that
always happens next to the pilot. It keeps full gain and takes a SIDE. So there
are three categories, and the third has one member:

| category | sounds |
| --- | --- |
| attenuated and placed | `explosion`, `hit`, `ecm` |
| placed, never attenuated | `enemyLaser` |
| the cockpit's own | everything else |

Two facts about the emitters decide the shape of the fix. Each of the five knows
the position of its own source. Not one of them knows where the player is:
`Combat` holds the `World` and nothing else, and `World` holds no player. The
one object that knows both is the `Game`, which is also the only caller of
`playSound`.

## What to do

### M1 — the event carries its place

Give the sound event an optional source position:
`{ kind: 'sound'; name: SoundName; at?: THREE.Vector3 }`. Use a type-only
`import type * as THREE from 'three'`, the form `game/fire-resolution.ts`
already uses, so `sounds.ts` stays erasable and headless.

Set `at` at the five emitters in the table above. Leave every cockpit sound
without it.

`Combat.wreck` takes an `NpcShip` and reads `npc.object.position`, so it needs
no new parameter. Clone the vector. The ship is despawned two lines later.

### M2 — the curve, and one home for it

`Game.playSound` measures `e.at` against `this.state.player.position` and passes
the DISTANCE to `audio.ts`. It never passes a gain. That is the precedent
`sfx.countdown(n)` set: the world step reports the occasion, and the audio
design is decided in `audio.ts`.

Add one private helper to `audio.ts`:

```
function distanceGain(distance: number): number
```

It returns 1 at zero range and falls to 0 at the audible edge. Give the five
`sfx` members that can attenuate an optional `distance = 0` parameter, and have
each one multiply its own gain by `distanceGain(distance)`. A default of 0 means
every existing caller and every existing test keeps the sound it has today.

### M3 — the stereo place

A distance says how far. It does not say which side. M3 puts each of the five
into the stereo field, and the project has already built every part of it for
the docking waltz.

**`views.ts` gains `viewRight(quaternion, view, out)`**, beside `viewDirection`
and in the same two lines: set `(1, 0, 0)`, apply `VIEW_QUATS[view]`, apply the
quaternion. That file already owns which way a view faces, and which way a view's
right lies is the same question. It depends on nothing, which is the property its
header protects.

**`Game.playSound` turns the two into a pan.** Take the vector from the player to
`e.at`, normalise it, and dot it with the view's right vector. The result is
&minus;1 to 1 already. Pass it to `audio.ts` beside the distance.

**`audio.ts` places the voice.** Widen the second parameter of the five `sfx`
members from a number to `{ distance, pan }`, both optional. Insert the panner in
`env()`, the one function every voice already routes through, using the exact
form `music.ts:195` uses:

```
const panner = a.createStereoPanner?.();
```

A browser with no `StereoPannerNode` connects straight through. The comment in
`music.ts` states the rule and it holds here too: a missing panner must cost the
placement, not the sound.

**Scale the dot before it is spent.** A raw dot hard-pans anything abeam into one
ear. `PAN = [-0.28, 0.24, 0]` in `music.ts` shows the project already declines to
do that by choice. Add `STEREO_WIDTH` to `src/constants/audio.ts` beside
`AUDIBLE_RANGE`, and multiply.

## Decisions already made

**Every sound with a place attenuates, not only the explosion** (Chris,
2026-08-13). The mechanism has to be built either way, so a fix that left the
enemy laser at full volume across the system would be the same defect with one
row removed.

**The audible edge is the scanner edge.** Add `AUDIBLE_RANGE` to a new
`src/constants/audio.ts`, as an expression over `SCANNER_RANGE`
(`src/constants/console.ts`, 6000) rather than as the digit 6000. A ship beyond
the scanner is a ship you cannot see, and "you hear what you could see" is one
rule with one home. This is the trick `HERMIT_REFUSES_AT` uses over `CHARACTER`.
Give it its own `@rule` id.

**The curve is `(1 - d / AUDIBLE_RANGE)²`, clamped at 0.** One constant, and no
second number to justify. It gives 0.25 of the gain at half the scanner, and
silence at the edge. The alternative is a true inverse-square law, which is
physically right and wrong for a game: it puts a kill at 300 metres at a
hundredth of the volume of one on the hull, and the fight stops being audible
long before it stops being dangerous.

**The sky is in stereo, and the ear turns with the VIEW** (Chris, 2026-08-13).
Not with the hull. The camera quaternion is `player.quaternion` composed with
`VIEW_QUATS[view]` (`game.ts:1722`), so a ship on the left of the screen is on
the left of the screen in rear view as well. An ear bolted to the hull would pan
that ship into the wrong side of the cockpit the moment the pilot looked at it,
which reads as a defect rather than as a frame of reference.

This is the argument `viewDirection` already makes for the gun, in its own doc
comment: what the player perceives and acts through is the VIEW. The missile
lock, the sight and a rear-view shot all use it. The ear is one more.

**M3 is a separate milestone from M2, and a separate commit.** How loud a bang is
and which side it is on are two audible judgements. Either can be reverted alone.

## Watch out for

**A source at zero distance has no direction, and this project has been bitten by
that exact shape before.** Normalising a zero-length vector gives NaN, and one
NaN in `pan.value` or in a gain ramp takes the voice out in silence. It is
`nose × heading` again — the degenerate case that docs/TODO/134 found in the
docking computer, where the cross product collapsed exactly when the controller
succeeded. Guard it: below some small distance the pan is 0 and the gain is 1.
A warhead that goes off on the hull is the live case, not a hypothetical one.

**`src/audio.ts` declares no module-level constant today, and the constants gate
is why.** `test/constants.test.ts` fails any `UPPER_CASE` const at column zero in
`src/` outside `src/constants/` that is not on its list. `music.ts` is on that
list; `audio.ts` is not. So `AUDIBLE_RANGE` and `STEREO_WIDTH` both go in
`src/constants/audio.ts`. Do not add `audio.ts` to the list instead. Both are
rules about where a thing is in the world, not judgements about how a note
sounds. That is the line the list itself draws for `music.ts`.

**`src/constants/` may not import three.** `views.ts` says so in `VIEW_QUATS`'s
own doc comment, and it is why that table stays in `views.ts`. `viewRight`
returns into a caller's vector for the same reason. Neither new constant is a
vector, so neither is affected.

**Do not read the pan off `this.render.camera`.** Its quaternion is the right
one, and reaching for it would make a sound depend on the renderer. `views.ts`
depends on nothing, and the header of that file says the one import cycle this
project ever had was over exactly this function.

**Run `npm run generate:constants` before the gates, not after them.** A new
constant's doc comment is the `Purpose` column of `src/constants/CATALOG.md`.
`docs/PROCESS.md` step 3 has this row.

**`applyStep` drops two event kinds before `playSound` ever sees them**
(`game.ts:1776`). `npcFired` and `playerDealt` are for a measuring caller. Do not
route the enemy laser's sound through either of them.

**`combat-sim.ts` consumes the same events and plays nothing.** An added field
must stay optional so the simulator and the trainer keep compiling untouched.

**The countdown and the docking waltz are separate event kinds.** Neither takes a
position. Leave both alone. The waltz builds its own panners, and M3 must not
reach into them: `music.ts` places three SID voices by arrangement, and the sky
places a bang by where it is. Two subjects, two homes, one node type.

## Verification

Tier: this touches the audio layer and no game rule. `npm run check` is the whole
of it. No probe measures a fight differently for it, and no balance number moves.

New gates, in `test/audio.test.ts`, driven by the recording context in
`test/audio-fixtures.ts`:

1. An explosion at zero distance keeps exactly the gain it has today. This is
   the regression the default parameter is for.
2. An explosion at the audible edge is silent.
3. An explosion at half the audible edge is a quarter of the near gain. That
   pins the curve rather than the fact of a curve.
4. A cockpit sound is unchanged at any player position. Move the player and
   assert the tone is identical.

And one in `test/game.test.ts` or beside the world-step tests:

5. A wreck at a known position reports a sound event carrying that position, and
   a beep reports one carrying none. This pins the seam, not the curve.

M3 adds four more, and `test/audio-fixtures.ts` already records what they read.
It exports `panners`, and `test/music.test.ts:59` already counts them. Nothing
new is needed in the fake:

6. A bang to starboard pans right; the same bang to port pans left; one dead
   ahead and one dead astern both pan centre.
7. **Rear view flips it.** Same world position, same player, view 1 rather than
   view 0, and the pan is the negative of what it was. This is the decision
   above, and it is the assertion that would catch an ear bolted to the hull.
8. Nothing ever reaches a full &plusmn;1. `STEREO_WIDTH` is what holds that, and
   `test/music.test.ts:64` already asserts the same property for the waltz.
9. **A browser with no `StereoPannerNode` still makes the sound.** Delete
   `createStereoPanner` from the fake and assert the tone is unchanged. The
   fixture's own comment says this fallback needs its own test, and the waltz
   has one.

**Prove each gate can fail.** Break the rule each one protects: return a
constant 1 from `distanceGain` for 2 and 3, drop the `at` at `Combat.wreck` for
5, multiply a cockpit sound by the curve for 4, drop `VIEW_QUATS` out of
`viewRight` for 7, and set `STEREO_WIDTH` to 1 for 8.

One more, and it needs no new gate. A warhead detonating on the player's own
hull must not silence the voice. Assert it plays at all — that is the NaN guard,
and NaN fails every comparison rather than throwing.

**Chris flew it on 2026-08-13, and headphones were the flight.** Two questions
reached no assertion. Does a fight still SOUND dangerous once the far half of it
goes quiet? And does a pirate on your six announce itself in the correct ear?
Both answers were one number — `AUDIBLE_RANGE` for the first, `STEREO_WIDTH` for
the second — and **neither had to move.**

There was a third thing only a pilot could judge, and it is the reason M3 was
worth building at all. **A stereo place is information.** Elite gives the pilot a
scanner, and a bang off the left ear is the same fact one beat earlier. That is
the claim the flight accepted.
