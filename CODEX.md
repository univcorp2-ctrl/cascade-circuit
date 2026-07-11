# Development notes

- Keep `src/game/engine.ts` pure and deterministic.
- Do not place Stripe secrets in frontend code or committed files.
- Every rule change requires a Vitest case.
- Preserve the free-first flow and make price copy match Stripe Dashboard.
- Legal templates are placeholders until the operator inserts verified business information.
