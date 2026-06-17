---
description: AI code review of the current changes against the project's review checklist.
argument-hint: [base-ref, defaults to origin/main]
allowed-tools: Read, Bash(git diff:*), Bash(git status)
---

Review the current changes for this Phaser MFE project.

## Steps

1. Get the diff to review:
    - If `$1` is given, use `git diff $1...HEAD`.
    - Otherwise use `git diff origin/main...HEAD` plus `git diff` (unstaged) and
      `git diff --staged`, so uncommitted work is covered too.

2. Read `.github/CODE_REVIEW_CHECKLIST.md` and review **strictly against it**.

## Rules

- **Do not** comment on formatting, lint, types, or build — CI and the pre-commit
  hook already enforce those. Focus only on what the checklist covers.
- The MFE protocol section is the highest-risk area. Pay special attention to the
  type-union / runtime-`Set` sync in `bridge.ts`.
- Reference real files and lines from the diff. Don't invent issues; if the change
  is clean, say so.

## Output

Group findings by severity, following the checklist's output convention:

- **Blocker** — must fix before merge
- **Should-fix** — worth addressing
- **Nit** — optional/style

Each finding: file:line, the checklist item it maps to, and a concrete suggestion.
