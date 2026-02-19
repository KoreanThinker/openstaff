# Agents

## Purpose

The Agents screen is the **central hub for AI agent lifecycle management**. OpenStaff installs and runs without any agents pre-installed. This screen is where users install agent runtimes (Claude Code, Codex), configure API keys, verify connections, view available models, monitor usage/costs, and set budgets — all without touching a terminal.

This screen is accessible from the sidebar navigation. It is distinct from individual Staff configuration; changes here affect all Staff that use a given agent.

**Key principle**: Agent setup is completely independent from app installation. Users can explore the full OpenStaff UI (Dashboard, Skills, Registry, Settings) before setting up any agent. Staff execution is the only feature that requires a configured agent.

---

## First-Time Experience (No Agents Configured)

When a user first visits the Agents screen (or arrives via the Dashboard banner after Setup Wizard), they see a guided setup experience.

### Empty State Layout

```
+------------------------------------------------------------------+
|  SIDEBAR  |  AGENTS                                               |
|           |                                                       |
|           |  +--------------------------------------------------+ |
|           |  |  [Cpu icon]  Set up your first AI Agent          | |
|           |  |                                                  | |
|           |  |  OpenStaff needs an AI agent to power your       | |
|           |  |  Staff. Let's get Claude Code set up.            | |
|           |  |                                                  | |
|           |  |  +--------------------------------------------+  | |
|           |  |  |  Step 1: Install Claude Code               |  | |
|           |  |  |  [  Install  ]                             |  | |
|           |  |  +--------------------------------------------+  | |
|           |  |  |  Step 2: Enter your API Key                |  | |
|           |  |  |  [________________________] [Test]          |  | |
|           |  |  +--------------------------------------------+  | |
|           |  |  |  Step 3: Ready!                            |  | |
|           |  |  |  ✓ Agent installed and connected           |  | |
|           |  |  +--------------------------------------------+  | |
|           |  +--------------------------------------------------+ |
|           |                                                       |
|           |  +--------------------------------------------------+ |
|           |  |  CODEX  --  Coming soon                          | |
|           |  +--------------------------------------------------+ |
+------------------------------------------------------------------+
```

### Guided Setup Steps

The Claude Code agent card shows a **vertical stepper** guiding the user through setup:

1. **Install Claude Code**: "Install" button triggers `npm install --prefix ~/.openstaff/tools @anthropic-ai/claude-code`. Progress bar shown during installation. On success, step auto-completes with checkmark.
2. **Enter API Key**: Password input + "Test Connection" button. Disabled until Step 1 completes. On successful test, step completes.
3. **Ready**: Summary confirmation. "Your Claude Code agent is ready to power your Staff." Link to "Create your first Staff" navigating to Staff Create.

Once all steps are complete, the card transitions to the full management view (see sections below).

### Dashboard Banner Integration

After Setup Wizard completion, the Dashboard shows a persistent banner:
```
┌──────────────────────────────────────────────────────────────┐
│  ⚡ Set up your first AI agent to start creating Staff.      │
│     [Go to Agents →]                               [Dismiss] │
└──────────────────────────────────────────────────────────────┘
```

This banner dismisses when any agent reaches "Connected" status.

---

## Navigation

Sidebar item: **Agents** (icon: cpu/chip)
URL path: `/agents`

Breadcrumb: `Agents`

---

## Layout

