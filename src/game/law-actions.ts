// What the law does to a commander, and what she can do about it.
//
// The ORCHESTRATION half of the law, split out of `game.ts` by docs/TODO/150.
// `law.ts` next door owns the RULES — what a bribe costs, what a patrol is
// worth, what a fine leaves you with — and this holds what the Game does with
// them: offering money to a patrol, throwing the evidence overboard, raising a
// record, scrambling the station's fleet, and buying a name back.
//
// It is the same shape as `station.ts`: the state, plus a narrow host for the
// few things it has to reach back for. It decides and it spends; the Game owns
// the console, the sounds and what mode the ship is in.
//
// ONE ASYMMETRY IS THE WHOLE FEATURE, and it lives in `bribePolice`: a bribe
// never clears a record and never buys one back. The inspection latches the
// scan without raising anything, and the fight buys one ship out of one fight
// and leaves you exactly as Fugitive as you were. The NAME pays for both,
// refusals included.

import * as THREE from 'three';
import { formatCredits } from './commander.ts';
import { nearestEngaging, nearestNpc, type NpcShip } from './npc.ts';
import {
  bribeOffered, carryingContraband, inspectionPrice, patrolPrice, patrolReach,
  recordCleared, recordVerdict,
} from './law.ts';
import { launchStationDefence } from './spawning.ts';
import { offerBribe, type Dumped } from './jettison.ts';
import { random } from './rng.ts';
import {
  CLEAN, DEFENCE_RANGE, SCAN_LINE_SECONDS,
} from '../constants/law.ts';
import type { GameState } from './state.ts';

/**
 * The few things the law has to reach back to the Game for.
 *
 * WIDER THAN THE PLAN ESTIMATED, and the two extras are worth naming. The mode
 * is read twice and they are different questions — `mode()` includes an open
 * screen, so a bribe is refused while a chart is up, and `baseMode()` does not,
 * because the defence fleet cares where the SHIP is rather than what is on
 * screen. And two sounds are the Game's because `audio.ts` is platform: a child
 * that imported it would stop being portable.
 */
export interface LawHost {
  showMessage(text: string, seconds: number): void;
  queueMessage(text: string, seconds: number): void;
  /** a deed moved the Character score — see game/character.ts */
  markName(before: number, after: number): void;
  /** the mode INCLUDING an open screen */
  mode(): string;
  /** the base state, ignoring any screen over it */
  baseMode(): string;
  refused(): void;
  defenceLaunched(): void;
  cargoJettisoned(): void;
}

export class LawActions {
  private readonly state: GameState;
  private readonly host: LawHost;
  /** scratch, so a launch does not allocate a vector per Viper */
  private readonly scratch = new THREE.Vector3();

  constructor(state: GameState, host: LawHost) {
    this.state = state;
    this.host = host;
  }

  /**
   * The record moves — and the console says where it left you, once the deed
   * that moved it has been read (docs/TODO/130).
   *
   * THE ONE HOME of what a moved record says. It used to say `LEGAL STATUS: X`
   * on the spot, and `callStationDefence` three lines below erased it before a
   * frame was drawn, so becoming a Fugitive was never on the console at all;
   * the scan and the survivor sale had each already written out their own
   * `recordVerdict` because this line was no use to them. One rule now, said in
   * the console's running order: **what you did, what the sky did about it,
   * where you now stand.** Nothing here takes the console from its own cause.
   *
   * `recordVerdict` (law.ts) rather than the status alone, because the half a
   * player needs is who is coming — and it is assembled from the rule that
   * decides that, so it cannot promise a fight the sky will not deliver.
   *
   * **Only a MOVE speaks.** Every laser hit that lands on a trader reaches here
   * (combat.ts); a line per hit would shout the same record down the length of
   * a fight. A record that did not move is nothing happening, and nothing
   * happening is worth no line.
   *
   * @internal — driven by src/game/game.ts. The orchestrator holds the record
   * and delegates the move to here.
   */
  raiseLegal(level: number): void {
    if (level <= CLEAN) return;   // shooting a pirate is nobody's business
    const moved = this.state.commander.legalStatus < level;
    if (moved) this.state.commander.legalStatus = level;
    // The sky first: Vipers leaving the slot are happening NOW, and a pilot
    // being shot at wants that ahead of a sentence about paperwork.
    this.callStationDefence();
    if (moved) {
      this.host.queueMessage(recordVerdict(this.state.commander.legalStatus), SCAN_LINE_SECONDS);
    }
  }

