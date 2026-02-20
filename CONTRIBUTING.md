# Contributing to OpenStaff

Thank you for your interest in contributing to OpenStaff! This guide will help you set up the project and understand the development workflow.

OpenStaff is an Electron desktop app that manages multiple AI coding agents (Staff) running 24/7. Think of it as PM2 for AI agents. Please read through this document before submitting your first contribution.

## Getting Started

### Prerequisites

- **Node.js** >= 22
- **pnpm** (package manager) -- install with `npm install -g pnpm`
- **macOS** or **Linux** (Ubuntu). Windows is not currently supported.

### Setup

1. **Fork** the repository on GitHub.

2. **Clone** your fork:

   ```bash
   git clone https://github.com/<your-username>/openstaff.git
   cd openstaff
   ```

3. **Install dependencies**:

   ```bash
   pnpm install
   ```

4. **Start the development server**:

   ```bash
   pnpm dev
   ```

   This launches the Electron app with hot-reload via `electron-vite`.

### Useful Commands

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `pnpm dev`           | Start the app in development mode  |
| `pnpm build`         | Build the app for production       |
| `pnpm lint`          | Run ESLint on `src/`               |
| `pnpm type-check`    | Run TypeScript type checking       |
| `pnpm test`          | Run unit/integration tests (Vitest)|
| `pnpm test:watch`    | Run tests in watch mode            |
| `pnpm test:coverage` | Run tests with coverage report     |
| `pnpm audit:prod`    | Audit production dependencies only |
| `pnpm test:e2e`      | Run end-to-end tests (Playwright, headless + hidden window) |
| `pnpm test:e2e:quick` | Run headless E2E without rebuild (fast local iteration) |
| `pnpm test:e2e:headed` | Run end-to-end tests in headed mode (requires `OPENSTAFF_ALLOW_HEADED=1`) |
| `pnpm test:e2e:ui`   | Run Playwright UI mode (requires `OPENSTAFF_ALLOW_HEADED=1`) |

## Development Workflow

### Branching

- Create a feature branch from `main`:

  ```bash
  git checkout -b feat/my-feature main
  ```

- Use descriptive branch names prefixed with the change type: `feat/`, `fix/`, `chore/`, `test/`.

### Commits

We use **Conventional Commits**. Every commit message must follow this format:

```
<type>: <short description>
```

Accepted types:

- `feat:` -- a new feature
- `fix:` -- a bug fix
- `test:` -- adding or updating tests
- `chore:` -- tooling, dependency updates, CI changes
- `refactor:` -- code restructuring without behavior change
- `docs:` -- documentation changes

**Feature-unit commits**: each commit should contain a test and the implementation that makes it pass, always leaving the codebase in a green (passing) state.

### Pull Requests

1. Make sure all tests pass locally (`pnpm test` and `pnpm lint`).
2. Run `pnpm type-check` to verify there are no type errors.
3. Open a PR against `main` with a clear title and description.
4. Link the relevant GitHub issue in the PR body (e.g., `Closes #12`).

## Code Style

### TypeScript

- **Strict mode** is enabled. Do not use `any` unless absolutely unavoidable.
- **Named exports only**. No default exports.
- **ES modules** (`import`/`export`). No CommonJS (`require`/`module.exports`).
- **2-space indentation**.

```typescript
// Good
export function createStaff(name: string): Staff {
  // ...
}

// Bad -- default export
export default function createStaff(name: string): Staff {
  // ...
}

// Bad -- any type
function processData(data: any) {
  // ...
}
```

### Imports

- Use the path alias `@/` which maps to `src/renderer/src/` for renderer imports:

  ```typescript
  import { Button } from '@/components/ui/button'
  import { useStaffStore } from '@/stores/staff-store'
  ```

- Keep imports organized: external packages first, then internal modules.

## Testing

### Philosophy: Strict TDD

**Write the test first**, then implement to make it pass. No exceptions.

### How to Run Tests

```bash
# Run all unit/integration tests
pnpm test

# Run a specific test by name
pnpm test -- --testNamePattern="creates a new staff"

# Run tests in watch mode during development
pnpm test:watch

# Run with coverage report
pnpm test:coverage

# Run end-to-end tests (requires the app to be buildable)
pnpm test:e2e

# Fast local reruns (skips build; use after at least one successful build)
pnpm test:e2e:quick

# Visual debugging mode (shows Electron window)
OPENSTAFF_ALLOW_HEADED=1 pnpm test:e2e:headed
```

