// What a commander does while she is docked.
//
// One half of the orchestrator, split from the other by docs/TODO/155 M1 on
// Chris's rule of 2026-08-14: *"It makes sense to split docked from flight -
// they are very different things."* `game.ts` keeps the mode machine, the frame
// and the routing; this holds everything that only happens with the ship on a
// pad, and `flight.ts` will hold everything that only happens with it in the
// sky.
//
// ONE RESPONSIBILITY: what a commander does while she is docked. Arriving,
// leaving, the menu she reads, the market and the outfitters she trades at, the
// board she takes work from, and the one question the station will not let her
// leave without answering. Six faces of standing still at a station.
//
// `station.ts` next door owns the RULES of the two transitions — what a dock
// costs, what a launch rolls, what a fine leaves. This spends them.
//
// THE MODE MACHINE IS NOT HERE, and that is the seam. `setBaseMode` is a host
// method, so this file asks to become the docked mode and never declares
// itself to be it. A half that chose its own succession would be deciding what
// the other half is.
//
// IT IS PLATFORM, like `cockpit-view.ts` and `career.ts`. The docked menu is a
// screen, and a station is mostly a place where screens are read.

import type * as THREE from 'three';
import { renderDockedMenu, hideScreen } from '../ui/screens.ts';
import { Station, type StationEvent, type StationHost, type DockArrival } from './station.ts';
import { generateContractOffers } from './contract-offers.ts';
import { acceptContract, settleContracts, contractMessage, type ContractEvent } from './contracts.ts';
import {
  resolveSurvivors, survivorMessage, survivorOffers, type SurvivorChoice,
} from './survivors.ts';
import { SLAVES } from '../constants/commodities.ts';
import { SMUGGLE_DELIVERY_NOTORIETY } from '../constants/contracts.ts';
import { BRIEFING_VERSION } from '../constants/commander.ts';
import type { Contract } from './commander.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import { buyEquipment, type MarketScreen, type TradeContext } from './screens/trade.ts';
import type { ContractsScreen } from './screens/contracts.ts';
import type { Persistence } from './persistence.ts';
import type { Ordnance } from './ordnance.ts';
import type { SoundEvent } from './sounds.ts';
import type { GameState } from './state.ts';

/**
 * What being docked has to reach back to the Game for.
 *
 * The mode machine, the console, the sounds, and the three pieces of the
 * cockpit a station reaches through — the mouse, the tunnel and the nose.
 *
 * NOT ONE OF THEM IS A RULE. `setBaseMode` is the sharpest of them: the station
 * decides that a dock or a launch happened, and the orchestrator decides what
 * the game then IS. Splitting those two is what lets a half be a half.
 */
export interface DockedHost {
  /** the base state, ignoring any screen over it */
  baseMode(): 'dead' | 'docked' | 'flight';
  /** ask to become docked or flying — the mode machine is the parent's */
  setBaseMode(mode: 'docked' | 'flight'): void;
  showMessage(text: string, seconds: number): void;
  queueMessage(text: string, seconds: number): void;
  /** a message event, said or queued as it asks — see game.ts's `sayEvent` */
  sayEvent(e: { text: string; seconds: number; queued?: boolean }): void;
  /** the one place a SoundEvent becomes a noise (sounds.ts) */
  playSound(e: SoundEvent): void;
  /** a deed moved the Character score — see game/character.ts */
  markName(before: number, after: number): void;
  /** selling a person is an offence the Government notices */
  raiseLegal(level: number): void;
  /** the system we are standing in */
  system(): StarSystem;
  /** point the ship down a direction — a launch faces it out */
  lookAlong(dir: THREE.Vector3): void;
  /** a launch or an arrival fills the sky (world-build.ts) */
  populateSystem(situation: 'launch' | 'arrival'): void;
  openScreen(id: 'briefing' | 'survivors'): void;
  releaseMouseFlight(): void;
  startTunnel(seconds: number, way?: 'in' | 'out'): void;
}

export class Docked {
  private readonly state: GameState;
  /**
   * Docking, launching, and the menu between them — see station.ts.
   *
   * The two transitions that switch the mode, and the only two places the
   * station's own rules (the fine, the market roll, the bulletin board) are
   * applied.
   */
  private readonly station: Station;
  /** the market screen, which owns the row the buy and sell keys act on */
  private readonly market: MarketScreen;
  /** the bulletin board, which owns the job the accept key takes */
  private readonly contracts: ContractsScreen;
  /** the record, because docking and trading are both checkpoints */
  private readonly saves: Persistence;
  private readonly host: DockedHost;

