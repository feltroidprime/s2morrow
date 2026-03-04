# DEPLOY-001 Plan: Scaffold Next.js 15 app at `apps/demo/` with all dependencies

## Overview

`DEPLOY-001` scaffold work is already present in the repository, so this plan is focused on **test-first regression locking** and **minimal implementation changes only if tests fail**.

Plan priorities follow the PRD and approved architecture:
- P0 must-have scaffold contract first
- Keep architecture invariant: Next.js 15 App Router at `apps/demo/`
- Preserve security invariants: no private keys in env files; no server-side crypto introduction
- Verify `bun run dev` startup as the final integration gate

## TDD Step Order (Tests First, Then Implementation)

### Phase A: RED/GREEN tests for scaffold contract

1. Add/extend unit test: required scaffold files exist.
2. Add/extend unit test: `package.json` scripts and dependencies match scaffold requirements.
3. Add/extend unit test: `next.config.mjs` enables async WASM and sets wasm output filename.
4. Add/extend unit test: `tsconfig.json` has strict + bundler resolution + `@/*` path alias.
5. Add/extend unit test: `postcss.config.mjs` includes `@tailwindcss/postcss`.
6. Add/extend unit test: `src/app/globals.css` includes Tailwind v4 import + required Falcon color tokens.
7. Add/extend unit test: `.env.local` includes `NEXT_PUBLIC_STARKNET_RPC_URL` and forbids private/secret key variables.
8. Add/extend unit test: `src/app/layout.tsx` exports metadata and `RootLayout({ children }: { readonly children: ReactNode })`.
9. Add/extend unit test: `src/app/page.tsx` exports `Home(): React.JSX.Element` and remains an RSC (no `"use client"`).
10. Add integration test/script check: `bun run dev` reaches ready state without crashing.

### Phase B: Implementation fixes (only for failing tests)

11. Patch `apps/demo/package.json` if scripts/dependencies mismatch test contract.
12. Patch `apps/demo/next.config.mjs` if WASM webpack settings mismatch.
13. Patch `apps/demo/tsconfig.json` if compiler or path alias settings mismatch.
14. Patch `apps/demo/postcss.config.mjs` if Tailwind v4 PostCSS plugin missing.
15. Patch `apps/demo/src/app/globals.css` if required tokens/imports are missing.
16. Patch `apps/demo/src/app/layout.tsx` and/or `apps/demo/src/app/page.tsx` if signature/structure checks fail.
17. Patch `apps/demo/.env.local` if RPC var missing or secret-like env vars are present.
18. Re-run test suite and integration checks until all pass.

## Files to Create/Modify (with signatures)

### Tests

- Modify: `apps/demo/src/tests/scaffold/package-scaffold.test.ts`
  - Keep/extend helpers:
  - `function isObjectRecord(value: unknown): value is Record<string, unknown>`
  - `function toStringRecord(value: unknown): Record<string, string>`
  - `function getDependencies(p: unknown): Record<string, string>`
- Modify or create: `apps/demo/src/tests/scaffold/config-files.test.ts`
  - Validate `next.config.mjs`, `tsconfig.json`, `postcss.config.mjs`, `globals.css`, `page.tsx`
- Modify: `apps/demo/src/tests/scaffold/env-config.test.ts`
  - Keep parser:
  - `function parseEnv(content: string): Record<string, string>`
- Modify: `apps/demo/src/tests/scaffold/providers.test.ts`
  - Validate layout export shape and provider wrapping assumptions
- Create: `apps/demo/src/tests/scaffold/dev-server.integration.test.ts` (or script-driven integration harness)
  - Spawn `bun run dev`, assert startup readiness text, then teardown process

### Implementation (only if test failures require changes)

- Modify: `apps/demo/package.json`
- Modify: `apps/demo/next.config.mjs`
- Modify: `apps/demo/tsconfig.json`
- Modify: `apps/demo/postcss.config.mjs`
- Modify: `apps/demo/src/app/globals.css`
- Modify: `apps/demo/src/app/layout.tsx`
  - `export default function RootLayout({ children }: { readonly children: ReactNode })`
- Modify: `apps/demo/src/app/page.tsx`
  - `export default function Home(): React.JSX.Element`
- Modify: `apps/demo/.env.local`

## Tests to Write

### Unit tests

1. Scaffold file presence and readability checks.
2. `package.json` scripts: `dev`, `build`, `start`, `typecheck`, `test`.
3. Runtime dependency presence: `next`, `react`, `react-dom`, `effect`, `@effect-atom/atom`, `@effect-atom/atom-react`, `starknet`, `tailwindcss`.
4. `next.config.mjs` webpack config includes:
   - `config.experiments.asyncWebAssembly === true`
   - `config.output.webassemblyModuleFilename` is set.
5. `tsconfig.json` includes strict mode, bundler resolution, and `@/* -> ./src/*`.
6. `postcss.config.mjs` includes `@tailwindcss/postcss`.
7. `globals.css` includes `@import "tailwindcss";` and Falcon design tokens.
8. `.env.local` contains non-empty `NEXT_PUBLIC_STARKNET_RPC_URL`.
9. `.env.local` rejects secret/private-key style variable names.
10. `layout.tsx` exports metadata and default `RootLayout`.
11. `page.tsx` remains server component (no `"use client"`).

### Integration tests

1. Dev server startup check:
   - Command: `cd apps/demo && bun run dev`
   - Assert: process reaches `Ready` output and binds a local URL.
2. Optional CI gate:
   - `cd apps/demo && bun test src/tests/scaffold`
   - `cd apps/demo && bun run typecheck`

## Risks and Mitigations

- Risk: Re-scaffolding could overwrite newer implementation already present.
  - Mitigation: Apply only minimal patches required by failing tests.
- Risk: Turbopack root warning from multiple lockfiles may look like a failure.
  - Mitigation: Treat as non-blocking warning; only fail on startup crash/non-ready state.
- Risk: Port 3000 may be occupied in local/CI.
  - Mitigation: readiness assertion should accept any Next.js selected local port.
- Risk: Env drift introduces sensitive keys.
  - Mitigation: keep explicit forbidden-pattern test for secret/private key variable names.

## Verification Against Acceptance Criteria

1. Run scaffold tests:
   - `cd apps/demo && bun test src/tests/scaffold`
2. Verify dev server starts:
   - `cd apps/demo && bun run dev`
   - Confirm Next.js reaches ready state and serves a local URL.
3. Confirm required files exist:
   - `apps/demo/package.json`
   - `apps/demo/next.config.mjs`
   - `apps/demo/tsconfig.json`
   - `apps/demo/postcss.config.mjs`
   - `apps/demo/src/app/globals.css`
   - `apps/demo/src/app/layout.tsx`
   - `apps/demo/src/app/page.tsx`
   - `apps/demo/.env.local`
4. Confirm required deps are present in `package.json`:
   - `next`, `react`, `react-dom`, `effect`, `@effect-atom/atom`, `@effect-atom/atom-react`, `starknet`, `tailwindcss`

