<p align="center">
  <img src="resources/icon.png" width="128" alt="OpenStaff icon" />
</p>

<h1 align="center">OpenStaff</h1>

<p align="center">
  <strong>Hire your AI staff. Let them work 24/7.</strong><br/>
  An open-source desktop app that manages multiple AI coding agents running in an infinite loop.<br/>
  Like PM2 for AI agents.
</p>

<p align="center">
  <a href="https://github.com/koreanthinker/openstaff/releases"><img src="https://img.shields.io/github/v/release/koreanthinker/openstaff" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/koreanthinker/openstaff" alt="License" /></a>
</p>

<!-- screenshot -->

---

## What is OpenStaff?

OpenStaff turns AI coding agents into autonomous employees. Each **Staff** runs an infinite feedback loop -- Gather, Execute, Evaluate -- cycling continuously until you stop it. Define a role in plain English, attach skills, and let your Staff work around the clock.

No coding required. Built for non-developers.

## Features

:infinity: **Infinite Feedback Loop** -- Every Staff runs Gather > Execute > Evaluate on repeat. Autonomous learning and improvement, 24/7.

:busts_in_silhouette: **Multiple Staff** -- Run N specialized AI employees in parallel. Marketing, pSEO, ad creatives, community outreach -- each with their own role.

:bar_chart: **Real-Time Monitoring** -- Track token usage, costs, cycle counts, and custom KPIs from a single dashboard.

:jigsaw: **Skills System** -- Attach modular SKILL.md files to give Staff new capabilities. Browse the built-in template registry or create your own.

:globe_with_meridians: **Remote Access** -- Expose your local API via Ngrok tunnel and monitor Staff from anywhere.

:computer: **Tray App** -- Lives in your macOS menu bar. Quick status checks and controls without opening the full window.

:electric_plug: **Agent Drivers** -- Claude Code support out of the box. Extensible AgentDriver interface for future agents (Codex and beyond).

:package: **Template Registry** -- Pre-built Staff templates for common roles. One-click setup to get started fast.

## Quick Start

**Prerequisites**

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated

**Install**

```bash
git clone https://github.com/koreanthinker/openstaff.git
cd openstaff
pnpm install
```

**Development**

```bash
pnpm dev
```

**Build**

```bash
# macOS
pnpm build:mac

# Linux
pnpm build:linux
```

## Architecture

OpenStaff is an **API-first** Electron app. The main process runs an Express REST API + WebSocket server. Both the Electron renderer and the optional Ngrok web UI consume the same API.

```
┌─────────────────────────────────────────────────┐
│                  Electron App                   │
│                                                 │
│  ┌──────────┐    ┌──────────────────────────┐   │
│  │ Renderer │    │      Main Process        │   │
│  │ (React)  │───>│  Express API + WebSocket │   │
│  └──────────┘    │                          │   │
│                  │  ┌────────────────────┐   │   │
│                  │  │   Staff Manager    │   │   │
│                  │  │  ┌──────────────┐  │   │   │
│                  │  │  │ AgentDriver  │  │   │   │
│                  │  │  │ (node-pty)   │  │   │   │
│                  │  │  └──────────────┘  │   │   │
│                  │  └────────────────────┘   │   │
│                  └──────────────────────────┘   │
└─────────────────────────────────────────────────┘
                         │
                    ~/.openstaff/
              (JSON config, JSONL logs)
```

- **No database.** All data lives on the filesystem under `~/.openstaff/`.
- **node-pty** spawns Claude Code CLI sessions as real PTY processes.
- **Electron IPC** is used only for native features (tray, notifications, file dialogs).

## Project Structure

```
src/
├── main/                  # Electron main process
│   ├── agent-driver/      # AgentDriver interface + Claude Code implementation
│   ├── api/               # Express REST API server + routes
│   ├── data/              # Filesystem data layer (JSON, JSONL)
│   ├── health-check/      # Staff health monitoring
│   ├── monitoring/        # Token usage parsing + metrics engine
│   ├── ngrok/             # Remote access tunnel
│   ├── staff-manager/     # Process lifecycle management
│   ├── store/             # electron-store config
│   └── tray/              # macOS menu bar tray
├── preload/               # Electron preload scripts
├── renderer/              # React frontend
│   └── src/
│       ├── components/    # UI components (shadcn/ui)
│       ├── pages/         # Route pages
│       ├── hooks/         # React hooks
│       ├── stores/        # Zustand stores
│       └── lib/           # Utilities
└── shared/                # Types shared between main + renderer
```

## Development

**Run tests**

```bash
# Unit + integration tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# E2E tests (requires built app)
pnpm test:e2e
```

**Lint and type check**

```bash
pnpm lint
pnpm type-check
```

**Code style**

- TypeScript strict mode
- Named exports only (no default exports)
- ES modules (no CommonJS)
- 2-space indentation
- Path alias: `@/` maps to `src/renderer/src/`

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) -- Copyright (c) 2026 Hyun Namgung
