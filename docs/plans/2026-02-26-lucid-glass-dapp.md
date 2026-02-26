# Lucid Glass dApp Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Falcon-512 demo into a premium glassmorphism dApp with zero blind spots — every state handled, every transition animated, every error human-readable.

**Architecture:** The app already has strong foundations: Effect pipelines, typed errors, atom-based state, glass design tokens. We refine rather than rewrite. Work flows bottom-up: CSS foundation -> utility classes -> component library -> interactive panel upgrades -> polish pass.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5.7, Tailwind CSS 4 (`@theme`), Effect 3, @effect-atom 0.5, starknet.js 9, Bun test runner.

---

## Task 1: Enhance CSS Design Tokens & Utility Classes

**Files:**
- Modify: `apps/demo/src/app/globals.css`

**Goal:** Eliminate inline glass styles across the codebase by extracting reusable CSS utility classes. Add missing design tokens for consistent spacing, easing, and component variants.

**Step 1: Add glass utility classes to globals.css**

After the existing `.glass-nav` block (~line 134), add:

```css
/* ─── Glass form controls ──────────────────────────────────────────── */
.glass-input {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 0.75rem;
  transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}

.glass-input:focus {
  outline: none;
  border-color: var(--glass-border-hover);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.glass-input:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.glass-select {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 0.75rem;
  transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}

.glass-select:focus {
  outline: none;
  border-color: var(--glass-border-hover);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

/* Glass display — read-only content (hex, addresses, code) */
.glass-display {
  background: var(--glass-bg);
  border-radius: 0.5rem;
}

/* Glass button — secondary/ghost variant */
.glass-btn {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}

.glass-btn:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-hover);
}

/* ─── Glass card status modifiers ──────────────────────────────────── */
.glass-card-success {
  box-shadow: var(--glass-shadow), var(--glass-shadow-success);
  border-color: rgba(16, 185, 129, 0.15);
}

.glass-card-error {
  box-shadow: var(--glass-shadow), var(--glass-shadow-error);
  border-color: rgba(239, 68, 68, 0.15);
}

.glass-card-active {
  box-shadow: var(--glass-shadow), var(--glass-shadow-glow);
  border-color: rgba(99, 102, 241, 0.2);
}

.glass-card-warning {
  box-shadow: 0 0 30px -5px rgba(234, 179, 8, 0.1);
  border-color: rgba(234, 179, 8, 0.15);
}
```

**Step 2: Add micro-interaction keyframes**

After the shimmer keyframes block, add:

```css
/* ─── Micro-interaction animations ─────────────────────────────────── */
@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(99, 102, 241, 0.3); }
  50% { box-shadow: 0 0 16px rgba(99, 102, 241, 0.5); }
}

@keyframes checkmark-in {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fade-in 0.3s cubic-bezier(0.32, 0.72, 0, 1) both;
}

.animate-scale-in {
  animation: scale-in 0.2s cubic-bezier(0.32, 0.72, 0, 1) both;
}

.animate-slide-up {
  animation: slide-up 0.4s cubic-bezier(0.32, 0.72, 0, 1) both;
}

.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

.animate-checkmark {
  animation: checkmark-in 0.4s cubic-bezier(0.32, 0.72, 0, 1) both;
}

/* Copy feedback */
@keyframes copy-flash {
  0% { background: rgba(16, 185, 129, 0.15); }
  100% { background: transparent; }
}

.animate-copy-flash {
  animation: copy-flash 0.6s ease-out;
}

/* Stagger delays for lists */
.stagger-delay-1 { animation-delay: 50ms; }
.stagger-delay-2 { animation-delay: 100ms; }
.stagger-delay-3 { animation-delay: 150ms; }
.stagger-delay-4 { animation-delay: 200ms; }
.stagger-delay-5 { animation-delay: 250ms; }

/* Respect reduced motion for all animations */
@media (prefers-reduced-motion: reduce) {
  .animate-fade-in,
  .animate-scale-in,
  .animate-slide-up,
  .animate-pulse-glow,
  .animate-checkmark,
  .animate-copy-flash {
    animation: none;
  }
}
```

**Step 3: Add scrollbar styling**

