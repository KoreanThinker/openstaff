# App Shell

## Purpose

The App Shell is the shared layout wrapper rendered on every screen. It provides persistent navigation (sidebar), a contextual header bar, a notification system, and native OS integrations (system tray, window controls). Both the Electron renderer and the Ngrok web UI share this layout. The shell never unmounts -- only the content area swaps between pages.

---

## Layout

```
+--+----------------------------------------------------+
|  |  [Page Title]          [____Search____]  [+] [B] [T]|
|  +----------------------------------------------------|
|  |                                                     |
|Lo|                                                     |
|go|                                                     |
|  |                                                     |
|D |              CONTENT AREA                           |
|S |           (page-specific content)                   |
|A |                                                     |
|R |                                                     |
|Se|                                                     |
|  |                                                     |
|  |                                                     |
+--+-----------------------------------------------------+

Sidebar (expanded ~240px):         Sidebar (collapsed ~64px):
+------------------------+         +------+
| [Logo] OpenStaff       |         | [Lo] |
|------------------------|         |------|
| [ic] Dashboard         |         | [ic] |
| [ic] Skills        *   |         | [ic] |
| [ic] Agents            |         | [ic] |
| [ic] Registry          |         | [ic] |
| [ic] Settings          |         | [ic] |
|                        |         |      |
|                        |         |      |
| [<<] Collapse          |         | [>>] |
+------------------------+         +------+

Header Bar:
+------------------------------------------------------------------+
| Page Title              [  Search staffs, skills...  ]  [+] [B] [T] |
+------------------------------------------------------------------+
  [+] = Screen-specific action (e.g., "+ Create Staff")
  [B] = Notification bell
  [T] = Theme toggle (sun/moon)
```

### Structural markup (conceptual)

```
<div className="flex h-screen bg-background">
  {/* Sidebar */}
  <aside className="flex flex-col border-r border-border bg-card">
    ...nav items...
  </aside>

  {/* Main area */}
  <div className="flex flex-1 flex-col overflow-hidden">
    {/* Header */}
    <header className="flex items-center gap-4 border-b border-border bg-card px-6 h-14">
      ...title, search, actions...
    </header>

    {/* Content */}
    <main className="flex-1 overflow-y-auto p-6 bg-background">
      <Outlet />
    </main>
  </div>
</div>
```

---

## Sidebar Navigation

### Expanded State (~240px)

The sidebar sits on the left edge of the window. It uses `bg-card` with a right `border-border`. Per the design system, this is NOT a heavy edge-to-edge sidebar -- it is a discrete, minimal navigation panel that maintains the airy Bento feel.

**Structure (top to bottom):**

1. **Logo area** (h-14, vertically centered with header): App icon + "OpenStaff" wordmark. `text-foreground font-semibold text-lg`.
2. **Navigation items** (flex-col gap-1, px-3):
   - Dashboard (LayoutDashboard icon)
   - Skills (Puzzle icon)
   - Agents (Bot icon)
   - Registry (Store icon)
   - Settings (Settings icon)
3. **Spacer** (flex-1 to push collapse button to bottom)
4. **Collapse toggle** (bottom): Chevron-left icon button that collapses to icon-only mode.

**Nav item styling:**

```
/* Inactive */
<NavLink className="flex items-center gap-3 rounded-xl px-3 py-2.5
  text-muted-foreground hover:bg-muted hover:text-foreground
  transition-colors text-sm font-medium">
  <Icon className="h-5 w-5 shrink-0" />
  <span>Label</span>
</NavLink>

/* Active */
<NavLink className="... bg-muted text-foreground">
  ...
</NavLink>
```

- Active item: `bg-muted text-foreground rounded-xl` (soft background, rounded corners per design system rule 8).
- Hover on inactive: `hover:bg-muted hover:text-foreground`.
- Icons: Lucide icons, 20x20 (`h-5 w-5`).

### Collapsed State (~64px)

