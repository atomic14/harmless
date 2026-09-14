# The combat computer acquires targets but loses its aim

Review date: 12 September 2026. Source revision: `5abc879`.

The main weakness is sustained tracking. The computer often acquires a target within three seconds, then rolls around it without a useful shot. This happens with one selected target, so target switching cannot explain it.

The best first improvement is to control when pitch starts during a bank. An isolated experiment raised average tracking from **53.9% to 98.1%** across 54 additional orbit cases. Those figures describe prescribed target paths, not full combat or win rates. No production code changed during this review.

## Scope and measurement

The shipped pilot is [`ScriptedCoPilot`](../src/game/scripted-co-pilot.ts). The trained controller in [`combat-computer.ts`](../src/game/combat-computer.ts) is dormant.

The tracking probe uses the real player flight model, the shipped controller, and a pirate with radius 15. The player starts at speed 200. The target follows a prescribed path. Its position, orientation, and speed agree with that path.

Each run holds the same target throughout. This isolates steering from target selection. **Time on the gun** means the target is inside both `hitCone(radius, distance)` and `LASER_RANGE`, after the player moves. The first ten seconds are excluded from this measure. A tracking gap is consecutive time without that firing geometry.

The first grid contains 18 orbits and three straight or weaving paths. Runs last 30 and 60 seconds. The separate validation grid contains 54 orbits with different radii, speeds, and starting phases. Those runs last 45 and 90 seconds. These are deterministic grids, not estimates of encounter frequency.

## 1. High priority: stop the persistent roll around a target

