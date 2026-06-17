## What & why

<!-- Short summary of the change and the reason for it. -->

## Self-review

Reviewed against [`CODE_REVIEW_CHECKLIST.md`](./CODE_REVIEW_CHECKLIST.md)
(tip: run the `/review` AI command before pushing).

- [ ] Layout/animation invariants respected (canvas-only, `scaleX`-only flip, config-driven values)
- [ ] MFE protocol: type union ↔ runtime `Set` in sync; shell mirror noted if `protocol.ts` changed
- [ ] No weakened origin checks, no unnecessary deps, focused diff
- [ ] `npm run typecheck && npm run lint && npm run build` pass locally

## Notes for the reviewer

<!-- Anything that needs extra attention, esp. shell-side protocol changes. -->