- Logo area shows only the app icon (no wordmark).
- Nav items show icon only, centered horizontally. Tooltip on hover shows the label.
- Collapse button becomes a chevron-right expand button.
- Transition: `transition-[width] duration-200 ease-in-out`.

### State persistence

Sidebar expanded/collapsed state is stored in Zustand (`useSidebarStore`) and persisted to localStorage so it survives page refreshes.

---

## Header Bar

Fixed height `h-14`. Uses `bg-card` with bottom `border-border`. Content is flex-row with items vertically centered.

### Left section: Page Title

- Dynamic text matching the current route (e.g., "Dashboard", "Staff Detail: Meta Ads Creative").
- `text-foreground font-semibold text-lg`.
- Updated via React context or Zustand store.

### Center section: Search Bar

- Pill-shaped input: `rounded-full bg-muted border-none px-4 py-2 w-80`.
- Placeholder: "Search staffs, skills..."
- Magnifying glass icon on the left inside the input.
- Searches across Staff names/roles and Skill names.
- Dropdown results list appears below on focus with results.
- Keyboard shortcut: Cmd+K (macOS) / Ctrl+K (Linux) to focus.

### Right section: Actions

Laid out as a flex row with `gap-2`:

1. **Screen-specific action button** (optional): Rendered by each page via a portal or context. Examples:
   - Dashboard: `<Button variant="default" size="sm" className="rounded-full">+ Create Staff</Button>`
   - Skills page: `<Button>+ Add Skill</Button>`
   - Other pages may have no action button.
2. **Notification bell**: Icon button. Shows a red dot badge (`bg-destructive`) when there are unread notifications.
3. **Theme toggle**: Sun icon (light) / Moon icon (dark). Uses `rounded-full` icon button. Toggles the `dark` class on `<html>`.

---

## System Tray (Native, Not React)

The system tray is managed entirely in the Electron main process via IPC. It is NOT rendered in the React UI.

### Tray Icon

- Uses a 16x16 / 22x22 template image (monochrome for macOS menu bar compatibility).
- macOS: Template image (black, auto-inverts in dark menu bar).
- Linux: Standard tray icon.

### Tray Menu

```
OpenStaff
----------------------------
[green dot] Meta Ads Creative (Cycle #47)
[green dot] pSEO Writer (Cycle #23)
[red dot]   Naver Cafe Marketer (Stopped)
----------------------------
Open Dashboard
Settings
----------------------------
Quit OpenStaff
```

- Staff list is dynamically built from the StaffManager state.
- Status indicators: green dot = running, red dot = stopped, yellow dot = error/backoff.
- Clicking a Staff item opens the dashboard and navigates to that Staff's detail page.
- "Open Dashboard" brings the main window to focus (or creates it if closed).
- "Settings" opens the main window to the Settings page.
- "Quit OpenStaff" triggers graceful shutdown: stops all Staff processes, then exits.

### Tray Click Behavior

- **macOS**: Left-click shows the menu (standard macOS behavior).
- **Linux**: Left-click toggles window visibility (show/hide). Right-click shows the menu.

### IPC Events

| Event (main -> renderer)    | Payload              | Purpose                               |
|-----------------------------|----------------------|---------------------------------------|
| `tray:open-dashboard`       | none                 | Open/focus main window                |
| `tray:open-settings`        | none                 | Navigate to settings page             |
| `tray:open-staff`           | `{ staffId: string }`| Navigate to specific staff detail     |

| Event (renderer -> main)    | Payload              | Purpose                               |
|-----------------------------|----------------------|---------------------------------------|
| `tray:update-staff-list`    | `StaffSummary[]`     | Update tray menu with latest statuses |

The tray menu is rebuilt whenever Staff statuses change, triggered by the StaffManager in the main process.

---

## Window Controls (Electron)

Follows the Docker Desktop model.

| Action              | Behavior                                                                 |
|---------------------|--------------------------------------------------------------------------|
| **Close (X)**       | Hides the window (minimize to tray). Staff keep running in background.   |
| **Minimize (-)**    | Minimizes to OS taskbar/dock. Standard OS behavior.                      |
| **Maximize**        | Toggles fullscreen/maximized window. Standard OS behavior.               |

