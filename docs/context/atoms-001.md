# Context for atoms-001: Implement atom definitions (`falcon.ts`, `starknet.ts`, `pipeline.ts`)

## Ticket Scope
Create/confirm all atom definitions for Falcon demo state:
- `apps/demo/src/atoms/falcon.ts`
- `apps/demo/src/atoms/starknet.ts`
- `apps/demo/src/atoms/pipeline.ts`

Hard requirement from ticket:
- Do **not** create a barrel export file (`apps/demo/src/atoms/index.ts`).
- Import atoms directly from module files (for example `../atoms/falcon`, `../atoms/starknet`, `../atoms/pipeline`).

## Required References Read

### `docs/specs/`
- Contains `docs/specs/falcon-demo-website.md` only.

### `docs/specs/falcon-demo-website.md`
- P0 `atoms-state` requirements:
  - `wasmStatusAtom`: `"loading" | "ready" | "error"`, kept alive.
  - `keypairAtom`: `Option<FalconKeypair>`.
  - `verificationStepAtom`: idle -> generating-keypair -> signing -> creating-hint -> packing -> verifying -> complete/error.
  - `deployStepAtom`: idle -> generating-keypair -> packing -> computing-address -> awaiting-funds -> deploying -> deployed/error.
  - `pipelineStepsAtom`: 6-step pipeline, pending/active/complete statuses, counts aligned with README/PRD values.
- Pipeline step card values in PRD:
  - `hash_to_point` 5,988
  - `NTT(s1)` ~15,000
  - `pointwise multiply` ~1,500
  - `NTT(mul_hint)` ~15,000
  - `recover s0` ~500
  - `norm check` ~26,000

### `docs/plans/2026-02-23-falcon-demo-website-design.md`
- Confirms state stack: `@effect-atom/atom` + `@effect-atom/atom-react`.
- Interactive components are client-only (`next/dynamic` with `ssr: false`), and they consume these atoms.
- `wasmStatusAtom` is explicitly part of WASM loading UX.

### `docs/plans/2026-02-23-falcon-demo-website-impl.md`
- Task 4 defines exact target atom shapes for `falcon.ts`, `starknet.ts`, `pipeline.ts`.
- Task 4 also suggests `apps/demo/src/atoms/index.ts`, and later tasks import from `@/atoms`.
- This conflicts with this ticket's explicit constraint: **no barrel file**.
- Step-count constants in Task 4 match current test expectations:
  - `[5988, 15000, 1500, 15000, 500, 26000]`.

### `CLAUDE.md`
- Project-level conventions:
  - Bun package manager.
  - Effect-TS patterns required across services (`Effect.Service`, `Schema.TaggedError`, `Effect.fn`).
  - Security invariants: no hardcoded private keys, validate Starknet inputs, browser-side crypto only.

## Existing Implementation Read (`apps/demo/src/`)

### Atom definitions
- `apps/demo/src/atoms/falcon.ts`
  - `wasmStatusAtom` with `Atom.keepAlive`.
  - `keypairAtom` is `Option.Option<FalconKeypair>` and already `Atom.keepAlive`.
  - `signatureAtom`, `verificationStepAtom`, `messageAtom` present.
- `apps/demo/src/atoms/starknet.ts`
  - `DeployStep` union includes all required states.
  - `deployStepAtom`, `deployedAddressAtom`, `deployTxHashAtom` present.
- `apps/demo/src/atoms/pipeline.ts`
  - 6 pipeline step records present with expected IDs/order/counts.
  - `pipelineStepsAtom`, `pipelineActiveStepAtom`, `pipelinePlayingAtom` present.
  - `INITIAL_PIPELINE_STEPS` exported and used by tests.

### Types/services that atoms depend on
- `apps/demo/src/services/types.ts`
  - Source of `FalconKeypair`, `FalconSignatureResult`, `VerificationStep`, `PipelineStep`, branded `TxHash`/`ContractAddress`.
- `apps/demo/src/services/errors.ts`, `FalconService.ts`, `StarknetService.ts`, `WasmRuntime.ts`
  - Confirm Effect-TS style currently used in app codebase.

### Tests enforcing atom contracts
- `apps/demo/src/tests/atoms.test.ts`
  - Direct module imports (no barrel).
  - Verifies all atom initial values and transitions.
  - Verifies pipeline IDs and counts; total expected is `63,988`.
- `apps/demo/src/__tests__/verify-playground/atoms.test.ts`
  - Verifies Falcon atom transitions and shape.
- `apps/demo/src/__tests__/pipeline-viz.test.ts`
  - Asserts 6-step data correctness, exact count array `[5988, 15000, 1500, 15000, 500, 26000]`.
- `apps/demo/src/__tests__/account-deploy/account-deploy-flow.test.ts`
  - Uses `DeployStep`, `deployStepAtom`, `deployedAddressAtom`, `deployTxHashAtom` directly.

### App shell state wiring status
- `apps/demo/src/app/layout.tsx`
  - Does not yet wrap with `AtomProvider`; this is in Task 4 plan but outside this ticket's direct file list.

## README Profiling Reference
- `README.md` profiling table values:
  - `verify (e2e)`: 63,177
  - `verify_with_msg_point`: 26,301
  - `hash_to_point`: 5,988
- Note for implementer: pipeline sub-step values used by PRD/tests are partly approximate (`~15k`, `~1.5k`, `~500`, `~26k`) and currently encoded as integers in atoms/tests.

## Implementation Risks / Clarifications
1. Barrel export conflict:
- Implementation plan suggests `atoms/index.ts`, but this ticket forbids it.
- Keep/update imports to direct module paths only.

2. Step count interpretation:
- Tests currently enforce `[5988, 15000, 1500, 15000, 500, 26000]` and total `63,988`.
- README top-level metrics are `63,177` / `26,301` / `5,988`.
- If ticket insists on different "exact" values than current tests, tests and atom constants must be updated together.

## Relevant Files for atoms-001
- `apps/demo/src/atoms/falcon.ts`
- `apps/demo/src/atoms/starknet.ts`
- `apps/demo/src/atoms/pipeline.ts`
- `apps/demo/src/services/types.ts`
- `apps/demo/src/tests/atoms.test.ts`
- `apps/demo/src/__tests__/verify-playground/atoms.test.ts`
- `apps/demo/src/__tests__/pipeline-viz.test.ts`
- `apps/demo/src/__tests__/account-deploy/account-deploy-flow.test.ts`
- `docs/specs/falcon-demo-website.md`
- `docs/plans/2026-02-23-falcon-demo-website-design.md`
- `docs/plans/2026-02-23-falcon-demo-website-impl.md`
- `CLAUDE.md`
- `README.md`
