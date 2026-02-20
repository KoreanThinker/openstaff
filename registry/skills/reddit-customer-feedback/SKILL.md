---
name: reddit-customer-feedback
description: Reddit customer feedback skill for autonomous execution cycles.
allowed-tools: Read Write Bash
compatibility: Requires REDDIT_API_KEY.
metadata:
  author: openstaff
  version: 1.0.0
---

# Reddit Customer Feedback

Use this skill to run reliable customer feedback cycles inside OpenStaff.

## Execution guide

1. Gather the latest context and constraints from source systems.
2. Execute one bounded batch of work and log outcomes.
3. Evaluate quality and KPI impact, then queue the next cycle.

## Output contract

- Write machine-readable summaries for each cycle.
- Include blockers and next actions.
- Keep changes small, verifiable, and reversible.
