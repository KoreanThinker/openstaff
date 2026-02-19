# Staff Detail

## Purpose

The Staff Detail screen provides comprehensive monitoring and management of a single Staff. It is the primary destination for understanding what a Staff is doing, how it is performing, and what it has learned. Accessible by clicking any Staff row on the Dashboard.

---

## Navigation

- **Entry**: Click a Staff row on the Dashboard staff list.
- **Back**: A back button in the header returns to the Dashboard.
- **Route**: `/staffs/:staffId` (or equivalent in-app navigation).
- **Deep-linking**: Each tab is addressable via query param (`?tab=metrics`) so Ngrok web UI users can bookmark specific tabs.

---

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [<- Back]   Staff Name Here          ● Running  3d 14h 22m    │
│                                                                 │
│  Role: Meta ads creative designer                               │
│                                                                 │
│  [ Start/Stop ]  [ Restart ]  [ Edit ]  [ Delete ]             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [ Overview ]  [ Metrics ]  [ Logs ]  [ KPI ]  [ Memory ]  [ Errors ] │
│   ─────────                                                     │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │                    Tab Content Area                         │ │
│ │                                                             │ │
│ │              (varies per selected tab)                      │ │
│ │                                                             │ │
│ │                                                             │ │
│ │                                                             │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Header Section

The header is fixed at the top of the Staff Detail screen, always visible regardless of active tab.

### Components

| Element | Description | Design |
|---------|-------------|--------|
| Back button | Returns to Dashboard | Icon-only `<-` arrow, `text-muted-foreground`, hover `text-foreground` |
| Staff name | Large heading | `text-2xl font-semibold text-foreground` |
| Status dot | Live status indicator | Follows design-system rule 6 (Running=green pulse, Stopped=gray, Error=red, Warning=amber) |
| Status label | Text beside dot | "Running", "Stopped", "Error", "Warning (Backoff)" in `text-sm text-muted-foreground` |
| Uptime | Time since last start | `text-sm text-muted-foreground font-mono`, e.g. "3d 14h 22m". Hidden when Stopped. |
| Role | One-line role subtitle | `text-sm text-muted-foreground` below the name |

### Action Buttons

Displayed in a row to the right of (or below on small screens) the Staff name.

| Button | Variant | Condition |
|--------|---------|-----------|
| Start | `default` (primary) | Shown when Staff is Stopped |
| Stop | `outline` | Shown when Staff is Running |
| Restart | `outline` | Shown when Staff is Running |
| Edit | `ghost` | Always shown. Opens Staff edit form/modal. |
| Delete | `ghost` + `text-destructive` | Always shown. Triggers confirmation dialog. |

**Delete confirmation**: A `<AlertDialog>` with destructive action. Text: "This will permanently delete this Staff and all its data. This cannot be undone."

---

## Tab: Overview

The default tab. Displays the Staff's configuration and current state at a glance.

### Layout

```
┌──────────────────────────────────┐  ┌──────────────────────────┐
│         Loop Visualization       │  │      Quick Stats         │
│                                  │  │                          │
│    ┌─────────┐                   │  │  Cycles      47         │
│    │ GATHER  │──────┐            │  │  Uptime      3d 14h     │
│    └─────────┘      │            │  │  Restarts    2          │
│         ▲           ▼            │  │  Status      Running    │
│    ┌──────────┐ ┌──────────┐    │  │                          │
│    │ EVALUATE │◄│ EXECUTE  │    │  │                          │
│    └──────────┘ └──────────┘    │  └──────────────────────────┘
└──────────────────────────────────┘
┌──────────────────────────────────┐  ┌──────────────────────────┐
│       Staff Configuration        │  │     Connected Skills     │
│                                  │  │                          │
│  Gather:  Collect trending...    │  │  ● Instagram             │
│  Execute: Create 3 ad creati...  │  │  ● Meta Ads API          │
│  Evaluate: Check CPI, CPM fr... │  │                          │
│  KPI:     CPI < $2.00, CTR >... │  │                          │
├──────────────────────────────────┤  ├──────────────────────────┤
│       Agent & Model              │  │     Latest Cycle         │
│                                  │  │                          │
│  Agent: Claude Code              │  │  #47 - 2026-02-20       │
│  Model: Claude Sonnet 4.5       │  │  "Created 3 new ad..."  │
└──────────────────────────────────┘  └──────────────────────────┘
```