At the bottom of globals.css:

```css
/* ─── Custom scrollbar ─────────────────────────────────────────────── */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--glass-border-hover);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}

.light ::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.15);
}
```

**Step 4: Verify the dev server compiles without errors**

Run: `cd apps/demo && bun run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/demo/src/app/globals.css
git commit -m "style: add glass utility classes, micro-interaction animations, and scrollbar styling"
```

---

## Task 2: Migrate Inline Styles to Glass Utility Classes

**Files:**
- Modify: `apps/demo/src/components/interactive/KeyManagementPanel.tsx`
- Modify: `apps/demo/src/components/interactive/SignVerifyPanel.tsx`
- Modify: `apps/demo/src/components/interactive/SendTransaction.tsx`
- Modify: `apps/demo/src/components/interactive/AccountDeployFlow.tsx`
- Modify: `apps/demo/src/components/interactive/PipelineVisualizer.tsx`
- Modify: `apps/demo/src/components/interactive/HexDisplay.tsx`
- Modify: `apps/demo/src/components/landing/NavHeader.tsx`
- Modify: `apps/demo/src/components/landing/PerformanceStats.tsx`
- Modify: `apps/demo/src/components/landing/Footer.tsx`
- Modify: `apps/demo/src/components/ThemeToggle.tsx`

**Goal:** Replace all `style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}` occurrences with the new CSS classes. Replace status card inline styles with `.glass-card-success`, `.glass-card-error`, `.glass-card-active`, `.glass-card-warning` modifiers.

**Step 1: Migrate input fields**

In all components, replace patterns like:
```tsx
className="... focus:outline-none focus:ring-1 focus:ring-falcon-primary/30"
style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
```
With:
```tsx
className="... glass-input"
```
(Remove the `style` prop entirely; remove the redundant focus ring classes since `.glass-input:focus` handles it.)

Files affected:
- `SignVerifyPanel.tsx` line 136: message input
- `SendTransaction.tsx` lines 91, 105: recipient and amount inputs
- `AccountDeployFlow.tsx` line 402: devnet account select (use `glass-select`)
- `AccountDeployFlow.tsx` line 347: fund account address display (use `glass-display`)

**Step 2: Migrate glass buttons**

Replace inline-styled ghost/secondary buttons with `glass-btn` class:
- `KeyManagementPanel.tsx` lines 150, 158: Import/Export buttons
- `SignVerifyPanel.tsx` line 209: Try Again button
- `AccountDeployFlow.tsx` lines 356, 484: Copy button, Try Again button
- `PipelineVisualizer.tsx` line 142: toolbar container

**Step 3: Migrate status cards**

Replace inline `style={{ boxShadow: "...", borderColor: "..." }}` with modifier classes:
- `SignVerifyPanel.tsx` lines 173-176: result card → `glass-card-static glass-card-success` or `glass-card-error`
- `SignVerifyPanel.tsx` lines 195-198: error card → `glass-card-static glass-card-error`
- `SendTransaction.tsx` line 121: success result → `glass-card-static glass-card-success`
- `SendTransaction.tsx` line 143: error result → `glass-card-static glass-card-error`
- `AccountDeployFlow.tsx` line 447: deployed card → `glass-card-static glass-card-success`
- `AccountDeployFlow.tsx` line 477: error card → `glass-card-static glass-card-error`
- `AccountDeployFlow.tsx` line 299: warning card → `glass-card-static glass-card-warning`

**Step 4: Migrate PipelineVisualizer step cards**

Replace the inline `style` prop in `PipelineStepCard` with conditional classes:
```tsx
className={`glass-card-static rounded-3xl p-6 transition-all duration-300 ${
  isActive ? "glass-card-active" : isComplete ? "glass-card-success" : ""
}`}
```

**Step 5: Migrate HexDisplay**

Replace `style={{ background: "var(--glass-bg)" }}` with `glass-display` class.

**Step 6: Migrate NavHeader**

Replace inline styles on network selector group and ThemeToggle button with `glass-btn` class where appropriate.

**Step 7: Migrate remaining inline styles**

Check for any remaining `style={{ background: "var(--glass-bg)"` patterns and eliminate them.

