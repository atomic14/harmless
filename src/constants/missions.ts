// The Navy mission, as numbers: what earns the briefing, how far away each leg
// is laid, and what the Navy pays.
//
// The skeletons under src/missions/skeletons/ spend these, and the machine
// in src/missions/machine.ts runs them (docs/TODO/190). Money is in tenths
// of a credit (invariant 8), and distances are in tenths of a light year, as
// everywhere else.

import { RATINGS } from './rating.ts';

/**
 * Kills before the Navy considers you worth a word: 16, as the original demanded.
 * It is the one gate that this game keeps from the 1984 mission structure.
 *
 * @rule missions.killThreshold
 */
export const MISSION_KILL_THRESHOLD = 16;

/**
 * The Constrictor hides this far from where you are briefed, in tenths of a
 * light year. That is three to eight jumps of hunt. The name is
 * MISSION_HUNT_RANGE to stay distinct from `hunt-ranges.ts`, where a "hunt
 * range" is in world units.
 */
export const MISSION_HUNT_RANGE = { min: 30, max: 80 } as const;

/** The courier run is longer: the plans matter more than your convenience. */
export const MISSION_COURIER_RANGE = { min: 50, max: 90 } as const;

/** What a kill of the Constrictor pays — 2,500 Cr, in tenths of a credit. */
export const CONSTRICTOR_BOUNTY = 25_000;

/**
 * ...and what a delivery of the plans pays: 1,500 Cr.
 *
 * @rule missions.courierPayment
 */
export const COURIER_PAYMENT = 15_000;

/**
 * How many missions a commander can hold open at one time: three.
 *
 * Chris chose three on 2026-09-06 (docs/TODO/190). One slot would make a lead
 * wait for the current mission to end. The bulletin board already offers
 * several contracts at once, and a mission is no rarer than a job. The mission
 * machine (`missions/machine.ts`) refuses a fourth acceptance. A saved lead
 * waits in `MissionState.leads` until a slot frees.
 *
 * It equals `MAX_CONTRACTS`, and that is a coincidence, not a rule. A board
 * job and a mission are separate slots. Each cap moves on its own evidence.
 *
 * @rule missions.liveCap
 */
export const MISSION_LIVE_CAP = 3;

/**
 * Days before a finished side job is offered again: a week.
 *
 * Failure rule 5 (docs/TODO/190): a side mission comes back after a delay,
 * and an arc never does. The delay is what stops one patron's one job from
 * reading as the only work in the galaxy. `missions/offers.ts` reads it
 * against the day the job last ended.
 *
 * It is a count of DAYS, and the word puts it beside the jump constants. It
 * is a mission's rule: nothing about a jump reads it.
 *
 * @domain missions
 * @rule missions.reofferDays
 */
export const MISSION_REOFFER_DAYS = 7;

/**
 * Inside this many jumps of a lead's world, the station talks about it. The
 * bulletin board carries a rumour, and the DATA ON page carries a line.
 *
 * "About five jumps" is Chris's phrase (docs/TODO/190). An arc's end is two to
 * four jumps from the next arc's start, so a commander who just finished one
 * is always inside it. `missions/hints.ts` counts the jumps on the full-tank
 * graph (galaxy/route.ts).
 *
 * @rule missions.leadRumourJumps
 */
export const LEAD_RUMOUR_JUMPS = 5;

/**
 * Docks with no mission progress before a patron with a lead writes a second
 * time.
 *
 * One further message, not a stream (docs/TODO/190 M3 step 3). Four docks is
 * about a trade loop. A commander who docked four times without touching a
 * mission is trading. One line is a reminder rather than a nag.
 *
 * @rule missions.leadNagDocks
 */
export const LEAD_NAG_DOCKS = 4;

/**
 * What a side job pays, per verb, in tenths of a credit.
 *
 * One table rather than eight constants, because the eight are one decision.
 * A side job pays less than the Navy's bounty and more than a board contract
 * of the same run. The hunt pays most, because the target shoots back. The
 * scan pays least, because nothing is fired. `missions/skeletons/side.ts`
 * spends them, and nothing else reads the table. A pipeline that prices a
 * job from its dossier is the arc plan's (item 192 of docs/TODO/190).
 *
 * @rule missions.sideJobPay
 */