### Components

**Loop Visualization Card** (top-left, prominent)
- Visual graphic showing the Gather -> Execute -> Evaluate cycle.
- Animated arrows connecting three rounded nodes in a triangular or circular layout.
- The currently active phase (if detectable) is highlighted with `bg-primary` tint; inactive phases use `bg-muted`.
- This is the signature visual of OpenStaff -- make it feel alive when Staff is running (subtle CSS animation on the arrows).
- Card: `bg-card border border-border rounded-[var(--radius)]`

**Quick Stats Card** (top-right)
- Four stat rows in a compact card.
- Each stat: label (`text-muted-foreground text-sm`) + value (`text-foreground text-xl font-semibold font-mono`).
- Cycle count derived from `cycles.jsonl` line count.
- Restart count derived from `errors.jsonl` entries of type `process_crash`.

| Stat | Source |
|------|--------|
| Cycles | `cycles.jsonl` line count |
| Uptime | Computed from `state.json` `last_started_at` |
| Restarts | `errors.jsonl` entries with type `process_crash` |
| Status | Derived from pty process alive check |

**Staff Configuration Card** (bottom-left)
- Displays Gather, Execute, Evaluate, KPI as labeled text blocks.
- Labels: `text-xs uppercase tracking-wide text-muted-foreground font-semibold`.
- Values: `text-sm text-foreground`, multi-line, with `line-clamp-3` and "Show more" expand.
- Below: Agent & Model shown as subtle key-value pairs.

**Connected Skills Card** (bottom-right, top)
- List of connected Skill names, each with a small dot indicator.
- Dot is `bg-success` if the skill's required credentials are configured, `bg-warning` if missing.
- Clicking a skill name could navigate to Skills management (future enhancement).

**Latest Cycle Card** (bottom-right, bottom)
- Shows the most recent entry from `cycles.jsonl`.
- Cycle number, date, and one-line summary.
- `font-mono text-sm` for the summary text.

---

## Tab: Metrics

Token usage and cost tracking charts with time-range selectors.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Time Range:  [ 24h ]  [ 7d ]  [ 30d ]  [ All ]               │
├──────────────────────────────────┬──────────────────────────────┤
│                                  │                              │
│     Token Usage (Area Chart)     │     Cost (Bar Chart)         │
│                                  │                              │
│     ╱─╲    ╱─╲                  │     █                        │
│   ╱    ╲╱╱   ╲                  │     █  █                     │
│  ╱             ╲                │  █  █  █  █                  │
│ ─────────────────               │  █  █  █  █  █              │
│                                  │                              │
│  ■ Input  ■ Output  ■ Cache     │  Total: $42.50              │
│                                  │                              │
├──────────────────────────────────┴──────────────────────────────┤
│                                                                 │
│     Token Breakdown (Today)        Cost Breakdown (Today)       │
│                                                                 │
│     Input:    124,500              Input:    $12.45             │
│     Output:    45,200              Output:   $22.60             │
│     Cache R:  890,100              Cache R:   $2.67             │
│     Cache W:   12,300              Cache W:   $0.37             │
│     Total:  1,072,100              Total:    $38.09             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Components

**Time Range Selector**
- Pill-shaped segmented control at the top of the tab.
- Options: `24h`, `7d`, `30d`, `All`.
- Active pill: `bg-primary text-primary-foreground rounded-full`.
- Inactive: `text-muted-foreground rounded-full`.

**Token Usage Chart** (Tremor `AreaChart`)
- Stacked area chart showing input, output, cache read, cache write tokens over time.
- Colors: `chart-1` (input), `chart-2` (output), `chart-3` (cache read), `chart-4` (cache write).
- X-axis: time buckets (hourly for 24h, daily for 7d/30d, weekly for All).
- Y-axis: token count (formatted with K/M suffixes).
- Tooltip on hover showing exact values.
- Card: `bg-card border border-border`.