  constructor(
    state: GameState, ordnance: Ordnance, market: MarketScreen,
    contracts: ContractsScreen, saves: Persistence, host: DockedHost,
  ) {
    this.state = state;
    this.market = market;
    this.contracts = contracts;
    this.saves = saves;
    this.host = host;
    this.station = new Station(state, ordnance, this.stationHost());
  }

  /**
   * What the station transitions may ask of this half.
   *
   * Same shape and same reason as `stepHost()` in game.ts. `populateSystem` is
   * a call rather than a returned event because it DRAWS from the seeded stream
   * (see station.ts). `settleContracts` remains a call at its exact seeded
   * position, but reports its sound and message for the station event stream
   * instead of applying either.
   */
  private stationHost(): StationHost {
    return {
      baseMode: () => this.host.baseMode(),
      setBaseMode: (mode) => { this.host.setBaseMode(mode); },
      lookAlong: (dir) => this.host.lookAlong(dir),
      populateSystem: (situation) => this.host.populateSystem(situation),
      checkpoint: () => { this.saves.checkpoint(); },
      settleContracts: () => this.settleContracts(),
      resetContractSelection: () => { this.contracts.selected = 0; },
    };
  }

  /** The station decides; this half says it. Same shape as applyStep. */
  private applyStation(events: readonly StationEvent[]): void {
    for (const e of events) {
      if (e.kind === 'sound' || e.kind === 'countdown' || e.kind === 'dockingMusic') {
        this.host.playSound(e);
        continue;
      }
      switch (e.kind) {
        case 'message': this.host.sayEvent(e); break;
        case 'persistence':
          if (e.action === 'forgetFlight') this.saves.forgetFlight();
          else this.saves.checkpoint();
          break;
        case 'presentation':
          if (e.action === 'releaseMouseFlight') this.host.releaseMouseFlight();
          else if (e.action === 'tunnel') this.host.startTunnel(1.4, e.way);
          else if (e.screen === 'docked') this.showDockedMenu();
          else hideScreen();
          break;
      }
    }
  }

  /**
   * The docked menu, drawn.
   *
   * ONE HOME, and it had three before docs/TODO/155 M1: the station event that
   * asks for the menu, the keyboard-layout key, and backing out of the new
   * commander panel. All three spelled out the same three-part call, so the
   * orders on the menu could have gone stale in two of them without the third
   * noticing.
   */
  showDockedMenu(): void {
    renderDockedMenu(this.host.system(), this.state.commander, this.station.orderLines());
  }

  /** Nothing on the stack, and the ship is on a pad: the menu is the base. */
  showBaseScreen(): void {
    this.applyStation(this.station.showBaseScreen());
  }

  /** @internal — driven by src/game/game.ts, which delegates to it. */
  enterDocked(arrival: DockArrival = 'arrived'): void {
    // Once per commander, whatever brought them here: a fresh boot, a real
    // docking, or a restored save from before the marker existed. The marker
    // moves BEFORE the dock so an 'arrived' checkpoint persists it in the same
    // act; the other arrivals write nothing here (docs/TODO/43/45), so theirs
    // rides the next ordinary save. Opening counts as shown — abandoning the
    // briefing must not trap a player in an onboarding loop, and H is the
    // permanent way back (docs/TODO/106).
    const brief = this.state.commander.briefingSeen < BRIEFING_VERSION;
    if (brief) this.state.commander.briefingSeen = BRIEFING_VERSION;
    this.applyStation(this.station.dock(arrival));
    if (brief) this.host.openScreen('briefing');
    // ...and the question the station will not proceed without an answer to,
    // pushed LAST so it is on TOP (docs/TODO/127). Both can be due at once — a
    // save from before the briefing marker, restored with somebody aboard — and
    // the order is decided here rather than left to whichever happens to open:
    // the forced choice is what is holding the clearance up, and the briefing
    // is reading matter that will still be there behind it.
    if (this.state.commander.survivors > 0) this.host.openScreen('survivors');
  }

  /** @internal — driven by src/game/game.ts, which delegates to it. */
  launch(): void {
    this.applyStation(this.station.launch());
  }

  /** The only slice of the Game the market and outfitters are allowed to see. */
  tradeContext(): TradeContext {
    return {
      commander: this.state.commander,
      system: this.host.system(),
      market: this.state.market,
      atHermit: this.state.session.hermitTrading,
      cheat: this.state.cheat,
      message: (text, seconds) => this.host.showMessage(text, seconds),
      queueMessage: (text, seconds) => this.host.queueMessage(text, seconds),
      addNotoriety: (amount) =>
        this.state.living.addNotoriety(this.state.commander.systemIndex, amount),
      checkpoint: () => { this.saves.checkpoint(); },
      leaveHermit: () => {
        this.state.session.hermitTrading = false;
        this.state.session.hermitCooldown = true;
        this.host.showMessage('LEAVING THE HERMIT', 3);
      },
    };
  }

