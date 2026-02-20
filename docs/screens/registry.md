# Registry

## Purpose

The Registry screen is an in-app marketplace for discovering, browsing, and installing Staff templates and Skills from the OpenStaff GitHub repository. It serves as the primary onboarding accelerator -- non-developer users can find a pre-built Staff template, download it, and have a running Staff within minutes without writing any configuration from scratch.

Backed by the repository's `registry/` directory:
- `registry/templates/*.json` -- Staff templates (pre-configured staff.json files)
- `registry/skills/*/SKILL.md` -- Skills with scripts and assets

---

## Navigation

Accessed via the sidebar navigation icon (shopping bag or grid icon). The nav item label is "Registry". When the user first completes the Setup Wizard and has no Staff yet, the dashboard "Create your first Staff" CTA also links here.

---

## Layout

```
+------------------------------------------------------------------+
|  [icon] Registry                                                  |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  [Q Search templates and skills...]            [Templates | Skills]  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  ( All )  ( Marketing )  ( SEO )  ( Dev )  ( Analytics )  ...    |
|                                                                   |
|  +----------------+  +----------------+  +----------------+       |
|  | +-----------+  |  | +-----------+  |  | +-----------+  |       |
|  | | Gradient  |  |  | | Gradient  |  |  | | Gradient  |  |       |
|  | | Thumbnail |  |  | | Thumbnail |  |  | | Thumbnail |  |       |
|  | +-----------+  |  | +-----------+  |  | +-----------+  |       |
|  |                |  |                |  |                |       |
|  | Meta Ads       |  | pSEO Agent    |  | Naver Cafe     |       |
|  | Creative       |  |               |  | Marketing      |       |
|  | Designer       |  | SEO content   |  |                |       |
|  |                |  | strategist... |  | Naver Cafe     |       |
|  | Meta ads       |  |               |  | community...   |       |
|  | creative...    |  | (SEO)         |  |                |       |
|  |                |  |               |  | (Marketing)    |       |
|  | (Marketing)    |  | [2 skills]    |  |                |       |
|  |                |  |               |  | [2 skills]     |       |
|  | [3 skills]     |  | [ Download ]  |  |                |       |
|  |                |  +----------------+  | [ Download ]   |       |
|  | [ Download ]   |                      +----------------+       |
|  +----------------+                                               |
|                                                                   |
|  +----------------+  +----------------+  +----------------+       |
|  | ...            |  | ...            |  | ...            |       |
|  +----------------+  +----------------+  +----------------+       |
+------------------------------------------------------------------+
```

The page is a single scrollable view. The top area is fixed with the search bar and tab toggle, followed by category pills. Below is a responsive card grid.

---

## Tab: Templates

The default tab. Displays Staff templates from `registry/templates/*.json`.

Each template card shows enough information for the user to understand what the Staff does and what it needs before downloading.

### Template JSON shape (from GitHub)

```json
{
  "openstaff_version": "1.0.0",
  "type": "staff",
  "name": "Meta Ads Creative Designer",
  "role": "Meta ads creative designer",
  "category": "marketing",
  "description": "Creates daily ad creatives with A/B variants based on trending content.",
  "gather": "Collect trending posts from Instagram and X for the last 3 days...",
  "execute": "Create 3 ad creatives with A/B test variants...",
  "evaluate": "Check CPI, CPM, CTR from Meta Ads dashboard...",
  "kpi": "CPI < $2.00, CTR > 3%, daily creatives >= 3",
  "required_skills": ["instagram", "meta-ads-api", "image-generation"],
  "recommended_agent": "claude-code",
  "recommended_model": "claude-sonnet-4-5",
  "author": "openstaff"
}
```

### Template Card Content

```
+---------------------------+
|  +---------------------+  |
|  |                     |  |
|  |  Category-colored   |  |
|  |  gradient block     |  |
|  |  with icon overlay  |  |
|  |                     |  |
|  +---------------------+  |
|                           |
|  Meta Ads Creative        |  <-- name (font-semibold, text-foreground)
|  Designer                 |
|                           |
|  Meta ads creative        |  <-- role (text-sm, text-muted-foreground)
|  designer                 |
|                           |
|  (Marketing)              |  <-- category pill (rounded-full, bg-muted)
|                           |
|  Skills: instagram,       |  <-- required_skills count or list
|  meta-ads-api +1          |
|                           |
|  [ Download ]             |  <-- action button (rounded-full pill)
+---------------------------+
```

