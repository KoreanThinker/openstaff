# OpenStaff

Electron desktop app that manages multiple AI coding agents (Staff) running 24/7. Like PM2 for AI agents. Target users are non-developers.

## Tech Stack

- **Framework**: Electron + electron-vite
- **Frontend**: React + TypeScript + shadcn/ui + Tailwind CSS
- **State**: Zustand (client state) + TanStack Query (server state)
- **Backend**: Express API server in Electron main process
- **Data**: Filesystem only (JSON, JSONL). No database. electron-store + safeStorage for settings.
- **Process**: node-pty for spawning Claude Code CLI sessions
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Package Manager**: pnpm

## Architecture

- **API-first**: Both Electron renderer and Ngrok web UI hit the same Express REST API + WebSocket.
- **Electron IPC**: Only for native features (tray, notifications, file dialogs).
- **Filesystem-only storage**: All data in `~/.openstaff/`. JSONL for time-series, JSON for config.
- **AgentDriver interface**: Abstraction for Claude Code (MVP) and future Codex support.

## Code Style

- TypeScript strict mode. No `any` unless absolutely unavoidable.
- Named exports only. No default exports.
- ES modules (import/export). No CommonJS.
- 2-space indentation.
- Path alias: `@/` maps to `src/renderer/src/`.

## Design System

- Bento Grid style with heavily rounded cards (`--radius: 1.5rem`).
- NEVER use hardcoded Tailwind colors (`bg-gray-100`). Use semantic CSS variables (`bg-background`, `bg-card`, `text-foreground`).
- Full rules in `.claude/rules/design-system.md` (auto-loaded for renderer files).

## Testing

- Unit tests: `pnpm test`
- Single test: `pnpm test -- --testNamePattern="test name"`
- E2E tests: `pnpm test:e2e`
- Write tests alongside source: `foo.ts` → `foo.test.ts`

### Development Method: Strict TDD

Always write the test FIRST, then implement to make it pass. No exceptions.

### Mocking Policy: Minimal

- NEVER mock what you can test for real. Use real filesystem (tmpdir), real Express server, real processes.
- Integration tests must use real I/O. If a test mocks everything, it tests nothing.
- E2E tests use real Electron + real Claude Code + real API. No mock agents in E2E.
- The only acceptable mocks: external services that are flaky/slow in unit tests (and even then, prefer real calls).
- Ask yourself: "Does this test prove the feature actually works?" If it only proves mocks return what you told them to, rewrite it.

### Coverage Target: 90%+

### When to Run E2E

Run E2E tests locally when completing a significant feature or task. E2E is the final verification that a feature works end-to-end. If you want to be confident a task is truly done, run the relevant E2E suite.

- CI runs: unit + integration + E2E subset (no API key needed: wizard, staff CRUD, skills, settings, tray)
- Local runs: full E2E including real Claude Code tests (agent install, staff start/stop, health check)
- Cross-platform: test on macOS locally + Ubuntu via `ssh persly`

## Build & Dev

- Dev: `pnpm dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Type check: `pnpm type-check`

## Key Decisions

- No SQLite. Everything is filesystem-based.
- Staff working directories: `~/.openstaff/staffs/{staff-id}/`
- CLAUDE.md (per-staff) is auto-generated from staff.json. Never hand-edited.
- memory.md is the agent's territory. OpenStaff reads but never writes.
- Claude Code isolation: `--setting-sources project,local` + `--strict-mcp-config`

## Development Workflow

- **Phase 1 (Foundation)**: Sequential on main branch. Scaffolding, shared types, API server, App Shell, AgentDriver.
- **Phase 2 (Features)**: Parallel with 3-4 teammates on feature branches. Each teammate owns a screen + API + tests.
- **Commits**: Feature-unit commits. Each commit = test + implementation passing together. Always green state. Conventional commits (`feat:`, `test:`, `fix:`, `chore:`).
- **No PRs** during solo development. Direct push to main (Phase 1) or feature branch merge (Phase 2).
- **Skills**: None. CLAUDE.md covers everything needed. Create skills only when repeated patterns emerge.

## MVP Completion Criteria

The MVP is NOT done until ALL of the following are true:

1. All 10 E2E tests pass (both CI subset and local-only)
2. Unit/integration test coverage >= 90%
3. All 9 screens implemented per docs/screens/*.md specs
4. PRD 100% match verified
5. GitHub release v1.0.0 published with macOS (.dmg) and Ubuntu (.deb) binaries
6. Installed and running on macOS (this machine) AND Ubuntu (ssh persly)
7. A "Persly Aha Moment Finder" Staff created using ~/github/perslyai/persly/.env.local
8. Staff successfully completes 100 cycles monitored in real-time

**DO NOT STOP until all 8 criteria are met.**

## Common Gotchas

- Claude Code reads from terminal (pty), not stdin pipe. That's why we use node-pty.
- electron-vite uses separate configs for main/preload/renderer. Don't mix them.
- safeStorage only works after app 'ready' event. Don't access encrypted values before that.
- Electron main process runs in Node.js context; renderer runs in browser context.
