// The flight session: the state of the moment.
//
// Split out of game.ts, so that this state has a home which is not the
// orchestrator. It is one object for the same reason NpcState is. A snapshot
// walks it generically. So a new field here saves itself, and there is no list
// to keep in step.

/**
 * The flight session: every flag and timer that describes the moment.
 *
 * It is not who the commander is, which is commander.ts. It is not what is in
 * the sky, which is the entity arrays.
 *
 * One object for the same reason NpcState is one object. A snapshot IS this
 * object, walked generically. Written as separate fields on Game, the snapshot
 * caught five of twenty-three. Those twenty-three included `torusEngaged`.
 * Restore a save taken under torus drive, and the ship quietly flew at a
 * different speed from the run it came from.
 */
export interface SessionState {
  /** console message currently visible; empty once its lifetime expires */
  messageText: string;
  /** seconds left for `messageText` */
  messageTimer: number;
  hyperCountdown: number;
  torusEngaged: boolean;
  witchspace: boolean;
  /**
   * Which of the 23 released blueprint sets this system flies — `''` for none.
   *
   * STATE, and saved, for invariant 12's reason. It decides which designs turn
   * up, and two of its four input bits are draws of the seeded stream
   * (`blueprintRandomBits`). A fresh derivation on a reload would need those
   * draws back. So a restored system would meet a different reception from the
   * one the save was taken in.
   *
   * `game/blueprint-set.ts` chooses it, and `ship-specs.ts`'s `specsForSet`
   * says what it means.
   *
   * `''` is what a world flies before any arrival. It is also what every save
   * written before docs/TODO/138 restores as. That is the full roster, which is
   * exactly what those saves flew.
   */
  blueprintSet: string;
  npcTargetTimer: number;
  autoSaveTimer: number;
  energyLowTimer: number;
  policeScanned: boolean;
  /** counts down to the next POLICE PATROL CLOSING while a cop is in the band */
  scanWarnTimer: number;
  /**
   * Lines in the queue for the console that the current one holds, oldest
   * first.
   *
   * The console is one line. Some consequences only make sense once the
   * commander read the thing that caused them. Two examples: what a police
   * scan cost your record (docs/TODO/122), and what a deed cost your reputation
   * (docs/TODO/129). Said in the same frame as their cause, they would erase
   * it.
   *
   * A list rather than the single countdown this replaced. One act can owe the
   * console two lines: a scan marks the record AND the reputation. A one-slot
   * queue let the second silently overwrite the first.
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
   * 0 front, 1 rear, 2 left, 3 right. NOT a camera setting. laserForView()
   * picks the weapon from it, and viewDir() aims the shot. So a reload in rear
   * view used to fire the FRONT laser at empty space ahead.
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
 * Say it once the console is free. It goes behind whatever is on the console
 * now, and behind everything already in the queue.
 *
 * It is for a line that EXPLAINS another. Such a line has to arrive after the
 * one it explains, or it reads as an announcement out of nowhere.
 * `showMessage` would merely take the console away from its own cause.
 */
export function queueMessage(state: SessionState, text: string, seconds = 3): void {
  state.queued.push({ text, seconds });
}

/**
 * Advance the message lifetime as part of the fixed game step. Then hand the
 * console to the next line in the queue.
 *
 * The promotion is here rather than in the world step, because the station
 * owes the console lines too. A dirty sale over a counter marks your
 * reputation the same way a scan does. `Game.step` ticks this in flight and at
 * the dock alike.
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
 * A message has a companion payload to clear, and the beam has none. The clamp
 * still matters, because a snapshot takes this state. An expired flash then has
 * one stable representation, rather than a negative value that depends on the
 * frame count.
 */
export function tickBeam(state: SessionState, dt: number): void {
  state.beamTimer = Math.max(0, state.beamTimer - dt);
}