### Test File Location

Place test files alongside the source file they test:

```
src/main/staff-manager/
  staff-manager.ts
  staff-manager.test.ts
```

### Mocking Policy: Minimal

- **Never** mock what you can test for real. Use real filesystem (`tmpdir`), real Express server, real processes.
- Integration tests must use real I/O. If a test mocks everything, it tests nothing.
- E2E tests use real Electron, real Claude Code, and real API. No mock agents in E2E.
- The only acceptable mocks are external services that are flaky or slow in unit tests (and even then, prefer real calls).
- Ask yourself: "Does this test prove the feature actually works?" If it only proves mocks return what you told them to, rewrite it.

### Coverage Target

We aim for **90%+ code coverage**. Run `pnpm test:coverage` to check.

## Design System

OpenStaff uses a **Bento Grid** style with compact rounded cards.

### Rules

1. **Never use hardcoded Tailwind colors** like `bg-gray-100`, `text-blue-500`, etc.
2. **Always use semantic CSS variables**:

   ```tsx
   // Good
   <div className="bg-background text-foreground">
   <div className="bg-card rounded-3xl">

   // Bad -- hardcoded colors
   <div className="bg-gray-100 text-gray-900">
   <div className="bg-white rounded-lg">
   ```

3. **Use the design system radius** (`--radius: 0.5rem`). Cards should use semantic radius tokens (`rounded-lg`, `rounded-md`, `rounded-sm`) or the equivalent CSS variable.

4. **Component library**: We use [shadcn/ui](https://ui.shadcn.com/) components built on Radix UI primitives. Prefer using existing components from `src/renderer/src/components/ui/` before creating new ones.

## Project Structure

```
openstaff/
  src/
    main/              # Electron main process (Node.js)
      agent-driver/    #   AgentDriver abstraction (Claude Code, future Codex)
      api/             #   Express REST API + WebSocket server
      data/            #   Filesystem data layer (JSON, JSONL)
      health-check/    #   Agent health monitoring
      ipc/             #   Electron IPC handlers (native features only)
      monitoring/      #   Resource usage monitoring
      staff-manager/   #   Staff lifecycle management
      store/           #   electron-store + safeStorage for settings
      tray/            #   System tray integration
      index.ts         #   Main process entry point
    preload/           # Electron preload scripts (bridge between main/renderer)
      index.ts
    renderer/          # React frontend (browser context)
      src/
        components/    #   UI components (shadcn/ui + custom)
        hooks/         #   React hooks
        lib/           #   Utility functions
        pages/         #   Page components (one per screen)
        stores/        #   Zustand state stores
        App.tsx        #   Root app component with routing
        main.tsx       #   Renderer entry point
    shared/            # Code shared between main and renderer
      types/           #   TypeScript type definitions
      constants.ts     #   Shared constants
      ansi-parser.ts   #   ANSI terminal output parser
  tests/               # E2E test files (Playwright)
  docs/                # Design documents and screen specs
```

### Key Architecture Decisions

- **API-first**: Both the Electron renderer and the Ngrok web UI hit the same Express REST API and WebSocket server running in the main process.
- **Electron IPC** is used only for native features (tray, notifications, file dialogs) -- not for data fetching.
- **Filesystem-only storage**: All data lives in `~/.openstaff/`. JSONL for time-series data, JSON for configuration. No database.
- **electron-vite** uses separate configs for main, preload, and renderer. Do not mix them.

## Reporting Issues

When opening an issue, please include:

1. **A clear title** describing the problem or feature request.
2. **Steps to reproduce** (for bugs): what you did, what you expected, what happened instead.
3. **Environment info**: OS (macOS version or Ubuntu version), Node.js version, pnpm version.
4. **Screenshots or logs** if applicable. Terminal output from `pnpm dev` is often helpful.
5. **Label** your issue appropriately: `bug`, `feature`, `docs`, `question`.

For security vulnerabilities, please do **not** open a public issue. Instead, email the maintainers directly.

## License

By contributing to OpenStaff, you agree that your contributions will be licensed under the [MIT License](LICENSE).
