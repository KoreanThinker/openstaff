# 👥 OpenStaff — AI Staff Operations

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/KoreanThinker/openstaff/main/build/logo-wordmark.svg">
    <img src="https://raw.githubusercontent.com/KoreanThinker/openstaff/main/build/logo-wordmark-dark.svg" alt="OpenStaff" width="460">
  </picture>
</p>

<p align="center">
  <strong>Hire your AI staff. Let them work 24/7.</strong>
</p>

<p align="center">
  <a href="https://github.com/KoreanThinker/openstaff/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/KoreanThinker/openstaff/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/KoreanThinker/openstaff/releases"><img src="https://img.shields.io/github/v/release/KoreanThinker/openstaff?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/KoreanThinker/openstaff?style=for-the-badge" alt="MIT License"></a>
</p>

**OpenStaff** is a local-first desktop app for operating multiple AI coding agents like a real team.
Each Staff runs a continuous loop: **Gather -> Execute -> Evaluate**.
You define each role in plain language, attach skills, and monitor outcomes from one dashboard.

[Releases](https://github.com/KoreanThinker/openstaff/releases) · [Product Docs](docs/PRD.md) · [Screen Specs](docs/screens) · [Security](SECURITY.md)

Preferred setup: install the desktop app from [Releases](https://github.com/KoreanThinker/openstaff/releases).

## Install (recommended)

Download the latest app package from [Releases](https://github.com/KoreanThinker/openstaff/releases).

- macOS: `.dmg`
- Linux: `.AppImage` / `.deb`

## Quick start (TL;DR)

Runtime: **Node >= 22**, **pnpm >= 9**.

```bash
git clone https://github.com/KoreanThinker/openstaff.git
cd openstaff
pnpm install
pnpm dev
```

## From source (development)

Build distributable packages:

```bash
pnpm build:mac
pnpm build:linux
```

## Security defaults (remote access)

- Remote access is **off** by default.
- Ngrok tunnel requires both API key and auth password.
- Sensitive values are encrypted in local config (`electron-store` + `safeStorage`).

Full details: [SECURITY.md](SECURITY.md)

## Highlights

- **Infinite operations loop**: every Staff continuously runs Gather -> Execute -> Evaluate.
- **Multi-agent support**: run Staff with Claude Code, OpenAI Codex, or Google Gemini CLI.
- **Multi-staff orchestration**: run specialized Staff in parallel for different business functions.
- **Live monitoring**: track cycles, token usage, costs, logs, and KPIs in real time.
- **Skill system**: install reusable `SKILL.md` skills from registry or local folders.
- **Remote dashboard access**: connect securely through Ngrok with password protection.
- **Slack alerts**: optional webhook alerts for staff errors, pauses, and budget warnings.
- **Local-first storage**: data stays on your machine under `~/.openstaff`.

## How it works (short)

```text
┌──────────────────────────────────────────────┐
│                OpenStaff App                 │
│                                              │
│  React UI  <-->  Main Process API/WebSocket │
│                      │                       │
│                 Staff Manager                │
│                      │                       │
│   Agent Drivers (Claude/Codex/Gemini CLI)    │
└──────────────────────────────────────────────┘
                       │
                 ~/.openstaff/
```

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=KoreanThinker/openstaff&type=Date)](https://www.star-history.com/#KoreanThinker/openstaff&Date)

## License

[MIT](LICENSE)
