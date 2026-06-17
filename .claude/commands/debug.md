---
description: Structured debugging of a reported symptom, using this project's known failure modes.
argument-hint: <symptom or error message>
allowed-tools: Read, Bash(git diff:*), Bash(git log:*), Bash(npm run typecheck)
---

Debug the following symptom: `$ARGUMENTS`

Work the problem; do not guess-and-patch. Follow this method:

1. **Restate the symptom** precisely (what is observed vs expected). Ask for a
   repro if it isn't clear.
2. **Form 2–3 hypotheses** before reading code. Rank them by likelihood.
3. **Locate** the relevant code and confirm or kill each hypothesis with evidence
   from the source. State what you checked.
4. **Propose the minimal fix** that addresses the root cause — not a symptom patch.
5. **Add a guard** against regression where it makes sense (an assert, a type, a
   comment documenting the invariant).

## Known failure modes in this project (check these first)

- **Shell command is ignored** → the type was added to the `ShellCommand` union in
  `protocol.ts` but **not** to the `SHELL_COMMAND_TYPES` runtime `Set` in `bridge.ts`;
  or `event.origin` isn't in `allowedShellOrigins`; or the envelope `target` doesn't
  match `mfeId`.
- **No sound / audio doesn't start** → browser autoplay policy: the audio context
  needs a user gesture before it can play.
- **Cards jump size mid-flip** → a tween touched `scaleY`; the flip must animate
  `scaleX` only and recompute it from the new texture's native width.
- **Layout broken after resize** → relayout must happen on the scene `resize`
  event using `GameConfig.layout` / `GameConfig.grid`, not fixed pixel values.
- **Works embedded but not standalone (or vice versa)** → check the
  `window.parent === window` branch in `MFEBridge`.

## Rules

- If a hypothesis is wrong, say so and move on — don't force it.
- Don't change unrelated code. Don't commit.
- If the root cause is genuinely unclear after investigation, say what's still
  unknown and what evidence would resolve it.
