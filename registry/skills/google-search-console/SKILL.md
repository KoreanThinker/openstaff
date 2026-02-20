---
name: google-search-console
description: Google Search Console integration for SEO monitoring and keyword reporting.
allowed-tools: Read Write Bash
compatibility: Requires GOOGLE_SEARCH_CONSOLE_API_KEY.
metadata:
  author: openstaff
  version: 1.0.0
---

# Google Search Console

Use this skill to run reliable operational cycles inside OpenStaff.

## Execution guide

1. Gather the latest context and constraints from source systems.
2. Execute one bounded batch of work and log outcomes.
3. Evaluate quality and KPI impact, then queue the next cycle.

## Output contract

- Write machine-readable summaries for each cycle.
- Include blockers and next actions.
- Keep changes small, verifiable, and reversible.
