---
description: Run the project's full verification sequence and report results.
allowed-tools: Bash(npm run typecheck), Bash(npm run lint), Bash(npm run build)
---

Run the verification sequence defined in `AGENTS.md`, in order, and stop at the
first failure:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run build`

Report a compact pass/fail for each step. If a step fails, show the relevant
error output and propose a fix. Do not commit anything.
