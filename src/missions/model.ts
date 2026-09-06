// The mission model: what a skeleton says, what a commander's progress holds,
// and what passes between the game and the mission machine.
//
// A SKELETON is one mission's rules, written in TypeScript by a developer. A
// DOSSIER is that mission's generated words, written offline by a model and
// committed as JSON. The machine (`machine.ts`) reads rules from the skeleton
// only, so generated text can never change what a mission does
// (docs/TODO/190).
//
// A LEG is one stage of a mission. Its VERB names the player's action, and a
// module under `verbs/` decides what each game event means for it. A BRANCH
// says which leg, or which final outcome, follows a trigger. A PLACEMENT says
// how the machine picks the leg's target world when the leg starts.
//
// Nothing here runs. The types are the contract between four places. Those
// are the skeletons under `skeletons/`, the verb modules, the machine, and the
// game code that sends inputs and applies effects.

import type { BlueprintOverride } from '../game/blueprint-set.ts';
import type { ShipDesignId } from '../game/ship-identity.ts';

/** A mission ship names a catalogue design (`ship-identity.ts`). */
export type ShipId = ShipDesignId;

/** An item a recovery leg wants. The item table arrives with docs/TODO/190 M4. */
export type ItemId = string;

/**
 * A mission act that moves the commander's reputation.
 *
 * `disrepute` is the delta that `afterDeed` (game/character.ts) applies. The
 * game applies it, not the machine, so the character ladder keeps one home.
 */
export interface Deed { disrepute: number }

/**
 * Who offers the mission. The Navy has no home world and no portrait. A world
 * patron is derived from the 1984 seed of the system at `seedSlot`, so Lave
 * always has the same governor.
 */
export type PatronRef = { kind: 'navy' } | { kind: 'world'; seedSlot: number };

/**
 * The facts about the commander that a rule can read. A projection of
 * `CommanderData`, so the machine cannot reach the purse or the hold.
 */
export interface CommanderFacts {
  galaxy: number;
  systemIndex: number;
  kills: number;
  combatScore: number;
  legalStatus: number;
  day: number;
}

/** A temporary change to a world that a later mission asks for. */
export interface WorldChange { override: BlueprintOverride }

/** A ship the game must spawn, with the mission tag it answers to. */
export interface TaggedShip { ship: ShipId; tag: string }

export type Verb =
  | { kind: 'hunt'; ship: ShipId; canEscape: boolean }
  | { kind: 'deliver'; cargo?: { commodity: number; tonnes: number } }
  | { kind: 'recover'; item: ItemId }
  | { kind: 'rescue' }
  | { kind: 'ambush' }
  | { kind: 'smuggle'; commodity: number; tonnes: number }
  | { kind: 'escort'; ship: ShipId }
  | { kind: 'scan'; ship: ShipId; seconds: number };

/**
 * Where a leg happens.
 *
 * `anywhere` is not in the plan's first list. The Constrictor's report leg
 * ends at ANY station, as the 1984 mission did, and no other placement says
 * that. `band` measures tenths of a light year on the chart. `handover`
 * counts jumps toward the named skeleton's start world. The arc plan, item
 * 192 of docs/TODO/190, fills it in.
 */
export type Placement =
  | { kind: 'here' }
  | { kind: 'anywhere' }
  | { kind: 'band'; min: number; max: number }
  | { kind: 'world'; seedSlot: number }
  | { kind: 'entity'; tag: string }
  | { kind: 'handover'; toward: string; min: number; max: number };

export type Trigger =
  | 'success' | 'failed' | 'targetEscaped' | 'targetDestroyed' | 'targetFled'
  | 'deadlinePassed'
  | { flag: string } | { survivor: 'landed' | 'sold' } | { choice: string };

export interface Settlement {
  /** tenths of a credit, paid once when the branch is taken */
  pay: number;
  deed?: Deed;
  /** a change to legal status, applied by the game */
  legal?: number;
  setFlags?: string[];
  /** a change to the player's standing with this patron */
  standing?: number;
  /**
   * What the console says when this settles. `{PAY}` is the fee in credits and
   * `{TARGET}` is the next leg's world. Absent means silence.
   */
  say?: string;
}

export interface Outcome extends Settlement {
  /** the skeleton this outcome opens, at that skeleton's start world */
  lead?: string;
}

export interface Branch {
  on: Trigger;
  to: string | 'complete' | 'fail';
  settle?: Settlement;
}

export interface Leg {
  id: string;
  verb: Verb;
  place: Placement;
  /**
   * The standing order in the game's voice, with `{TARGET}` for the world.
   * A dossier replaces it on screen when one exists. The line is a rule's
   * plain statement, not fiction, so it lives with the rules.
   */
  line: string;
  deadlineDays?: number;
  /**
   * Which released blueprint set this leg forces, and where. The Constrictor
   * waits at its target under set G. The Thargoids hunt the plans everywhere.
   */
  override?: { set: BlueprintOverride; where: 'target' | 'everywhere' };
  /** true raises the mis-jump chance, as the 1984 courier run did */
  carryingPlans?: boolean;
  /** the first branch whose trigger matches is the one taken */
  next: Branch[];
}