- **Thumbnail**: A gradient block using category-specific color pairs (e.g., Marketing = pink-to-orange gradient, SEO = blue-to-cyan, Dev = purple-to-indigo). Uses `chart-1` through `chart-5` palette mapped to categories. A subtle icon in the center represents the category.
- **Name**: Primary label. `text-base font-semibold text-foreground`.
- **Role**: One-line job title. `text-sm text-muted-foreground`. Truncate with ellipsis at 2 lines.
- **Category pill**: `rounded-full bg-muted text-muted-foreground text-xs px-3 py-1`.
- **Required skills**: Show first 2 skill names + "+N" if more. `text-xs text-muted-foreground`.
- **Download button**: `rounded-full` pill button at the card bottom.

---

## Tab: Skills

Displays Skills from `registry/skills/*/SKILL.md`. Each skill directory contains a `SKILL.md` with YAML frontmatter.

### Skill Card Content

```
+---------------------------+
|  +---------------------+  |
|  |                     |  |
|  |  Gradient block     |  |
|  |  (skill category)   |  |
|  |                     |  |
|  +---------------------+  |
|                           |
|  Instagram Skill          |  <-- name (font-semibold)
|                           |
|  Connect to Instagram     |  <-- description (text-sm, text-muted-foreground)
|  API for collecting...    |
|                           |
|  Auth: API_KEY required   |  <-- auth indicator
|                           |
|  [ Install ]              |  <-- action button
+---------------------------+
```

- **Name**: From SKILL.md frontmatter `name`.
- **Description**: From SKILL.md frontmatter `description`. Truncate at 2 lines.
- **Auth indicator**: Parsed from `compatibility` field. Shows a small lock icon + text like "API_KEY required" if credentials are needed. If no auth needed, show "No auth required" in muted text.
- **Install button**: `rounded-full` pill. Label says "Install" (vs "Download" for templates, since skills are installed to `~/.openstaff/skills/`).

---

## Search & Filter

### Search Bar

```
+------------------------------------------------------------+
|  [Q]  Search templates and skills...          [Templates | Skills]  |
+------------------------------------------------------------+
```

- Pill-shaped input: `rounded-full border border-border bg-card`.
- Search icon (`Q`) on the left inside the input.
- Filters by name, description, role, and category fields.
- Debounced (300ms) client-side filtering on the cached registry data.
- The tab toggle (Templates | Skills) is a segmented control with `rounded-full` shape, placed at the right end of the search bar row.

### Category Pills

```
( All )  ( Marketing )  ( SEO )  ( Dev )  ( Analytics )  ( Content )
```

- Horizontal scrollable row of pill buttons.
- Each pill: `rounded-full px-4 py-1.5 text-sm`.
- Default state: `bg-muted text-muted-foreground`.
- Active state: `bg-foreground text-background` (inverted for high contrast).
- "All" is selected by default.
- Categories are derived from the fetched registry data. Dynamically generated from the unique set of `category` values across all templates/skills.

---

## Card Design

### Grid Layout

- Desktop: 3-column grid (`grid-cols-3 gap-6`).
- Tablet: 2-column grid (`grid-cols-2 gap-4`).
- Compact: 1-column grid (`grid-cols-1 gap-4`).
- Cards use `<Card>` from shadcn/ui with default `--radius` (0.5rem).
- No shadow on cards. Subtle `border border-border`.

### Card Hover State

- On hover: `border-foreground/20` (slightly more visible border).
- Cursor: `pointer`.
- The card itself is clickable and opens a detail panel/modal.

### Card Click -- Detail Panel

Clicking a card opens a detail view (slide-over panel from the right or a modal). This shows the full template/skill information:

**Template detail:**
- Full name, role, category, author
- Complete Gather, Execute, Evaluate descriptions (not truncated)
- KPI targets
- Full list of required skills (with install status indicators)
- Recommended agent and model
- Large "Download" button

**Skill detail:**
- Full name, description, author, version
- Complete SKILL.md instructions preview
- Auth requirements with details
- List of Staff templates that use this skill
- Large "Install" button

---

## Download/Install Flow

### Template Download

1. User clicks "Download" on a template card.
2. Button changes to a spinner with "Downloading..." text.
3. Fetch the template JSON from GitHub raw URL.
4. On success: open the Staff Create form, pre-filled with all template fields (name, role, gather, execute, evaluate, kpi, recommended agent/model).
5. Required skills are listed in the create form. If any are not installed, show a prompt: "This template requires skills that are not installed: [skill-name]. Install now?"
6. User reviews, adjusts, connects skills, and confirms to create the Staff.

### Skill Install

1. User clicks "Install" on a skill card.
2. Button changes to a progress indicator with "Installing..." text.
3. Fetch the entire skill directory from GitHub (SKILL.md + scripts/ + references/ + assets/).
4. Write to `~/.openstaff/skills/{skill-name}/`.
5. On success: button changes to a checkmark with "Installed" label. Button becomes disabled/muted.
6. Already-installed skills show "Installed" state by default (compare local `~/.openstaff/skills/` against registry data).