```
+------------------------------------------------------------------+
|  SIDEBAR  |  AGENTS                                               |
|           |                                                       |
|           |  +--------------------------------------------------+ |
|           |  |  CLAUDE CODE AGENT CARD                          | |
|           |  |                                                  | |
|           |  |  [Header Row]                                    | |
|           |  |  Logo  "Claude Code"   v2.1.0   [Connected] pill | |
|           |  |                                                  | |
|           |  |  +--------------------------------------------+  | |
|           |  |  | CONNECTION & AUTH                          |  | |
|           |  |  | API Key: [*************] [eye] [Test]      |  | |
|           |  |  | Status: Connected (key valid)              |  | |
|           |  |  +--------------------------------------------+  | |
|           |  |                                                  | |
|           |  |  +--------------------------------------------+  | |
|           |  |  | INSTALLATION                               |  | |
|           |  |  | Status: Installed  v2.1.0                  |  | |
|           |  |  | Auto-update: [toggle ON]                   |  | |
|           |  |  | [Check for Updates]                        |  | |
|           |  |  +--------------------------------------------+  | |
|           |  |                                                  | |
|           |  |  +--------------------------------------------+  | |
|           |  |  | AVAILABLE MODELS                           |  | |
|           |  |  |  Opus 4.6         Sonnet 4.5    Haiku 4.5  |  | |
|           |  |  +--------------------------------------------+  | |
|           |  |                                                  | |
|           |  |  +---------------------+ +--------------------+  | |
|           |  |  | USAGE TODAY         | | USAGE THIS MONTH   |  | |
|           |  |  | Tokens: 12.4M      | | Tokens: 284.1M     |  | |
|           |  |  | Cost:   $18.42     | | Cost:   $412.87    |  | |
|           |  |  +---------------------+ +--------------------+  | |
|           |  |                                                  | |
|           |  |  +--------------------------------------------+  | |
|           |  |  | BUDGET                                     |  | |
|           |  |  | Monthly limit: [$500.00]                   |  | |
|           |  |  | Warning at:    [80]%                       |  | |
|           |  |  | [========....] $412.87 / $500.00  82.6%    |  | |
|           |  |  +--------------------------------------------+  | |
|           |  |                                                  | |
|           |  |  +--------------------------------------------+  | |
|           |  |  | STAFF USAGE BREAKDOWN                      |  | |
|           |  |  | Meta Ads Creative     $142.30  (34.5%)     |  | |
|           |  |  | pSEO Writer           $128.90  (31.2%)     |  | |
|           |  |  | Naver Cafe Marketer    $87.40  (21.2%)     |  | |
|           |  |  | Feature Developer      $54.27  (13.1%)     |  | |
|           |  |  +--------------------------------------------+  | |
|           |  |                                                  | |
|           |  +--------------------------------------------------+ |
|           |                                                       |
|           |  +--------------------------------------------------+ |
|           |  |  CODEX AGENT CARD                                | |
|           |  |  Logo  "Codex"   --   [Not Installed] pill       | |
|           |  |  "Coming soon. Codex support is planned."        | |
|           |  +--------------------------------------------------+ |
|           |                                                       |
+------------------------------------------------------------------+
```

The page scrolls vertically. Each agent is a full-width `<Card>` stacked top to bottom. Claude Code is first (MVP-supported), Codex second (future placeholder).

---

## Agent Card Design

Each agent gets one large Card component containing all its sections. The card uses the standard design system: `bg-card`, `border border-border`, default `--radius`.

### Header Row

```
+------------------------------------------------------------------+
|  [Agent Logo]   Agent Name           vX.Y.Z       [Status Pill]  |
+------------------------------------------------------------------+
```

- **Agent Logo**: 32x32 icon. Claude Code uses the Anthropic mark; Codex uses the OpenAI mark.
- **Agent Name**: `text-foreground font-sans text-lg font-semibold`. "Claude Code" or "Codex".
- **Version**: `text-muted-foreground text-sm font-mono`. Displays installed version or `--` if not installed.
- **Status Pill**: `rounded-full px-3 py-1 text-xs font-medium`. States:

| State           | Pill Style                                      |
| --------------- | ----------------------------------------------- |
| Connected       | `bg-success/15 text-success`                    |
| Disconnected    | `bg-destructive/15 text-destructive`            |
| Not Installed   | `bg-muted text-muted-foreground`                |
| Installing      | `bg-warning/15 text-warning` + spinner          |
| Updating        | `bg-warning/15 text-warning` + spinner          |

The overall status pill reflects the combined state: the agent is "Connected" only when installed AND the API key is valid.

---

## Connection & Auth

A section within the agent card for API key management.

### Layout

```
+------------------------------------------------------------------+
|  CONNECTION                                                       |
|                                                                   |
|  API Key                                                          |
|  +------------------------------------------+ [eye] [Test]       |
|  | sk-ant-***************************3kF9   |                    |
|  +------------------------------------------+                    |
|                                                                   |
|  [Status indicator + message]                                     |
+------------------------------------------------------------------+
```

### Elements

- **Section Title**: "Connection" -- `text-foreground text-sm font-semibold uppercase tracking-wide`.
- **API Key Input**: `<Input>` from shadcn/ui. `type="password"` by default.
  - Placeholder: `"Enter your Anthropic API key"` (Claude Code) or `"Enter your OpenAI API key"` (Codex).
  - The key is masked with dots/asterisks. Only last 4 characters shown when saved.
- **Eye Toggle Button**: `<Button variant="ghost" size="icon">`. Toggles password visibility.
- **Test Connection Button**: `<Button variant="outline">` with text "Test". Triggers an API validation call.
  - While testing: button shows spinner, text changes to "Testing..."
  - On success: brief checkmark animation, status updates to "Connected".
  - On failure: status updates to "Invalid key" with destructive color.