**Evidence:** [`scripted-co-pilot.ts:184`](../src/game/scripted-co-pilot.ts#L184), [`pitch-roll-steer.ts:176`](../src/game/pitch-roll-steer.ts#L176), [`pitch-roll-steer.ts:200`](../src/game/pitch-roll-steer.ts#L200).

The co-pilot permits pitch before its bank aligns with the target. The steering rule reduces pitch by the cosine of the bank error. It does not stop pitch completely. Pitch can then move the target's bearing while roll tries to catch that bearing. The resulting motion can circle the target indefinitely.

The module already describes this failure for the course pilot. Its comment at [`pitch-roll-steer.ts:107`](../src/game/pitch-roll-steer.ts#L107) says combat never encounters it. The measurements contradict that claim.

These are the shipped controller's results. Orbit radius describes the target's path around a fixed centre, not its distance from the moving player.

| Target path | Time on gun, 30-second run | Time on gun, 60-second run | Longest gap in the 60-second run |
| --- | ---: | ---: | ---: |
| Horizontal orbit, radius 400, speed 300 | 28.5% | 32.2% | 3.70 s |
| Vertical orbit, radius 400, speed 300 | 100.0% | 100.0% | 0.00 s |
| Tilted orbit, radius 800, speed 300 | 17.6% | 17.3% | 1.60 s |
| Straight crossing, speed 150 | 34.5% | 13.8% | 42.88 s |
| Weaving away | 7.5% | 7.5% | 3.67 s |
| Straight away, speed 280 | 100.0% | 100.0% | 0.00 s |

Every case remains inside laser range throughout its measurement window. The vertical orbit requires pitch without roll and tracks well. Horizontal and tilted paths expose the coupled steering failure.

The straight-crossing case first enters firing geometry at 1.98 seconds. Later, it settles around 10.9 degrees off target. It accumulates 10.7 full turns of absolute roll travel per minute. This is a persistent miss after successful acquisition.

**Recommended change:** evaluate the existing hard bank gate for the combat pilot. The experiment passes `0.1` radians, about 5.7 degrees, as `bankToTurn`'s final argument. This withholds the pitch request until the bank error falls below that threshold. The current rate ramp still applies.

The experiment changes only that argument. Lead, throttle, flight limits, and the gun cone retain their shipped values.

| Measurement | Shipped controller | Hard bank gate |
| --- | ---: | ---: |
| Initial grid mean, 30-second runs | 68.9% | 98.3% |
| Initial grid mean, 60-second runs | 64.9% | 97.7% |
| Separate grid mean, 45-second runs | 56.7% | 98.1% |
| Separate grid mean, 90-second runs | 53.9% | 98.1% |
| Separate grid worst case, 90-second runs | 3.8% | 81.3% |

No case in the separate grid lost more than one percentage point of tracking. However, the longest initial acquisition increased from 4.90 to 5.47 seconds. The candidate also retains a 9.97-second gap in the original straight-crossing case.

Treat `0.1` as a promising candidate, not a final calibrated value. Check neighbouring thresholds, more initial orientations, and actual NPC fights before release. Include target changes and close passes. Preserve the player's pitch-and-roll flight model.

## 2. High priority: make tracking tests reject weak tracking

**Evidence:** [`scripted-co-pilot.test.ts:157`](../test/scripted-co-pilot.test.ts#L157), [`scripted-co-pilot.test.ts:373`](../test/scripted-co-pilot.test.ts#L373).

The existing circling test accepts anything above **20%** time inside the gun cone. It passes at roughly 29% and 32%. That threshold protects an earlier improvement but accepts poor tracking today.

The straight-crossing test has two further weaknesses:

- It moves the target sideways without aligning its quaternion with that motion. The controller derives velocity from that quaternion, so its predicted motion differs from the test path.
- It measures a fixed `0.1`-radian angle instead of the actual gun cone.
- It stops after 20 seconds. The corrected 60-second probe exposes a sustained miss that a short run can conceal.

**Recommended change:** make target position, orientation, and speed consistent in every motion fixture. Measure actual firing geometry, acquisition time, longest tracking gap, and roll travel separately. Include horizontal, vertical, and tilted paths. Set acceptance limits per case after validating the controller change. A high average must not hide a case that loses the target for 40 seconds.

## 3. Medium priority: refine lead after the bank problem is fixed

**Evidence:** [`scripted-co-pilot.ts:180`](../src/game/scripted-co-pilot.ts#L180).

The aim point uses target velocity multiplied by the remaining angle and `PURSUIT_LEAD_GAIN`. The lead depends on heading error, but not on whether the target flies straight or turns.

Removing lead globally is a poor remedy. In the fast horizontal orbit, the shipped controller falls from 32.2% to 4.1% tracking without lead. Reducing the gain to `0.5` also performs poorly across the first grid.

After the hard gate, the tradeoff becomes clearer:

| 60-second case | Gate with current lead | Gate without lead |
| --- | ---: | ---: |
| Fast horizontal orbit | 90.0% | 46.8% |
| Straight crossing | 74.3% | 98.7% |
| Weaving away | 99.7% | 87.0% |

**Recommended change:** keep the current lead for the first bank-control experiment. Then investigate a separate rule for settled pursuit of a straight target. Target angular motion and relative velocity are useful candidate inputs. These are follow-up hypotheses; this review does not establish a final lead rule.

## 4. Medium priority: make target commitment reflect progress

**Evidence:** [`scripted-co-pilot.ts:143`](../src/game/scripted-co-pilot.ts#L143), [`threat-lock.ts:75`](../src/game/threat-lock.ts#L75).

The computer treats a target within `ENGAGED_CONE`, about 34 degrees, as an attack in progress. That condition blocks a target switch. It checks neither gun range nor recent firing geometry.

A controller-level reproduction holds a target 3,000 units away and 23 degrees off the nose. A second hostile sits 500 units directly ahead. After ten seconds, the existing lock still refuses the easy shot. A fresh controller chooses it. This reproduction holds geometry fixed to test the selection rule alone.

**Recommended change:** expose the held target and the reason it remains selected in probe output. After correcting steering, measure whether a timed lack of progress should release the commitment. Retain the existing hold time and switching margin unless the measurements justify a change. Frequent target switching would introduce another tracking failure.

## 5. Medium priority: preserve the correct controller state at handover

**Evidence:** [`scripted-co-pilot.ts:83`](../src/game/scripted-co-pilot.ts#L83), [`scripted-co-pilot.ts:103`](../src/game/scripted-co-pilot.ts#L103), [`persistence.ts:141`](../src/game/persistence.ts#L141).

Three state defects affect tracking after an interruption:

- Manual override returns without clearing the stored turn rates. In a headless Game, the player stops rolling during manual flight. Re-engagement restores an old roll at **−1.13 rad/s**, despite a target directly ahead.
- `reset()` leaves `steerMem.side` unchanged. A reset controller can choose the opposite bank from a fresh controller at identical geometry.
- Persistence saves the dormant trained controller, not the scripted controller's rates or steering memory. A fresh Game restores the player's saved roll correctly, then replaces it on the next step. The reproduction changes a continued **−1.48 rad/s** roll to **−0.17 rad/s**.

**Recommended change:** define one handover contract. Seed a resumed controller from the player's current rates. Clear engagement-specific steering memory when an engagement ends. Save the scripted controller state required to resume a turn. Test continued flight after restore, not just equality immediately after restore.

## Other confirmed findings

These are separate from the tracking recommendation:

- **Automatic fire can use the wrong mount.** A rear-view command leaves combat steering engaged. The computer aims at a front pirate but fires the rear laser. In a one-frame Game reproduction, it hits a trader behind the player and changes legal status to Offender. Pass an explicit mount with the automatic shot request, or suppress that request outside its intended view. See [`flight.ts:351`](../src/game/flight.ts#L351) and [`combat-player.ts:34`](../src/game/combat-player.ts#L34).
- **Automatic fire does not check the first object the shot will hit.** A trader between the player and a pirate takes the automatic shot. The reproduction again changes legal status to Offender. Use the shared shot trace before authorizing an automatic shot. Preserve explicitly selected targets and the human trigger's own behavior. See [`scripted-co-pilot.ts:215`](../src/game/scripted-co-pilot.ts#L215) and [`shot.ts`](../src/game/shot.ts).
- **Missile defence ends when no ship target remains.** With a hostile missile still inbound, `combatSteer` reports `AREA CLEAR` and requests no E.C.M. Evaluate the missile response independently of whether steering has a ship target. See [`scripted-co-pilot.ts:151`](../src/game/scripted-co-pilot.ts#L151) and [`autopilot.ts:270`](../src/game/autopilot.ts#L270).

## Evidence and reproduction

The focused existing suite passed **87 assertions**. It covers the scripted co-pilot, steering, targets, threat lock, and aim integration.

The review artifacts contain the independent experiments:

- [Tracking probe](reviews/combat-computer-2026-09-12/probe.mjs)
- [426 tracking measurements](reviews/combat-computer-2026-09-12/measurements.jsonl), including lead-removal and reduced-lead experiments
- [State, selection, and firing reproductions](reviews/combat-computer-2026-09-12/integration-probe.mjs)
- [Integration results](reviews/combat-computer-2026-09-12/integration-results.jsonl)

Run these from the repository root:

```sh
node --experimental-strip-types --no-warnings docs/reviews/combat-computer-2026-09-12/probe.mjs
node --experimental-strip-types --no-warnings docs/reviews/combat-computer-2026-09-12/probe.mjs --hard-gate
node --experimental-strip-types --no-warnings docs/reviews/combat-computer-2026-09-12/probe.mjs --holdout
node --experimental-strip-types --no-warnings docs/reviews/combat-computer-2026-09-12/probe.mjs --holdout --hard-gate
node --experimental-strip-types --no-warnings docs/reviews/combat-computer-2026-09-12/integration-probe.mjs
```

The hard-gate option creates a temporary controller module and removes it after import. It does not modify the game's source. The checked-in probe reproduced the original baseline and separate candidate results byte for byte.

The probes measure control geometry without shots, damage, or an opponent that reacts to the player. They establish a steering defect and a strong candidate improvement. Actual combat balance and cockpit feel still require validation when that improvement is implemented.
