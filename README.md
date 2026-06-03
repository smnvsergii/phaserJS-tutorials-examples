# Memory Cards

A small memory match game built with Phaser 3. Runs **standalone** in the
browser or **embedded** as a microfrontend inside the Game Hub shell, which
talks to it via `postMessage`.

This is also my first Phaser project — a stepping stone toward more complex
games (slots being the goal). Coming from a React / front-end background,
I used it to learn the Phaser scene lifecycle, asset loading, sprite
animation, and audio.

## Stack

- Phaser 3.90
- TypeScript 5
- Vite 8 (Rolldown)
- ESLint v9 (flat config) + Prettier
- Husky + lint-staged (pre-commit hook)
- LocalStorage for best-time persistence

## Requirements

- Node >= 22 (see `.nvmrc`)

## Scripts

```bash
npm install
npm run dev          # start dev server on http://localhost:8001
npm run build        # type-check + production build (dist/)
npm run preview      # serve the production build locally
npm run typecheck    # tsc, no emit
npm run lint         # ESLint
npm run lint:fix
npm run format       # Prettier
npm run format:check
```

## Tooling & config files

A quick map of every config in the repo and what it's for.

| File                       | Purpose                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `package.json`             | manifest, scripts, dependencies                                                             |
| `package-lock.json`        | exact versions of installed deps (commit it)                                                |
| `tsconfig.json`            | TypeScript compiler options (target, strict, paths)                                         |
| `vite.config.ts`           | Vite dev/build config (port, manual chunking for Phaser)                                    |
| `eslint.config.js`         | ESLint v9 flat config (type-aware rules for `src/`)                                         |
| `.prettierrc.json`         | Prettier formatting rules (quotes, indent, line width)                                      |
| `.prettierignore`          | files Prettier skips (`dist`, `node_modules`, `public`)                                     |
| `.editorconfig`            | per-editor defaults (charset, EOL, indent) — picked up by VS Code, JetBrains, Sublime, etc. |
| `.nvmrc`                   | Node version pin — `nvm use` reads it                                                       |
| `.gitignore`               | files git doesn't track (`node_modules`, `dist`, env, IDE caches)                           |
| `.env.example`             | template for `.env` (real `.env` is gitignored)                                             |
| `.husky/pre-commit`        | git hook that runs `lint-staged` before each commit                                         |
| `.lintstagedrc.json`       | tells `lint-staged` to run `eslint --fix` + Prettier on staged files only                   |
| `.github/workflows/ci.yml` | GitHub Actions: lint → format check → typecheck → build on every push/PR                    |
| `LICENSE`                  | MIT                                                                                         |

Why so many small files instead of a few bigger ones: each tool reads its
own config, and that's the path of least friction. Mixing them into
`package.json` works for some (Prettier, lint-staged) but not all (Vite,
TS, ESLint). Keeping them separate also makes it obvious what each tool
owns.

### How they interact at commit time

```
git commit
  └─> .husky/pre-commit
        └─> npx lint-staged          # reads .lintstagedrc.json
              ├─> eslint --fix       # uses eslint.config.js
              └─> prettier --write   # uses .prettierrc.json + .prettierignore
```

If any step fails, the commit is blocked.

### How they interact in CI

```
push / PR
  └─> .github/workflows/ci.yml
        ├─> npm ci                   # uses package-lock.json
        ├─> npm run lint             # eslint.config.js
        ├─> npm run format:check     # .prettierrc.json
        ├─> npm run typecheck        # tsconfig.json
        └─> npm run build            # tsconfig.json + vite.config.ts
```

## Project structure

```
memory-cards/
├── public/
│   └── assets/             # served as-is (Vite static)
│       ├── fonts/
│       ├── sounds/
│       └── sprites/
├── src/
│   ├── main.ts             # entry point: bridge + Phaser game
│   ├── config.ts           # game-wide constants (incl. MFE settings)
│   ├── styles.css
│   ├── vite-env.d.ts       # Vite client type defs (import.meta.env)
│   ├── mfe/
│   │   ├── protocol.ts     # typed wire protocol shared with the shell
│   │   └── bridge.ts       # MFE-side postMessage wrapper
│   ├── objects/
│   │   └── Card.ts
│   └── scenes/
│       ├── BootScene.ts
│       ├── PreloadScene.ts
│       └── GameScene.ts
├── index.html
├── tsconfig.json
├── vite.config.ts
└── eslint.config.js
```

The three-scene split (`Boot → Preload → Game`) is the same pattern used in
larger Phaser projects.

## Gameplay

- 4 pairs, 90-second timer, responsive 4-column grid
- Match all pairs to win — best time persists in `localStorage`
- "AMAZING! / ALL PAIRS FOUND!" win popup

## MFE / shell integration

The game can run standalone or embedded in a shell via `<iframe>`.
Communication uses `window.postMessage` through `MFEBridge`
(`src/mfe/bridge.ts`).

### Message envelope

```ts
interface MFEEnvelope<T extends string, P> {
    source: string; // sender id ("memory-cards", "shell", ...)
    target?: string; // optional recipient id
    version: number;
    type: T;
    payload: P;
}
```

### Commands (shell → MFE)

| type        | payload              | effect                          |
| ----------- | -------------------- | ------------------------------- |
| `pause`     | —                    | pauses the active scene & theme |
| `resume`    | —                    | resumes the active scene        |
| `restart`   | —                    | restarts the round              |
| `mute`      | `{ muted: boolean }` | toggles all sounds              |
| `setVolume` | `{ volume: 0..1 }`   | sets master volume              |

### Events (MFE → shell)

| type                 | payload                                 |
| -------------------- | --------------------------------------- |
| `ready`              | `{ mfeId, version, bestTime, timeout }` |
| `gameStart`          | `{ timeout }`                           |
| `match`              | `{ value, matched, total }`             |
| `mismatch`           | `{ values: [a, b] }`                    |
| `win`                | `{ time }`                              |
| `timeout`            | —                                       |
| `bestTimeUpdated`    | `{ bestTime }`                          |
| `paused` / `resumed` | —                                       |
| `muteChanged`        | `{ muted }`                             |
| `volumeChanged`      | `{ volume }`                            |

### Origin policy

`GameConfig.mfe.allowedShellOrigins` in `src/config.ts` controls which
origins this MFE accepts commands from. Empty list = any (dev only).

## What I learned

- Phaser scene lifecycle (`preload` / `create` / `update`) and delegating
  loading to a dedicated scene
- Sprite scaling via `setDisplaySize`
- Tween-based animation (move, flip) and how `scaleX: 0 → 1` produces the
  card-flip effect
- Browser autoplay policy and the audio-context user-gesture requirement
- Typing Phaser with TypeScript — strict mode without fighting the API
- Building a typed `postMessage` protocol for MFE communication

## Roadmap

- [x] TypeScript + Vite + ES modules
- [x] Wrap as a microfrontend embedded into a shell via iframe + postMessage
- [ ] Move on to a slot prototype using the same architecture
