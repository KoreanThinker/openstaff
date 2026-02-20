# Settings

## Purpose

App-wide configuration screen. Users manage remote access (Ngrok), default agent/model preferences, app behavior (startup, theme), and view app info. All settings are stored in `~/.openstaff/config.json` via electron-store with sensitive values encrypted by safeStorage.

## Navigation

Accessed from the sidebar "Settings" icon (gear). This is a top-level page alongside Dashboard, Staff Detail, Skills, and Agents.

## Layout (ASCII Wireframe)

```
+--[Sidebar]--+-----------------------------------------------------+
|             |                                                       |
|  [icon]     |  Settings                                             |
|  [icon]     |                                                       |
|  [icon]     |  +-----------------------------------------------+   |
|  [icon]     |  | Remote Access                                  |   |
|  --------   |  | Ngrok API Key    [*************************]   |   |
|  [gear] <-- |  | Auth Password    [*************************]   |   |
|             |  | Status           ● Connected                   |   |
|             |  | Tunnel URL       https://abc123.ngrok.io [copy]|   |
|             |  +-----------------------------------------------+   |
|             |                                                       |
|             |  +------------------------+ +------------------------+|
|             |  | Defaults               | | App Behavior           ||
|             |  | Default Agent           | | Start on Login  [====]||
|             |  |  [Claude Code     v]   | | Show on Startup [====]||
|             |  | Default Model           | |                       ||
|             |  |  [Claude Sonnet 4.5 v]  | | Theme                 ||
|             |  |                         | | [Light|Dark|System]   ||
|             |  +------------------------+ +------------------------+|
|             |                                                       |
|             |  +-----------------------------------------------+   |
|             |  | About                                          |   |
|             |  | OpenStaff v1.0.0              [Check Updates]  |   |
|             |  | GitHub  Documentation                         |   |
|             |  +-----------------------------------------------+   |
+-------------+-------------------------------------------------------+
```

## Remote Access Section

**Card title:** "Remote Access"

This card manages the Ngrok tunnel for accessing the dashboard remotely from a phone or laptop.

| Element | Component | Details |
|---------|-----------|---------|
| Ngrok API Key | Password input | Masked by default. Small eye icon to toggle visibility. Placeholder: "ngrok_xxxxxxxxxxxxxxxx" |
| Auth Password | Password input | Masked by default. Eye toggle. Placeholder: "Set a password for remote access" |
| Connection Status | Status indicator + text | Dot indicator (bg-success + animate-status-pulse when connected, bg-muted-foreground when disconnected) followed by "Connected" or "Disconnected" |
| Tunnel URL | Read-only text + copy button | Displayed only when connected. Monospace font (font-mono text-sm). Copy icon button on the right. Shows full ngrok URL. |

**Behavior:**
- When API key is entered/changed, auto-save after debounce (500ms) and attempt connection.
- If connection fails, show inline error text in text-destructive below the status line.
- Auth Password is required before enabling the tunnel. If missing, show helper text: "Set an auth password to enable remote access."
- Both fields stored encrypted via safeStorage.

## Defaults Section

**Card title:** "Defaults"

Default agent and model for newly created Staff. Does not affect existing Staff.

| Element | Component | Details |
|---------|-----------|---------|
| Default Agent | Select dropdown | Options: "Claude Code", "Codex" (disabled/grayed with "Coming soon" tag). Uses shadcn Select. |
| Default Model | Select dropdown | Options filtered by selected agent. For Claude Code: Claude Sonnet 4.5, Claude Opus 4.6, Claude Haiku 4.5, etc. |

**Behavior:**
- When Default Agent changes, Default Model resets to the first available model for that agent.
- Auto-save on change (no explicit save button).
- Show helper text below the card: "Applied to new Staff only. Existing Staff keep their current agent and model."

## App Behavior Section

**Card title:** "App Behavior"

| Element | Component | Details |
|---------|-----------|---------|
| Start on Login | Toggle switch | shadcn Switch. Label on left, switch on right. |
| Show Window on Startup | Toggle switch | Same layout. When off, app starts minimized to tray. |
| Theme | Segmented control | Three segments: Light / Dark / System. Uses a pill-shaped segmented control (rounded-full). Active segment uses bg-primary text-primary-foreground. |

**Behavior:**
- Toggles auto-save immediately on change.
- Theme change applies instantly without page reload (CSS variable swap).
- "Start on Login" configures OS-level auto-start (Login Items on macOS, autostart on Linux).
- Helper text below Start on Login: "OpenStaff launches automatically when you log in."

## About Section

**Card title:** "About"

