# AGENTS.md

Instructions for AI coding agents (Cursor, GitHub Copilot, Claude Code, etc.)
working in this repository. Human contributors: see [`README.md`](./README.md).

## How tools discover this file

`AGENTS.md` is the **single source of truth**. Most agents (Cursor, Copilot,
Codex, Gemini CLI, Windsurf, Aider, Zed, …) read it from the repo root
automatically. Tools that expect a different filename get a **thin shim** that
points back here — never a copy, so nothing can drift:

| Tool        | File                              | Role                        |
| ----------- | --------------------------------- | --------------------------- |
| Most agents | `AGENTS.md`                       | Source of truth (this file) |
| Claude Code | `CLAUDE.md`                       | Shim → imports `@AGENTS.md` |
| Kiro        | `.kiro/steering/project-rules.md` | Shim → includes `AGENTS.md` |

To support another tool, add a one-line shim that references this file. Do not
duplicate the rules.

## Project in one line

A Phaser 3 memory-match game in TypeScript that runs **standalone** or as a
**microfrontend** embedded in the Game Hub shell via `postMessage`.

## Tech stack (do not introduce alternatives without asking)

- **Phaser 3.90** — game framework. This is a `<canvas>` game, **not** a DOM/React app.
- **TypeScript 5**, `strict` mode. Target ES2022, ESM only (`"type": "module"`).
- **Vite 8** (Rolldown) — dev server and bundler.
- **ESLint v9** flat config + **Prettier**.
- **Husky + lint-staged** pre-commit hook.
- **Node >= 22** (see `.nvmrc`).
- No React, no CSS framework, no state library. Keep dependencies minimal.

## Commands

```bash
npm run dev          # dev server on http://localhost:8001
npm run build        # tsc -b (type-check) + vite build → dist/
npm run typecheck    # tsc, no emit
npm run test         # Vitest (watch)
npm run test:run     # Vitest (single run, used in CI)
npm run lint         # ESLint
npm run lint:fix     # ESLint --fix
npm run format       # Prettier --write
```

## Custom agent commands

Reusable Claude Code slash commands live in `.claude/commands/`:

- `/add-mfe-message <command|event> <type> [payload]` — adds a protocol message end-to-end (union + runtime guard + README + shell reminder).
- `/verify` — runs the typecheck → lint → build sequence and reports.
- `/review [base-ref]` — reviews the diff against `.github/CODE_REVIEW_CHECKLIST.md`.
- `/debug <symptom>` — structured root-cause debugging using the project's known failure modes.
- `/write-tests <file>` — generates Vitest unit tests for a module, following the project's test conventions.

## Before you finish a task (verification)

Run, in this order, and fix anything that fails:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test:run`
4. `npm run build`

The pre-commit hook runs `lint-staged` (eslint --fix + prettier) on staged
files, so unformatted code will block commits. Match the style up front.

## Code style

Prettier owns formatting — don't fight it. Key settings (`.prettierrc.json`):

- 4-space indentation, single quotes, semicolons.
- `printWidth` 100, trailing commas everywhere, always parenthesize arrow params, LF line endings.

TypeScript rules that matter (`eslint.config.js`, `tsconfig.json`):

- `strict` is on plus `noUnusedLocals` / `noUnusedParameters` / `noImplicitOverride` / `noFallthroughCasesInSwitch`. Prefix intentionally unused vars with `_`.
- Avoid `any` (lint warns). Prefer precise types and discriminated unions.
- `console` is restricted to `warn` / `error` / `info`.

## Architecture & conventions

- **Scene flow is `Boot → Preload → Game`** (`src/scenes/`). Keep loading in `PreloadScene`; don't load assets inside `GameScene`.
- **Central config**: all tunable constants (sizes, colors, timings, MFE settings) live in [`src/config.ts`](./src/config.ts) as a single `as const` object. Add new constants there — don't scatter magic numbers in scenes.
- **Game objects** go in `src/objects/` (e.g. `Card.ts`). Externalize display size via methods like `setCardSize` so the scene can relayout on resize.
- **Layout is computed, not hardcoded.** The scale manager runs in **RESIZE** mode; relayout happens on the scene `resize` event using values from `GameConfig.layout` / `GameConfig.grid`. **Never** use CSS media queries for game layout — this is a canvas.
- **Animations** use Phaser tweens with durations from `GameConfig.animation`. The card flip animates `scaleX` only and never touches `scaleY` (see `Card.ts`); preserve that invariant.

## MFE protocol (be careful here)

- The wire protocol lives in [`src/mfe/protocol.ts`](./src/mfe/protocol.ts) and is **mirrored by hand** in the shell. If you change it, say so explicitly — both sides must stay in sync.
- All messages use the `MFEEnvelope<Type, Payload>` discriminated union. New commands/events must follow the **exact pattern** of existing ones and keep the `*Type` / `*Payload` helper types inferring.
- `bridge.ts` is the MFE-side `postMessage` wrapper. Respect `GameConfig.mfe.allowedShellOrigins` — never weaken origin checks in committed code.

## Testing

- **Runner:** Vitest in **jsdom** (`vitest.config.ts`). Tests are `src/**/*.test.ts`, next to the source.
- Import test helpers from `vitest` explicitly (`globals: false`). Restore mocks in `afterEach`.
- Unit-test pure logic — the MFE bridge/protocol is the prime target (`src/mfe/bridge.test.ts`). **Don't** unit-test Phaser rendering or canvas output.
- Prioritize the project's known traps (protocol union ↔ runtime `Set`, origin/target filtering, standalone vs embedded). Run with `npm run test:run`.

## Guardrails

- Don't edit `node_modules/`, `dist/`, or `public/` (generated/static).
- Don't commit unless explicitly asked. Prefer focused, single-purpose diffs.
- Don't add dependencies for problems solvable with Phaser + the standard library.
- Solve the task asked; don't refactor unrelated code in the same change.
- This is a learning project (first Phaser project, heading toward a slot prototype) — prefer clear, well-commented code over clever one-liners.
