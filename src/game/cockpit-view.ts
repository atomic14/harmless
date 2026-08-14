// What the cockpit shows about the world.
//
// Split out of `game.ts` by docs/TODO/150 M3. `hud/hud-binding.ts` turns state
// into a dashboard, `hud/hud.ts` paints one, and `prompts.ts` decides which
// commands are worth offering — this is the ADAPTER between those rules and the
// Game that holds the world. It is the layer `hud-binding.ts` deliberately
// refuses in its own opening: "There is no `Game` here and no callback out."
//
// ONE RESPONSIBILITY: what the cockpit shows about the world. The gunsight
// lamp, the laser beams' meeting point, the prompt line and the dashboard frame
// are four surfaces of that one question. Each one reads the world and returns
// a picture; not one of them decides anything.
//
// IT ONLY READS. Nothing here writes to `state`, and that is the north star
// invariant 1 states — the renderer only reads the world. The two vectors below
// are scratch for the maths, and the beam attribute is the picture itself.

import * as THREE from 'three';
import { buildHudFrame } from '../hud/hud-binding.ts';
import { Hud } from '../hud/hud.ts';
import { flightPrompts, type Prompt } from './prompts.ts';
import { hitCone } from './gunnery.ts';
import { viewDirection } from './views.ts';
import { keyIfBound } from '../ui/key-help.ts';
import type { ControlMode } from './controls.ts';
import type { ExerciseStrip } from './combat-sim-strip.ts';
import type { Ordnance } from './ordnance.ts';
import type { Presentation } from '../engine/shell.ts';
import type { GameState } from './state.ts';
import { AIM_ASSIST, LASER_RANGE } from '../constants/player-gun.ts';
import { PLAYER_FLIGHT } from '../constants/player-flight.ts';
import { BEAM_Z } from '../engine/render-stack.ts';

/**
 * What the cockpit has to reach back to the Game for.
 *
 * FIVE, and each is a thing only the orchestrator knows. Three of them answer a
 * question about the machine rather than about the world: which binding table
 * is live, whether the ship is flying, and whether an exercise is running. The
 * fourth is the sight lamp, which lives on the shell.
 *
 * `inFlight` REPLACES THREE READS OF `mode`, and they were the same question
 * asked three times — the sight, the prompt line and the dashboard each tested
 * `mode === 'flight'`. One host method now, so the three cannot drift apart.
 *
 * `view` IS A METHOD RATHER THAN A CONSTRUCTOR ARGUMENT, and boot order is why.
 * The Game builds its shell inside its own constructor, because the shell needs
 * the scene the Game has just made — so the `Presentation` does not exist while
 * the Game's fields are being initialised, and a copy taken then would be
 * undefined.
 */
export interface CockpitHost {
  /** in the cockpit with no screen over it: the only state that has a HUD */
  inFlight(): boolean;
  /** which binding table answers, or null when no keyboard is live */
  controlMode(): ControlMode | null;
  /** the exercise's own strip, or null in career flight */
  exerciseStrip(): ExerciseStrip | null;
  /** the shell's gunsight lamp — `audio.ts`'s neighbour on the platform seam */
  setSightLit(on: boolean): void;
  /** the eye and the beams parented to it, from `Shell.view` */
  view(): Presentation;
}

export class CockpitView {
  private readonly state: GameState;
  private readonly ordnance: Ordnance;
  private readonly hud: Hud;
  private readonly host: CockpitHost;

  /** what the game is SEEN through: a camera, the beams, and one draw call */
  private get render(): Presentation { return this.host.view(); }

  /**
   * Scratch for the per-frame dashboard read, so it allocates nothing.
   */
  private readonly hudScratch = {
    a: new THREE.Vector3(), b: new THREE.Vector3(),
    c: new THREE.Vector3(), q: new THREE.Quaternion(),
  };

  /**
   * Two scratch vectors, and they are this file's OWN rather than the Game's.
   *
   * The same reason `placeOf` keeps `soundAt` and `soundRight`: the draw runs in
   * the middle of a frame whose step is already holding a vector in the Game's
   * `tmp`, so a shared scratch would corrupt whatever that frame was measuring —
   * silently, and only sometimes.
   */
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();

  constructor(state: GameState, ordnance: Ordnance, hud: Hud, host: CockpitHost) {
    this.state = state;
    this.ordnance = ordnance;
    this.hud = hud;
    this.host = host;
  }

  /** Direction the current view faces, in world space. The maths is the step's. */
  viewDir(out: THREE.Vector3): THREE.Vector3 {
    return viewDirection(this.state.player.quaternion, this.state.session.view, out);
  }

  /**
   * Light the sight when the aim assist would actually reach the target.
   *
   * The circle shows the envelope at knife range; this tells the truth for
   * the target in front of you right now, since the assist tapers with
   * distance. Together they answer "will this shot land?" without the player
   * having to learn the numbers.
   */
  private updateSight(): void {
    let on = false;
    if (this.host.inFlight()) {
      const forward = this.viewDir(this.tmp);
      for (const npc of this.state.world.npcs) {
        if (!npc.state.alive || npc.role === 'asteroid') continue;
        const to = this.tmp2.copy(npc.object.position).sub(this.state.player.position);
        const dist = to.length();
        if (dist > LASER_RANGE) continue;
        const cone = hitCone(npc.radius, dist);
        if (forward.angleTo(to.normalize()) < cone) { on = true; break; }
      }
    }
    this.host.setSightLit(on);
  }

