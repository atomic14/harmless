# Invariants

These rules must hold. The repository cites them by number. **Never renumber a
rule. Append a new rule instead.** Where a test pins a rule, that test is the
detailed source.

1. **Product name.** “Elite” may name the inspiration and the in-game rank. It is
   never this project's name. Do not use it in a title, in metadata, in a heading
   or in a domain name.

2. **Clean links.** An internal, canonical or sitemap URL omits `.html`.

3. **Atomic, isolated saves.** Only `storage.ts` stores a save. Each save is one
   record, and the code writes that record one time. The key grammar keeps a
   named save unreachable to an autosave. `useHarnessSaves()` switches the
   namespace permanently for that process. Call it before any harness flight or
   console flight.

4. **Galaxy fidelity.** `galaxy.ts` matches the 1984 algorithm byte for byte. Do
   not “fix” its maths.

5. **One combat model.** Training uses the game's combat modules. It never uses a
   copy of them. A change to the combat rules therefore makes the trained brains
   invalid. Train them again.

6. **No logarithmic depth buffer.** A logarithmic depth buffer disables the
   polygon offset. That offset holds the black hull fills behind the wireframe
   edges.

7. **Ship definitions use a +Z nose. Rotate a definition; never mirror it.** A
   mirror operation changes an asymmetric released hull.

8. **Money is integer tenths of a credit; fuel is tenths of a light-year.**

9. **Each key binding has one home.** The help surfaces render from the binding
   table and the description table. No surface copies a key. Prose does not copy
   a key either: a console message names a `Command`, and the edge renders the
   key. `test/key-prose.test.ts` scans `src/game/` for the letters.

10. **Economic rules stay outside `game.ts`.** They live in modules that the
    headless campaign shares.

11. **No `Math.random` in world code.** All world chance comes from one seeded
    stream.

12. **No ambient game-state globals.** Anything that world logic reads is
    explicit, saveable state. A write-only debug handle is the exception. One
    module owns it, and game logic never reads it or branches on it.

13. **A screen owns its rendering, keys and state behind one interface.** A
    screen returns an outcome; it does not touch the game. The mode is derived
    state. A click becomes the same keystroke or row selection as a key press.

14. **The menu cursor runs before the top screen. An input read consumes it.**
    The cursor is safe only while it touches almost nothing. Do not widen it.

15. **NPCs report; orchestrators resolve.** An NPC action returns an event and
    causes no effect itself. The game and the trainer share one resolver for the
    shot cost, the hit, the damage and the effects on the target. They also share
    one shield-face rule. Presentation stays with the caller. Put a new shot
    consequence in the resolver.