**Cost Chart** (Tremor `BarChart`)
- Grouped bar chart showing cost over time.
- Single color `chart-1` for total cost bars.
- X-axis matches token chart time range.
- Y-axis: USD formatted (`$X.XX`).
- Running total shown as a summary badge in the card header.

**Token Breakdown Card**
- Simple stat list for the selected period.
- Four rows: Input, Output, Cache Read, Cache Write + Total.
- Numbers in `font-mono`, right-aligned.
- Color dots matching chart colors beside each label.

**Cost Breakdown Card**
- Same layout as Token Breakdown but in USD.
- Shows cost per token type based on model pricing.

### Data Source

- `usage.jsonl` in the Staff's working directory.
- Each line: `{"date": "YYYY-MM-DD", "hour": N, "input_tokens": N, "output_tokens": N, "cache_read_tokens": N, "cache_write_tokens": N, "cost_usd": N}`
- Aggregation done client-side or via API depending on data volume.

---

## Tab: Logs

Real-time terminal output viewer streaming from the Staff's pty session.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Search: ____________]  [Filter: All ▼]  [Clear]  [⤓ Scroll]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  $ You are now active. Begin your first Gather → Execute →     │
│    Evaluate cycle. Do not stop.                                │
│                                                                 │
│  [10:23:15] Analyzing Instagram trends for product category... │
│  [10:23:18] Found 100 trending posts in last 3 days           │
│  [10:23:20] Top visual patterns: minimalist, bold typography   │
│  [10:24:01] Creating ad creative #1: Minimalist product shot   │
│  [10:24:15] Generating image with DALL-E...                    │
│  [10:24:32] Creative #1 complete. Starting #2...               │
│  [10:25:01] Creating ad creative #2: Bold typography variant   │
│  ...                                                           │
│  [10:30:45] Cycle #47 complete. CPI: $1.82, CTR: 3.4%        │
│                                                                 │
│                                              [Auto-scroll: ON] │
└─────────────────────────────────────────────────────────────────┘
```

### Components

**Terminal Viewer Card**
- Full-width card with dark-themed interior: `bg-[hsl(var(--card))]` with a slightly darker inset or use a dedicated terminal background variable.
- Font: `font-mono text-xs` (JetBrains Mono).
- Text color: `text-foreground` with reduced opacity for timestamps.
- Line height: tight (`leading-5`).
- Card uses the standard `border border-border` with `rounded-[var(--radius)]`.

**Search Bar**
- Input field at the top of the log viewer.
- Filters visible log lines by text match (client-side).
- Highlighted matches in the log output.

**Filter Dropdown**
- Options: `All`, `Gather`, `Execute`, `Evaluate`, `Errors`.
- Simple keyword-based filtering on log lines.

**Auto-scroll Toggle**
- Sticky indicator at the bottom-right of the log viewer.
- Auto-scroll is ON by default (follows new output).
- Scrolling up manually disables auto-scroll; a "Jump to bottom" button appears.
- Clicking "Jump to bottom" re-enables auto-scroll.

**Clear Button**
- Clears the visible log buffer (does not delete `output.log`).

### Data Source

- **Live**: WebSocket stream from the Express API, which forwards pty stdout data in real-time.
- **Historical**: `output.log` file in the Staff's working directory (30-day rotation).
- On initial load, fetch the last ~500 lines from `output.log`, then switch to WebSocket streaming.

### Performance

- Virtualized list rendering (e.g., `react-window` or `@tanstack/react-virtual`) to handle large log volumes.
- Buffer limit: keep last 10,000 lines in memory. Older lines available via scrolling up (lazy-loaded from file).
- ANSI color code parsing for terminal color output support.

---

## Tab: KPI

Per-metric time-series charts showing Staff performance against goals.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  KPI Dashboard                                                  │
│  Staff goal: "CPI < $2.00, CTR > 3%, daily creatives >= 3"    │
├────────────────────────────────┬────────────────────────────────┤
│                                │                                │
│     CPI (Cost Per Install)     │     CTR (Click-Through Rate)   │
│                                │                                │
│  $3.00                         │  5%                            │
│         ╲                      │              ╱                 │
│  $2.00 ─ ─ ─ ─ goal ─ ─ ─ ─  │  3% ─ ─ ─ goal ─ ─ ─ ─ ─ ─  │
│           ╲  ╱╲               │        ╱╲ ╱                    │
│  $1.00     ╲╱   ╲             │  1%  ╱                         │
│              current: $1.82    │       current: 3.4%            │
│                                │                                │
├────────────────────────────────┴────────────────────────────────┤
│                                                                 │
│     Daily Creatives                                             │
│                                                                 │
│  5  █  █     █                                                 │
│  3 ─█──█──█──█─ goal ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─              │
│  1  █  █  █  █  █                                              │
│                  current: 3                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Components

**KPI Goal Banner**
- At the top of the tab, display the raw KPI text from `staff.json` in a subtle `bg-muted` banner.
- `text-sm text-muted-foreground`.

**Per-Metric Chart Cards** (Tremor `LineChart` or `BarChart`)
- One card per distinct KPI metric parsed from `kpi.jsonl`.
- Layout: 2-column grid for metrics. Full-width if only one metric.
- Each chart card contains:
  - Metric name as card title (`text-lg font-semibold`).
  - Current value as a large number (`text-3xl font-mono font-bold`).
  - Trend badge: shows percentage change from previous period. `text-success` for improvement, `text-destructive` for decline.
  - Line chart with daily data points.
  - **Goal line**: Dashed horizontal reference line at the goal value. Style: `stroke-dasharray: 5,5`, color `text-muted-foreground` at 50% opacity. Label at the right end: "Goal: $2.00".
  - Chart line color: `chart-1` if metric is meeting goal, `chart-5` if below goal.
  - X-axis: dates. Y-axis: metric values.

**Metric Parsing**
- KPI text is free-form natural language. The system parses `kpi.jsonl` entries to extract metric names and values.
- `kpi.jsonl` format: `{"date": "YYYY-MM-DD", "cycle": N, "metrics": {"cpi": 1.82, "ctr": 3.4, "daily_creatives": 3}}`
- Goal values are extracted from the KPI text field in `staff.json` where possible (e.g., "CPI < $2.00" -> goal line at 2.00). If not parseable, no goal line is shown.

---

## Tab: Memory

Read-only display of the agent's `memory.md` learning journal.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent Memory                                    Last updated:  │
│                                                  2026-02-20     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ## Learnings                                                   │
│                                                                 │
│  ### Visual Style Patterns                                      │
│  - Minimalist product shots perform 2x better than busy        │
│    lifestyle images in our category                             │
│  - Bold typography with high contrast gets 40% more clicks     │
│                                                                 │
│  ### Copy Patterns                                              │
│  - Short, punchy headlines (< 5 words) outperform long ones    │
│  - Questions in headlines increase CTR by 15%                  │
│                                                                 │
│  ### Audience Insights                                          │
│  - 18-24 demographic responds best to meme-style creatives     │
│  - Evening posts (7-9pm) get 30% more engagement               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Components

**Memory Viewer Card**
- Single full-width card.
- Header shows "Agent Memory" title + last modified timestamp of `memory.md`.
- Body renders `memory.md` as Markdown using a Markdown renderer (e.g., `react-markdown`).
- Prose styling: `prose prose-sm dark:prose-invert` (Tailwind Typography plugin) or equivalent custom styles.
- Read-only -- no edit controls. This is the agent's territory.
- If `memory.md` is empty or does not exist, show an empty state: "No learnings recorded yet. The agent will start writing here after its first Evaluate cycle."

**Scroll Behavior**
- Content scrolls within the card if it overflows.
- Max height set to fill available tab content area.

### Data Source

- `memory.md` in the Staff's working directory.
- Fetched via API: `GET /api/staffs/:staffId/memory`.
- Polled every 30 seconds or refreshed on tab focus (not WebSocket -- memory updates are infrequent).

---

## Tab: Errors

Chronological error log with filtering.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Errors (12)                          [Filter: All Types ▼]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  2026-02-20 10:23:15   process_crash                           │
│  Process exited with code 1. Restarted via --resume.           │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                 │
│  2026-02-19 22:15:03   api_error                               │
│  Instagram API rate limit exceeded. Retrying in 60s.           │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                 │
│  2026-02-19 14:01:22   process_crash                           │
│  Process unresponsive for 10 minutes. Force killed.            │
│                                                                 │
│  ...                                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Components

**Error Count Badge**
- Tab label shows error count from current period: "Errors (12)".
- Badge uses `bg-destructive/10 text-destructive rounded-full` if count > 0.

**Filter Dropdown**
- Options: `All Types`, `process_crash`, `api_error`, `health_check`, `giveup`.
- Filters the error list by the `type` field in `errors.jsonl`.

**Error List**
- Reverse-chronological (newest first).
- Each error entry is a row within the card, separated by subtle dividers (`border-b border-border`).
- Entry layout:
  - **Timestamp**: `text-xs font-mono text-muted-foreground`.
  - **Error type**: Badge/pill with `rounded-full text-xs font-medium`. Color coding:
    - `process_crash`: `bg-destructive/10 text-destructive`
    - `api_error`: `bg-warning/10 text-warning`
    - `health_check`: `bg-warning/10 text-warning`
    - `giveup`: `bg-destructive/10 text-destructive`
  - **Message**: `text-sm text-foreground`. Truncated to 2 lines with expand on click.

**Empty State**
- If no errors: "No errors recorded. Your Staff is running smoothly." with a subtle check icon.

**Pagination / Infinite Scroll**
- Load 50 entries at a time. Scroll to load more.
- For large error logs, older entries are fetched on demand from the API.

### Data Source

- `errors.jsonl` in the Staff's working directory.
- Each line: `{"timestamp": "ISO8601", "type": "process_crash", "message": "Process exited with code 1", "details": {...}}`
- Also includes `signals.jsonl` entries of type `giveup` merged into the error timeline.

---

## Data Requirements

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/staffs/:id` | GET | Staff config, state, and derived status |
| `/api/staffs/:id` | PUT | Update Staff config |
| `/api/staffs/:id` | DELETE | Delete Staff |
| `/api/staffs/:id/start` | POST | Start Staff process |
| `/api/staffs/:id/stop` | POST | Stop Staff process |
| `/api/staffs/:id/restart` | POST | Restart Staff process |
| `/api/staffs/:id/metrics` | GET | Token usage and cost data (query: `range=24h\|7d\|30d\|all`) |
| `/api/staffs/:id/kpi` | GET | KPI metrics time-series |
| `/api/staffs/:id/memory` | GET | Raw memory.md content |
| `/api/staffs/:id/errors` | GET | Error log entries (query: `type`, `offset`, `limit`) |
| `/api/staffs/:id/logs` | GET | Historical log lines (query: `lines=500`) |
| `/api/staffs/:id/cycles` | GET | Cycle history |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `staff:status` | Server -> Client | Status change (running/stopped/error) |
| `staff:log` | Server -> Client | New pty output line(s) |
| `staff:metrics` | Server -> Client | Periodic metrics update (every 60s) |
| `staff:cycle` | Server -> Client | New cycle completed |
| `staff:error` | Server -> Client | New error recorded |

