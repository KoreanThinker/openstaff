# Skills

## Purpose

The Skills screen lets users manage Claude Code Agent Skills -- the modular capabilities that Staff use to connect to external services, collect data, and perform specialized work. Users can browse installed skills, add new ones (from local filesystem or GitHub registry), configure authentication (API keys/tokens), and remove skills they no longer need.

This is the central hub for all skill lifecycle management. Non-developers should be able to install a skill and configure its credentials without touching any files or code.

---

## Navigation

- **Sidebar icon**: Puzzle piece icon
- **Route**: `/skills`
- **Breadcrumb**: Skills (top-level page, no sub-routes)
- **Entry points**: Sidebar nav, Staff creation form "Manage Skills" link, Staff detail "Skills" section

---

## Layout

```
+------------------------------------------------------------------+
|  [icon] sidebar                                                   |
|  +--------------------------------------------------------------+|
|  |  Skills                                    [+ Add Skill]     ||
|  |                                                               ||
|  |  [Search skills...]              [All] [Active] [Needs Auth] ||
|  |                                                               ||
|  |  +---------------------------+  +---------------------------+||
|  |  | [icon]                    |  | [icon]                    |||
|  |  | Instagram API             |  | Meta Ads API              |||
|  |  | Connect to Instagram...   |  | Manage Meta advertising..||||
|  |  |                           |  |                           |||
|  |  | [Active]    3 Staff using |  | [Needs Auth]  1 Staff    |||
|  |  +---------------------------+  +---------------------------+||
|  |                                                               ||
|  |  +---------------------------+  +---------------------------+||
|  |  | [icon]                    |  | [icon]                    |||
|  |  | Google Search Console     |  | Web Scraping              |||
|  |  | Track search performance..|  | Scrape and parse web...   |||
|  |  |                           |  |                           |||
|  |  | [Active]    2 Staff using |  | [Active]    4 Staff using |||
|  |  +---------------------------+  +---------------------------+||
|  |                                                               ||
|  +--------------------------------------------------------------+|
+------------------------------------------------------------------+
```

The main content area uses a responsive card grid. Each skill is a Bento-style card. The top bar contains the page title, a search input, filter pills, and the primary "Add Skill" action button.

---

## Skill List / Grid

### Card Design

Each skill card follows the Bento Grid style: `<Card>` with default `--radius` (0.5rem), subtle `border-border`, no shadow.

```
+-----------------------------------------------+
|                                                 |
|  [Skill Icon]                          [...]   |
|                                                 |
|  Skill Name                                     |
|  Short description from SKILL.md (2 lines max) |
|                                                 |
|  [Status Badge]           N Staff using         |
|                                                 |
+-----------------------------------------------+
```

**Card elements:**

| Element | Source | Style |
|---|---|---|
| Icon | First letter fallback or category icon | `w-10 h-10 rounded-xl bg-muted` centered letter in `text-foreground` |
| Name | `name` from SKILL.md frontmatter | `text-base font-medium text-foreground` |
| Description | `description` from SKILL.md frontmatter | `text-sm text-muted-foreground`, truncated to 2 lines |
| Status badge | Derived from auth config state | `rounded-full` pill (see below) |
| Staff count | Count of Staff with this skill in `staff.json` | `text-sm text-muted-foreground` |
| Overflow menu | `[...]` icon button | Edit, Configure Auth, Delete actions |

### Status Badges

Pill-shaped badges (`rounded-full`, `px-3 py-1`, `text-xs font-medium`):

| Status | Meaning | Style |
|---|---|---|
| **Active** | All required env vars configured | `bg-success/15 text-success` |
| **Needs Auth** | Has required env vars, but some are missing | `bg-warning/15 text-warning` |
| **Not Configured** | No required env vars (no auth needed) OR freshly installed | `bg-muted text-muted-foreground` |

**Determining status:**
1. Parse SKILL.md `compatibility` field for required env var names (e.g., "Requires INSTAGRAM_ACCESS_TOKEN").
2. If no env vars required: **Active** (skill works out of the box).
3. If env vars required and all present in encrypted config: **Active**.
4. If env vars required and some/all missing: **Needs Auth**.

### Grid Layout

- Desktop: 2-column grid (`grid grid-cols-2 gap-4`)
- Narrower viewports: single column (`grid grid-cols-1 gap-4`)
- Cards have equal height within each row (CSS grid handles this)

### Search & Filter Bar

```
[Search skills...]              [All] [Active] [Needs Auth]
```