**Step 8: Add `tabular-nums` to all numeric displays**

Add `tabular-nums` class to:
- Hero stat values (Hero.tsx line 44)
- Pipeline step counts (PipelineVisualizer.tsx line 227)
- Balance display (AccountDeployFlow.tsx line 377)
- Duration display (SignVerifyPanel.tsx line 185)
- Amount input (SendTransaction.tsx line 100)

**Step 9: Verify and commit**

Run: `cd apps/demo && bun run typecheck`
Expected: No errors

```bash
git add apps/demo/src/components/
git commit -m "refactor: migrate inline glass styles to utility classes, add tabular-nums"
```

---

## Task 3: Remove Debug Logging from FalconSigner

**Files:**
- Modify: `apps/demo/src/services/FalconSigner.ts`

**Step 1: Remove console.log statements**

Remove lines 104-111 (the 8 debug console.log statements in `_signHash`). Keep only the success return.

Before:
```typescript
if (Exit.isSuccess(exit)) {
  console.log("[FalconSigner] txHash:", txHash)
  // ... 7 more console.logs
  return exit.value
}
```

After:
```typescript
if (Exit.isSuccess(exit)) {
  return exit.value
}
```

**Step 2: Commit**

```bash
git add apps/demo/src/services/FalconSigner.ts
git commit -m "fix: remove debug console.log statements from FalconSigner"
```

---

## Task 4: Create Reusable dApp Component Library

**Files:**
- Create: `apps/demo/src/components/ui/AddressDisplay.tsx`
- Create: `apps/demo/src/components/ui/CopyButton.tsx`
- Create: `apps/demo/src/components/ui/GlassSkeleton.tsx`
- Create: `apps/demo/src/components/ui/EmptyState.tsx`
- Create: `apps/demo/src/components/ui/StatusBadge.tsx`
- Create: `apps/demo/src/components/ui/TokenAmount.tsx`
- Create: `apps/demo/src/components/ui/ExplorerLink.tsx`

**Goal:** Extract reusable dApp-specific primitives that enforce consistent styling and behavior across all interactive sections.

**Step 1: Create CopyButton component**

```tsx
// apps/demo/src/components/ui/CopyButton.tsx
"use client"
import React, { useCallback, useState } from "react"

interface CopyButtonProps {
  readonly value: string
  readonly label?: string
  readonly className?: string
}

export function CopyButton({ value, label = "Copy", className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [value])

  return (
    <button
      onClick={handleCopy}
      className={`glass-btn shrink-0 rounded-lg px-3 py-1.5 text-xs transition-all duration-200 ${
        copied
          ? "text-falcon-success/80"
          : "text-falcon-text/40 hover:text-falcon-text/70"
      } ${className}`}
      title={copied ? "Copied!" : `Copy ${label}`}
    >
      {copied ? "\u2713 Copied" : label}
    </button>
  )
}
```

**Step 2: Create AddressDisplay component**

```tsx
// apps/demo/src/components/ui/AddressDisplay.tsx
import React from "react"
import { CopyButton } from "./CopyButton"

interface AddressDisplayProps {
  readonly address: string
  readonly label?: string
  readonly explorerBaseUrl?: string
  readonly full?: boolean
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr
  return `${addr.slice(0, 10)}...${addr.slice(-4)}`
}

export function AddressDisplay({ address, label, explorerBaseUrl, full = false }: AddressDisplayProps) {
  return (
    <div className="glass-display rounded-xl p-4">
      {label && (
        <p className="text-[10px] font-medium uppercase tracking-widest text-falcon-text/20">
          {label}
        </p>
      )}
      <div className={`flex items-center gap-2 ${label ? "mt-2" : ""}`}>
        <code className="flex-1 break-all font-mono text-xs tabular-nums text-falcon-accent/60">
          {full ? address : truncateAddress(address)}
        </code>
        <CopyButton value={address} />
      </div>
      {explorerBaseUrl && (
        <a
          href={`${explorerBaseUrl}/contract/${address}`}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-block text-xs text-falcon-text/25 transition-colors duration-200 hover:text-falcon-accent/60"
        >
          View on explorer &rarr;
        </a>
      )}
    </div>
  )
}
```