  /** @internal — driven by src/game/game.ts, which delegates to it. */
  buyCargo(want: number): void { this.market.buy(want); }

  /**
   * @internal — no caller at all (docs/TODO/151 M1). The market screen sells
   * through `TradeContext`, and `buyCargo` above keeps the scripted caller that
   * this one lost.
   */
  sellCargo(want: number): void { this.market.sell(want); }

  /** @internal — driven by src/game/game.ts, which delegates to it. */
  buyEquipment(id: string): void { buyEquipment(id, this.tradeContext()); }

  /**
   * Work on offer here today. Deliberately generous compared to the original,
   * which gated missions behind a high combat rating — a new commander should
   * always have somewhere to be.
   * @internal — no caller at all (docs/TODO/151 M1). The station and the
   * campaign both call the free `generateContractOffers` in contract-offers.ts,
   * which this method only wraps.
   */
  generateContractOffers(): Contract[] {
    return generateContractOffers(
      this.host.system(), this.state.systems, this.state.commander.day);
  }

  /**
   * The bulletin board decides; this half says it and plays its named sound.
   *
   * Messages come back as StationEvents rather than going straight to the HUD
   * because docking says several things in a row and the last one is the one
   * the player reads — see station.ts.
   *
   * ...and the consequences the pure module cannot reach: landing a smuggling
   * run raises the destination's temperature, which is `LivingGalaxy` state
   * `settleContracts` has no handle on. The module decides, the orchestrator
   * applies (invariant 15). ONE application per event, here and at the
   * campaign's own settle site — the dock path in station.ts must not add a
   * second, which would double the heat of every delivery.
   */
  private applyContracts(events: readonly ContractEvent[]): StationEvent[] {
    return events.flatMap((e): StationEvent[] => {
      if (e.kind === 'paid' && e.contract.kind === 'smuggle') {
        this.state.living.addNotoriety(
          e.contract.destination, e.contract.qty * SMUGGLE_DELIVERY_NOTORIETY);
      }
      const m = contractMessage(e, this.state.systems);
      return [
        ...(m.sound ? [{ kind: 'sound' as const, name: m.sound }] : []),
        { kind: 'message', text: m.text, seconds: m.seconds, queued: m.queued },
      ];
    });
  }

  /** @internal — driven by src/game/game.ts, which delegates to it. */
  acceptContract(): void {
    const events = acceptContract(
      this.state.commander, this.state.contractOffers, this.contracts.selected);
    if (events.some((e) => e.kind === 'accepted')) {
      this.contracts.selected = Math.max(0, this.contracts.selected - 1);
    }
    this.applyStation(this.applyContracts(events));
  }

  /**
   * What the two dirty answers pay here: the station's own Slaves quote, read
   * off the market this dock rolled rather than priced again (docs/TODO/127).
   */
  survivorOffers(): { sale: number; release: number } {
    return survivorOffers(
      this.state.commander.survivors, this.state.market[SLAVES]?.price ?? 0);
  }

  /**
   * The survivors rule decides; this half says it (docs/TODO/127).
   *
   * Same shape as `applyContracts` and for the same reason: `survivors.ts` is
   * pure, and everything a choice touches outside the commander — the console,
   * and in M3 the region's heat and the Government's opinion — lands here.
   */
  answerForSurvivors(choice: SurvivorChoice): void {
    const c = this.state.commander;
    const before = c.disrepute ?? 0;
    const e = resolveSurvivors(c, choice, this.survivorOffers());
    if (!e) return;
    // The law and the region first, so the SALE has the console after them:
    // `raiseLegal` QUEUES what the record now means (docs/TODO/130), so the
    // line the player reads first is the one explaining what they just did.
    if (e.kind === 'sold') {
      this.state.living.addNotoriety(c.systemIndex, e.heat);
      this.host.raiseLegal(e.offence);
    }
    this.host.showMessage(survivorMessage(e), 4);
    // ...then the record, waiting behind the receipt that caused it
    // (docs/TODO/122), and then what it did to your name (docs/TODO/129).
    this.host.markName(before, c.disrepute ?? 0);
  }

  /** Pay out anything delivered here; drop anything overdue. */
  private settleContracts(): StationEvent[] {
    return this.applyContracts(settleContracts(this.state.commander));
  }
}
