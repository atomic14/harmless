# The Jameson Trials — end-to-end economy simulation (2026-07-26)

> **A dated report.** The language follows the house style; no finding, number or
> quotation moved. Two facts in it are stale. The `hull x/6` figures are the
> retired normalized damage scale — the commander now has three 255-point pools
> (`docs/ELITE-A.md`). The defence brain is now `jameson-defend-g1`. The economic
> findings still hold; the combat numbers describe a different damage model.

Question: can an autopiloted Commander Jameson build up cash on trade legs in the
live game? Method: a scripted pilot flew the *real* game in the browser, through
the debug handle. It used the real market rules, the real fuel costs, real
hyperspace (witch-space included), real pirates, real docking physics and the
real legal system. It cheated in one way only: perfect aim on the docking
approach, as a stand-in for the docking computer. The trial backed the player's
own save up first, then restored it after.

## The route

- **Lave ↔ Diso** (as first proposed): both worlds are agricultural, so the
  margins proved thin. The economy model predicts that. The best find was a
  one-off fluctuation bargain, about +7 Cr on a single tonne of Alien Items.
- **Lave ↔ Leesti** (agricultural ↔ industrial, the classic route): genuinely
  profitable. Food and alloys go out at about +2.5 Cr/t and better. Computers
  come back at about +30 Cr/t, when the commander can afford them.

## Three commanders

**MkI** — died on his first day. The v1 autopilot aligned its nose to the
station, but it never corrected the lateral drift. That gave repeated hull
collisions, and bounce damage, in a Dictatorship system full of pirates. Cause of
death: pilot error, and pirates to finish the job. *Validated: collision damage,
bounce mechanics, pirate lethality.*

**MkII** — the tragic one. He survived a witch-space Thargoid ambush and docked
successfully with the v2 autopilot. He then **rammed a ship to death** on a
bouncy approach. The game credited him with the kill, branded him a criminal, and
took his savings as the docking fine. That left him in a poverty trap: 1.3 Cr,
and no way to afford the 1.5 Cr of fuel to reach Lave. *Validated: witch-space
escape, collision kills, legal escalation, fines, and an emergent poverty trap —
all working as designed.* A harness bug made his chronic losses worse; see below.

**MkIII** — the professional. He got collision avoidance, so traffic holds when a
ship comes within 320. He also got a cargo buyer that knows what he can afford:
it maximises the affordable total profit rather than the per-tonne margin. That
is the poor commander's liquor-and-food strategy. Results on Lave ↔ Leesti:

| leg | cargo | profit | notes |
| --- | --- | --- | --- |
| Lave → Leesti | 16t Food | **+38.4** | clean run |
| Leesti → Lave | empty | −1.5 | fought through 3 pirates, hull 3.6/6, 35 traffic holds |
| Lave → Leesti | 10t Food | **+26.5** | |
| Lave → Leesti | 5t Alloys | **+38.5** | |
| Leesti → Lave | 2t Computers | (unsold) | pirates prevented docking |

Pirates then killed MkIII on the Lave approach, while he held two tonnes of
computers. *Validated: the compounding loop works — when you survive.*

## Harness bugs the simulation caught (fixed in-session)

1. **v1 docking**: no lateral correction, so the ship hit the hull.
2. **v3 gate oscillation**: a bang-bang limit cycle between the "seek gate"
   branch and the "final run" branch. A latch on the final run fixed it.
3. **The embezzling accountant**: the harness's `sellAll` took the cargo and
   counted the revenue, but it *never credited the commander*. Every sale before
   the fix paid nothing. Two thirds of MkII's poverty was this bug, and one third
   was his fine.

## Findings about the game itself

- **The economy is sound.** Agricultural ↔ agricultural is about break-even.
  Agricultural ↔ industrial is reliably profitable. The margins and the prices
  behave as the original model says.
- **Piracy risk is real and asymmetric**, exactly as intended. A leg out of Lave
  (Dictatorship, government 3) met 1–3 pirates on nearly every run. The Leesti
  and Diso legs were quiet. An unarmed trader who does not fight has a real
  chance of death on the Lave side. A human — or the combat AI — who shoots back
  does far better.
- **Witch-space** fired 2–3 times across about 12 jumps. The design rate is 9%,
  so the trial was a little unlucky and still inside expectation. The escapes
  worked. The ambushes hurt.
- **The legal system bites.** One accidental ram cascaded into a kill, then
  fugitive status, then a near-total fine. Emergent, fair, very Elite.
- **Poverty traps exist.** Below about 2 Cr with an empty tank, you cannot buy
  the fuel to leave. The original had this too, and players begged for the escape
  pod. One mercy rule is possible, if it is ever wanted: a station advances 1 LY
  of fuel to a broke commander.

## Verdict

Yes. Jameson builds up cash on the proper route, at about +30–40 Cr per outbound
leg. He buys computers on the way home when his capital allows it. The constraint is
*survival*, not economics: the pirates on the low-government side are the tax.
That is, give or take, the 1984 experience working as intended.

## Epilogue — the Jameson AI (same day)

The trials concluded that *survival is the binding constraint*, and that led
straight to training run 5: a *defence policy* for armed traders (see
TRAINING-LOG.md). Against two shipped pirates on held-out seeds, a scripted
trader dies 100% of the time. The trained Jameson dies 10%, holds enemy accuracy
to 1%, and sometimes shoots an attacker down. Its successor
(`jameson-defend-g1`) flies every armed trader in the game. You can watch it in
the viewer, as "Commander Jameson (defence AI) vs 2 pirates". MkI, MkII and MkIII
did not die in vain.

## MkIV — first of his name (trade autopilot + trained defence brain)

The full integration: MkIII's trade logic, but the ship passes to the trained
`jameson-defend` policy when pirates close within 4.5 km. The policy flies at
trader-Cobra dynamics, which match its training distribution. It also fires the
player's real laser. Six legs, Lave ↔ Leesti:

| leg | cargo | trade P&L | events |
| --- | --- | --- | --- |
| Lave → Leesti | 16t Food | +44.8 | clean |
| Leesti → Lave | 1t Computers | +14.9 | **witch-space**, 3 pirates, 69s combat, **3 kills**, hull 3.8/6 |
| Lave → Leesti | 7t Liquor | +45.7 | clean |
| Leesti → Lave | 3t Computers | +48.9 | **witch-space**, 3 pirates, 58s combat, 1 kill |
| Lave → Leesti | 11t Liquor | +81.7 | quiet |
| Leesti → Lave | 5t Computers | +82.5 | 1 pirate, 43s combat, 1 kill |

**100.0 → 461.5 Cr (trade P&L +318.5, the rest pirate bounties). Five
kills. Two witch-space ambushes survived. Hull never below 3.8/6. Legal
status: Clean throughout. Zero deaths.**

The compounding curve is the story. The profit per leg *grew* from +45 to +82, as
capital turned into higher-value cargo: 1, then 3, then 5 computers on a return
leg. MkIII died as he held his first computers. MkIV fought through the same
corridor five times. One trained policy is the difference.

Rating at retirement: still Harmless (5 kills; Mostly Harmless at 8). The next
milestone for a MkV endurance run is Competent (512).
