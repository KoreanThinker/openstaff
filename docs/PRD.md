# OpenStaff — Product Requirements Document

**Version**: 2.0 (MVP)
**Date**: 2026-02-19
**Author**: Persly
**License**: MIT

---

## 1. Executive Summary

OpenStaff is an open-source desktop application that runs and manages multiple AI Staff (specialized AI agents) 24/7 on a single high-performance local machine.

If OpenClaw is "one general-purpose AI assistant," OpenStaff is a platform that manages "N specialized AI employees." While OpenClaw handles finite, one-off tasks, OpenStaff runs infinite, repeating tasks indefinitely. Just as PM2 manages Node.js processes, OpenStaff manages AI coding agent processes.

**Core Differentiator**: Every Staff operates in an infinite loop of Gather → Execute → Evaluate. This feedback loop is the heart of OpenStaff. Staff autonomously collects feedback at appropriate times, accumulates learnings, and improves over time.

**Target User**: Non-developers, especially early-stage startup CEOs. Users must be able to create and operate Staff using only natural language, without touching code.

**Language**: English only. All UI, prompts, templates, and skills are in English.

---

## 2. Problem Statement

Early-stage startup CEOs need to simultaneously run numerous repetitive tasks: marketing, pSEO, A/B testing, community infiltration, ad creative production, etc. AI coding agents (Claude Code, Codex) can perform these tasks, but currently:

1. **Manual management required**: When an agent stops, you must restart it manually.
2. **One-shot only**: When a task finishes, the agent terminates. No continuous improvement loop.
3. **No monitoring**: Token costs, performance, and errors cannot be viewed at a glance.
4. **Hard to run multiple agents**: No process management, resource monitoring, or reporting system.

OpenStaff solves all of these problems.

---

## 3. Core Concepts & Terminology

### 3.1 Staff

A single AI employee. Specialized for a specific role (marketing, pSEO, ad creative production, etc.) and runs an infinite loop 24/7. A Staff runs forever until the user manually stops it.

Each Staff is defined by the following components:

| Component    | Description                                                                                         | Input Method     |
| ------------ | --------------------------------------------------------------------------------------------------- | ---------------- |
| **Role**     | One-line job title describing this Staff's profession                                               | Text (one line)  |
| **Gather**   | Where and how to collect information, ideas, tasks, and trends                                      | Natural language  |
| **Execute**  | The specific work to perform based on gathered information                                           | Natural language  |
| **Evaluate** | How to measure performance, which metrics to check, and what to learn                               | Natural language  |
| **KPI**      | Long-term key performance indicators to track on the dashboard (not part of the loop)               | Natural language  |
| **Skills**   | Set of tools the Staff can use. For connecting to sources and collecting feedback                    | UI select/connect |
| **Agent**    | The coding agent and LLM model to run the Staff                                                     | UI select        |

**Staff Independence**: All Staff are completely independent. There is no inter-Staff communication.

### 3.2 Feedback Loop

The core mechanism of OpenStaff. Every Staff infinitely repeats:

```
Gather → Execute → Evaluate → Gather → Execute → Evaluate → ...
```

**Loop Timing**: Not forced. The Agent decides autonomously.
- After planning based on Gather, it moves to Execute.
- When Execute produces output, it collects Evaluate feedback.
- Feedback collection timing varies by task nature (marketing: days, pSEO: weeks).
- The Agent decides the appropriate time to receive feedback or move to the next cycle.

The task list is maintained and managed by the Agent itself.

### 3.3 Skills

Same concept as Claude Code Agent Skills. Composed of SKILL.md + bundled files (scripts, resources, etc.) — a filesystem-based modular capability.

**Structure** (follows official Claude Code Skills standard):
```
skill-name/
├── SKILL.md          # YAML frontmatter (name, description, allowed-tools, etc.) + usage instructions
├── scripts/          # Executable scripts
├── references/       # Reference documentation
└── assets/           # Templates, images, data files
```

**SKILL.md Format** (official Claude Code standard):
```yaml
---
name: skill-name
description: What this skill does and when to use it
allowed-tools: Bash(python *) Read
compatibility: Requires API_KEY environment variable
metadata:
  author: openstaff
  version: "1.0"
---

# Instructions
(Markdown content with usage instructions)
```

**Purpose**:
- Connect to data sources specified in Gather (e.g., Instagram API, Google Search Console)
- Collect Evaluate metrics (e.g., fetch CPI/CPM from Meta Ads API)
- Use tools needed for Execute (e.g., image generation, content posting)

**Authentication Management**: API keys, OAuth tokens, etc. required by Skills are configured in the OpenStaff UI Skills management screen. These are injected as environment variables when spawning the Staff's agent process.

### 3.4 OpenStaff Built-in Skill

Every Staff automatically has the `openstaff` skill, which provides structured communication between the agent and OpenStaff:

```yaml
---
name: openstaff
description: >
  OpenStaff platform integration. Use to report cycle completion,
  record KPI metrics, and request human help when stuck.
allowed-tools: Bash(echo *) Read
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
```

OpenStaff monitors these files:
- `cycles.jsonl` → Cycle count for dashboard
- `kpi.jsonl` → KPI chart data for dashboard
- `signals.jsonl` → Giveup detection → pause Staff + notify user

### 3.5 Agent

The coding agent that actually runs the Staff. MVP supports:

