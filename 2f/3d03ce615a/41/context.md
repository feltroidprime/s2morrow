# Session Context

## User Prompts

### Prompt 1

IMPORTANT: After completing the task below, you MUST output a JSON object in a ```json code fence at the very end of your response. Do NOT forget this — the workflow fails without it.

CODE QUALITY REVIEW — Ticket: ES-005

Title: Implement StarknetService with shared salt and no type assertions
Category: effect-services

You are reviewing this ticket&#x27;s implementation for **code quality only**.
Spec compliance is reviewed separately — focus here on quality, correctness patterns, and ma...

### Prompt 2

Base directory for this skill: /home/felt/.claude/plugins/cache/eni-skills/personal-skills/1.0.0/skills/effect-best-practices

# Effect-TS Best Practices

This skill enforces opinionated, consistent patterns for Effect-TS codebases. These patterns optimize for type safety, testability, observability, and maintainability.

## Quick Reference: Critical Rules

| Category | DO | DON'T |
|----------|-----|-------|
| Services | `Effect.Service` with `accessors: true` | `Context.Tag` for business logic...

