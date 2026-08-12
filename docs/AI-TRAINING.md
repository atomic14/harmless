# Ship AI: from behaviour trees to self-play RL, and a living galaxy

> **This document is the original design, not the as-built spec.** It differs in
> every dimension that has a number in it. The policy MLP (a multilayer
> perceptron) and the neuroevolution trainer both shipped
> (`src/ai-training/`, `train/evolve.ts`). Each section that shipped differently
> carries an AS BUILT note. The authority is always `src/ai-training/policy.ts`,
> which exports the sizes. For the runs, the curves and the hyperparameters, see
> `docs/TRAINING-LOG.md`. Watch the results at `/viewer`.

Chris's questions: can we train ship AI with reinforcement learning, pitting
AIs against AIs in a simulated environment? And can we simulate a whole
universe of ships doing their own thing, flying between systems?

Short answers. **Yes, and it is very tractable for this game**, because our
flight model is tiny and deterministic. And **yes**, with a two-level
simulation. The design is below.

## The scripted tier

> **No trained policy ships.** `src/ai-training/brains/` holds no weights at
> all — only a `.gitkeep`. The game flies three hand-written code pilots.
> `pursuit` is what a pirate flies by default: it chases onto your six, then
> breaks into the attack run when you turn onto it. `attack-run` flies the armed
> traders and the combat computer you buy; it is the hand-written three-phase
> run, pointed the other way. `scripted` is the A/B control, and it reverts the
> whole game to the three-phase attack run. `src/game/brain-names.ts` states that
> pairing: `SHIPPED_BRAINS` is `{}`, `pirateBrainNameFor` returns `pursuit`
> (`scripted` when the A/B asks for it), and `defenceBrainNameFor` returns
> `attack-run` (again `scripted` under the A/B). `npm test` reads those files
> rather than a list. `train/evolve.ts` can breed a candidate for research. The
> game loads nothing it produces until `brains.ts` imports it and this file
> names it.

`src/game/npc.ts` implements the behaviour matrix by hand:

- **Traders** arrive from deep space. They work the station ↔ planet lane, and
  they depart through their own jump flash. They flee when attacked, and they
  use E.C.M.
- **Pirates** hunt the player in loose packs. Each ship gets its own bearing
  offset, so a group attacks from spread directions. They prey on traders when
  the player is out of reach.
- **Police** attack a pirate on sight. They attack a fugitive player too.
- **Lone bounty hunters** ignore a clean player. They hunt an offender and a
  pirate. They draw from the released bounty-hunter slot band — nine hulls, led
  by the Fer-de-Lance (`ship-roles.ts`).
- **Thargoids** are always hostile. They deploy Thargon drones, which go inert
  when the mothership dies.

This is decent 1984-plus AI. Reinforcement learning (RL) is the path to a
dogfight that feels *alive*: lead pursuit, energy management, break turns, and
pack flanking that emerges rather than a scripted equivalent.

## Why RL fits here unusually well

The whole flight model is about 10 numbers per ship — position, quaternion,
speed and the turn-rate caps — with closed-form updates and probabilistic
gunnery. A headless simulation that renders nothing can run **millions of
ship-seconds per minute** in a Node worker. Small inputs, a small action space
and cheap rollouts: this is the regime where a simple method beats a fancy one.

## Proposed architecture

### 1. Extract the sim core

Take the kinematics and the combat resolution out as a pure module, with its own
vector maths and no three.js. That buys fast headless episodes.

> **AS BUILT — no separate core, and that is the lesson.** A copy cannot deliver
> "a trained policy behaves identically in training and in the shipped game",
> however carefully somebody mirrors it. So the kinematics run *in the game*.
> `world-step.ts`, `collisions.ts`, `systems.ts`, `gunnery.ts` and a `PlayerShip`
> that flies a `FlightDemand` all run headless under node. `scenario.ts` builds
> each episode from the engine directly. Same benefit, and no copy.

### 2. Observation & action spaces (per ship)

Observation (about 30 floats, all in the ship's own frame, so a policy
generalises):
- Own state: speed/maxSpeed, energy, shields, laser temp, missiles left
- For the K=3 nearest ships: relative position (unit dir + log distance),
  relative velocity, their nose direction vs us, hull class one-hot,
  hostile/neutral flag