### Implementation

```typescript
// main/index.ts
mainWindow.on('close', (event) => {
  if (!app.isQuitting) {
    event.preventDefault();
    mainWindow.hide();
  }
});

// Tray "Quit" sets app.isQuitting = true before app.quit()
app.on('before-quit', () => {
  app.isQuitting = true;
});
```

### Window Restore

When the user clicks the tray icon or "Open Dashboard":
- If window exists but is hidden: `mainWindow.show(); mainWindow.focus();`
- If window was destroyed: recreate BrowserWindow, load renderer.

### macOS-specific

- `mainWindow.setWindowButtonVisibility(true)` -- use native traffic lights.
- Consider `titleBarStyle: 'hiddenInset'` for a cleaner look where the sidebar extends to the top, with traffic lights inset into the sidebar area.

---

## Notification System

In-app toast notifications for real-time alerts. Native OS notifications are used in parallel for background alerts (when window is hidden).

### Toast Notifications (In-App)

**Position**: Top-right corner of the content area, stacked vertically with `gap-2`.

**Auto-dismiss**: 5 seconds. Click to navigate to relevant Staff detail. Manual dismiss via X button.

**Toast structure:**

```
+-------------------------------------------+
| [status dot] Staff Name                [X] |
| Brief message about the event              |
| 2 seconds ago                              |
+-------------------------------------------+
```

**Styling:**
- Container: `bg-card border border-border rounded-xl shadow-soft-float p-4`
- Dark mode: `dark:shadow-soft-float-dark`
- Width: `w-96` (384px)
- Stack limit: 3 visible toasts max. Older ones are queued.

### Notification Types

| Type           | Trigger                               | Dot Color        | Example Message                                    |
|----------------|---------------------------------------|------------------|----------------------------------------------------|
| **Error**      | Staff process crash                   | `bg-destructive` | "Meta Ads Creative crashed. Auto-restarting..."    |
| **Giveup**     | Agent writes to signals.jsonl         | `bg-destructive` | "pSEO Writer gave up: Cannot access GSC API"      |
| **Warning**    | Health check failure / backoff        | `bg-warning`     | "Naver Cafe Marketer entering backoff (attempt 3)" |
| **Stopped**    | Backoff limit exceeded                | `bg-muted-foreground` | "Naver Cafe Marketer stopped after 5 failures" |
| **Info**       | Staff started/stopped by user action  | `bg-success`     | "Meta Ads Creative started successfully"           |

### Native OS Notifications

Sent via Electron `Notification` API when the window is hidden/minimized:
- Same content as toast notifications.
- Clicking a native notification brings the window to front and navigates to the relevant Staff.

### Notification Bell (Header)

- Badge: red dot (`bg-destructive`, `w-2 h-2 rounded-full`) positioned top-right of the bell icon. Shown when unread count > 0.
- Click opens a dropdown panel listing recent notifications (last 20).
- Each item is clickable and navigates to the relevant Staff detail.
- "Mark all as read" button at the top of the panel.

### Implementation

Uses a Zustand store (`useNotificationStore`) fed by WebSocket events from the main process:
- `ws:staff:error` -> error toast
- `ws:staff:giveup` -> giveup toast
- `ws:staff:health-warning` -> warning toast
- `ws:staff:stopped` -> stopped toast

---

## Dark Mode Toggle

### Approach

Uses the standard `class` strategy for Tailwind dark mode:
- A `dark` class on the `<html>` element toggles between light and dark themes.
- All colors are driven by CSS variables in `global.css`, so toggling the class swaps the entire palette automatically.
- Explicit `dark:` Tailwind variants are rarely needed.

### Toggle behavior

1. User clicks the sun/moon icon in the header.
2. Zustand store (`useThemeStore`) updates the theme value (`"light" | "dark" | "system"`).
3. Effect applies/removes the `dark` class on `<html>`.
4. Preference persisted to localStorage.
5. On app load, check localStorage first. If "system", use `prefers-color-scheme` media query.

