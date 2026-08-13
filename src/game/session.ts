// The flight session: what is happening right now.
//
// Split out of game.ts so the state has a home that is not the orchestrator.
// It is one object for the same reason NpcState is: a snapshot walks it
// generically, so adding a field here saves it and there is no list to keep
// in step.

/**
 * The flight session: every flag and timer that describes what is happening
 * right now, as opposed to who the commander is (commander.ts) or what is in
 * the sky (the entity arrays).
 *
 * One object for the same reason NpcState is one object — a snapshot is this,
 * walked generically. Written as separate fields on Game, the snapshot caught
 * five of twenty-three, and the twenty-three included `torusEngaged`: restore
 * a save taken under torus drive and the ship quietly flew at a different
 * speed from the run it came from.
 */
export interface SessionState {
  /** console message currently visible; empty once its lifetime expires */
  messageText: string;
  /** seconds remaining for `messageText` */
  messageTimer: number;
  hyperCountdown: number;
  torusEngaged: boolean;
  witchspace: boolean;
  /**
   * Which of the 23 released blueprint sets this system flies — `''` for none.
   *
   * STATE, and saved, for invariant 12's reason: it decides which designs turn
   * up, and two of its four input bits are draws of the seeded stream
   * (`blueprintRandomBits`). Re-deriving it on a reload would need those draws
   * back, so a restored system would meet a different reception from the one the
   * save was taken in. `game/blueprint-set.ts` chooses it and
   * `ship-specs.ts`'s `specsForSet` says what it means.
   *
   * `''` is what a world flies before any arrival, and what every save written
   * before docs/TODO/138 restores as — the full roster, which is exactly what
   * those saves were flying.
   */
  blueprintSet: string;
  npcTargetTimer: number;
  autoSaveTimer: number;
  energyLowTimer: number;
  policeScanned: boolean;
  /** counts down to the next POLICE PATROL CLOSING while a cop is in the band */
  scanWarnTimer: number;
  /**
   * Lines waiting for the console the current one is holding, oldest first.
   *
   * The console is one line, and some consequences only make sense AFTER the
   * thing that caused them has been read: what a police scan cost your record
   * (docs/TODO/122), what a deed cost your name (docs/TODO/129). Said in the
   * same frame as their cause they would erase it.
   *
   * A list rather than the single countdown this replaced, because one act can
   * owe the console two lines — a scan marks the record AND the name — and a
   * one-slot queue would have made the second silently overwrite the first.
   */
  queued: { text: string; seconds: number }[];
  defenceLaunched: boolean;
  hermitTrading: boolean;
  hermitCooldown: boolean;
  jettisonedValue: number;
  arrivalCargoValue: number;
  genShipSeen: boolean;
  trumbleTimer: number;
  beaconTimer: number;
  paused: boolean;
  /**
   * 0 front, 1 rear, 2 left, 3 right. NOT a camera setting: laserForView()
   * picks the weapon from it and viewDir() aims the shot, so reloading in
   * rear view used to fire the FRONT laser at empty space ahead.
   */
  view: number;
  ccEngaged: boolean;
  beamTimer: number;
  dcEngaged: boolean;
}

/** Put a message in canonical state; the HUD only paints these fields. */
export function showMessage(state: SessionState, text: string, seconds = 3): void {
  state.messageText = text;
  state.messageTimer = seconds;
}

/**
 * Say it once the console is free — behind whatever is on it now, and behind
 * anything already waiting.
 *
 * For a line that EXPLAINS another: it has to arrive after the one it explains
 * or it reads as an unprompted announcement, and `showMessage` would simply
 * take the console away from its own cause.
 */
export function queueMessage(state: SessionState, text: string, seconds = 3): void {
  state.queued.push({ text, seconds });
}

/**
 * Advance the message lifetime as part of the fixed game step, and hand the
 * console to whatever has been waiting for it.
 *
 * The promotion is here rather than in the world step because a queued line is
 * owed from the station too — a dirty sale over a counter marks your name the
 * same way a scan does — and `Game.step` ticks this whether the ship is flying
 * or docked.
 */
export function tickMessage(state: SessionState, dt: number): void {
  if (state.messageText) {
    state.messageTimer -= dt;
    if (state.messageTimer > 0) return;
    state.messageText = '';
    state.messageTimer = 0;
  }
  const next = state.queued.shift();
  if (next) showMessage(state, next.text, next.seconds);
}

/**
 * Advance the cockpit beam lifetime as part of the fixed game step.
 *
 * Unlike messages, the beam has no companion payload to clear. Clamping still
 * matters because this state is snapshotted: an expired flash has one stable
 * representation rather than a frame-count-dependent negative value.
 */
export function tickBeam(state: SessionState, dt: number): void {
  state.beamTimer = Math.max(0, state.beamTimer - dt);
}
