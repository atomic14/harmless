# Invariants

Rules that must hold. Their numbers are cited throughout the repository: **never
renumber; append**. Tests are the detailed source where they exist.

1. **Product name.** “Elite” may describe the inspiration and in-game rank, but
   is never this project's name in titles, metadata, headings or domain names.

2. **Clean links.** Internal, canonical and sitemap URLs omit `.html`.

3. **Atomic, isolated saves.** `storage.ts` alone stores saves. Each save is one
   record written once; the key grammar makes named saves unreachable to
   autosaves. `useHarnessSaves()` switches namespace permanently for that
   process and must run before any harness or console flight.

4. **Galaxy fidelity.** `galaxy.ts` is byte-matched to the 1984 algorithm; do not
   “fix” its maths.

5. **One combat model.** Training uses the game's combat modules, never copies.
   Changing combat rules therefore invalidates trained brains; retrain them.

6. **No logarithmic depth buffer.** It disables the polygon offset that keeps
   black hull fills behind wireframe edges.

7. **Ship definitions use +Z nose and are rotated, never mirrored.** Mirroring
   changes asymmetric released hulls.

8. **Money is integer tenths of a credit; fuel is tenths of a light-year.**

9. **Each key binding has one home.** Help surfaces are rendered from the binding
   and description tables; no surface copies keys — and neither does PROSE: a
   console message names a `Command` and the edge renders the key
   (`test/key-prose.test.ts` scans `src/game/` for the letters).

10. **Economic rules stay outside `game.ts`** in modules shared with the headless
    campaign.

11. **No `Math.random` in world code.** All world chance uses one seeded stream.

12. **No ambient game-state globals.** Anything world logic reads is explicit,
    saveable state. Write-only debug handles are the exception: one module owns
    them and game logic never reads or branches on them.

13. **A screen owns its rendering, keys and state behind one interface.** It
    returns an outcome instead of touching the game; mode is derived. Clicks
    become the same keystrokes or row selections as keyboard input.

14. **The menu cursor runs before the top screen, and input reads consume it.**
    It is safe only while the cursor touches almost nothing; do not widen it.

15. **NPCs report; orchestrators resolve.** NPC actions return events without
    side effects. Game and trainer share one resolver for shot cost, hit, damage
    and target effects, plus one shield-face rule. Presentation stays with the
    caller; new shot consequences belong in the resolver.