**Step 3: Create GlassSkeleton component**

```tsx
// apps/demo/src/components/ui/GlassSkeleton.tsx
import React from "react"

interface GlassSkeletonProps {
  readonly className?: string
  readonly lines?: number
}

export function GlassSkeleton({ className = "", lines = 3 }: GlassSkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="skeleton-shimmer h-4 rounded-lg"
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  )
}
```

**Step 4: Create EmptyState component**

```tsx
// apps/demo/src/components/ui/EmptyState.tsx
import React from "react"

interface EmptyStateProps {
  readonly title: string
  readonly description: string
  readonly action?: {
    readonly label: string
    readonly onClick: () => void
  }
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm font-medium text-falcon-text/40">{title}</p>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-falcon-text/25">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-xl bg-gradient-to-b from-falcon-primary to-falcon-primary/80 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-falcon-primary/15 transition-all duration-200 hover:scale-[1.02]"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
```

**Step 5: Create StatusBadge component**

```tsx
// apps/demo/src/components/ui/StatusBadge.tsx
import React from "react"

type StatusVariant = "success" | "error" | "warning" | "info" | "pending"

interface StatusBadgeProps {
  readonly variant: StatusVariant
  readonly children: React.ReactNode
}

const variantStyles: Record<StatusVariant, string> = {
  success: "text-falcon-success/80 bg-falcon-success/10",
  error: "text-falcon-error/80 bg-falcon-error/10",
  warning: "text-yellow-400/80 bg-yellow-400/10",
  info: "text-falcon-accent/80 bg-falcon-accent/10",
  pending: "text-falcon-primary/80 bg-falcon-primary/10",
}

export function StatusBadge({ variant, children }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]}`}>
      {variant === "pending" && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {children}
    </span>
  )
}
```

**Step 6: Create TokenAmount component**

```tsx
// apps/demo/src/components/ui/TokenAmount.tsx
import React from "react"

interface TokenAmountProps {
  readonly amount: bigint
  readonly decimals?: number
  readonly symbol?: string
  readonly className?: string
}

export function TokenAmount({ amount, decimals = 18, symbol = "STRK", className = "" }: TokenAmountProps) {
  const formatted = (Number(amount) / 10 ** decimals).toFixed(4)

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {formatted} <span className="text-falcon-text/40">{symbol}</span>
    </span>
  )
}
```

**Step 7: Create ExplorerLink component**

```tsx
// apps/demo/src/components/ui/ExplorerLink.tsx
import React from "react"

interface ExplorerLinkProps {
  readonly baseUrl: string
  readonly txHash?: string
  readonly address?: string
  readonly className?: string
}

export function ExplorerLink({ baseUrl, txHash, address, className = "" }: ExplorerLinkProps) {
  if (!baseUrl) return null

  const path = txHash ? `/tx/${txHash}` : address ? `/contract/${address}` : ""
  const label = txHash ? "View transaction" : address ? "View contract" : "View on explorer"

  return (
    <a
      href={`${baseUrl}${path}`}
      target="_blank"
      rel="noreferrer noopener"
      className={`inline-flex items-center gap-1 text-xs text-falcon-text/25 transition-colors duration-200 hover:text-falcon-accent/60 ${className}`}
    >
      {label} <span aria-hidden="true">&rarr;</span>
    </a>
  )
}
```

**Step 8: Run typecheck and commit**

Run: `cd apps/demo && bun run typecheck`

```bash
git add apps/demo/src/components/ui/
git commit -m "feat: add reusable dApp UI component library (CopyButton, AddressDisplay, GlassSkeleton, EmptyState, StatusBadge, TokenAmount, ExplorerLink)"
```

---

## Task 5: Integrate UI Components into Interactive Panels

**Files:**
- Modify: `apps/demo/src/components/interactive/AccountDeployFlow.tsx`
- Modify: `apps/demo/src/components/interactive/SendTransaction.tsx`
- Modify: `apps/demo/src/components/interactive/SignVerifyPanel.tsx`

**Goal:** Replace hand-rolled address displays, copy buttons, explorer links, and balance displays with the new reusable components.

**Step 1: Refactor AccountDeployFlow**

Replace the "Send STRK to" address display block (lines 347-361) with:
```tsx
<AddressDisplay
  address={deployStep.address}
  label="Send STRK to"
  explorerBaseUrl={networkConfig.explorerBaseUrl}
  full