export const SIDE_JOB_PAY = {
  hunt: 8_000, deliver: 3_000, recover: 4_000, rescue: 5_000,
  ambush: 6_000, smuggle: 7_000, escort: 6_000, scan: 2_500,
} as const;

/**
 * What the station pays for the whole gang on the side hunt, in tenths of
 * a credit: 1,500 Cr (docs/TODO/217 M1). The gang is a Fer-de-Lance with
 * an Asp, a Krait and a Mamba. That is four hulls, two missiles and two
 * E.C.M. fits, against the lone Krait that paid `SIDE_JOB_PAY.hunt`.
 * Each kill pays its own bounty on top, as any kill does.
 *
 * @rule missions.gangBounty
 */
export const GANG_BOUNTY = 15_000;

/**
 * ...and half of it when the gang is gone but its leader ran (docs/TODO/217
 * M1). The leader keeps its head, and the commander keeps three kills.
 *
 * @rule missions.gangBrokenBounty
 */
export const GANG_BROKEN_BOUNTY = GANG_BOUNTY / 2;

/**
 * Kills before the board offers the gang hunt (docs/TODO/217 M2). Chris
 * asked for gates by kills on 2026-09-13. It is the kills of the second
 * rung, Mostly Harmless. So a commander who reads that word on the status
 * screen finds the job on the board. A gang of four kills a Harmless one.
 * The Navy asks for twice as many (`MISSION_KILL_THRESHOLD`).
 *
 * @rule missions.gangHuntKills
 */
export const GANG_HUNT_KILLS = RATINGS[1][0];

/**
 * Kills before the board offers a lane to clear or a trader to cover: half
 * the gang hunt's (docs/TODO/217 M2). Both jobs meet a pack of three on
 * the way, and both let a commander choose the range. The delivery, the
 * scan and the smuggle stay open, and the two scoop jobs ask for scoops.
 *
 * @domain missions
 * @rule missions.laneJobKills
 */
export const LANE_JOB_KILLS = GANG_HUNT_KILLS / 2;

/**
 * The rung the Dark Wheel's first whisper waits for (docs/TODO/219 M1):
 * Above Average, 128 kills. Chris chose it on 2026-09-13. The Wheel finds
 * a commander worth finding, and a Harmless one is not yet.
 *
 * @rule missions.wheelWhisperRung
 */
export const WHEEL_WHISPER_RUNG = RATINGS.findIndex(([, name]) => name === 'Above Average');

/**
 * The governments whose boards carry the Wheel's word (docs/TODO/219 M1),
 * by their 1984 names. The Wheel posts nothing where a government reads
 * the boards. `galaxy.ts` owns the names, and the offers filter compares
 * a world's own against this list. It is a narrower line than
 * `LAWLESS_GOVERNMENT` in encounters.ts, which breeds pirate waves up to a
 * dictatorship. A dictatorship reads its boards.
 *
 * @domain missions
 * @rule missions.lawlessGovernments
 */
export const LAWLESS_GOVERNMENTS: readonly string[] = ['Anarchy', 'Feudal'];

/**
 * What a Wheel trial pays, in tenths of a credit (docs/TODO/219 M1). More
 * than an arc leg of the same verb, because the Wheel asks more. The mark
 * is a gang with two Asps. The door pays nothing: its reward is a fit.
 *
 * @rule missions.wheelPay
 */
export const WHEEL_PAY = { mark: 20_000, blockade: 20_000, pilot: 25_000 } as const;

/**
 * The lower fee a rescue pays when the pod is lost and the data still
 * arrives, in tenths of a credit. The scientist example in docs/TODO/190:
 * a failure is a branch, and the branch pays less.
 *
 * It is a FEE, in tenths of a credit, and the word "salvage" puts it beside
 * the commodities. Nothing about a market reads it.
 *
 * @domain missions
 * @rule missions.rescueSalvagePay
 */
export const RESCUE_SALVAGE_PAY = 1_500;

/**
 * How far a side job sends the commander, in tenths of a light year: two to
 * seven. So a job is one jump out and back on a full tank at most.
 *
 * @rule missions.sideJobRange
 */
export const SIDE_JOB_RANGE = { min: 20, max: 70 } as const;

/**
 * Days a side job allows before its deadline passes: two weeks.
 *
 * @rule missions.sideJobDays
 */
export const SIDE_JOB_DAYS = 14;

