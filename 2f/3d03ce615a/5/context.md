# Session Context

## User Prompts

### Prompt 1

IMPORTANT: After completing the task below, you MUST output a JSON object in a ```json code fence at the very end of your response. Do NOT forget this — the workflow fails without it.

RESEARCH PHASE — Ticket: ES-005

Title: Implement StarknetService with shared salt and no type assertions
Description: Create apps/demo/src/services/StarknetService.ts with 4 methods. Critical fixes needed vs planned code: (1) computeDeployAddress must return the salt so deployAccount can reuse it — or refac...

### Prompt 2

Base directory for this skill: /home/felt/.claude/plugins/cache/eni-skills/personal-skills/1.0.0/skills/effect-best-practices

# Effect-TS Best Practices

This skill enforces opinionated, consistent patterns for Effect-TS codebases. These patterns optimize for type safety, testability, observability, and maintainability.

## Quick Reference: Critical Rules

| Category | DO | DON'T |
|----------|-----|-------|
| Services | `Effect.Service` with `accessors: true` | `Context.Tag` for business logic...

