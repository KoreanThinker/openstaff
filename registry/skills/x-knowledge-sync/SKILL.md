---
name: x-knowledge-sync
description: X knowledge sync skill for autonomous execution cycles.
allowed-tools: Read Write Bash
compatibility: Requires X_API_KEY.
metadata:
  author: openstaff
  version: 1.0.0
---

# X Knowledge Sync

Use this skill to run reliable knowledge sync cycles inside OpenStaff.

## Execution guide

1. Gather the latest context and constraints from source systems.
2. Execute one bounded batch of work and log outcomes.
3. Evaluate quality and KPI impact, then queue the next cycle.

## Output contract

- Write machine-readable summaries for each cycle.
- Include blockers and next actions.
- Keep changes small, verifiable, and reversible.