/**
 * How many days before a deadline the console starts to say how many are
 * left. Three, so a job with a fortnight on it warns for its last fifth. A
 * jump costs one to three days, so a warning at one day would come too late
 * for a job two jumps away (docs/TODO/203 M1).
 *
 * @domain missions
 * @rule missions.deadlineWarningDays
 */
export const DEADLINE_WARNING_DAYS = 3;

/**
 * Seconds a scan target must stay under the scanner lock: twenty, which is a
 * pass and a turn at a trader's speed.
 *
 * @rule missions.scanSeconds
 */
export const SCAN_SECONDS = 20;

/**
 * How far off the centre of the view a scan's subject may sit and still count
 * as watched, in radians: 0.35, which is twenty degrees. The whole forward
 * view is about half a radian to each side. So the subject may sit anywhere
 * in the middle two thirds of the screen. It used to count only under the
 * missile lock. That cone is 0.09, and it needs a missile armed. So the
 * briefing's "do not fire" sent the player to arm a weapon (docs/TODO/203
 * M5). The lock still counts, so a player who locked on loses nothing.
 *
 * @domain missions
 * @rule missions.watchCone
 */
export const WATCH_CONE = 0.35;

/**
 * Tonnes of the patron's goods on a smuggle job: three, which fits a Cobra's
 * hold beside its own stock.
 *
 * It is a mission leg's load, and the word "smuggle" puts it beside the
 * board's contracts. A board job prices its own tonnes in contract-offers.ts.
 *
 * @domain missions
 * @rule missions.smuggleTonnes
 */
export const SMUGGLE_TONNES = 3;

/**
 * The roles that count as an enemy near an escorted ship: the ones that
 * prey. A police ship beside the charge is no threat to it, whatever the
 * commander's own record says. A trader beside it never blocks the fee
 * (docs/TODO/190, escort completion). `world-step.ts` reads it inside
 * `DOCK_COMPUTER_RANGE` of the charge.
 */
export const ESCORT_ENEMY_ROLES: readonly string[] = ['pirate', 'hunter', 'thargoid', 'thargon'];

/**
 * How many arcs the tour holds: five, Chris's number (docs/TODO/190, item 192).
 *
 * `missions/tour.ts` places that many start worlds from the seed, and
 * `skeletons/index.ts` lists the arcs in tour order.
 *
 * @rule missions.tourArcs
 */
export const TOUR_ARCS = 5;

/**
 * How far each arc's start world is from the one before it, in JUMPS on the
 * full-tank graph: four to six. "Each four to six jumps farther across the
 * galaxy" is the intended tour (docs/TODO/192). Galaxy 1's most distant
 * world is 21 jumps from Lave, so five steps of this size cross it.
 *
 * It is a band of jumps, not of tenths of a light year. `SIDE_JOB_RANGE`
 * and the Navy's ranges are tenths on the chart.
 *
 * @rule missions.tourStepJumps
 */
export const TOUR_STEP_JUMPS = { min: 4, max: 6 } as const;

/**
 * How far an arc's final leg lies from the next arc's start world, in JUMPS:
 * two to four. Close enough that the rumour range (`LEAD_RUMOUR_JUMPS`)
 * always covers it, and far enough that the lead is a journey.
 *
 * @rule missions.arcHandoverJumps
 */
export const ARC_HANDOVER_JUMPS = { min: 2, max: 4 } as const;

/**
 * What an arc leg pays, per verb, in tenths of a credit.
 *
 * One table, as `SIDE_JOB_PAY` is, and a separate rule. An arc pays more
 * than a side job of the same verb. An arc sends the commander across the
 * galaxy, and a side job sends them one jump out and back. The same order
 * holds inside the table, for the same reasons. The arcs under
 * `missions/skeletons/arcs/` spend it (docs/TODO/192 M2).
 *
 * @rule missions.arcPay
 */
export const ARC_PAY = {
  hunt: 12_000, deliver: 5_000, recover: 6_000, rescue: 8_000,
  ambush: 9_000, smuggle: 10_000, escort: 9_000, scan: 4_000,
} as const;

/**
 * Days an arc leg allows before its deadline passes: a month, twice a side
 * job's fortnight, because an arc leg may be four jumps out. A deadline is
 * what makes `failed` reachable on a delivery. So an arc the commander cannot
 * finish fails on its own rather than holding a slot for good.
 *
 * @rule missions.arcLegDays
 */
export const ARC_LEG_DAYS = 30;
