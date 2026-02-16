# Session Context

## User Prompts

### Prompt 1

Base directory for this skill: /home/felt/.claude/plugins/cache/claude-plugins-official/superpowers/4.3.0/skills/brainstorming

# Brainstorming Ideas Into Designs

## Overview

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design and get user approval.

<HARD-GATE>
Do NOT invoke any implementa...

### Prompt 2

store the Pk as a struct of 9 felt252

### Prompt 3

[Request interrupted by user]

### Prompt 4

store the Pk as a struct of felt252

### Prompt 5

yes, 29 is fine. continue with the design

### Prompt 6

Base directory for this skill: /home/felt/.claude/plugins/cache/claude-plugins-official/superpowers/4.3.0/skills/writing-plans

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

As...

### Prompt 7

1. Load /cairo-coding as well for basic rules if needed.

### Prompt 8

Base directory for this skill: /home/felt/PycharmProjects/s2morrow/.claude/skills/cairo-coding

# Coding Cairo

Rules and patterns for writing efficient Cairo code. Sourced from audit findings and production profiling.

## When to Use

- Implementing arithmetic (modular, parity checks, quotient/remainder)
- Optimizing loops (slow iteration, repeated `.len()` calls, index-based access)
- Splitting or assembling integer limbs (u256 → u128, u32s → u128, felt252 → u96)
- Packing struct fields ...

### Prompt 9

Base directory for this skill: /home/felt/.claude/plugins/cache/claude-plugins-official/superpowers/4.3.0/skills/subagent-driven-development

# Subagent-Driven Development

Execute plan by dispatching fresh subagent per task, with two-stage review after each: spec compliance review first, then code quality review.

**Core principle:** Fresh subagent per task + two-stage review (spec then quality) = high quality, fast iteration

## When to Use

```dot
digraph when_to_use {
    "Have implementatio...