export interface Gate {
  minKills?: number;
  minRating?: number;
  legalStatus?: 'clean' | 'any';
  flags?: string[];
  notFlags?: string[];
  /** skeletons that must be finished first, by either outcome */
  done?: string[];
  withinJumps?: number;
  /** the Navy briefs in galaxy 1 only; a world patron is already in one galaxy */
  galaxy?: number;
}

export interface Skeleton {
  id: string;
  kind: 'arc' | 'side' | 'event';
  anchor: 'local' | 'relative' | 'fixed';
  patron: PatronRef;
  /** the console line that announces the offer on docking */
  hail: string;
  /** the offer in words on the MISSIONS screen, before a dossier replaces it */
  pitch: string;
  offer: Gate;
  /** `legs[0]` starts when the player accepts */
  legs: Leg[];
  complete: Outcome;
  fail: Outcome;
  /** skeletons this one shuts out, for good */
  excludes?: string[];
  /** how many times a side job repeats; absent means once */
  cap?: number;
}

export interface Patron {
  id: string;
  world: number | 'navy';
  name: string;
  role: string;
  species: string;
  voice: string;
  /** image path; '' uses the world's portrait */
  portrait: string;
}

export interface Dossier {
  skeleton: string;
  hash: string;
  title: string;
  /** pages, with {TARGET} {PATRON} {HERE} slots */
  briefing: string[];
  legs: Record<string, { arrive: string; success: string; fail: string }>;
  lead: string;
  rumour: { far: string; near: string };
  news: string;
  images: { target?: string; place?: string };
  story: {
    opening: string;
    closing: { complete: string; fail: string };
    /** by leg, then by outcome, with {WORLD} {DAY} */
    legs: Record<string, Record<string, string>>;
  };
}

export interface LiveMission {
  skeleton: string;
  leg: string;
  /** the leg's world, or null when any station will do */
  target: number | null;
  /** the tag of the ship this leg is about, or null */
  tag: string | null;
  /** what the verb module counts: an arrival, seconds on a scan */
  progress: number;
  deadlineDay: number | null;
}

export interface Lead { skeleton: string; galaxy: number; world: number; sinceDay: number }

export interface JournalEntry {
  skeleton: string;
  leg: string;
  /** `accepted`, a trigger name, `abandoned`, `complete` or `fail` */
  outcome: string;
  day: number;
  world: number;
}

export interface EntityState {
  ship: ShipId;
  /** hull left, as a fraction of full */
  hull: number;
  lastWorld: number;
  alive: boolean;
}

export interface MissionPassenger {
  /** the same identifier for the pod and its passenger */
  tag: string;
  /** the owning live mission's skeleton */
  mission: string;
}

export interface MissionState {
  /** at most `MISSION_LIVE_CAP` */
  live: LiveMission[];
  leads: Lead[];
  done: Record<string, 'complete' | 'fail'>;
  flags: string[];
  standing: Record<string, number>;
  entities: Record<string, EntityState>;
  passengers: MissionPassenger[];
  journal: JournalEntry[];
}

/** An event that already happened. The machine decides what it means. */
export type MissionInput =
  | { kind: 'docked' }
  | { kind: 'arrived' }
  | { kind: 'misjumped' }
  | { kind: 'dayPassed'; days: number }
  | { kind: 'destroyed'; tag: string }
  | { kind: 'escaped'; tag: string }
  | { kind: 'fled'; tag: string }
  | { kind: 'scooped'; tag: string }
  | { kind: 'scanned'; tag: string }
  | { kind: 'policeScan' }
  | { kind: 'escortLost'; tag: string }
  | { kind: 'escortSafe'; tag: string }
  | { kind: 'survivor'; tag: string; fate: 'landed' | 'sold' }
  | { kind: 'choice'; id: string }
  | { kind: 'accept'; skeleton: string }
  | { kind: 'abandon'; skeleton: string }
  | { kind: 'galaxyChanged'; from: number; to: number };

/** A consequence the game applies. The machine never touches the commander. */
export type MissionEffect =
  | { kind: 'say'; text: string; command?: 'openMissions' }
  | { kind: 'later'; text: string }
  | { kind: 'pay'; tenths: number }
  | { kind: 'deed'; deed: Deed }
  | { kind: 'legal'; delta: number }
  | { kind: 'lead'; skeleton: string; galaxy: number; world: number }
  | { kind: 'worldOverride'; world: number; until: number; change: WorldChange }
  | { kind: 'standingSpawn'; world: number; until: number; ships: TaggedShip[] };