- **Status Indicator**: Small dot + text below the input.
  - Connected: `bg-success` dot + "Connected -- API key valid" in `text-success`.
  - Disconnected: `bg-destructive` dot + "Disconnected -- invalid or missing key" in `text-destructive`.
  - Not tested: `bg-muted-foreground` dot + "Not tested" in `text-muted-foreground`.

### Behavior

- On key input change, the status resets to "Not tested" until the user clicks Test.
- Keys are stored encrypted via Electron's `safeStorage` in `config.json`.
- The Test button sends the key to the Express API, which makes a lightweight model list call to validate.

---

## Installation Management

A section within the agent card for binary installation and updates.

### Layout

```
+------------------------------------------------------------------+
|  INSTALLATION                                                     |
|                                                                   |
|  Status: Installed                                                |
|  Version: v2.1.0          [Check for Updates]                     |
|  Auto-update: [toggle]                                            |
|                                                                   |
|  (or if not installed:)                                           |
|  Status: Not Installed                                            |
|  [Install Claude Code]                                            |
|                                                                   |
|  (or if installing/updating:)                                     |
|  Installing Claude Code...                                        |
|  [========================>           ] 68%                        |
+------------------------------------------------------------------+
```

### Elements

- **Status Text**: "Installed", "Not Installed", "Installing...", "Updating..."
- **Version Display**: `font-mono text-sm text-muted-foreground`. Shows current version (e.g., `v2.1.0`).
- **Install Button**: `<Button variant="default">` with text "Install Claude Code". Full-width when no other elements are shown.
  - Triggers `npm install --prefix ~/.openstaff/tools @anthropic-ai/claude-code`.
- **Check for Updates Button**: `<Button variant="outline" size="sm">`. Only visible when installed.
- **Auto-update Toggle**: `<Switch>` from shadcn/ui. When ON, OpenStaff checks for updates on launch and periodically.
- **Progress Bar**: Shown during install/update. Uses a simple div with `bg-success` fill and `bg-muted` track, `rounded-full`. Percentage text to the right.

### Behavior

- Install runs in the background. Progress is streamed via WebSocket.
- On install failure, show an inline error alert with retry button.
- When auto-update is on and a new version is available, show a subtle banner: "Update available: v2.2.0" with an "Update Now" button.

---

## Available Models

A section within the agent card listing the LLM models available through this agent.

### Layout

```
+------------------------------------------------------------------+
|  AVAILABLE MODELS                                                 |
|                                                                   |
|  +------------------+ +------------------+ +------------------+   |
|  | Opus 4.6         | | Sonnet 4.5       | | Haiku 4.5        |   |
|  | Most capable     | | Balanced          | | Fastest          |   |
|  +------------------+ +------------------+ +------------------+   |
+------------------------------------------------------------------+
```

### Elements

- **Model Chips**: Each model is displayed as a small `bg-muted rounded-lg` chip/card with:
  - Model name: `text-foreground text-sm font-medium`.
  - Short descriptor: `text-muted-foreground text-xs`. e.g., "Most capable", "Balanced", "Fastest".
- Models are displayed in a horizontal flex-wrap row with `gap-3`.
- Models list is determined by the agent driver's `getAvailableModels()` method.
- This section is read-only / informational. Model selection per-Staff happens on the Staff creation/edit screen.

### Claude Code Models (MVP)

| Model             | Descriptor      |
| ----------------- | --------------- |
| claude-opus-4-6   | Most capable    |
| claude-sonnet-4-5 | Balanced        |
| claude-haiku-4-5  | Fastest         |

### Codex Models (Future)

Not shown until Codex is implemented.

---

## Usage Overview

A section within the agent card showing aggregate token/cost metrics across all Staff using this agent.

### Layout

```
+------------------------------------------------------------------+
|  USAGE                                                            |
|                                                                   |
|  +---------------------------+  +---------------------------+     |
|  |  Today                    |  |  This Month               |     |
|  |  12.4M tokens             |  |  284.1M tokens            |     |
|  |  $18.42                   |  |  $412.87                  |     |
|  |  +12.3% vs yesterday      |  |  +8.1% vs last month     |     |
|  +---------------------------+  +---------------------------+     |
|                                                                   |
+------------------------------------------------------------------+
```

### Elements

Two metric cards side by side in a 2-column grid (`grid grid-cols-2 gap-4`).

Each metric card is a nested `bg-muted/50 rounded-lg p-4` container:

- **Period Label**: "Today" or "This Month" in `text-muted-foreground text-xs uppercase tracking-wide`.
- **Token Count**: Big number in `text-foreground text-2xl font-semibold`. Format with suffixes: `12.4M`, `284.1M`, `1.2B`.
- **Cost**: `text-foreground text-lg font-medium`. Format: `$18.42`.
- **Trend Indicator**: `text-xs`. Positive trends use `text-success` with up arrow. Negative trends use `text-destructive` with down arrow. Neutral uses `text-muted-foreground`.