| Agent            | Execution Method                         | Status     |
| ---------------- | ---------------------------------------- | ---------- |
| **Claude Code**  | CLI via node-pty (interactive, headless)  | MVP        |
| **OpenAI Codex** | CLI via node-pty (interactive, headless)  | Abstracted |

Each Agent is assigned an LLM Model (e.g., Claude Sonnet 4.5, GPT-5, etc.).

**Agent Abstraction Interface**:
```typescript
interface AgentDriver {
  id: string              // 'claude-code' | 'codex'
  name: string

  isInstalled(): Promise<boolean>
  install(): Promise<void>
  getBinaryPath(): string
  getAvailableModels(): string[]

  spawn(opts: SpawnOptions): AgentProcess
  resume(opts: ResumeOptions): AgentProcess
  exec(opts: ExecOptions): Promise<string>  // One-shot (for reports, etc.)
}

interface AgentProcess {
  pid: number
  sessionId: string | null

  write(message: string): void
  onData(cb: (data: string) => void): void
  onExit(cb: (code: number) => void): void
  kill(): Promise<void>
}
```

MVP implements `ClaudeCodeDriver` only. `CodexDriver` interface is defined but not implemented.

**Authentication Management**: Agent API keys are configured in the OpenStaff UI Agent management screen.

---

## 4. Architecture

### 4.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│               OpenStaff Desktop App (Electron)            │
│                                                           │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐   │
│  │  Staff      │  │  Skills    │  │  Agent           │   │
│  │  Management │  │  Management│  │  Management      │   │
│  └─────┬──────┘  └─────┬──────┘  └─────┬────────────┘   │
│        │               │               │                  │
│  ┌─────┴───────────────┴───────────────┴──────────────┐  │
│  │             Staff Process Manager                   │  │
│  │          (node-pty process orchestrator)            │  │
│  └─────┬──────────┬──────────┬────────────────────────┘  │
│        │          │          │                            │
│  ┌─────┴──┐ ┌─────┴──┐ ┌────┴───┐                       │
│  │Staff A │ │Staff B │ │Staff C │ ...                    │
│  │(pty)   │ │(pty)   │ │(pty)   │                        │
│  └────────┘ └────────┘ └────────┘                        │
│                                                           │
│  ┌──────────────────────────────────────────────────┐    │
│  │          Express API Server (localhost:PORT)       │    │
│  │  ├── REST API (/api/staffs, /api/skills, etc.)   │    │
│  │  ├── WebSocket (real-time logs, status)           │    │
│  │  └── Static Files (React web build)              │    │
│  └────────────────────┬─────────────────────────────┘    │
│                       │                                   │
│  ┌────────────────────┴─────────────────────────────┐    │
│  │              Ngrok Tunnel → public URL             │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  ┌───────────────────────────────────────────────────┐    │
│  │              Monitoring Engine                      │    │
│  │  (token tracking, cost, health check, KPI)         │    │
│  └───────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### 4.2 API-First Architecture

Both the Electron renderer and web browser (via Ngrok) use the same Express API:

```
Electron App UI  ──→ localhost:PORT/api/*
                     localhost:PORT/ws
Phone/Laptop     ──→ https://xxx.ngrok.io/api/*
                     https://xxx.ngrok.io/ws
```

One Express server handles REST API, WebSocket, and static file serving. Only one Ngrok tunnel required.

Electron IPC is used ONLY for native features:
- System tray management
- Native notifications
- File dialogs (import/export)
- App minimize/quit behavior

### 4.3 Staff Execution Mechanism

Each Staff is a Claude Code CLI interactive session running in a node-pty pseudo-terminal.

**Spawn Flow**:
1. Generate CLAUDE.md from staff.json using the system prompt template.
2. Symlink connected Skills to the working directory's `.claude/skills/`.
3. Spawn Claude Code via node-pty with isolation flags:
   ```bash
   claude --dangerously-skip-permissions \
     --setting-sources project,local \
     --strict-mcp-config \
     --mcp-config ./staff-mcp.json
   ```
4. Send initial prompt via pty.write():
   ```
   "You are now active. Begin your first Gather → Execute → Evaluate cycle. Do not stop."
   ```

**Environment Variables** (injected at spawn):
- `ANTHROPIC_API_KEY` — Agent API key
- Skill-specific env vars (e.g., `INSTAGRAM_ACCESS_TOKEN`)

