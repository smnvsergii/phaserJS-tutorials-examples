---
description: Generate Vitest unit tests for a module, following the project's test conventions.
argument-hint: <path to source file>
allowed-tools: Read, Edit, Bash(npm run test:run), Bash(npm run lint)
---

Write Vitest unit tests for: `$ARGUMENTS`

## Conventions (match these)

- Test file sits next to the source as `*.test.ts` (e.g. `src/mfe/bridge.test.ts`).
- Import test functions explicitly from `vitest` (`globals: false` — no ambient globals).
- jsdom is the environment; `window` / `postMessage` are available.
- Follow the existing style of `src/mfe/bridge.test.ts`: small helpers, one
  behavior per `it`, `describe` blocks by scenario, restore mocks in `afterEach`.

## What to test

1. **Behavior, not implementation.** Drive the unit through its public API.
2. **The risky edges first.** Prioritize the project's known traps — e.g. the
   protocol union vs runtime `SHELL_COMMAND_TYPES` `Set`, origin/target filtering,
   standalone vs embedded mode.
3. **One clear assertion per test**, with a message on non-obvious expectations.
4. Do **not** test Phaser rendering or canvas output in unit tests — keep units pure.

## Finish

Run `npm run test:run` and `npm run lint`. All tests must pass and the file must
lint clean (watch for empty arrow functions — use `() => undefined` for mocks).