### States

| Setting    | Behavior                                                   | Icon     |
|------------|------------------------------------------------------------|----------|
| **Light**  | Force light mode                                           | Sun      |
| **Dark**   | Force dark mode                                            | Moon     |
| **System** | Follow OS preference (auto-switch)                         | Monitor  |

Cycle order on click: Light -> Dark -> System -> Light.

---

## Responsive Behavior

### Electron Desktop (Primary)

- **>= 1024px**: Sidebar expanded (240px). Full header with search bar.
- **768px - 1023px**: Sidebar auto-collapses to icon-only mode (64px). Search bar shrinks.
- **< 768px**: Sidebar hidden. Hamburger menu icon appears in the header to toggle a slide-over sidebar.

### Ngrok Web UI (Phone/Tablet)

When accessed via Ngrok on a mobile browser:

- Sidebar is hidden by default.
- A hamburger icon in the top-left of the header toggles a full-screen overlay navigation.
- Search is accessible via the Cmd+K shortcut or a search icon that expands the input.
- Toast notifications stack at the top of the viewport.
- Header action buttons remain visible.

### Implementation

```typescript
// useSidebarStore.ts
interface SidebarState {
  expanded: boolean;
  mobileOpen: boolean;
  toggle: () => void;
  setMobileOpen: (open: boolean) => void;
}
```

- `expanded`: Controls desktop expanded/collapsed.
- `mobileOpen`: Controls mobile slide-over visibility.
- On window resize (via `useMediaQuery` hook), auto-collapse/expand based on breakpoints.

---

## Electron-specific Behaviors

### IPC Communication (Native Features Only)

Per the architecture, IPC is used ONLY for native features. All data operations go through the Express API.

| IPC Channel                  | Direction        | Purpose                                      |
|------------------------------|------------------|----------------------------------------------|
| `window:close`               | renderer -> main | Request hide-to-tray                         |
| `window:minimize`            | renderer -> main | Minimize to taskbar                          |
| `window:maximize`            | renderer -> main | Toggle maximize                              |
| `theme:changed`              | renderer -> main | Sync theme to native tray/notifications      |
| `tray:open-dashboard`        | main -> renderer | Navigate to dashboard                        |
| `tray:open-settings`         | main -> renderer | Navigate to settings                         |
| `tray:open-staff`            | main -> renderer | Navigate to staff detail                     |
| `notification:click`         | main -> renderer | User clicked a native notification           |
| `dialog:open-file`           | renderer -> main | Open native file picker (skill import, etc.) |

### Preload Script

Exposes a typed `window.electronAPI` object via contextBridge:

```typescript
// preload/index.ts
contextBridge.exposeInMainWorld('electronAPI', {
  window: {
    close: () => ipcRenderer.send('window:close'),
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
  },
  theme: {
    onChange: (cb: (theme: string) => void) =>
      ipcRenderer.on('theme:changed', (_, theme) => cb(theme)),
  },
  notification: {
    onClick: (cb: (staffId: string) => void) =>
      ipcRenderer.on('notification:click', (_, staffId) => cb(staffId)),
  },
  dialog: {
    openFile: (opts: OpenDialogOptions) =>
      ipcRenderer.invoke('dialog:open-file', opts),
  },
  isElectron: true,
});
```

### Ngrok Web Compatibility

The renderer detects the environment via `window.electronAPI?.isElectron`:
- **Electron**: Uses IPC for window controls, native notifications, file dialogs.
- **Web (Ngrok)**: Hides window control buttons, uses browser Notification API (if permitted), uses `<input type="file">` for file selection.

### Auto-start on Login

Configured in Settings. Uses Electron's `app.setLoginItemSettings()`:

```typescript
app.setLoginItemSettings({
  openAtLogin: true,
  openAsHidden: !config.show_window_on_startup,
});
```

When `show_window_on_startup` is false, the app starts minimized to tray (window is not created until user clicks tray icon).
