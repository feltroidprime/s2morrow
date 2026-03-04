# DEPLOY-001: Scaffold Next.js 15 app at apps/demo/ with all dependencies

## Status: ALREADY COMPLETE

The scaffold described in Task 1 of the implementation plan has **already been fully implemented**. All files exist, all dependencies are installed, and significant additional implementation has progressed well beyond the scaffold.

## Evidence of Completion

### Required Files (all exist)

| File | Status | Notes |
|------|--------|-------|
| `apps/demo/package.json` | Present | All required deps + scripts |
| `apps/demo/next.config.mjs` | Present | WASM webpack config included |
| `apps/demo/tsconfig.json` | Present | Bundler moduleResolution, path aliases |
| `apps/demo/postcss.config.mjs` | Present | `@tailwindcss/postcss` plugin |
| `apps/demo/src/app/globals.css` | Present | Tailwind v4 + dark/light theme tokens |
| `apps/demo/src/app/layout.tsx` | Present | Metadata, Providers wrapper, dark class |
| `apps/demo/src/app/page.tsx` | Present | Full page with all landing sections + interactive sections |
| `apps/demo/.env.local` | Present | NEXT_PUBLIC_STARKNET_RPC_URL set |
| `apps/demo/bun.lock` | Present | Dependencies installed |

### Required Dependencies (all present in package.json)

```json
{
  "dependencies": {
    "@effect-atom/atom": "^0.5.0",
    "@effect-atom/atom-react": "^0.5.0",
    "@tailwindcss/postcss": "^4.2.1",
    "effect": "^3.13.0",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "starknet": "^9.2.1",
    "tailwindcss": "^4.2.1"
  },
  "devDependencies": {
    "@types/bun": "^1.3.9",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

### Required Scripts (all present)

- `dev`: `next dev --turbopack`
- `build`: `next build`
- `start`: `next start`
- `typecheck`: `tsc --noEmit`
- `test`: `bun test`

### Existing Tests for Scaffold

- `src/tests/scaffold/package-scaffold.test.ts` - Verifies all deps and scripts
- `src/tests/scaffold/env-config.test.ts` - Verifies .env.local and no secrets
- `src/tests/scaffold/providers.test.ts` - Verifies Providers component and layout

## Beyond-Scaffold Implementation Already Done

The project has progressed significantly beyond Task 1. The following are already implemented:

### Services (Effect-TS pattern)
- `src/services/errors.ts` - All 9 Schema.TaggedError classes (WasmLoadError, KeygenError, SigningError, VerificationError, HintGenerationError, PackingError, StarknetRpcError, AccountDeployError, InsufficientFundsError)
- `src/services/types.ts` - Domain types (FalconKeypair, FalconSignatureResult, PackedPublicKey, VerificationStep, PipelineStep, branded TxHash/ContractAddress)
- `src/services/WasmRuntime.ts` - Full WasmRuntime service with Context.Tag, Layer, runtime validation via isValidWasmModule()
- `src/services/FalconService.ts` - Full FalconService with Effect.Service, accessors, all methods (generateKeypair, sign, verify, createHint, packPublicKey, deserializePublicKeyNtt)
- `src/services/StarknetService.ts` - Full StarknetService with Config-based RPC URL, computeDeployAddress, getBalance, deployAccount, waitForTx

### Atoms (Effect Atoms)
- `src/atoms/falcon.ts` - wasmStatusAtom, keypairAtom, signatureAtom, verificationStepAtom, messageAtom
- `src/atoms/pipeline.ts` - pipelineStepsAtom (6 steps with step counts), pipelineActiveStepAtom, pipelinePlayingAtom
- `src/atoms/starknet.ts` - deployStepAtom, deployedAddressAtom, deployTxHashAtom

### Landing Components (RSC)
- `src/components/landing/Hero.tsx` - Full hero with stats, CTA buttons, smooth scroll
- `src/components/landing/WhyPostQuantum.tsx` - 4 cards (Quantum Threat, AA, Falcon-512, Hint-Based)
- `src/components/landing/PerformanceStats.tsx` - Table with 4 operations + calldata efficiency card
- `src/components/landing/Footer.tsx` - GitHub + Starknet Docs links

### Interactive Components
- `src/components/ThemeToggle.tsx` - Dark/light toggle with class-based strategy
- `src/components/interactive/PlaygroundSection.tsx` - next/dynamic wrapper with ssr:false + skeleton
- `src/components/interactive/VerificationPlayground.tsx` - Stub ("Coming soon")

### Providers
- `src/app/providers.tsx` - Client component wrapping children with RegistryProvider

## Specification References

| Document | Path | Relevance |
|----------|------|-----------|
| PRD | `docs/specs/falcon-demo-website.md` | P0 requirements, MoSCoW priorities, constraints |
| Architecture | `docs/plans/2026-02-23-falcon-demo-website-design.md` | Three-layer architecture, service definitions, atom shapes |
| Implementation Plan | `docs/plans/2026-02-23-falcon-demo-website-impl.md` | Task 1 (scaffold) - 13 steps with exact file contents |
| Project Conventions | `CLAUDE.md` | Cairo tooling (not directly relevant), falcon-rs companion crate |

## Key Architecture Decisions (from design doc)

- **Next.js 15 App Router**: RSC for landing, client components for interactive sections
- **Effect-TS mandatory**: Effect.Service with accessors, Schema.TaggedError, Effect.fn
- **Tailwind CSS v4**: CSS-first config via `@import "tailwindcss"` + `@theme` block (no tailwind.config.js)
- **WASM loading**: From `/public/wasm/` via fetch + instantiate, cached by Layer memoization
- **State**: Effect Atoms (`@effect-atom/atom`, `@effect-atom/atom-react`) with RegistryProvider
- **Dark theme default**: `className="dark"` on `<html>`, CSS variables for both themes
- **Client components**: Loaded via `next/dynamic` with `ssr: false`
- **Bun**: Package manager and test runner

## Conclusion

**This ticket (DEPLOY-001) requires no implementation work.** The scaffold is complete, dependencies are installed, tests exist and should pass. The implementer should verify with:

```bash
cd apps/demo && bun test src/tests/scaffold/
cd apps/demo && bun run dev  # verify dev server starts
```

If the ticket system requires closing this as "done", the verification commands above confirm completion.