- **Search**: Filters by skill name and description. Debounced input (300ms). Uses `<Input>` from shadcn/ui.
- **Filter pills**: `rounded-full` toggle buttons. Active pill uses `bg-primary text-primary-foreground`. Inactive pills use `bg-muted text-muted-foreground`.
- Filters are combinable: search text + status filter.

---

## Skill Detail Panel

Clicking a skill card opens a **slide-over panel** from the right side (not a modal, to maintain context of the grid). The panel overlays the grid with a backdrop.

```
+------------------------------------------------------------------+
|  Skills                     |  +-------------------------------+ |
|                              |  | [<- Back]          [Delete]  | |
|  (grid cards dimmed behind)  |  |                              | |
|                              |  | [Icon]                       | |
|                              |  | Instagram API        [Active]| |
|                              |  | v1.2 by openstaff            | |
|                              |  |                              | |
|                              |  | -- Description ------------ | |
|                              |  | Full SKILL.md rendered      | |
|                              |  | content here as markdown.   | |
|                              |  |                              | |
|                              |  | -- Authentication --------- | |
|                              |  | INSTAGRAM_ACCESS_TOKEN      | |
|                              |  | [***********************]   | |
|                              |  | [Save]                      | |
|                              |  |                              | |
|                              |  | -- Connected Staff -------- | |
|                              |  | * Meta Ads Creative (Running| |
|                              |  | * Social Monitor (Stopped)  | |
|                              |  |                              | |
|                              |  | -- Source ------------------ | |
|                              |  | Local import                | |
|                              |  | Installed 2026-02-15        | |
|                              |  +-------------------------------+ |
+------------------------------------------------------------------+
```

### Panel Sections

**Header:**
- Back arrow button (closes panel)
- Skill icon, name, status badge
- Version and author from SKILL.md `metadata` frontmatter
- Delete button (icon, top-right, `text-destructive` on hover)

**Description:**
- Full SKILL.md markdown body rendered as HTML
- Uses `prose` / `prose-sm` typography with `text-foreground` overrides
- Read-only display

**Authentication:**
- Only shown if the skill declares required env vars in `compatibility`
- Each env var gets a labeled input field
- Fields use `type="password"` with a show/hide toggle
- Pre-filled with masked value if already configured (shows `*****`)
- "Save" button stores values encrypted via `safeStorage` in `config.json`
- After saving, status badge updates immediately (Needs Auth -> Active)

**Connected Staff:**
- List of Staff that have this skill in their `skills` array
- Each entry shows Staff name and current status indicator dot (Running/Stopped/Error)
- Clicking a Staff name navigates to that Staff's detail page
- If no Staff are connected: "No Staff are using this skill."

**Source:**
- Shows whether the skill was imported locally or downloaded from registry
- Installation date
- If from registry: "Check for updates" link

---

## Add Skill Flow

The "+ Add Skill" button opens a **modal dialog** with two tabs:

```
+-----------------------------------------------+
|  Add Skill                              [X]    |
|                                                 |
|  [Local Import]  [GitHub Registry]              |
|                                                 |
|  +-----------------------------------------+   |
|  |                                         |   |
|  |  (Tab content here)                     |   |
|  |                                         |   |
|  +-----------------------------------------+   |
|                                                 |
+-----------------------------------------------+
```

### Tab 1: Local Import

```
+-----------------------------------------+
|                                          |
|  Select a skill directory that contains  |
|  a SKILL.md file.                        |
|                                          |
|  [Browse...]                             |
|                                          |
|  (After selection:)                      |
|  +------------------------------------+  |
|  | instagram-api/                     |  |
|  |   SKILL.md                         |  |
|  |   scripts/fetch.py                 |  |
|  |   references/api-docs.md           |  |
|  +------------------------------------+  |
|                                          |
|  Name: Instagram API                     |
|  Description: Connect to Instagram...    |
|  Required Auth: INSTAGRAM_ACCESS_TOKEN   |
|                                          |
|              [Cancel]  [Import Skill]    |
|                                          |
+-----------------------------------------+
```

**Flow:**
1. User clicks "Browse..." -- triggers Electron file dialog (IPC) to select a directory.
2. App validates the directory contains a valid `SKILL.md` with proper YAML frontmatter.
3. Shows preview: directory tree, parsed name/description, required env vars.
4. On "Import Skill": copies the entire directory to `~/.openstaff/skills/{skill-name}/`.
5. If a skill with the same name already exists: show warning dialog ("Skill already exists. Replace?").