### File Sources

| File | Tab(s) | Access Pattern |
|------|--------|----------------|
| `staff.json` | Overview | Read on load |
| `state.json` | Overview, Header | Read on load, WebSocket updates |
| `cycles.jsonl` | Overview, KPI | Read on load, WebSocket for new entries |
| `kpi.jsonl` | KPI | Read on load |
| `usage.jsonl` | Metrics | Read on load, periodic refresh |
| `memory.md` | Memory | Read on load, poll every 30s |
| `errors.jsonl` | Errors | Read on load, WebSocket for new entries |
| `signals.jsonl` | Errors | Merged with errors on read |
| `output.log` | Logs | Tail on load, WebSocket for live stream |

---

## Interactions

### Tab Switching
- Tabs use shadcn/ui `<Tabs>` component.
- Active tab indicator: underline style with `bg-primary` bottom border, 2px height, animated slide.
- Tab content area has a consistent min-height to prevent layout shift.
- Tab state is preserved when switching (logs keep their scroll position, charts keep their time range).

### Staff Actions
- **Start**: POST `/api/staffs/:id/start`. Button shows loading spinner. On success, status dot transitions to green pulse. Uptime counter begins.
- **Stop**: POST `/api/staffs/:id/stop`. Confirmation not required (easily reversible). Button shows loading spinner. On success, status transitions to gray.
- **Restart**: POST `/api/staffs/:id/restart`. Button shows loading spinner. Brief "Restarting..." state shown.
- **Edit**: Opens a modal or navigates to the Staff edit form (same form as creation, pre-filled). On save, Staff auto-restarts if it was running.
- **Delete**: Opens `<AlertDialog>` confirmation. On confirm, navigates back to Dashboard after deletion.