  /**
   * Buy your name back at the station — the optional half of the law.
   *
   * Docking no longer clears your record (station.ts); this is the choice that
   * does. `recordCleared` (law.ts) owns the rule — the fine, capped at what you
   * can pay — and this applies it and announces it.
   */
  payFine(): void {
    const c = this.state.commander;
    const cleared = recordCleared(c.legalStatus, c.credits);
    if (!cleared) {
      this.host.showMessage('RECORD CLEAN — NO FINE DUE', 3);
      return;
    }
    c.credits = cleared.creditsLeft;
    c.legalStatus = CLEAN;
    this.host.showMessage(`FINE PAID: ${formatCredits(cleared.paid)} — RECORD CLEAR`, 4);
  }

  /**
   * Stations keep "a small fleet of ships for their own defence, which they
   * may risk to assist a trader if they see him attacked" — misbehave in
   * sight of the station and Vipers launch from the slot.
   */
  private callStationDefence(): void {
    // ...MISBEHAVE, which means in the sky. `raiseLegal` is reachable from the
    // station now — selling a survivor is an offence filed over a counter
    // (docs/TODO/127 M3) — and a docked ship is parked INSIDE the range test
    // below, so without this the sale would scramble Vipers into a world the
    // player is not in and cannot see. The record still moves; the fleet is
    // what waits until there is a ship to launch at.
    if (this.host.baseMode() !== 'flight') return;
    if (this.state.session.witchspace || this.state.session.defenceLaunched) return;
    if (this.state.player.position.distanceTo(this.state.world.station.position) > DEFENCE_RANGE) return;
    this.state.session.defenceLaunched = true;
    launchStationDefence(this.state.world, this.scratch);
    // Queued, because this used to erase the line that explained it —
    // ESCAPE CAPSULE DESTROYED and STATION HULL HIT both reach here through
    // `raiseLegal` (docs/TODO/130). It is not a delay where it matters: with a
    // quiet console `tickMessage` promotes it on the next step, so it waits
    // only when something is already speaking, which is when it should.
    this.host.queueMessage('STATION DEFENCE LAUNCHED', 4);
    // ...but the SOUND is immediate, so the speaker and the sky agree on the
    // frame the Vipers actually leave the slot.
    this.host.defenceLaunched();
  }

  /**
   * Offer the law money.
   *
   * Two situations and no mode: the Viper shooting at you, and the patrol
   * closing on a dirty hold. The key reads which one is in front of you, and
   * when there is neither it says so and spends nothing, the way an empty hold
   * answers HOLD EMPTY.
   *
   * `law.ts` decides what each costs and what it leaves; this spends the
   * credits, writes the latch and writes `satisfied` (invariant 10).
   *
   * **Neither half touches the record.** The inspection latches `policeScanned`
   * with no `raiseLegal`, so the scan does not happen and the Government's
   * paperwork stays spotless; the fight buys one ship out of one fight and
   * leaves you exactly as Fugitive as you were. The name pays for both
   * (`bribeOffered`), refusals included. That asymmetry is the whole feature: a
   * bribe never clears a record and never buys one back.
   *
   * @internal — driven by src/game/game.ts. The orchestrator owns the key and
   * delegates the offer to here.
   */
  bribePolice(): void {
    if (this.host.mode() !== 'flight') { this.host.refused(); return; }
    const c = this.state.commander;
    const session = this.state.session;

    // The fight comes first: a Viper already shooting is the more urgent
    // purchase, and buying an inspection off a man who is trying to kill you
    // would be money for nothing. One press buys ONE ship — a pair costs twice,
    // exactly as a gang of pirates does.
    const hunter = nearestEngaging(this.state.world.npcs, this.state.player.position,
      c.legalStatus, 'police');
    if (hunter) {
      const paid = this.offerTo(hunter.npc, patrolPrice(c.legalStatus));
      if (paid === null) return;
      // The same field the jettisoned cargo sets, honoured by the same line of
      // `isHostileToPlayer` — this ship is done with you. The RECORD is not
      // touched: you are still a Fugitive, the next patrol is a fresh problem,
      // and the station still wants its money.
      hunter.npc.state.satisfied = true;
      this.host.showMessage(`PATROL BREAKS OFF — ${formatCredits(paid)} AND YOUR NAME`, 4);
      return;
    }

    // The inspection: contraband aboard, nobody has read it yet, and a patrol
    // close enough to. `patrolReach` is the same window the console warned you
    // about, rather than a second opinion about the same two ranges.
    const cop = nearestNpc(this.state.world.npcs, this.state.player.position,
      (npc) => npc.role === 'police');
    if (!session.policeScanned && !session.witchspace && carryingContraband(c.cargo)
      && cop && patrolReach(cop.distance) !== 'none') {
      const paid = this.offerTo(cop.npc, inspectionPrice(c.cargo));
      if (paid === null) return;
      session.policeScanned = true;
      this.host.showMessage(
        `PATROL LOOKS THE OTHER WAY — ${formatCredits(paid)} AND YOUR NAME`, 4);
      return;
    }

    this.host.showMessage('NOBODY TO PAY OFF', 2);
    this.host.refused();
  }

