---
description: Add a new MFE protocol message (command or event) end-to-end, keeping types and runtime guards in sync.
argument-hint: <command|event> <messageType> [payloadShape]
allowed-tools: Read, Edit, Bash(npm run typecheck), Bash(npm run lint)
---

You are adding a new MFE protocol message to this Phaser MFE. Arguments: `$ARGUMENTS`
(`$1` = direction `command` or `event`, `$2` = message type name, `$3` = optional payload shape).

Follow the project conventions in `AGENTS.md`. Do every step — the most common
bug is updating the type union but forgetting the runtime guard.

## Steps

1. **`src/mfe/protocol.ts`** — add the message to the correct discriminated union:
    - `command` → add to `ShellCommand` as `MFEEnvelope<'$2', PAYLOAD>`.
    - `event` → add to `MFEEvent` as `MFEEnvelope<'$2', PAYLOAD>`.
    - Use the payload shape from `$3`, or `Record<string, never>` if none.
    - Match the formatting of the existing members exactly. The `*Type` and
      `*Payload` helper types must keep inferring with no extra changes.

2. **`src/mfe/bridge.ts`** — only if `$1` is `command`:
    - Add `'$2'` to the `SHELL_COMMAND_TYPES` runtime `Set`. This is separate
      from the type union and is the step most often missed — without it the
      command is silently dropped by `isShellCommandType`.

3. **`README.md`** — add a row to the Commands or Events table with the type
   and payload, matching the existing table style.

4. **Shell mirror** — remind me that `src/mfe/protocol.ts` is mirrored by hand
   in the Game Hub shell, and this change must be applied there too. Do not
   edit the shell repo yourself; just flag it in your summary.

5. **Verify** — run `npm run typecheck` and `npm run lint`. Fix anything that fails.

## Output

End with a short summary: files changed, and an explicit reminder to mirror the
protocol change in the shell.
