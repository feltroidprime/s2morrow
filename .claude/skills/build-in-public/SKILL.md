---
name: build-in-public
description: Use when writing Twitter threads, capturing gold moments, gathering session context, or pushing drafts to Typefully for build-in-public content
---

# Build in Public — Thread Writing System

## Overview

CLI at `scripts/thread/thread.py` + Slack MCP for live workspace access.

## Directory Structure

```
scripts/thread/
├── context.md         # GLOBAL: voice, rules, audiences, narratives, summaries
├── gold_moments.md    # Running log of compelling moments
├── research/          # Technical writeups, Slack messages, notes
├── threads/dayN/      # Per-thread folders (thread.md, notes.md, etc.)
├── images/            # Screenshots and diagrams
├── visuals/           # Python scripts for generating charts
└── thread.py          # CLI tool
```

## Commands

### Gather context for a new thread
```bash
python3 scripts/thread/thread.py context --since "2026-02-11" --until "2026-02-13"
```

### Browse Claude Code sessions
```bash
python3 scripts/thread/thread.py sessions --since "2026-02-11"
python3 scripts/thread/thread.py sessions --id UUID_PREFIX
```

### Push thread to Typefully
```bash
python3 scripts/thread/thread.py push scripts/thread/threads/day5/thread.md
python3 scripts/thread/thread.py push scripts/thread/threads/day5/thread.md --dry-run
```

### Add gold moment (do this whenever something interesting happens!)
```bash
python3 scripts/thread/thread.py gold "description" --day N
```

### List Typefully drafts
```bash
python3 scripts/thread/thread.py list
```

## Slack Integration

Slack MCP is configured globally. Use these tools to pull context from Slack:
- `slack_search_messages` — search across workspace for keywords
- `slack_get_thread` — pull a full thread by URL or channel+timestamp
- `slack_conversations_history` — read recent messages from a channel

No need to save Slack messages as files — read them live during thread writing.

## Thread File Format

Each thread lives in `scripts/thread/threads/dayN/thread.md`:

```markdown
# Day N Thread
reply_to: https://x.com/feltroidPrime/status/XXXXX

## Post 1
Content of first tweet...

## Post 2
Content of second tweet...
```

Per-thread notes/brainstorming go in `scripts/thread/threads/dayN/notes.md`.

## Writing Rules

Read `scripts/thread/context.md` before writing any thread.
Key rules: casual technical voice, one idea per post, show work over narration,
low-key endings ("Let's see"), never use "Plot twist:" or thread emojis.

## Workflow

1. `thread.py context --since DATE` to gather raw material
2. `thread.py sessions --since DATE` to find interesting Claude sessions
3. Use Slack MCP to pull relevant workspace conversations
4. Read `context.md` for voice/style and running narratives
5. Read `gold_moments.md` for pre-captured highlights
6. Read `research/` for technical context
7. Write the thread in `scripts/thread/threads/dayN/thread.md`
8. `thread.py push` to send to Typefully as draft
9. Iterate: edit the .md, `thread.py push` to update
10. Update `context.md` with Day N summary after publishing