### Real-time Updates
- Status changes update the header dot and label immediately via WebSocket.
- New log lines appear in the Logs tab in real-time.
- Metrics refresh periodically (60s interval aligned with monitoring engine).
- New errors trigger a subtle badge count increment on the Errors tab label.

---

## States

### Loading State
- Skeleton loaders matching the layout of each tab.
- Header skeleton: name placeholder bar, status dot placeholder, button placeholders.
- Tab content: card-shaped skeletons with pulsing animation.

### Empty States

| Tab | Empty State |
|-----|-------------|
| Overview | Never truly empty -- always shows config. Cycles/stats show "0" values. |
| Metrics | "No usage data yet. Metrics will appear once the Staff starts running." |
| Logs | "No log output yet. Start the Staff to see live output here." |
| KPI | "No KPI data recorded yet. The Staff will report KPIs after completing Evaluate cycles." |
| Memory | "No learnings recorded yet. The agent will start writing here after its first Evaluate cycle." |
| Errors | "No errors recorded. Your Staff is running smoothly." |

### Error States
- If the Staff ID is not found (deleted or invalid URL): redirect to Dashboard with a toast "Staff not found."
- If API fails to load data for a tab: show inline error card with retry button. "Failed to load [tab name] data. [Retry]"

### Staff Status-Dependent UI