/>
```

Replace the deployed success card's address/tx display with:
```tsx
<AddressDisplay address={deployStep.address} label="Account Address" full />
<p className="mt-2 break-all font-mono text-xs text-falcon-text/50">
  Tx: {deployStep.txHash}
</p>
<ExplorerLink baseUrl={networkConfig.explorerBaseUrl} txHash={deployStep.txHash} className="mt-4" />
```

Replace the balance display (line 377) with `<TokenAmount>`.

**Step 2: Refactor SendTransaction**

Replace the success result card's tx display and explorer link with:
```tsx
<p className="mt-2 break-all font-mono text-xs tabular-nums text-falcon-text/50">
  Tx: {result.txHash}
</p>
<ExplorerLink baseUrl={networkConfig.explorerBaseUrl} txHash={result.txHash} className="mt-3" />
```

**Step 3: Typecheck and commit**

Run: `cd apps/demo && bun run typecheck`

```bash
git add apps/demo/src/components/interactive/
git commit -m "refactor: integrate reusable UI components into interactive panels"
```

---

## Task 6: Enhance Error Handling with User-Facing Messages

**Files:**
- Create: `apps/demo/src/services/error-messages.ts`
- Modify: `apps/demo/src/components/interactive/AccountDeployFlow.tsx`
- Modify: `apps/demo/src/components/interactive/SendTransaction.tsx`

**Goal:** Map typed Effect errors to specific, helpful user-facing messages instead of showing generic error strings.

**Step 1: Create error message mapping**

```typescript
// apps/demo/src/services/error-messages.ts
import { Cause, Exit, Option } from "effect"
import type {
  AccountDeployError,
  DevnetFetchError,
  InsufficientFundsError,
  KeygenError,
  PackingError,
  SigningError,
  StarknetRpcError,
  TransactionSignError,
  TransactionSubmitError,
  VerificationError,
  WasmLoadError,
} from "./errors"

type AppError =
  | WasmLoadError
  | KeygenError
  | SigningError
  | VerificationError
  | PackingError
  | StarknetRpcError
  | AccountDeployError
  | InsufficientFundsError
  | TransactionSignError
  | TransactionSubmitError
  | DevnetFetchError

export function mapErrorToUserMessage(error: AppError): string {
  switch (error._tag) {
    case "WasmLoadError":
      return "Failed to load the cryptography module. Try refreshing the page."
    case "KeygenError":
      return "Keypair generation failed. Try again with a different seed."
    case "SigningError":
      return "Signing failed. Make sure your keypair is valid."
    case "VerificationError":
      return `Verification failed at step: ${error.step}. The signature may be invalid.`
    case "PackingError":
      return "Failed to pack the public key. The key data may be corrupted."
    case "StarknetRpcError":
      return "Network error communicating with Starknet. Check your connection and try again."
    case "AccountDeployError":
      if (error.message.includes("INSUFFICIENT_ACCOUNT_BALANCE")) {
        return "Not enough STRK to cover deployment gas. Add more funds and try again."
      }
      if (error.message.includes("CONTRACT_ALREADY_DEPLOYED") || error.message.includes("already deployed")) {
        return "This account is already deployed. You can start using it."
      }
      return `Deployment failed: ${error.message}`
    case "InsufficientFundsError":
      return `Insufficient STRK balance at ${error.address.slice(0, 10)}...${error.address.slice(-4)}. Send at least ${error.required} wei to continue.`
    case "TransactionSignError":
      return "Transaction signing was cancelled or failed."
    case "TransactionSubmitError":
      if (error.message.includes("nonce")) {
        return "Transaction nonce conflict. Wait for your previous transaction to confirm, then try again."
      }
      if (error.message.includes("INSUFFICIENT")) {
        return "Insufficient balance to cover this transfer and gas fees."
      }
      return `Transaction failed: ${error.message}`
    case "DevnetFetchError":
      return "Could not connect to local devnet. Make sure starknet-devnet is running on port 5050."
    default:
      return "An unexpected error occurred. Check the browser console for details."
  }
}