**Validation errors:**
- No SKILL.md found: "Selected directory does not contain a SKILL.md file."
- Invalid YAML frontmatter: "SKILL.md has invalid frontmatter. Required fields: name, description."

### Tab 2: GitHub Registry

```
+-----------------------------------------+
|                                          |
|  [Search registry skills...]             |
|                                          |
|  +------------------------------------+  |
|  | Instagram API              [Install]|  |
|  | Connect to Instagram Graph API     |  |
|  +------------------------------------+  |
|  | Meta Ads API               [Install]|  |
|  | Manage Meta advertising campaigns  |  |
|  +------------------------------------+  |
|  | Google Search Console      [Install]|  |
|  | Track search performance and...    |  |
|  +------------------------------------+  |
|  | Web Scraping              [Installed]|  |
|  | Scrape and parse web content       |  |
|  +------------------------------------+  |
|                                          |
|                            [Cancel]      |
|                                          |
+-----------------------------------------+
```

**Flow:**
1. Fetches skill list from GitHub registry (`registry/skills/` in the repo).
2. Displays as a scrollable list with search.
3. Already-installed skills show "Installed" badge (disabled, `bg-muted text-muted-foreground`).
4. Click "Install" downloads the skill directory to `~/.openstaff/skills/{skill-name}/`.
5. Shows progress indicator during download.
6. After install: skill appears in the main grid. If auth is required, status is "Needs Auth".

**Error states:**
- Network error: "Could not connect to registry. Check your internet connection."
- Empty registry: "No skills available in the registry yet."

---

## Auth Configuration

Auth can be accessed from two places:
1. The skill detail panel "Authentication" section
2. The overflow menu "Configure Auth" on each skill card

### Auth Form

```
+-----------------------------------------------+
|  Configure Authentication                      |
|                                                 |
|  Instagram API requires the following           |
|  credentials to function:                       |
|                                                 |
|  INSTAGRAM_ACCESS_TOKEN                         |
|  [________________________________] [eye icon]  |
|                                                 |
|  INSTAGRAM_APP_SECRET                           |
|  [________________________________] [eye icon]  |
|                                                 |
|  Values are encrypted and stored securely       |
|  using your OS keychain.                        |
|                                                 |
|              [Cancel]  [Save Credentials]        |
|                                                 |
+-----------------------------------------------+
```

**Behavior:**
- Env var names parsed from SKILL.md `compatibility` field.
- Each env var rendered as a labeled password input with show/hide toggle.
- If a value was previously saved, input shows masked placeholder (`*****`). Saving an empty field does NOT clear the existing value (user must explicitly clear).
- "Save Credentials" encrypts each value with `safeStorage` and stores in `config.json` under a `skills.{skill-name}.env` key.
- After save: update skill status badge. If all required vars are now set, status becomes "Active".
- These env vars are injected into the Staff agent process at spawn time.

**Security note (displayed in UI):**
"Values are encrypted and stored securely using your OS keychain."

---

## Delete Skill

Triggered from the skill detail panel header or the card overflow menu.

### Warning Dialog (Staff are using this skill)

```
+-----------------------------------------------+
|  Delete Skill                                   |
|                                                 |
|  Are you sure you want to delete                |
|  "Instagram API"?                               |
|                                                 |
|  [!] This skill is currently used by:           |
|    - Meta Ads Creative Designer (Running)       |
|    - Social Monitor (Stopped)                   |
|                                                 |
|  Deleting will remove this skill from all       |
|  connected Staff. Running Staff will be          |
|  restarted without this skill.                  |
|                                                 |
|              [Cancel]  [Delete Skill]            |
|                                                 |
+-----------------------------------------------+
```

### Warning Dialog (no Staff using this skill)

```
+-----------------------------------------------+
|  Delete Skill                                   |
|                                                 |
|  Are you sure you want to delete                |
|  "Instagram API"?                               |
|                                                 |
|  This action cannot be undone.                  |
|                                                 |
|              [Cancel]  [Delete Skill]            |
|                                                 |
+-----------------------------------------------+
```

**Flow:**
1. Show appropriate warning dialog.
2. On confirm:
   a. Remove symlinks from all affected Staff working directories (`.claude/skills/{skill-name}`).
   b. Remove skill from each affected Staff's `staff.json` `skills` array.
   c. Regenerate CLAUDE.md for affected Staff.
   d. Restart any running affected Staff.
   e. Delete the skill directory from `~/.openstaff/skills/{skill-name}/`.
   f. Remove associated env var entries from `config.json`.
3. Show toast notification: "Skill deleted successfully."