**Isolation Flags** (prevent interference with user's personal Claude Code):
- `--setting-sources project,local` — Ignores global `~/.claude/settings.json`
- `--strict-mcp-config --mcp-config ./staff-mcp.json` — Only loads Staff-specific MCP servers

**Idle Detection & "Keep Going"**:
- Monitor pty stdout for output.
- Check child processes of the Claude Code process (via process tree).
- If no pty output for 5 minutes AND no child processes → send via pty.write():
  ```
  Continue working. Start your next Gather → Execute → Evaluate cycle now. Do not stop.
  ```
  This exact message is the canonical idle prompt. Do not modify it.

**Restart Flow** (when process exits or crashes):
1. Save session_id to state.json before the session starts.
2. On exit: log error, increment restart counter.
3. Spawn new pty: `claude --resume {session_id} --dangerously-skip-permissions ...`
4. If resume fails, generate fresh CLAUDE.md and start new session.
5. Consecutive failures (5 within 5 minutes): backoff (30s → 60s → 120s).
6. Backoff limit exceeded: set Staff to Stopped status, show notification.

**Reboot Recovery**:
1. Computer shuts down → pty sessions die.
2. OpenStaff auto-starts on login (OS Login Items / autostart).
3. Reads state.json for each Staff that was "running."
4. Resumes each with `claude --resume {session_id}`.

**Context Management**:
- Claude Code automatically compacts context when the window fills up.
- CLAUDE.md content is preserved during compaction (key advantage).
- `--resume` loads the already-compacted session.
- No special handling required from OpenStaff.

**Staff Count Limit**: None. Users create as many as they want. Resource monitoring is available in the dashboard for self-management.

### 4.4 Staff Memory

Each Staff has two separate files for instructions and learning:

```
~/.openstaff/staffs/{staff-id}/
├── CLAUDE.md        # Auto-generated by OpenStaff. READ-ONLY for the agent.
│                    # Contains system prompt, role, gather/execute/evaluate instructions.
│                    # Regenerated whenever staff.json changes.
│
└── memory.md        # Agent's learning journal. WRITE by agent, READ by OpenStaff.
                     # Agent appends learnings after each Evaluate cycle.
                     # OpenStaff displays this in the Memory tab.
```

**CLAUDE.md** is always auto-generated from `staff.json` + the system prompt template (TypeScript code). When the user updates Staff config in the UI:
1. Save to `staff.json`
2. Regenerate `CLAUDE.md` from template
3. Restart Staff session

**memory.md** is the agent's territory. OpenStaff reads it for display but never modifies it.

**System Prompt Template Migration**: When the app updates with a new template format, all Staff CLAUDE.md files are regenerated from their staff.json + the new template. User config and agent learnings are both preserved.

### 4.5 Token Usage / Cost Tracking

Adopts the ccusage approach:

- Claude Code logs to `~/.claude/projects/` as JSONL.
- OpenStaff Monitoring Engine watches each Staff's log directory.
- Parses JSONL for token usage (input, output, cache read/write) and calculates cost.
- Writes daily summaries to `usage.jsonl` in each Staff's working directory.
- Dashboard UI visualizes per-Staff, daily, and monthly data.
- Cost calculation based on LiteLLM pricing data or internal pricing table.

### 4.6 Data Storage

**Fully filesystem-based. No database.**

```
~/.openstaff/
├── config.json                    # App settings (electron-store + safeStorage)
│
├── staffs/
│   └── {staff-id}/                # Each Staff's working directory
│       ├── CLAUDE.md              # Auto-generated instructions (read-only for agent)
│       ├── memory.md              # Agent's learning journal
│       ├── .claude/
│       │   ├── settings.json      # Claude Code project settings
│       │   └── skills/            # Symlinks to ~/.openstaff/skills/*
│       ├── staff.json             # Staff config (source of truth for UI)
│       ├── state.json             # Runtime state (session_id, last_started_at)
│       ├── cycles.jsonl           # Cycle completion records (from openstaff skill)
│       ├── kpi.jsonl              # KPI metrics (from openstaff skill)
│       ├── usage.jsonl            # Token/cost records (from monitoring engine)
│       ├── errors.jsonl           # Error records (from monitoring engine)
│       ├── signals.jsonl          # Giveup signals (from openstaff skill)
│       ├── output.log             # Pty output capture (30-day rotation)
│       └── (agent work files)     # Files created by the agent during work
│
├── skills/                        # Installed skills (Claude Code standard)
│   └── {skill-name}/
│       ├── SKILL.md
│       ├── scripts/
│       ├── references/
│       └── assets/
│
├── tools/                         # Internally installed Claude Code
│   └── node_modules/
│       └── @anthropic-ai/claude-code/
│
└── registry/                      # Cached GitHub registry data
```

**Settings** (`config.json` via electron-store):
```json
{
  "anthropic_api_key": "encrypted:...",
  "openai_api_key": "encrypted:...",
  "ngrok_api_key": "encrypted:...",
  "ngrok_auth_password": "encrypted:...",
  "default_agent": "claude-code",
  "default_model": "claude-sonnet-4-5",
  "setup_completed": true,
  "start_on_login": true,
  "show_window_on_startup": true
}
```

Sensitive values encrypted with Electron's `safeStorage` API (OS keychain).

**staff.json** (source of truth for UI):
```json
{
  "id": "meta-ads-creative",
  "name": "Meta Ads Creative Designer",
  "role": "Meta ads creative designer",
  "gather": "Collect trends from Instagram for the last 3 days...",
  "execute": "Create 3 ad creatives with A/B test variants...",
  "evaluate": "Analyze CPI, CPM from Meta Ads dashboard...",
  "kpi": "CPI < $2.00, CTR > 3%",
  "agent": "claude-code",
  "model": "claude-sonnet-4-5",
  "skills": ["instagram", "meta-ads-api"],
  "created_at": "2026-02-19T00:00:00Z"
}
```

**state.json** (runtime state, minimal):
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "last_started_at": "2026-02-19T10:00:00Z"
}
```

Status (running/stopped) is derived from whether the pty process is alive.
Cycle count is derived from `cycles.jsonl` line count.
Restart count is derived from `errors.jsonl` entries of type `process_crash`.

---

## 5. Feature Specifications

### 5.1 Staff Management

#### 5.1.1 Staff Creation

**UI**: Visual representation of the infinite loop: Gather → Execute → Evaluate → Gather → Execute → ... This loop visualization is the key impact that intuitively conveys the concept of "endless repeating work" to the user.

**Input Fields**:

| Field      | Type                                     | Description              | Example                                                    |
| ---------- | ---------------------------------------- | ------------------------ | ---------------------------------------------------------- |
| Staff Name | Text                                     | Staff name               | "Meta Ads Creative Designer"                               |
| Role       | Text (one line)                          | One-line job title       | "Meta ads creative designer"                               |
| Gather     | Natural language (textarea)              | Where/how to collect info| "Collect top 100 trending posts from Instagram last 3 days"|
| Execute    | Natural language (textarea)              | What work to perform     | "Create 3 ad creatives with A/B test variants"             |
| Evaluate   | Natural language (textarea)              | How to measure & learn   | "Check CPI, CPM from Meta Ads dashboard, analyze patterns" |
| KPI        | Natural language (textarea)              | Long-term metrics        | "CPI < $2.00, CTR > 3%, daily creatives >= 3"             |
| Skills     | Multi-select (from installed Skills)     | Skills to connect        | Instagram Skill, Meta Ads API Skill                        |
| Agent      | Single select                            | Agent to use             | Claude Code                                                |
| Model      | Single select (filtered by Agent)        | LLM model               | Claude Sonnet 4.5                                          |

**Processing Logic**:
1. Save Staff config as `staff.json` in the working directory.
2. Generate `CLAUDE.md` from `staff.json` + system prompt template.
3. Create working directory: `~/.openstaff/staffs/{staff-id}/`
4. Symlink connected Skills to `.claude/skills/`.
5. Create empty `memory.md`, `state.json`.
6. Spawn Agent subprocess via node-pty.

#### 5.1.2 Staff Deletion

- Terminate subprocess (SIGTERM → 5s wait → SIGKILL).
- Delete entire working directory: `~/.openstaff/staffs/{staff-id}/`
- No confirmation about archiving — clean delete.

#### 5.1.3 Staff Update

- Role, Gather, Execute, Evaluate, KPI text can be modified.
- Skills, Agent, Model can be changed.
- On change: update `staff.json` → regenerate `CLAUDE.md` → restart subprocess.

#### 5.1.4 Staff Start / Stop / Restart

- **Start**: Spawn pty process. Save session_id to state.json.
- **Stop**: Terminate subprocess (SIGTERM → SIGKILL). Preserve session_id.
- **Restart**: Stop then Start. Resume with `--resume {session_id}`.

### 5.2 Staff Monitoring

PM2-style dashboard. Real-time updates via WebSocket.

**Staff List** (main screen):

| Column         | Description                                    |
| -------------- | ---------------------------------------------- |
| Status         | Running / Stopped / Error                      |
| Name           | Staff name                                     |
| Role           | One-line role description                      |
| Agent          | Claude Code / Codex                            |
| Model          | LLM model name                                 |
| Uptime         | Time since last start                          |
| Restarts       | Restart count (from errors.jsonl)              |
| Tokens (Today) | Today's total token count                      |
| Cost (Today)   | Today's cost (USD)                             |
| Cycle          | Completed Feedback Loop cycle count            |
| KPI Summary    | Latest KPI values with trend arrows (↑↓)       |

**Staff Detail Screen** (click a Staff):

| Tab      | Content                                                                      |
| -------- | ---------------------------------------------------------------------------- |
| Overview | Staff config (Role, Gather, Execute, Evaluate, KPI, Skills, Agent) + loop viz|
| Metrics  | Token usage (input/output/cache), cost — hourly/daily/monthly charts         |
| Logs     | Real-time pty stdout/stderr stream                                           |
| KPI      | Per-metric time-series line charts (daily), goal lines as dashed reference   |
| Memory   | memory.md contents (agent's learning journal)                                |
| Errors   | Error log list                                                               |

**System Resource Monitoring** (bottom bar or separate tab):

| Metric                   | Description                                  |
| ------------------------ | -------------------------------------------- |
| CPU Usage                | Total + per-Staff CPU usage                  |
| Memory Usage             | Total + per-Staff memory usage               |
| Total Cost (Today/Month) | All Staff combined cost                      |
| Active Staff Count       | Number of currently running Staff            |

### 5.3 Health Check & Auto-Recovery

**Interval**: Every 60 seconds.

**Health Check Items**:
1. Is the pty process alive? (PID check)
2. Is the process responsive? (stdout output within last N seconds OR active child processes)

**Auto-Recovery Flow**:
1. Process exit detected
2. Log error to errors.jsonl
3. Attempt `claude --resume {session_id}` via new pty
4. If resume fails, start fresh session with same CLAUDE.md
5. Consecutive failures (5 within 5 minutes): apply backoff (30s → 60s → 120s)
6. Backoff limit exceeded: set Staff to Stopped, show native notification

### 5.4 Skills Management

#### 5.4.1 Skill List

- Display installed Skills from `~/.openstaff/skills/`
- Show name, description, auth status for each Skill

#### 5.4.2 Skill Addition

- Import Skill directory from local filesystem
- Download from GitHub registry
- UI for setting required environment variables (API keys, tokens)

#### 5.4.3 Skill Deletion / Update

- On delete: warn if any Staff uses this Skill
- On delete: remove symlinks from affected Staff working directories
- Update from GitHub registry

#### 5.4.4 Skill Authentication

Skills declare required credentials in their SKILL.md `compatibility` field. OpenStaff's UI provides a form to input these values. Values are stored encrypted in `config.json` and injected as environment variables when spawning the Staff process.

### 5.5 Agent Management

**OpenStaff installs and runs without any agents pre-installed.** Agent setup is entirely independent and managed through the dedicated Agents screen. Users can explore the app, browse the registry, and configure settings before setting up any agent.

**Agents screen** is the central hub for agent lifecycle management:

- **Installation**: Step-by-step guide to install Claude Code (`npm install --prefix ~/.openstaff/tools @anthropic-ai/claude-code`). Progress bar, no terminal exposure.
- **Authentication**: API key input (stored encrypted via safeStorage) + Test Connection + health check status.
- **Health Check Dashboard**: Installation status, API key validity, connection status — all visible at a glance per agent.
- **Models**: Available model list per agent (read-only, informational).
- **Usage & Cost**: Aggregate token usage and cost (today/month) across all Staff using this agent.
- **Budget**: Monthly cost limit + warning threshold with visual progress bar.
- **Staff Breakdown**: Per-Staff cost breakdown showing which Staff consumes what.
- **Auto-update**: Toggle for keeping agents up to date automatically.

**Agent readiness guard**: Staff cannot be started without a configured agent. The Staff Create screen and Start action check agent readiness and guide users to the Agents screen if needed.

Supported agents:
- Claude Code (MVP): Full lifecycle management.
- Codex (future): Placeholder card with "Coming soon" message.

### 5.6 Settings

| Setting                  | Description                            |
| ------------------------ | -------------------------------------- |
| Ngrok API Key            | For web UI remote access               |
| Ngrok Auth Password      | Basic auth for Ngrok URL               |
| Default Agent            | Default agent for new Staff            |
| Default Model            | Default model for new Staff            |
| Start on Login           | Auto-start OpenStaff at OS login       |
| Show Window on Startup   | Show dashboard on app start            |

### 5.7 Web UI (Ngrok)

- Same React codebase serves both Electron renderer and web browser.
- Express API server handles all data operations.
- Electron renderer hits localhost; web browser hits Ngrok URL.
- Ngrok tunnel setup when API key is configured.
- Basic auth for Ngrok URL security.
- Full dashboard access from phone/laptop: monitor Staff, start/stop, change settings.

**Single-server architecture** (one Ngrok tunnel):
```
Express Server (localhost:PORT)
├── /api/*     → REST API
├── /ws        → WebSocket (real-time updates)
└── /*         → Static React build (web UI)
```

### 5.8 Export & Import

#### 5.8.1 Export

Export Staff config as a JSON file:
```json
{
  "openstaff_version": "1.0.0",
  "type": "staff",
  "role": "Meta ads creative designer",
  "gather": "...",
  "execute": "...",
  "evaluate": "...",
  "kpi": "...",
  "required_skills": ["instagram", "meta-ads-api"],
  "recommended_agent": "claude-code",
  "recommended_model": "claude-sonnet-4-5"
}
```

Export includes `staff.json` config only. No memory.md, no runtime state.

#### 5.8.2 Import

Import a Staff JSON file → auto-populate the Staff creation form. User reviews, adjusts Skills/Agent connections, and confirms.

### 5.9 GitHub Registry

Staff templates and Skills hosted in this repository's `registry/` directory:

```
registry/
├── templates/
│   ├── meta-ads-creative.json
│   ├── pseo-agent.json
│   └── naver-cafe-marketing.json
└── skills/
    ├── instagram/
    │   ├── SKILL.md
    │   └── scripts/
    ├── meta-ads-api/
    └── google-search-console/
```

In-app browsing: fetch from GitHub raw URLs. Download = import to local.

### 5.10 Setup Wizard

Lightweight first-launch onboarding. **Does NOT install agents or collect API keys** — that's the Agents screen's responsibility. The wizard introduces the product and optionally configures remote access.

```
Step 1: Welcome
  "Welcome to OpenStaff"
  → Brief explanation of what OpenStaff does (manage AI Staff 24/7)
  → Visual illustration of the Gather → Execute → Evaluate loop

Step 2: (Optional) Remote Access
  "Access your dashboard from anywhere"
  → Ngrok API Key: [____________]
  → Auth Password: [____________]
  → Skip available

Step 3: Complete!
  → "Get started" button → Dashboard
  → Banner/prompt to set up an agent in the Agents screen
```

---

## 6. App Behavior

OpenStaff follows the Docker Desktop application model:

| Behavior                | Description                                                         |
| ----------------------- | ------------------------------------------------------------------- |
| Close window (X)        | Minimize to system tray. Staff keep running.                        |
| Quit from tray          | Stop all Staff, then exit app completely.                           |
| System tray icon        | Shows quick Staff status overview and controls.                     |
| Auto-start on login     | Optional. Configurable in Settings.                                 |
| Start without window    | Optional. Start minimized to tray.                                  |
| Native notifications    | Staff errors, giveup signals, health check failures.                |

**System Tray Menu**:
```
◉ OpenStaff
──────────────────
🟢 Meta Ads Creative (Cycle #47)
🟢 pSEO Writer (Cycle #23)
🔴 Naver Cafe Marketer (Stopped)
──────────────────
Open Dashboard
Settings
──────────────────
Quit OpenStaff
```

---

## 7. Technical Stack

| Area                 | Technology                                           |
| -------------------- | ---------------------------------------------------- |
| Desktop App          | Electron (electron-vite)                             |
| Frontend             | React + TypeScript                                   |
| UI Components        | shadcn/ui + Tailwind CSS                             |
| State Management     | Zustand + TanStack Query                             |
| Web UI               | Same React codebase (web build)                      |
| Backend (in-app)     | Node.js (Electron main process) + Express API server |
| WebSocket            | socket.io                                            |
| Data Storage         | Filesystem (JSONL, JSON) + electron-store            |
| Encryption           | Electron safeStorage API (OS keychain)               |
| Process Management   | node-pty (pseudo-terminal)                           |
| Token Tracking       | JSONL log parsing (ccusage approach)                 |
| System Metrics       | pidusage (per-process CPU/RAM)                       |
| Tunnel               | Ngrok Node.js SDK                                    |
| Testing              | Vitest (unit) + Playwright (E2E, Electron support)   |
| CI/CD                | GitHub Actions (multi-platform: macOS + Ubuntu)      |
| Build/Package        | electron-builder (.dmg, .deb)                        |
| Auto-Update          | electron-updater (GitHub Releases)                   |
| Package Manager      | pnpm                                                 |
| Chart Library        | Tremor (shadcn/ui compatible)                        |
| Git Integration      | simple-git (for future use, not in MVP)              |
| Landing Page         | Vanilla HTML (in-repo)                               |
| Marketplace          | GitHub registry + export/import                      |

---

## 8. Staff Definition Examples

### 8.1 Meta Ads Creative Staff

- **Role**: "Meta ads creative designer"
- **Gather**: "Collect trending posts from Instagram and X (Twitter) for the last 3 days in our product category. Analyze visual styles, copy patterns, and hashtags of top 100 posts."
- **Execute**: "Create 3 ad creatives (image + copy) per day tailored to our product. Include A/B test variants."
- **Evaluate**: "Check each creative's CPI, CPM, CTR from Meta Ads dashboard API. Analyze which patterns perform best and apply learnings to next batch."
- **KPI**: "CPI < $2.00, CTR > 3%, daily creatives >= 3"
- **Skills**: Instagram Skill, X (Twitter) Skill, Meta Ads API Skill, Image Generation Skill
- **Agent**: Claude Code
- **Model**: Claude Sonnet 4.5

### 8.2 pSEO Agent

- **Role**: "SEO content strategist and writer"
- **Gather**: "Analyze current keyword performance from Google Search Console. Discover new keyword opportunities from competitor blogs and industry trends."
- **Execute**: "Create SEO-optimized content based on discovered keywords and publish to blog."
- **Evaluate**: "Track impressions, clicks, and average ranking for published content in Google Search Console. Learn which keywords and content patterns are effective."
- **KPI**: "Monthly organic impressions > 50K, average position < 10, new content pieces >= 5/week"
- **Skills**: Google Search Console Skill, Blog CMS Skill, Web Scraping Skill
- **Agent**: Claude Code
- **Model**: Claude Sonnet 4.5

### 8.3 Naver Cafe Infiltration Marketing Agent

- **Role**: "Naver Cafe community marketer"
- **Gather**: "Browse target Naver Cafes and collect popular posts and trending topics."
- **Execute**: "Write natural, community-appropriate posts that subtly mention our product. Match the cafe's tone and culture."
- **Evaluate**: "Collect comments, view counts, and reactions on posts. Analyze which tone and topics are most effective."
- **KPI**: "Average views > 500, positive reaction rate > 70%, posts/week >= 5"
- **Skills**: Naver Cafe Skill, Web Scraping Skill
- **Agent**: Claude Code
- **Model**: Claude Sonnet 4.5

### 8.4 Feature Development Agent

- **Role**: "Product feature developer"
- **Gather**: "Collect feature ideas from Slack user feedback channel, app reviews, and competitor updates."
- **Execute**: "Design, prototype, and implement the highest-priority feature. Deploy to 1% of users first."
- **Evaluate**: "Analyze event logs and QA results for the deployed feature. If quality is sufficient, gradually increase rollout percentage."
- **KPI**: "Feature completion rate >= 1/week, bug reports < 3/feature, rollout success rate > 90%"
- **Skills**: GitHub Skill, Analytics Skill, Feature Flag Skill
- **Agent**: Claude Code (Codex when available)
- **Model**: Claude Sonnet 4.5

### 8.5 Play Store ASO Agent

- **Role**: "Play Store ASO specialist"
- **Gather**: "Research trending keywords on Play Store and track ranking trends for existing keywords."
- **Execute**: "Optimize keyword combinations and update app description and screenshot captions."
- **Evaluate**: "Track impressions and install count changes per keyword. Learn effective keyword patterns."
- **KPI**: "Organic installs +20% MoM, target keyword top 10 count >= 5"
- **Skills**: Play Store API Skill, ASO Tool Skill
- **Agent**: Claude Code
- **Model**: Claude Sonnet 4.5

---

## 9. User Flow

### 9.1 First Use (Onboarding)

1. Download and install OpenStaff (.dmg for macOS, .deb for Ubuntu)
2. Launch app → Setup Wizard starts automatically
3. Wizard: Welcome screen explains the concept (Gather → Execute → Evaluate loop)
4. Wizard: (Optional) Configure Ngrok for remote access
5. Dashboard opens → Banner guides user to Agents screen
6. Agents screen: Install Claude Code (progress bar) + enter API key + test connection
7. Dashboard: Download Staff template from registry or create from scratch
8. Install required Skills and set API keys
9. Start Staff

### 9.2 Daily Operation

1. Staff runs 24/7 on workstation (minimized to tray)
2. Check dashboard from laptop/phone via Ngrok URL
3. Review KPI charts for each Staff
4. Adjust Staff config if needed (Gather, Execute, Evaluate)
5. Monthly cost review

---

## 10. Non-Functional Requirements

| Area       | Requirement                                                               |
| ---------- | ------------------------------------------------------------------------- |
| Stability  | 24/7 non-stop. Health check + auto-recovery on Staff crash.               |
| Performance| No Staff count limit. Monitoring overhead minimized (60s health check).    |
| Security   | API keys encrypted via OS keychain (safeStorage). Ngrok URL with auth.    |
| UX         | Non-developers create Staff with natural language only. No code required.  |
| Data       | All data stored locally. No external transmission except Ngrok tunnel.     |
| Platform   | macOS, Ubuntu (Electron)                                                  |
| Testing    | Strict TDD. 90%+ coverage. Minimal mocking. Real Claude Code in E2E.     |
| CI/CD      | GitHub Actions: unit + integration + E2E subset (no API key). Full E2E local. |
| Updates    | Auto-update via electron-updater (GitHub Releases).                       |
| Logs       | 30-day rotation for output.log files.                                     |

---

## 11. MVP Scope & Exclusions

### MVP Includes (v1.0)

- Staff CRUD (create/read/update/delete)
- Staff execution (Claude Code via node-pty, interactive mode)
- Staff monitoring dashboard (PM2-style)
- Health Check & Auto-Recovery (60s interval)
- Idle detection & "keep going" mechanism
- Skills management (add/delete/update, auth configuration)
- Agent management (Claude Code connection, auto-install, auto-update)
- Codex agent interface (abstracted, not implemented)
- Settings (Ngrok, agent defaults, app behavior)
- Web UI via Ngrok (same React codebase, basic auth)
- Token/cost tracking (JSONL parsing)
- KPI tracking & charts (daily, per-Staff line charts)
- Staff Memory (memory.md, displayed in dashboard)
- Export & Import (staff.json based)
- GitHub Registry (templates & skills browsing/download)
- OpenStaff built-in skill (cycle-complete, record-kpi, giveup)
- Setup Wizard (first-launch onboarding)
- System tray integration (Docker Desktop-style)
- Auto-start on login
- TDD test suite (Vitest + Playwright)
- CI/CD pipeline (GitHub Actions)
- Landing page (vanilla HTML)

### MVP Excludes (Future)

- Codex agent implementation
- Slack integration & automated reports (daily/weekly)
- KPI alert system (automated warning prompts)
- Git-based memory versioning
- Inter-Staff communication
- Manager Staff controlling other Staff
- Advanced memory systems (vector DB, RAG)
- Auto-stop on goal achievement
- Docker-based isolation
- Self-hosted marketplace
- Mobile app
- SQLite or any database
- Windows support

---

## 12. Success Metrics

| Metric                         | Target                 |
| ------------------------------ | ---------------------- |
| GitHub Stars (1 month)         | 1,000+                 |
| Staff uptime                   | 99%+ (health check)   |
| Registry Staff templates       | 20+ (at launch)        |
| Staff creation time (non-dev)  | Under 5 minutes        |

---

## 13. Project Structure

```
openstaff/
├── src/
│   ├── main/                      # Electron main process
│   │   ├── index.ts
│   │   ├── staff-manager/         # node-pty session management
│   │   ├── health-check/          # Process monitoring
│   │   ├── monitoring/            # Token/cost tracking, KPI file watching
│   │   ├── api/                   # Express API server + WebSocket
│   │   ├── ngrok/                 # Ngrok tunnel management
│   │   ├── store/                 # electron-store config management
│   │   ├── tray/                  # System tray integration
│   │   └── ipc/                   # Electron IPC handlers (native only)
│   ├── preload/
│   │   └── index.ts
│   └── renderer/                  # React UI
│       └── src/
│           ├── components/        # UI components (shadcn/ui)
│           ├── pages/             # Dashboard, Staff detail, Settings, etc.
│           ├── stores/            # Zustand stores
│           ├── hooks/             # React hooks
│           └── lib/               # Utilities
├── registry/                      # GitHub registry (templates & skills)
│   ├── templates/
│   └── skills/
├── landing/                       # Landing page (vanilla HTML)
├── tests/
│   └── e2e/                       # Playwright E2E tests (unit tests live alongside source)
├── .github/
│   └── workflows/                 # GitHub Actions CI/CD
├── electron.vite.config.ts
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── PRD.md
```

---

## 14. Testing Strategy

### 14.1 Development Method: Strict TDD

Every feature follows: Write test → Run (fail) → Implement → Run (pass) → Refactor. No exceptions.

### 14.2 Test Layers

| Layer | Tool | What | Mocking Policy |
|-------|------|------|----------------|
| **Unit** | Vitest | Pure functions, utilities, template generation, JSONL parsing, cost calculation | No mocking. Pure functions need no mocks. |
| **Integration** | Vitest | Express API routes, StaffManager, AgentDriver, file system operations | Real filesystem (tmpdir), real Express server. Minimal mocking. |
| **Component** | Vitest + React Testing Library | React components, forms, interactions | MSW for API calls (real HTTP, fake server). No shallow rendering. |
| **E2E** | Playwright (Electron) | Full app flows through real Electron window | **Zero mocking.** Real Electron + real Claude Code + real API key. |

### 14.3 Mocking Policy

- Never mock what you can test for real.
- Integration tests use real I/O: real filesystem, real Express server, real processes.
- E2E tests use real everything: real Electron, real Claude Code CLI, real Anthropic API.
- Acceptable mocks: Only when external service is genuinely unreachable in test env.
- Rule of thumb: If a test only proves that mocks return what you told them to, it's worthless. Rewrite it.

### 14.4 Coverage Target

90%+ overall. Critical paths (StaffManager, AgentDriver, API routes) must be near 100%.

### 14.5 E2E Scenarios (MVP Completion Criteria)

MVP is complete when ALL of these E2E tests pass:

| # | Scenario | Verification |
|---|----------|-------------|
| 1 | Setup Wizard completion | First launch → wizard → Dashboard arrival |
| 2 | Agent install + connect | Agents page → install Claude Code → API key → connection success |
| 3 | Staff creation | Fill form → save → staff.json exists → CLAUDE.md generated |
| 4 | Staff start + monitoring | Start → pty alive → Dashboard shows Running → logs streaming |
| 5 | Staff stop + restart | Stop → Stopped state → Restart → resume with session_id |
| 6 | Staff deletion | Delete → directory removed → gone from Dashboard |
| 7 | Skill add + Staff connect | Install skill → configure auth → connect to Staff → symlink verified |
| 8 | Settings persistence | Change settings → restart app → settings preserved |
| 9 | Health check + recovery | Kill Staff process → auto-restart within 60s |
| 10 | Window → tray behavior | Close window → app still running → restore from tray |

**Test Data Isolation**: All tests use `OPENSTAFF_HOME` env var to override the data directory. Production uses `~/.openstaff/`, tests use `~/.openstaff-test/` (or tmpdir). This prevents test data from interfering with real data.

**E2E API Key Strategy**: Hybrid approach. E2E scenario #2 (Agent install + connect) tests the full UI flow including API key entry. All other E2E tests start with a pre-seeded config (API key already in config.json) to skip redundant setup.

**E2E Model**: Claude Sonnet 4.5 for all E2E tests. Timeout per test: 120 seconds. No retry policy — if a test fails, it fails. Fix the code, not the test.

**E2E Independence**: Every E2E test is fully independent. Each test does its own setup and teardown. No shared state between tests. This allows parallel execution and prevents cascade failures.

**Test Staff for E2E**: A fast, simple Staff that completes one cycle in ~30 seconds:
- Role: "Test file creator"
- Gather: "Check if test-output.txt exists in the working directory"
- Execute: "Create or update test-output.txt with the current timestamp"
- Evaluate: "Verify test-output.txt exists and contains a recent timestamp"

### 14.6 CI/CD Test Split

| Environment | Tests Run | Trigger |
|-------------|-----------|---------|
| **GitHub Actions** | Unit + Integration + Component + E2E (subset) | Every push / PR |
| **Local** | All tests including full E2E suite | On developer judgment, before merge |

**CI E2E subset** (no API key, no cost — runs via xvfb headless Electron):

| # | Scenario | Why CI-safe |
|---|----------|-------------|
| 1 | Setup Wizard | Pure UI flow |
| 3 | Staff creation | Form → filesystem, no agent start |
| 6 | Staff deletion | Filesystem cleanup |
| 7 | Skill add + connect | Symlink operations |
| 8 | Settings persistence | electron-store read/write |
| 10 | Window → tray | Electron window management |

**Local-only E2E** (requires real Claude Code + API key):

| # | Scenario | Why local-only |
|---|----------|----------------|
| 2 | Agent install + connect | Real npm install + API key validation |
| 4 | Staff start + monitoring | Real Claude Code pty session, API cost |
| 5 | Staff stop + restart | Real running process |
| 9 | Health check + recovery | Real process kill/restart |

### 14.7 Cross-Platform Testing

| Platform | Method | Tests |
|----------|--------|-------|
| **macOS** | Local development machine | All tests (unit + integration + full E2E) |
| **Ubuntu** | SSH to server (`ssh persly`) | All tests (unit + integration + full E2E) |
| **CI (macOS)** | GitHub Actions macos-latest | Unit + Integration + CI E2E subset |
| **CI (Ubuntu)** | GitHub Actions ubuntu-latest + xvfb | Unit + Integration + CI E2E subset |

Ubuntu server is used for cross-platform verification. Same test suite runs on both platforms.

---

## 15. Open Questions

| #   | Question                                                                      | Status   |
| --- | ----------------------------------------------------------------------------- | -------- |
| 1   | Codex CLI headless subprocess execution interface details                     | TBD      |
| 2   | Codex `--resume` equivalent functionality                                     | TBD      |
| 3   | Skills marketplace quality control / security verification                    | Deferred |
| 4   | Exact Tremor chart components for KPI visualization                           | TBD      |
| 5   | OpenClaw landing page reference — exact content/layout                        | TBD      |