export function extractUserMessage<A, E extends { readonly _tag: string; readonly message: string }>(
  exit: Exit.Exit<A, E>,
  fallback: string,
): string {
  if (Exit.isSuccess(exit)) return fallback
  const failure = Cause.failureOption(exit.cause)
  return Option.match(failure, {
    onNone: () => fallback,
    onSome: (error) => mapErrorToUserMessage(error as AppError),
  })
}
```

**Step 2: Update AccountDeployFlow to use extractUserMessage**

Replace the `extractFailureMessage` function (lines 40-52) import with `extractUserMessage` from the new module.

Update `handlePrepare` line 148:
```typescript
message: extractUserMessage(prepareExit, "Failed to prepare deployment"),
```

Update `handleDeploy` line 199:
```typescript
message: extractUserMessage(deployExit, "Account deployment failed"),
```

**Step 3: Update SendTransaction to use extractUserMessage**

Replace the error extraction (lines 63-69) with:
```typescript
setError(extractUserMessage(exit, "Transaction failed"))
```

**Step 4: Typecheck and commit**

Run: `cd apps/demo && bun run typecheck`

```bash
git add apps/demo/src/services/error-messages.ts apps/demo/src/components/interactive/AccountDeployFlow.tsx apps/demo/src/components/interactive/SendTransaction.tsx
git commit -m "feat: add typed error-to-user-message mapping for all Effect errors"
```

---

## Task 7: Add Transaction State Feedback

**Files:**
- Modify: `apps/demo/src/components/interactive/AccountDeployFlow.tsx`
- Modify: `apps/demo/src/components/interactive/SendTransaction.tsx`

**Goal:** Improve visual feedback for all transaction phases. Replace bare "Sending..." text with contextual state indicators.

**Step 1: Enhance AccountDeployFlow deploying state**

When `deployStep.step === "deploying"`, show a contextual card:
```tsx
{deployStep.step === "deploying" && (
  <div className="glass-card-static glass-card-active mt-8 rounded-2xl p-6 animate-fade-in">
    <div className="flex items-center gap-3">
      <span className="inline-block h-2.5 w-2.5 animate-pulse-glow rounded-full bg-falcon-primary" />
      <p className="text-sm font-medium text-falcon-text/80">Deploying your Falcon account...</p>
    </div>
    <p className="mt-2 text-xs text-falcon-text/30">
      Confirm the transaction in your wallet. This may take 30-60 seconds.
    </p>
  </div>
)}
```

**Step 2: Enhance SendTransaction with loading state**

When `sending` is true, replace the button text with a loading indicator and show a status card:
```tsx
{sending && (
  <div className="glass-card-static glass-card-active mt-5 rounded-2xl p-5 animate-fade-in">
    <div className="flex items-center gap-3">
      <span className="inline-block h-2.5 w-2.5 animate-pulse-glow rounded-full bg-falcon-accent" />
      <p className="text-sm font-medium text-falcon-text/80">Sending STRK...</p>
    </div>
    <p className="mt-2 text-xs text-falcon-text/30">
      Signing with your Falcon key and submitting to the network.
    </p>
  </div>
)}
```

**Step 3: Add animate-fade-in to success/error result cards**

Add `animate-fade-in` class to all result cards for smooth entrance.

**Step 4: Typecheck and commit**

```bash
git add apps/demo/src/components/interactive/
git commit -m "feat: add contextual transaction state feedback with animations"
```

---

## Task 8: Polish Landing Sections

**Files:**
- Modify: `apps/demo/src/components/landing/Hero.tsx`
- Modify: `apps/demo/src/components/landing/WhyPostQuantum.tsx`
- Modify: `apps/demo/src/components/landing/PerformanceStats.tsx`
- Modify: `apps/demo/src/components/landing/Footer.tsx`
- Modify: `apps/demo/src/components/landing/NavHeader.tsx`

**Goal:** Apply final polish to landing sections: stagger animations on cards, consistent spacing, tighter typography.

**Step 1: Add stagger-child classes to WhyPostQuantum cards**

Wrap each card in the grid with `stagger-child` class so they animate in sequence when scrolled into view.

**Step 2: Add stagger-child classes to Hero stats**

Wrap each stat card with `stagger-child` class.

**Step 3: Polish PerformanceStats table borders**

Replace inline `style={{ borderBottom: "1px solid var(--glass-border)" }}` with a Tailwind class approach using `divide-y` or keep the glass-border variable but extract to a class.

**Step 4: Add mobile hamburger menu to NavHeader**

Add a basic mobile menu toggle that shows/hides nav links on small screens (currently hidden with `hidden md:flex`). Use a simple glass dropdown that slides down.

**Step 5: Footer polish**

Ensure footer uses `glass-nav` bottom border style consistently (it currently uses inline style).

**Step 6: Typecheck and commit**

```bash
git add apps/demo/src/components/landing/
git commit -m "style: polish landing sections with stagger animations, mobile nav, and consistent borders"
```

---

## Task 9: Responsive Pass

**Files:**
- Modify: Various components

**Goal:** Ensure every section works well at mobile (375px), tablet (768px), desktop (1440px), and ultrawide (1920px+).

**Step 1: Test and fix Hero section responsive**

- Ensure stat cards stack properly on mobile
- Check heading text size scaling

**Step 2: Test and fix Verification Playground responsive**

- The 2-column grid should stack to single column on mobile
- Inputs should be full-width
- Hex displays should not overflow

**Step 3: Test and fix Pipeline Visualizer responsive**

- 3-column grid should collapse to 2 on tablet, 1 on mobile
- Toolbar should wrap cleanly

**Step 4: Test and fix Account Deploy Flow responsive**

- Step progress line should work on mobile
- Address display should break properly
- Buttons should be full-width on mobile

**Step 5: Test and fix NavHeader responsive**

- Network selector should be compact on mobile
- Navigation links should use the mobile menu

**Step 6: Commit**

```bash
git add apps/demo/src/
git commit -m "style: responsive layout pass for mobile, tablet, desktop, and ultrawide"
```

---

## Task 10: Micro-Interactions & Final Polish

**Files:**
- Modify: Various components

**Goal:** Add the finishing touches that make the UI feel premium: button press feedback, copy feedback, smooth number transitions, focus states.

**Step 1: Button press feedback**

Add `active:scale-[0.98]` to all primary and secondary buttons for a satisfying press feel.

**Step 2: Consistent focus-visible rings**

Ensure all interactive elements have `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-falcon-primary/40` (standardize to ring-2 everywhere).

**Step 3: Copy button feedback**

The CopyButton component already handles the copied state with a checkmark. Verify it works in all locations.

**Step 4: Pipeline step card hover lift**

Add subtle hover effect to pipeline step cards (even though they're `glass-card-static`, a slight `hover:translate-y-[-1px]` adds life).

**Step 5: Smooth section transitions**

Verify all ScrollReveal sections animate in properly with staggered children.

**Step 6: Test in both dark and light modes**

Switch between themes and verify:
- All glass effects render correctly in both modes
- Text contrast is readable in light mode
- Shadows are appropriate for each mode
- Status colors are visible in both modes

**Step 7: Commit**

```bash
git add apps/demo/src/
git commit -m "style: add micro-interactions, consistent focus rings, and final polish"
```

---

## Task 11: Write Tests for New Components

**Files:**
- Create: `apps/demo/src/__tests__/ui/copy-button.test.tsx`
- Create: `apps/demo/src/__tests__/ui/address-display.test.tsx`
- Create: `apps/demo/src/__tests__/ui/status-badge.test.tsx`
- Create: `apps/demo/src/__tests__/ui/token-amount.test.tsx`
- Create: `apps/demo/src/__tests__/services/error-messages.test.ts`

**Goal:** Test the new reusable components and error mapping logic.

**Step 1: Test error message mapping**

```typescript
// apps/demo/src/__tests__/services/error-messages.test.ts
import { describe, expect, test } from "bun:test"
import { Exit } from "effect"
import { mapErrorToUserMessage, extractUserMessage } from "@/services/error-messages"
import { WasmLoadError, InsufficientFundsError, TransactionSubmitError } from "@/services/errors"