### Data Source

Aggregated from `usage.jsonl` files across all Staff directories that use this agent. Calculated by the Monitoring Engine and served via the Express API.

---

## Budget Settings

A section within the agent card for configuring monthly cost limits.

### Layout

```
+------------------------------------------------------------------+
|  BUDGET                                                           |
|                                                                   |
|  Monthly Limit                    Warning Threshold               |
|  +------------------+             +------------------+            |
|  | $  500.00        |             | 80  %            |            |
|  +------------------+             +------------------+            |
|                                                                   |
|  [==================================........] 82.6%              |
|  $412.87 of $500.00 used                                         |
|                                                                   |
+------------------------------------------------------------------+
```

### Elements

- **Monthly Limit Input**: `<Input>` with dollar sign prefix. Numeric only. Default: no limit (empty).
- **Warning Threshold Input**: `<Input>` with percent suffix. Default: `80`. When usage exceeds this percentage, a warning notification is triggered.
- **Progress Bar**: Full-width bar showing current month spend vs limit.
  - Track: `bg-muted rounded-full h-2`.
  - Fill: `bg-success rounded-full` when under warning threshold, `bg-warning` when between warning and limit, `bg-destructive` when at or over limit.
- **Usage Text**: Below the bar. `text-sm text-muted-foreground`. Format: `$412.87 of $500.00 used`.

### Behavior

- When no limit is set, the progress bar and usage text are hidden. A muted message reads: "No monthly limit set."
- When the warning threshold is crossed, OpenStaff sends a native notification.
- When the limit is reached, OpenStaff sends a notification. It does NOT auto-stop Staff (users may want to continue). The progress bar turns `bg-destructive`.
- Budget settings are stored in `config.json` under `agents.claude-code.budget`.

---

## Staff Usage Breakdown

A section within the agent card showing which Staff contribute to the aggregate usage.

### Layout

```
+------------------------------------------------------------------+
|  USAGE BY STAFF                                                   |
|                                                                   |
|  Staff Name                  Cost (Month)          Share          |
|  ---------------------------------------------------------------  |
|  Meta Ads Creative           $142.30                34.5%         |
|  [=============================]                                  |
|                                                                   |
|  pSEO Writer                 $128.90                31.2%         |
|  [==========================]                                     |
|                                                                   |
|  Naver Cafe Marketer          $87.40                21.2%         |
|  [==================]                                             |
|                                                                   |
|  Feature Developer            $54.27                13.1%         |
|  [===========]                                                    |
+------------------------------------------------------------------+
```

### Elements

- Each row contains:
  - **Staff Name**: `text-foreground text-sm font-medium`.
  - **Cost**: `text-foreground text-sm font-mono` aligned right.
  - **Share Percentage**: `text-muted-foreground text-xs` aligned right.
  - **Mini Bar**: `h-1.5 bg-chart-1 rounded-full` proportional to the percentage. Track is `bg-muted`.
- Rows are sorted descending by cost.
- If no Staff are using this agent, show muted text: "No Staff are using this agent."
- Clicking a Staff row navigates to that Staff's detail screen.

---

## Data Requirements

### API Endpoints

| Method | Endpoint                          | Description                          |
| ------ | --------------------------------- | ------------------------------------ |
| GET    | `/api/agents`                     | List all agents with status          |
| GET    | `/api/agents/:id`                 | Get single agent details             |
| PUT    | `/api/agents/:id/api-key`         | Update API key (encrypted storage)   |
| POST   | `/api/agents/:id/test-connection` | Validate API key                     |
| POST   | `/api/agents/:id/install`         | Trigger agent installation           |
| POST   | `/api/agents/:id/update`          | Trigger agent update                 |
| GET    | `/api/agents/:id/models`          | List available models                |
| GET    | `/api/agents/:id/usage`           | Get usage stats (today + month)      |
| GET    | `/api/agents/:id/usage/breakdown` | Get per-Staff usage breakdown        |
| PUT    | `/api/agents/:id/budget`          | Update budget settings               |

### WebSocket Events

| Event                    | Direction      | Description                         |
| ------------------------ | -------------- | ----------------------------------- |
| `agent:install:progress` | Server->Client | Installation progress (0-100)       |
| `agent:update:progress`  | Server->Client | Update progress (0-100)             |
| `agent:status:change`    | Server->Client | Connection/install status changed   |
| `agent:usage:update`     | Server->Client | Usage metrics refreshed             |