  /**
   * Point the cockpit beams at `target`, or straight down the gun axis when
   * there is nothing to converge on.
   *
   * The beams are children of the camera and meet at (0, 0, -BEAM_Z), so the
   * convergence point is simply the target direction in camera space at the
   * same depth. Only the meeting point moves — the emitters stay on the hull
   * corners, which is what sells the beams as bending.
   */
  aimBeams(target: THREE.Vector3 | null): void {
    const pos = this.render.beams.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    let x = 0, y = 0, z = -BEAM_Z;
    if (target) {
      const local = this.render.camera.worldToLocal(this.tmp2.copy(target));
      const len = local.length();
      if (len > 1e-3) {
        x = (local.x / len) * BEAM_Z;
        y = (local.y / len) * BEAM_Z;
        z = (local.z / len) * BEAM_Z;
      }
    }
    // vertices 1 and 3 are the convergence point (0 and 2 are the emitters)
    arr[3] = x; arr[4] = y; arr[5] = z;
    arr[9] = x; arr[10] = y; arr[11] = z;
    pos.needsUpdate = true;
  }

  /**
   * The prompt line: what a key can do about what is happening, with the key
   * the table actually binds in front of it.
   *
   * The join between a pure rule and invariant 9. `prompts.ts` decides WHICH
   * commands are worth offering and what each is worth right now; `boundKey`
   * answers what to press, from `controls.ts`, which is the one home of that —
   * so rebinding a command rewrites its own prompt and no letter is ever
   * written out in prose. Only in flight: the station menu already renders its
   * own keys from the same table.
   *
   * @internal — public so a test can read what the cockpit is offering without
   * scraping the painted line, the way `jettisonCargo` is driven directly.
   */
  keyPrompts(): string[] {
    const mode = this.host.controlMode();
    if (!this.host.inFlight() || !mode) return [];
    return flightPrompts({
      commander: this.state.commander,
      playerPos: this.state.player.position,
      npcs: this.state.world.npcs,
      policeScanned: this.state.session.policeScanned,
      witchspace: this.state.session.witchspace,
      energy: this.state.sys.energy,
      missileInbound: this.ordnance.missileInbound,
      // `>= 0` is `sendDistressBeacon`'s own reading of the timer, over in
      // game.ts: a beacon already broadcasting is what that key refuses, and
      // this is the prompt for that key.
      beaconSent: this.state.session.beaconTimer >= 0,
      stationDistance: this.state.player.position
        .distanceTo(this.state.world.station.position),
      dcEngaged: this.state.session.dcEngaged,
    }).flatMap((p) => {
      const line = this.renderPrompt(p);
      return line ? [line] : [];
    });
  }

  /**
   * One offer as the cockpit prints it: the key this mode binds, then the
   * words. Null when it binds none.
   *
   * `keyIfBound`, not `boundKey`: the arena's table subtracts eight of the
   * cockpit's commands, so an unbound one here is an ordinary answer — the
   * offer simply is not made — rather than a build failure. Shared with the
   * ordnance refusals, which carry a `Prompt` for the same reason a prompt does
   * (docs/TODO/128 M3): a rule module may not name a key.
   */
  renderPrompt(p: Prompt): string | null {
    const mode = this.host.controlMode();
    const key = mode ? keyIfBound(mode, p.command) : null;
    return key ? `${key} ${p.what}` : null;
  }

  /** How wide the sight circle is drawn, in pixels, at this focal length. */
  sightRadius(pxPerRad: number): number {
    return Math.tan(AIM_ASSIST) * pxPerRad;
  }

  renderHud(dt: number): void {
    this.updateSight();
    const frame = buildHudFrame({
      commander: this.state.commander,
      sys: this.state.sys,
      world: this.state.world,
      camera: this.render.camera,
      playerPos: this.state.player.position,
      playerQuat: this.state.player.quaternion,
      playerForward: this.state.player.getForward(this.tmp),
      viewDir: this.viewDir(this.tmp2),
      speedFrac: this.state.player.speed / this.state.player.maxSpeed,
      rollFrac: this.state.player.rollRate / PLAYER_FLIGHT.maxRoll,
      pitchFrac: this.state.player.pitchRate / PLAYER_FLIGHT.maxPitch,
      view: this.state.session.view,
      missiles: this.ordnance.missiles,
      canisters: this.state.world.cargo.items,
      targetLock: this.ordnance.targetLock,
      missileArmed: this.ordnance.armed,
      inFlight: this.host.inFlight(),
      witchspace: this.state.session.witchspace,
      assist: this.state.session.ccEngaged,
      ecmDetected: this.state.ecmDetectedTimer > 0,
      messageText: this.state.session.messageText,
      messageTimer: this.state.session.messageTimer,
      prompts: this.keyPrompts(),
      // Null in career flight, and gated on the same `active` that decides the
      // exercise owns the keyboard (controlMode) — the strip is the exercise's
      // own view of itself, not a second opinion about one.
      exercise: this.host.exerciseStrip(),
    }, this.hudScratch);

    this.hud.render(dt, frame);
  }
}