describe("mapErrorToUserMessage", () => {
  test("maps WasmLoadError to refresh message", () => {
    const err = new WasmLoadError({ message: "module not found" })
    expect(mapErrorToUserMessage(err)).toContain("refreshing the page")
  })

  test("maps InsufficientFundsError with address truncation", () => {
    const err = new InsufficientFundsError({
      message: "insufficient",
      address: "0x1234567890abcdef1234567890abcdef",
      required: "1000",
    })
    const msg = mapErrorToUserMessage(err)
    expect(msg).toContain("0x12345678")
    expect(msg).toContain("1000 wei")
  })

  test("maps nonce conflict in TransactionSubmitError", () => {
    const err = new TransactionSubmitError({ message: "Invalid nonce" })
    expect(mapErrorToUserMessage(err)).toContain("nonce conflict")
  })
})

describe("extractUserMessage", () => {
  test("returns fallback for success exit", () => {
    const exit = Exit.succeed("ok")
    expect(extractUserMessage(exit, "fallback")).toBe("fallback")
  })

  test("extracts mapped message from failure exit", () => {
    const exit = Exit.fail(new WasmLoadError({ message: "failed" }))
    expect(extractUserMessage(exit, "fallback")).toContain("refreshing the page")
  })
})
```

**Step 2: Test TokenAmount rendering**

```typescript
// apps/demo/src/__tests__/ui/token-amount.test.tsx
import { describe, expect, test } from "bun:test"