| Status | Header Appearance | Action Buttons |
|--------|-------------------|----------------|
| Running | Green pulse dot, uptime shown | Stop, Restart, Edit, Delete |
| Stopped | Gray dot, no uptime | Start, Edit, Delete |
| Error | Red dot, uptime shown | Stop, Restart, Edit, Delete |
| Warning (Backoff) | Amber dot, uptime shown, backoff indicator | Stop, Restart, Edit, Delete |

---

## Responsive

The Staff Detail screen must work in both the Electron desktop window and the Ngrok web UI (phone/tablet/laptop).

### Breakpoints

| Breakpoint | Layout Adjustments |
|------------|-------------------|
| Desktop (>= 1024px) | Full 2-column grid on Overview and KPI tabs. Charts side-by-side on Metrics. |
| Tablet (768px - 1023px) | Overview cards stack to single column. Metrics charts stack vertically. |
| Mobile (< 768px) | All content single-column. Tabs become horizontally scrollable. Action buttons collapse into a "..." dropdown menu. Header stacks vertically (name + status on one line, actions below). |

### Mobile-Specific Adjustments
- Tab bar: horizontal scroll with no wrapping. Active tab scrolls into view.
- Log viewer: full-width, search bar collapses to icon toggle.
- Charts: full-width with touch-friendly tooltips.
- Action buttons: collapse into a single `<DropdownMenu>` with icon trigger.
- Back button: always visible, positioned top-left.