### Data Shapes

```typescript
interface AgentInfo {
  id: string                    // 'claude-code' | 'codex'
  name: string                  // 'Claude Code' | 'Codex'
  installed: boolean
  version: string | null        // e.g. '2.1.0'
  connected: boolean            // API key valid
  hasApiKey: boolean            // API key present (but maybe invalid)
  autoUpdate: boolean
  models: AgentModel[]
  status: 'connected' | 'disconnected' | 'not-installed' | 'installing' | 'updating'
}

interface AgentModel {
  id: string                    // e.g. 'claude-sonnet-4-5'
  name: string                  // e.g. 'Sonnet 4.5'
  descriptor: string            // e.g. 'Balanced'
}

interface AgentUsage {
  today: { tokens: number; cost: number; tokensTrend: number; costTrend: number }
  month: { tokens: number; cost: number; tokensTrend: number; costTrend: number }
}

interface AgentBudget {
  monthlyLimit: number | null   // null = no limit
  warningThreshold: number      // 0-100, default 80
  currentSpend: number
}

interface StaffUsageBreakdown {
  staffId: string
  staffName: string
  cost: number
  percentage: number
}
```

---

## Interactions

| Action                     | Trigger                                 | Result                                                         |
| -------------------------- | --------------------------------------- | -------------------------------------------------------------- |
| Enter API key              | Type in input field                     | Status resets to "Not tested"                                  |
| Test connection            | Click "Test" button                     | API validation call; status updates to Connected/Disconnected  |
| Toggle key visibility      | Click eye icon                          | Input toggles password/text type                               |
| Install agent              | Click "Install" button                  | Progress bar appears; installs via npm                         |
| Check for updates          | Click "Check for Updates"               | Checks npm registry; shows banner if update available          |
| Update agent               | Click "Update Now" on banner            | Progress bar appears; updates via npm                          |
| Toggle auto-update         | Click Switch                            | Persisted to config.json                                       |
| Set monthly limit          | Edit limit input, blur or Enter         | Saved to config.json; progress bar appears                     |
| Set warning threshold      | Edit threshold input, blur or Enter     | Saved to config.json                                           |
| Click Staff in breakdown   | Click row                               | Navigate to `/staffs/:id`                                      |

---

## States

### Page-Level States

| State              | Condition                  | Display                                                 |
| ------------------ | -------------------------- | ------------------------------------------------------- |
| Loading            | Fetching agent data        | Skeleton cards with pulsing placeholders                 |
| Loaded             | Data available             | Full agent cards rendered                                |
| Error              | API fetch failed           | Inline error alert with retry button                     |

### Agent Card States

| State              | Condition                                    | Header Pill       | Sections Shown                                    |
| ------------------ | -------------------------------------------- | ----------------- | ------------------------------------------------- |
| First Setup        | Never configured, first visit                | Not Installed      | Guided stepper (Install → Auth → Ready)           |
| Not Installed      | Agent binary missing (returning user)        | Not Installed      | Connection (disabled), Install button only        |
| Installing         | npm install in progress                      | Installing         | Progress bar, all other sections disabled         |
| Disconnected       | Installed but no valid API key               | Disconnected       | Connection (editable), Installation, Models       |
| Connected          | Installed + valid API key                    | Connected          | All sections fully active                         |
| Updating           | npm update in progress                       | Updating           | All sections visible but update section animating |
| Future (Codex)     | Not yet implemented                          | Coming Soon        | Placeholder message only                          |

### Budget Bar States

| State              | Condition                       | Bar Color          |
| ------------------ | ------------------------------- | ------------------ |
| Normal             | Spend < warning threshold       | `bg-success`       |
| Warning            | Spend >= warning, < limit       | `bg-warning`       |
| Over limit         | Spend >= limit                  | `bg-destructive`   |
| No limit set       | Monthly limit is null           | Hidden             |

---

## Responsive

The Agents screen is used in both the Electron window and the Ngrok web UI (phone/tablet).

| Breakpoint       | Layout Changes                                                   |
| ---------------- | ---------------------------------------------------------------- |
| Desktop (>=1024) | Sidebar visible. Agent cards at full width. Usage metrics 2-col. |
| Tablet (>=768)   | Sidebar collapses to icons. Agent cards full width. 2-col usage. |
| Mobile (<768)    | No sidebar (bottom nav or hamburger). Usage metrics stack 1-col. Model chips wrap to multiple rows. Staff breakdown rows stack. |

All card sections use consistent padding (`p-5` or `p-6`). Inner sections use `p-4` with `bg-muted/50 rounded-lg` for visual grouping within the card.