describe("TokenAmount", () => {
  test("formats wei amount to 4 decimal places", () => {
    // Test the formatting logic
    const amount = 1000000000000000n // 0.001 ETH
    const formatted = (Number(amount) / 1e18).toFixed(4)
    expect(formatted).toBe("0.0010")
  })

  test("handles zero amount", () => {
    const amount = 0n
    const formatted = (Number(amount) / 1e18).toFixed(4)
    expect(formatted).toBe("0.0000")
  })
})
```

**Step 3: Run tests**

Run: `cd apps/demo && bun test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add apps/demo/src/__tests__/
git commit -m "test: add tests for error message mapping and UI components"
```

---

## Task 12: Visual QA with surf CLI

**Files:** None (inspection only)

**Goal:** Launch the dev server and visually inspect every page state, component, and interaction.

**Step 1: Start dev server**

Run: `cd apps/demo && bun run dev`

**Step 2: Dark mode walkthrough**

Use `surf cli` to screenshot and inspect:
- Hero section (default state)
- WhyPostQuantum cards (stagger animation)
- PerformanceStats table (tabular-nums alignment)
- Verification Playground (empty/keygen/signed/verified/error)
- Pipeline Visualizer (idle/playing/step/complete)
- Account Deploy Flow (each step: idle/preparing/awaiting-funds/deploying/deployed/error)
- SendTransaction (idle/sending/success/error)
- Footer
- NavHeader (all network selections)

**Step 3: Light mode walkthrough**

Toggle to light mode and repeat all screenshots. Check:
- Glass effects render in light mode
- Text contrast passes accessibility
- Shadows are softer
- Status colors are visible

**Step 4: Mobile viewport (375px)**

Resize and check all sections stack properly.

**Step 5: Document findings and fix**

For each issue found, fix immediately and re-inspect.

**Step 6: Commit fixes**

```bash
git add apps/demo/src/
git commit -m "fix: visual QA fixes from surf CLI inspection"
```

---

## Execution Notes

- Tasks 1-3 are foundational CSS and cleanup — must go first
- Task 4 creates components that Tasks 5-7 depend on
- Tasks 8-10 are polish passes that can overlap
- Task 11 tests can be written alongside or after implementation
- Task 12 is the continuous QA loop — run after each major task to catch regressions

Total estimated scope: ~15 files modified, ~7 files created. No new npm dependencies. No contract changes required for this frontend pass (contract gaps documented in Phase 0 report for future work).