  /**
   * Put the money in front of one ship: what it cost, or null if it bought
   * nothing.
   *
   * Both halves of the key go through here, so neither can acquire an answer
   * the other does not have — the shortfall, the refusal and the name are one
   * rule about offering money to a policeman, and only the CONSEQUENCE of a
   * taken offer differs between them.
   *
   * The roll comes off the world's seeded stream (invariant 11), and only when
   * an offer is actually made: a commander who cannot cover the price has not
   * said anything out loud, so nothing is spent and no draw is consumed.
   *
   * A refusal is an offence in front of a witness. `provokedByPlayer` — not
   * `provoked`, which is damage from any source — so he engages under the rule
   * that already exists, and the name is charged for the asking.
   */
  private offerTo(target: NpcShip, price: number): number | null {
    const c = this.state.commander;
    const offer = bribeOffered(price, c.credits, c.disrepute ?? 0, random());
    if (offer.outcome === 'short') {
      // the pirate bribe's own words for the same failure, rather than a second
      // way of saying "not enough, and here is the figure"
      this.host.showMessage(`THEY WANT MORE (${formatCredits(Math.ceil(offer.short))})`, 3);
      this.host.refused();
      return null;
    }
    // The name is charged here, so the line that says so is queued here too —
    // behind whichever of the four answers below the caller puts on the
    // console. A REFUSAL costs it as well, which is the one case that reads
    // like a bug until you have read docs/TODO/123: the deed is the asking.
    this.host.markName(c.disrepute ?? 0, offer.disrepute);
    c.disrepute = offer.disrepute;
    if (offer.outcome === 'refused') {
      target.state.provokedByPlayer = true;
      this.host.showMessage('THE OFFER IS REFUSED — AND REPORTED', 4);
      this.host.refused();
      return null;
    }
    c.credits = offer.creditsLeft;
    return offer.price;
  }

  /**
   * The road out of the ship, shared by both dumps: clear of your own scoop,
   * counted toward the toll, and offered to the pirates.
   *
   * `choose` is the only difference between them — WHICH tonnes go — and it is
   * passed rather than branched on so neither ordering can quietly acquire the
   * other's rule.
   */
  throwOverboard(
    choose: (cargo: number[]) => Dumped,
    nothingToDump: string,
  ): void {
    if (this.host.mode() !== 'flight') { this.host.refused(); return; }

    const dumped = choose(this.state.commander.cargo);
    if (dumped.tonnes.length === 0) {
      this.host.showMessage(nothingToDump, 1.5);
      this.host.refused();
      return;
    }
    // Out of the back, clear of your own scoop reach — `cargo.jettison`, not
    // `cargo.spawn`, which scatters a wreck's hold where it fell. Dropped at
    // the nose it landed inside SCOOP_RANGE and a commander with fuel scoops
    // fitted collected it again on the next frame.
    const nose = this.state.player.getForward(this.scratch);
    for (const commodity of dumped.tonnes) {
      this.state.world.cargo.jettison(this.state.player.position, nose, commodity);
    }
    this.state.session.jettisonedValue += dumped.value;
    this.host.cargoJettisoned();

    const n = dumped.tonnes.length;
    const bribe = offerBribe(
      this.state.world.npcs.filter((npc) => npc.role === 'pirate'),
      this.state.session.jettisonedValue, this.state.session.arrivalCargoValue);
    if (bribe.bought > 0) {
      this.host.showMessage(
        `${bribe.bought} ATTACKER${bribe.bought > 1 ? 'S' : ''} BREAKING OFF`, 3);
    } else if (bribe.stillWant !== null) {
      this.host.showMessage(
        `JETTISONED ${n}t ${dumped.lastName} — THEY WANT MORE `
        + `(${formatCredits(Math.ceil(bribe.stillWant))})`, 3);
    } else {
      this.host.showMessage(`JETTISONED ${n}t ${dumped.lastName}`, 2);
    }
  }
}
