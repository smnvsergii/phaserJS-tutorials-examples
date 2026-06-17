# Code Review Checklist

Project-specific review criteria for `memory-cards`. This is the single source
of truth for **what a review should check** — used by human reviewers and by the
`/review` AI command alike.

> Scope: this list deliberately covers only what CI **cannot** catch. Formatting,
> lint, types, and build are already enforced by `ci.yml` and the pre-commit hook —
> do not waste review on them.

## Architecture & rendering

- [ ] **Canvas, not DOM.** No CSS media queries or DOM layout used for game elements. Layout is computed from `GameConfig.layout` / `GameConfig.grid` on the scene `resize` event.
- [ ] **No magic numbers.** New sizes, timings, colors, or thresholds are added to `src/config.ts`, not hardcoded in scenes/objects.
- [ ] **Scene responsibilities respected.** Asset loading stays in `PreloadScene`; `GameScene` does not load assets. Scene flow `Boot → Preload → Game` is intact.

## Animation invariants

- [ ] **Card flip animates `scaleX` only.** No tween touches `scaleY` during a flip; card height stays constant across a texture swap (see `Card.ts`). `scaleX` is recomputed from the new texture's native width.
- [ ] Tween durations come from `GameConfig.animation`, not inline literals.

## MFE protocol (highest-risk area)

- [ ] **Type union and runtime guard are in sync.** A new `command` added to `ShellCommand` in `protocol.ts` is also added to the `SHELL_COMMAND_TYPES` `Set` in `bridge.ts`. (Forgetting this type-checks but silently drops the command.)
- [ ] **Envelope pattern followed.** New messages use `MFEEnvelope<Type, Payload>`; `*Type` / `*Payload` helpers still infer.
- [ ] **Shell mirror flagged.** Any `protocol.ts` change notes that the shell copy must be updated too.
- [ ] **Origin policy not weakened.** `allowedShellOrigins` checks in `bridge.ts` are not loosened in committed code.

## General

- [ ] **No unnecessary dependencies.** Nothing added for what Phaser or the standard library already does.
- [ ] **Focused diff.** No unrelated refactors mixed into the change.
- [ ] **`console` usage** limited to `warn` / `error` / `info`.
- [ ] **Standalone mode preserved.** Changes don't break running the game outside a shell (`window.parent === window`).

## Review output convention

Group findings by severity: **Blocker** (must fix), **Should-fix**, **Nit**.
For each, reference the file/line and the checklist item it relates to. If nothing
is wrong, say so explicitly rather than inventing issues.