- Nearest missile: direction + distance + closing speed
- Objective context: direction to protectee (trader being escorted), pack
  centroid offset (pirates), home/escape vector

Actions (discrete, and they match the keyboard model — 3×3×3×2 = 54 combos):
- pitch {-1, 0, +1} · roll {-1, 0, +1} · throttle {down, hold, up} ·
  trigger {fire, don't}

> **AS BUILT — smaller, and the encoders are the authority.** The observation
> covers one target, not K=3. `observe()` writes `OBS_SIZE = 13` floats, and its
> own docstring in `policy.ts` names each slot. The target's speed is not a slot;
> it reaches the network through the closing rate. Three wider encoders extend
> the observation. `observePack` adds the direction and the log distance of the
> nearest living packmate (`PACK_OBS_SIZE = 17`). `observePackWide` adds enough
> about that mate to fly a complementary line, rather than merely to avoid it
> (`PACK_WIDE_OBS_SIZE = 25`). `observeDefend` (`DEFEND_OBS_SIZE = 29`) is the
> defender's own encoder: it observes the ship's own pools (hull and energy
> bank), the shield split (fore and aft faces), an inbound warhead, the velocity
> of the threat it fights, and a second threat. The pack encoders still see no
> shields, no missiles, no hull-class one-hot and no protectee channel. Those
> numbers mean nothing to a pirate, so the phase that needs them pays for them.
> `observeFor()` picks the encoder that a given brain wants: the defence encoder
> by its E.C.M. head, otherwise the widest encoder that its inputs allow. That is
> why the choice has one home.
>
> The action SPACE is as designed, at 3×3×3×2 = 54 reachable combinations. It is
> not 54 outputs. `act()` emits `OUT_SIZE = 11` logits as four independent heads
> (pitch 3, roll 3, throttle 3, fire 2), and it takes an argmax per head. The
> policy is therefore deterministic, and the head count grows additively rather
> than multiplicatively. The defence policy adds a FIFTH head for the E.C.M.
> (`DEFEND_OUT_SIZE = 13`). It is a two-logit press, and `act()` reads it into
> `Control.ecm`. Only the defence family has that head, so a pirate never asks
> for it.

### 3. Policy representation

A tiny MLP: 30 → 64 → 64 → action logits, about 7k parameters. At runtime that is
a few thousand multiply-adds per ship per AI tick. 10 Hz is plenty, because a
human does not re-decide at 60 Hz either. It is effectively free for 20 ships.
The weights ship as a `Float32Array` in a JSON file. Inference is 30 lines of
TypeScript, with no runtime dependency.

> **AS BUILT — a quarter of the size.** `HIDDEN = 32`, so the solo network is
> 13 → 32 → 32 → 11. `genomeSize()` in `policy.ts` is the one place that works
> the parameter count out: 1,867 for a solo brain, 1,995 for the pack width
> (still just under 2k), and 2,251 for pack-wide. Only pack-wide is over 2k. The
> defender is bigger on purpose. `DEFEND_HIDDEN = 64`, so its net is
> 29 → 64 → 64 → 13, at about 6,925 parameters. A world that holds a second
> threat and a warhead asks more of the network than the lone-hunter phases did.
> Do not restate these numbers here. Call `genomeSize(obsSize, hidden, outSize)`
> if you need one. Everything else in this section held: two `tanh` layers, the
> weights as a `Float32Array` in a JSON file, inference in `act()` with no
> runtime dependency, and the 10 Hz tick. `brainFly` in `npc.ts` re-decides every
> 0.1 s and ramps between decisions.

### 4. Training method — two phases

**Phase A: neuroevolution self-play (the recommended start).**
Take a population of about 64 policies. Evaluate each one over a few hundred
randomised duels and skirmishes. Then select and mutate — with CMA-ES
(covariance matrix adaptation), or with simple truncation plus noise. There is no
backprop and no Python, and it runs overnight in Node worker threads.
Neuroevolution is famously competitive on a policy under 100k parameters, and the
asynchronous tournament *is* the AI-against-AI arena you described.

> **AS BUILT — the defaults are smaller.** `train/evolve.ts` runs POP=48,
> GENS=300, EPISODES=3, ELITES=8 by default. Every one of those takes a `--`
> override. The population is not about 64.

**Phase B (if we want sharper play): PPO self-play in Python.**
PPO means proximal policy optimization. Port the sim, which is about 300 lines of
maths. Train with PPO and league play: the current policy against a pool of past
checkpoints, in mixed roles. Export to ONNX or to raw weights. This is only worth
the cost if Phase A plateaus below what we want.

### 5. Role-specific rewards

| Role | Reward |
| --- | --- |
| Pirate (pack) | shared: damage dealt to target + kill bonus + cargo canisters spilled − damage taken − friendly fire; small penalty per second, which buys decisive attacks |
| Trader | +survival per second, +big bonus to reach the jump-out point alive, − damage taken; it learns evasion, the jink, and the run for mass-lock-free space |
| Bounty hunter | +kill on marked target only, − shots at neutrals, efficiency bonus (time/energy) |
| Police | +pirate kills, +traders alive in their patrol radius, − response time |
| Thargon swarm | shared: damage to player-proxy, and each second alive while the mothership lives |

The curriculum runs in four steps: a static target, then a target that drifts,
then the scripted AI of today, then the self-play league. The scripted AI stays
forever as the "grader". A candidate policy must beat it convincingly before it
ships.

### 6. Integration

`NpcShip` gains a `brain: 'scripted' | PolicyBrain` field. A PolicyBrain maps an
observation to an action, and then to the same steering primitives:
`steerToward` becomes a raw pitch rate and roll rate. A settings toggle lets us
A/B a scripted ship against a trained ship in-game. Train the **pirate pack**
first, because it has the most gameplay value. Then train trader evasion, then
the hunters.

> **AS BUILT — no such field, and that is the point.** A ship does not carry a
> brain. `NpcShip.update` asks `pirateBrainFor(tier, organised, brains)` or
> `defenceBrain(brains)` on each frame that needs one. `brains` is the
> `BrainSelection` handed in with the world view, and ultimately `state.brains`.
> `game/brain-names.ts` holds the rule for which name flies for whom, and
> `game/brains.ts` holds the weights behind a name. The ship holds only the
> cached decision and the ramped rates (`brainControl`, `brainTimer`,
> `brainPitchRate`, `brainRollRate`), and a snapshot covers all of them. The A/B
> toggle is `state.brains` — game state, not a settings global (invariant 12).
> The LIVE BRAINS row on the combat trainer's setup panel reaches it. `brainFly()`
> is the single implementation of "how a brain-flown ship moves", and a training
> episode flies a candidate genome through that same method.

## The living galaxy (ships doing their own thing, between systems)

Use two simulation levels, so the cost stays bounded.

**Level 1 — abstract galaxy layer.** Each system gets a lightweight economy
state: a traffic rate λ derived from productivity and government (we already
compute both), a pirate-risk score, and a commodity price drift from the recent
simulated trade volume. A ship between systems is only a record:
`{shipClass, cargo, from, to, etaTimestamp}`. A few hundred of these cost
nothing. They advance whenever the player does anything, or on a timer. This is
how the universe "keeps happening" while you are docked.

**Level 2 — instantiation at the boundary.** When the player is in a system,
each Level-1 arrival due there materialises as a real NPC. It uses the
witch-flash arrival we already have, and it flies its actual cargo to the
station. When a trader jumps out, it returns to Level 1 with a real destination
and a real ETA. Destroy a trader, and its cargo genuinely never arrives, with a
tiny price effect at the destination market. Pirates congregate at Level 1 in
systems with high traffic and low government, which is exactly where you meet
them at Level 2.

The classic seeded galaxy stays the *baseline*. The living layer stores only
*deltas* — a recent price nudge, a traffic event — so the saves stay small and
the 1984 determinism survives underneath.

### Suggested build order

1. Extract the sim core. This also unlocks headless testing of all combat.
2. Add the Level-1 traffic records. Wire the arrivals and departures to the
   trader lifecycle we already have. The payoff is visible at once.
3. Build the neuroevolution trainer, in a Node worker, with the pirate pack
   first.
4. Ship the trained pirate brains and trader brains behind a toggle.
5. Drive the market deltas from the simulated trade. Migrate the pirate risk.