| Element | Component | Details |
|---------|-----------|---------|
| App Version | Text | "OpenStaff v{version}" in text-foreground. Version read from package.json. |
| Check for Updates | Button | Pill button (rounded-full), secondary variant. Shows spinner while checking. Result: "Up to date" or "Update available (v{x.y.z})" with a "Download" link. |
| GitHub | Link | External link icon + "GitHub". Opens repo in default browser. |
| Documentation | Link | External link icon + "Documentation". Opens docs URL in default browser. |

**Layout within card:**
- Version and Check Updates on the same row, left and right aligned.
- GitHub and Documentation links on the next row as inline links separated by a middle dot or spacing.

## Data Requirements

**Read on mount (GET /api/settings):**

```typescript
interface AppSettings {
  ngrok_api_key: string       // masked, only last 4 chars visible
  ngrok_auth_password: string // masked, only presence indicated (boolean)
  ngrok_status: 'connected' | 'disconnected' | 'connecting' | 'error'
  ngrok_url: string | null
  ngrok_error: string | null
  default_agent: 'claude-code' | 'codex'
  default_model: string
  start_on_login: boolean
  show_window_on_startup: boolean
  theme: 'light' | 'dark' | 'system'
  app_version: string
}
```

**Write on change (PATCH /api/settings):**

Each setting change sends a partial update:
```typescript
// Example: changing theme
PATCH /api/settings { "theme": "dark" }

// Example: updating ngrok key
PATCH /api/settings { "ngrok_api_key": "ngrok_xxxxxxxxxxxxxxxx" }
```

**Available agents/models (GET /api/agents):**

```typescript
interface AgentInfo {
  id: string           // 'claude-code' | 'codex'
  name: string
  available: boolean   // installed and API key configured
  models: string[]     // available model IDs
}
```

## Interactions

### Save Behavior: Auto-save

No explicit "Save" button. All settings auto-save on change.

- **Toggles & selects:** Save immediately on change.
- **Text inputs (API keys, password):** Save after 500ms debounce from last keystroke.
- **Feedback:** Brief success toast ("Settings saved") appears at bottom-right on successful save. Error toast on failure.
- **Optimistic updates:** UI updates immediately; rolls back on API error.

### Specific Interactions

| Action | Behavior |
|--------|----------|
| Enter Ngrok API Key | Debounced auto-save. Triggers connection attempt. Status changes to "Connecting..." with a subtle spinner. |
| Clear Ngrok API Key | Disconnects tunnel. Status returns to "Disconnected". Tunnel URL disappears. |
| Copy Tunnel URL | Click copy button. Button briefly shows checkmark icon. Toast: "URL copied to clipboard." |
| Change Default Agent | Model dropdown resets. Both values auto-saved. |
| Toggle Start on Login | Immediate save. OS-level auto-start configured. |
| Toggle Theme | Immediate visual change. Saved to config. |
| Check for Updates | Button shows loading spinner. After check: "Up to date" text replaces button temporarily (3s), or shows update prompt. |
| Click GitHub/Docs link | Opens URL in system default browser via Electron shell.openExternal(). |

## States

### Loading State
- Skeleton placeholders for each card while settings load from API.
- Cards maintain their layout dimensions during loading.

### Connected (Ngrok)
- Status dot: `bg-success animate-status-pulse`
- Status text: "Connected" in text-success
- Tunnel URL row visible with copy button

### Disconnected (Ngrok)
- Status dot: `bg-muted-foreground`
- Status text: "Disconnected" in text-muted-foreground
- Tunnel URL row hidden

### Connecting (Ngrok)
- Status dot replaced by a small spinner
- Status text: "Connecting..." in text-muted-foreground

### Error (Ngrok)
- Status dot: `bg-destructive`
- Status text: "Connection failed" in text-destructive
- Error detail text below: e.g., "Invalid API key" in text-sm text-destructive

### Empty/First Use
- Ngrok fields empty. Status shows "Disconnected".
- Defaults pre-populated: Claude Code + Claude Sonnet 4.5.
- Start on Login: on. Show Window on Startup: on. Theme: System.

## Responsive

The settings page is rendered inside the Electron window and the Ngrok web UI. Both share the same React components.

| Viewport | Layout |
|----------|--------|
| Desktop (>1024px) | Defaults and App Behavior cards side by side (2-column grid). Remote Access and About cards full width. |
| Tablet/Small window (768-1024px) | All cards stack vertically, full width. Sidebar collapses to icon-only. |
| Mobile/Ngrok web (<768px) | All cards stack vertically, full width. Sidebar remains collapsed; no dedicated bottom tab bar/hamburger in current implementation. |

Grid structure:
```
Desktop:
[Remote Access                               ] (col-span-2)
[Defaults          ] [App Behavior           ] (1 col each)
[About                                       ] (col-span-2)

Mobile:
[Remote Access ]
[Defaults      ]
[App Behavior  ]
[About         ]
```
