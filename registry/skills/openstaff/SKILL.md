---
name: openstaff
description: >
  OpenStaff platform integration. Use to report cycle completion,
  record KPI metrics, and request human help when stuck.
allowed-tools: Bash(echo *) Read
metadata:
  author: openstaff
  version: "1.0"
---

## cycle-complete
After completing a full Gather → Execute → Evaluate cycle,
append to ./cycles.jsonl:
{"cycle": N, "date": "YYYY-MM-DD", "summary": "one line summary"}

## record-kpi
After Evaluate, record KPI metrics.
Append to ./kpi.jsonl:
{"date": "YYYY-MM-DD", "cycle": N, "metrics": {"metric_name": value}}

## giveup
ONLY after exhausting ALL options (retry at least 3 times).
Append to ./signals.jsonl:
{"type": "giveup", "reason": "detailed reason", "timestamp": "ISO8601"}
This pauses your execution and alerts the user.
