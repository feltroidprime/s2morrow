# Session Context

## User Prompts

### Prompt 1

Implement the following plan:

# Fix: FalconService.sign() passes empty salt

## Context

The WASM `sign()` binding requires a 40-byte salt (`SALT_LEN = 40`). The Rust side validates this and rejects anything else:

```rust
if salt.len() != SALT_LEN {
    return Err(JsError::new(&format!(
        "Invalid salt length: expected {SALT_LEN}, got {}", salt.len()
    )));
}
```

But `FalconService.ts:117` passes `new Uint8Array(0)`:

```typescript
wasm.sign(secretKey, message, new Uint8Array(0))  // ...

### Prompt 2

Base directory for this skill: /home/felt/.claude/plugins/cache/claude-plugins-official/superpowers/4.3.1/skills/verification-before-completion

# Verification Before Completion

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't r...

### Prompt 3

Error

Error: VK too short: expected at least 897 bytes, got 896