### Skill Update

- If a skill is already installed but the registry has a newer version, show "Update" instead of "Installed".
- Update flow is the same as install (overwrite local files).

---

## Data Requirements

### GitHub Fetching

- **Registry index**: On screen load, fetch a manifest/index file from the GitHub repo that lists all available templates and skills with metadata. This avoids needing to crawl the directory.
  - URL: `https://raw.githubusercontent.com/{owner}/{repo}/main/registry/index.json`
  - Fallback: GitHub API to list directory contents, then fetch individual files.

- **Caching**: Store fetched registry data in `~/.openstaff/registry/cache.json` with a TTL of 1 hour. Serve from cache on subsequent visits within the TTL.

- **Template download**: Fetch individual template JSON from raw URL.

- **Skill download**: Fetch skill directory contents via GitHub API (list files in `registry/skills/{skill-name}/`), then download each file.

### Registry Index Shape

```json
{
  "version": "1.0.0",
  "updated_at": "2026-02-19T00:00:00Z",
  "templates": [
    {
      "id": "meta-ads-creative",
      "name": "Meta Ads Creative Designer",
      "role": "Meta ads creative designer",
      "category": "marketing",
      "description": "Creates daily ad creatives...",
      "required_skills": ["instagram", "meta-ads-api", "image-generation"],
      "author": "openstaff",
      "path": "templates/meta-ads-creative.json"
    }
  ],
  "skills": [
    {
      "id": "instagram",
      "name": "Instagram Skill",
      "description": "Connect to Instagram API...",
      "category": "social",
      "auth_required": true,
      "auth_description": "INSTAGRAM_ACCESS_TOKEN",
      "author": "openstaff",
      "version": "1.0",
      "path": "skills/instagram/"
    }
  ]
}
```

---

## Interactions

| Action | Behavior |
|---|---|
| Click tab (Templates/Skills) | Switch card grid content. Preserve search query and category filter. |
| Type in search | Debounced 300ms client-side filter across name, description, role, category. |
| Click category pill | Filter cards to that category. "All" clears the filter. |
| Click card | Open detail panel (slide-over or modal) with full information. |
| Click "Download" (template) | Fetch template JSON, navigate to Staff Create form pre-filled. |
| Click "Install" (skill) | Download skill to `~/.openstaff/skills/`, show progress, update button state. |
| Pull-to-refresh / refresh button | Re-fetch registry index from GitHub (bypass cache). |

---

## States

### Loading

- On first load or refresh: show skeleton cards in the grid (3x2 grid of skeleton rectangles matching card dimensions).
- Skeleton uses `bg-muted animate-pulse rounded-[var(--radius)]`.
- Search bar and tabs are interactive during loading.

### Empty Search Results

- Show centered empty state inside the grid area.
- Illustration: a simple search icon with a question mark.
- Text: "No results found for '[query]'" (`text-muted-foreground`).
- Subtext: "Try a different search term or browse all [templates/skills]." with a link to clear the search.

### Download/Install Progress

- **Template download**: Button shows spinner + "Downloading..." for the brief fetch. Typically fast (single JSON file).
- **Skill install**: Button shows spinner + "Installing..." with progress. May take a few seconds for larger skill packages.
- On failure: show a toast notification with the error. Button reverts to original state.

### Offline / Fetch Error

- If GitHub fetch fails (no internet, rate limit, etc.):
  - If cache exists: show cached data with a subtle banner at the top: "Showing cached results. Last updated [time ago]." with a "Retry" button.
  - If no cache: show full-page empty state. Illustration of a disconnected cable. Text: "Unable to connect to the registry." Subtext: "Check your internet connection and try again." Button: "Retry".

### Already Installed

- Skills that are already installed locally show the "Installed" button state (muted, with a checkmark icon).
- Templates that have already been used to create a Staff could show a subtle "Used" badge, but the Download action remains available (users may want to create multiple Staff from the same template).

---

## Responsive

| Breakpoint | Layout |
|---|---|
| Desktop (>= 1024px) | 3-column card grid. Detail panel slides in from the right (keeps grid visible underneath). |
| Tablet (>= 640px, < 1024px) | 2-column card grid. Detail opens as a modal overlay. |
| Compact (< 640px) | 1-column card grid. Category pills horizontally scroll. Detail opens as full-screen sheet. |

Search bar and tab toggle remain full-width across all breakpoints. Category pills scroll horizontally on smaller screens with fade-out edges on the overflow side.
