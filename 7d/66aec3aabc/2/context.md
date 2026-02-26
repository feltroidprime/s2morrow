# Session Context

## User Prompts

### Prompt 1

Implement the following plan:

# Plan: E2E Scripts + Declare + README

## Context

The Falcon account deploy flow works end-to-end (keygen → NTT pk → pack → deploy → transfer) but there are no committed scripts to run it. The existing `apps/demo/scripts/deploy-falcon.mjs` is gitignored (`scripts/` in root `.gitignore`). Need:
1. Idempotent devnet E2E test script
2. Sepolia class declaration support
3. README setup sections

## Key Constraints

- `scripts/` is gitignored — use `bin/` in...

### Prompt 2

Help me make declare-sepolia work : This should build the latest cairo contract, declare it and update network.ts

### Prompt 3

try it

### Prompt 4

done

### Prompt 5

add a makefile for vercel deploy release

### Prompt 6

I have trouble deploying on sepoila : rR: RPC: starknet_addDeployAccountTransaction with params { "deploy_account_transaction": { "type": "DEPLOY_ACCOUNT", "constructor_calldata": [ "0x246966a109602fa9d1e3cee01b29e0302aca7d8978c9ba6066852a981885dc1", "0x1b7f8be2f8fd01f5f8be43e147fabf203baf6f8b5a07db5560ed30e4ad94142", "0x496cda3ba72c23d7a236a73b081912a0184279c0836545334b28b47caee2997", "0x110f35380354effc14b808ab772e1ed0197a119c093df24b8882ed3b77d2953", "0x241698aa575aaec3382b7865b64c22501d1820b...

### Prompt 7

[Request interrupted by user for tool use]