**Delete button style:** `variant="destructive"` from shadcn/ui Button.

---

## Data Requirements

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/skills` | List all installed skills with status |
| `GET` | `/api/skills/:name` | Get skill detail (parsed SKILL.md, auth status, connected Staff) |
| `POST` | `/api/skills/import` | Import skill from local path |
| `POST` | `/api/skills/install` | Download and install from registry |
| `PUT` | `/api/skills/:name/auth` | Save encrypted auth credentials |
| `DELETE` | `/api/skills/:name` | Delete skill (handles Staff cleanup) |
| `GET` | `/api/registry/skills` | List available skills from GitHub registry |

### Data Structures

**Skill (list item):**
```typescript
interface SkillSummary {
  name: string               // from SKILL.md frontmatter
  description: string        // from SKILL.md frontmatter
  authStatus: 'active' | 'needs-auth' | 'not-configured'
  connectedStaffCount: number
  source: 'local' | 'registry'
  installedAt: string        // ISO 8601
}
```

**Skill (detail):**
```typescript
interface SkillDetail extends SkillSummary {
  version: string            // from metadata.version
  author: string             // from metadata.author
  allowedTools: string       // from allowed-tools
  requiredEnvVars: string[]  // parsed from compatibility
  configuredEnvVars: string[] // which env vars have saved values
  markdownContent: string    // full SKILL.md body (below frontmatter)
  connectedStaff: Array<{
    id: string
    name: string
    status: 'running' | 'stopped' | 'error'
  }>
}
```

### Filesystem Reads

- `~/.openstaff/skills/` -- directory listing for installed skills
- `~/.openstaff/skills/{name}/SKILL.md` -- parse frontmatter + body
- `~/.openstaff/staffs/*/staff.json` -- scan for skill references
- `~/.openstaff/config.json` -- read encrypted auth values (presence check only)

---

## Interactions

| Action | Trigger | Result |
|---|---|---|
| Click skill card | Card click | Open detail slide-over panel |
| Search skills | Type in search input | Filter visible cards (debounced 300ms) |
| Filter by status | Click filter pill | Show only matching status cards |
| Add skill (local) | Browse -> select dir -> Import | Copies to skills dir, appears in grid |
| Add skill (registry) | Search -> Install | Downloads to skills dir, appears in grid |
| Configure auth | Fill env var fields -> Save | Encrypts and stores, updates status badge |
| Delete skill | Confirm dialog -> Delete | Removes skill, cleans up Staff references |
| Click connected Staff | Staff name in detail panel | Navigate to Staff detail page |
| Overflow menu | `[...]` on card | Dropdown: Configure Auth, Delete |

---

## States

### Empty State (no skills installed)

```
+-----------------------------------------------+
|                                                 |
|          [puzzle piece illustration]             |
|                                                 |
|          No skills installed yet                |
|                                                 |
|  Skills give your Staff superpowers --          |
|  connecting them to APIs, data sources,          |
|  and tools they need to do their job.           |
|                                                 |
|          [+ Add Your First Skill]               |
|                                                 |
+-----------------------------------------------+
```

- Centered content within the main area.
- CTA button opens the Add Skill modal.
- `text-muted-foreground` for description text.

### Loading State

- Skeleton cards (2x2 grid of `<Skeleton>` components from shadcn/ui matching card dimensions).
- Skeleton has `rounded-[var(--radius)]` to match card shape.

### Search / Filter: No Results

```
+-----------------------------------------------+
|                                                 |
|  No skills match your search.                   |
|  Try a different search term or clear filters.  |
|                                                 |
+-----------------------------------------------+
```

- `text-muted-foreground`, centered in the grid area.

### Error State (failed to load skills)

```
+-----------------------------------------------+
|                                                 |
|  Could not load skills.                         |
|  [Retry]                                        |
|                                                 |
+-----------------------------------------------+
```

- `text-destructive` for the error message.
- Retry button uses `variant="outline"`.

---

## Responsive

| Viewport | Layout |
|---|---|
| Desktop (>= 1024px) | 2-column card grid, slide-over panel occupies ~400px from right |
| Tablet (768px - 1023px) | 2-column card grid, slide-over panel becomes full-width overlay |
| Narrow (< 768px) | 1-column card grid, slide-over panel becomes full-width overlay |

- Search bar and filter pills stack vertically on narrow viewports.
- Add Skill modal becomes nearly full-width on narrow viewports with internal padding preserved.
- Card content remains the same across all viewports (no hidden elements).
