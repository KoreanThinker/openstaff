# Staff Create / Edit

## Purpose

The Staff Create/Edit screen is where users "hire" a new AI employee or update an existing one. It collects the Staff definition (Role, Gather, Execute, Evaluate, KPI), assigns Skills, and selects the Agent/Model. The screen's centerpiece is an animated infinite loop visualization that immediately communicates "this employee works forever in a repeating cycle" to non-developers.

In **create mode**, the form is blank (or pre-filled from a template). In **edit mode**, the form is pre-populated from the existing `staff.json`.

---

## Navigation

- **Entry points**:
  - Dashboard "Create Staff" button (create mode)
  - Registry template "Use Template" button (create mode, pre-filled)
  - Import file dialog (create mode, pre-filled)
  - Staff Detail screen "Edit" button (edit mode)
- **Exit points**:
  - "Create & Start" / "Save & Restart" -> redirects to Staff Detail screen
  - "Cancel" -> returns to previous screen (Dashboard or Staff Detail)
- **URL**: `/staffs/new` (create), `/staffs/:id/edit` (edit)

---

## Layout (ASCII Wireframe)

```
+------------------------------------------------------------------+
|  <- Back    Staff Create                     [Import Template v]  |
+------------------------------------------------------------------+
|                                                                    |
|  +--------------------------------------------------------------+ |
|  |                    LOOP VISUALIZATION                         | |
|  |                                                               | |
|  |         Gather -------> Execute -------> Evaluate             | |
|  |           ^                                  |                | |
|  |           |                                  |                | |
|  |           +----------------------------------+                | |
|  |                     (infinite loop)                           | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  |  Identity Card                                                | |
|  |                                                               | |
|  |  Staff Name   [____________________________________]          | |
|  |  Role         [____________________________________]          | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  |  The Loop Card                                                | |
|  |                                                               | |
|  |  Gather     [                                    ]            | |
|  |             [  textarea (4 rows)                 ]            | |
|  |                                                               | |
|  |  Execute    [                                    ]            | |
|  |             [  textarea (4 rows)                 ]            | |
|  |                                                               | |
|  |  Evaluate   [                                    ]            | |
|  |             [  textarea (4 rows)                 ]            | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  |  KPI Card                                                     | |
|  |                                                               | |
|  |  KPI        [                                    ]            | |
|  |             [  textarea (2 rows)                 ]            | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  +----------------------------+  +-----------------------------+  |
|  |  Skills Card               |  |  Agent & Model Card         |  |
|  |                            |  |                             |  |
|  |  [Instagram] [Meta Ads] x |  |  Agent  [Claude Code    v]  |  |
|  |  [+ Add Skill]            |  |  Model  [Sonnet 4.5     v]  |  |
|  |                            |  |                             |  |
|  +----------------------------+  +-----------------------------+  |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  |          [Cancel]              [Create & Start]               | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

---

## Loop Visualization

The loop visualization is the hero element of the screen. It sits at the top inside a full-width Card with generous padding.

### Visual Design

```
         +------------+          +------------+          +------------+
         |            |   ---->  |            |   ---->  |            |
         |   Gather   |          |  Execute   |          |  Evaluate  |
         |            |   ---->  |            |   ---->  |            |
         +------------+          +------------+          +------------+
               ^                                               |
               |                                               |
               +-----------------------------------------------+
                              infinite loop
```

### Detailed Specification

- **Container**: Full-width `<Card>` with `bg-card`, `border border-border`, generous vertical padding (`py-10`).
- **Three nodes**: Rounded-full pill shapes (`rounded-full px-6 py-3`) representing Gather, Execute, Evaluate.
  - Each node has a subtle background tint and an icon:
    - **Gather**: Search/radar icon. Background `bg-chart-1/10`, text `text-chart-1`.
    - **Execute**: Bolt/lightning icon. Background `bg-chart-2/10`, text `text-chart-2`.
    - **Evaluate**: Chart-bar/check icon. Background `bg-chart-3/10`, text `text-chart-3`.
- **Arrows**: SVG path arrows connecting the three nodes left-to-right, then a curved return arrow from Evaluate back to Gather underneath.
- **Animation**: A small dot (or subtle glow) continuously travels the loop path at a slow pace (8-10 second full cycle). Uses CSS `@keyframes` on an SVG `<circle>` with `offset-path`. The animation conveys "always moving, never stopping."
- **Label**: Small `text-muted-foreground text-sm` label centered below: "Your Staff repeats this cycle forever"
- **Interactive highlight**: When the user focuses on the Gather/Execute/Evaluate textarea, the corresponding node in the loop visualization subtly scales up (`scale-110`) and brightens, creating a visual link between the form input and the loop concept.

### Responsive Behavior

- On narrow viewports (< 640px), the three nodes stack vertically with downward arrows, and the return arrow wraps from bottom back to top on the right side.

---

## Form Fields

### Identity Card

A `<Card>` containing the Staff's name and role.

#### Staff Name

| Property     | Value                                        |
|-------------|----------------------------------------------|
| Type        | `<Input>` (text, single line)                |
| Placeholder | "e.g., Meta Ads Creative Designer"           |
| Validation  | Required. 1-80 characters.                   |
| Helper text | "A friendly name for this Staff"             |
| Maps to     | `staff.json > name`                          |

#### Role

| Property     | Value                                        |
|-------------|----------------------------------------------|
| Type        | `<Input>` (text, single line)                |
| Placeholder | "e.g., Meta ads creative designer"           |
| Validation  | Required. 1-120 characters.                  |
| Helper text | "One-line job title describing what this Staff does" |
| Maps to     | `staff.json > role`                          |

---

### The Loop Card

A `<Card>` containing the three loop phase textareas. A subtle vertical connector line or step indicators (1, 2, 3) on the left side visually tie these three fields together as a sequence.

#### Gather

| Property     | Value                                        |
|-------------|----------------------------------------------|
| Type        | `<Textarea>` (4 rows, resizable)             |
| Placeholder | "Where and how should this Staff collect information?\n\ne.g., Collect trending posts from Instagram and X for the last 3 days in our product category. Analyze visual styles, copy patterns, and hashtags of top 100 posts." |
| Validation  | Required. 1-2000 characters.                 |
| Helper text | "Tell your Staff where to look and what to collect" |
| Label icon  | Search icon, colored `text-chart-1`          |
| Maps to     | `staff.json > gather`                        |

#### Execute

| Property     | Value                                        |
|-------------|----------------------------------------------|
| Type        | `<Textarea>` (4 rows, resizable)             |
| Placeholder | "What specific work should this Staff perform?\n\ne.g., Create 3 ad creatives with A/B test variants per day, tailored to our product." |
| Validation  | Required. 1-2000 characters.                 |
| Helper text | "Describe the actual work to produce"        |
| Label icon  | Bolt icon, colored `text-chart-2`            |
| Maps to     | `staff.json > execute`                       |

#### Evaluate

| Property     | Value                                        |
|-------------|----------------------------------------------|
| Type        | `<Textarea>` (4 rows, resizable)             |
| Placeholder | "How should this Staff measure results and learn?\n\ne.g., Check CPI, CPM, CTR from Meta Ads dashboard. Analyze which patterns perform best and apply learnings." |
| Validation  | Required. 1-2000 characters.                 |
| Helper text | "Define how to measure performance and what to learn" |
| Label icon  | Chart-bar icon, colored `text-chart-3`       |
| Maps to     | `staff.json > evaluate`                      |

---

### KPI Card

A separate `<Card>` below the loop fields.

#### KPI

| Property     | Value                                        |
|-------------|----------------------------------------------|
| Type        | `<Textarea>` (2 rows, resizable)             |
| Placeholder | "e.g., CPI < $2.00, CTR > 3%, daily creatives >= 3" |
| Validation  | Optional. 0-1000 characters.                 |
| Helper text | "Long-term metrics tracked on the dashboard. These are not part of the loop instructions." |
| Maps to     | `staff.json > kpi`                           |

---

## Skills Selection

Located in a `<Card>` on the left side of a 2-column layout (alongside Agent & Model on the right).

### UX

- **Display**: Currently connected Skills shown as pill badges (`rounded-full`) with the Skill name and an "x" remove button.
- **Add button**: A `[+ Add Skill]` pill button opens a popover/dropdown listing all installed Skills from `~/.openstaff/skills/`.
- **Dropdown items**: Each Skill shows its name, a one-line description (from `SKILL.md`), and an auth status indicator (green dot = configured, amber dot = credentials missing).
- **Empty state**: If no Skills are installed, show a message: "No Skills installed. Go to Skills to add some." with a link to the Skills management screen.
- **Validation**: Optional. A Staff can run with zero Skills.
- **Maps to**: `staff.json > skills` (array of skill name strings)

### Pill Badge Design

```
  [  Instagram  x ]  [  Meta Ads API  x ]  [+ Add Skill]
```

- Skill pills: `bg-muted text-foreground rounded-full px-3 py-1 text-sm`
- Remove "x": `text-muted-foreground hover:text-foreground` on the trailing side
- Add button: `border border-dashed border-border text-muted-foreground rounded-full px-3 py-1 text-sm hover:border-foreground`

---

## Agent & Model Selection

Located in a `<Card>` on the right side of the 2-column layout.

### Agent

| Property     | Value                                        |
|-------------|----------------------------------------------|
| Type        | `<Select>` (single select dropdown)          |
| Options     | Claude Code, Codex (disabled/coming soon)    |
| Default     | Value from `config.json > default_agent`     |
| Validation  | Required.                                    |
| Helper text | "The AI agent that powers this Staff"        |
| Maps to     | `staff.json > agent`                         |

### Model

| Property     | Value                                        |
|-------------|----------------------------------------------|
| Type        | `<Select>` (single select dropdown)          |
| Options     | Filtered by selected Agent. For Claude Code: Claude Sonnet 4.5, Claude Opus 4.6, Claude Haiku 4.5. For Codex: (future). |
| Default     | Value from `config.json > default_model`     |
| Validation  | Required.                                    |
| Helper text | "The AI model to use. Faster models cost less." |
| Maps to     | `staff.json > model`                         |

### Behavior

- Changing Agent resets Model to the first available option for that Agent.
- Codex option is visible but disabled with a "Coming Soon" badge.
- Model options are sourced from `AgentDriver.getAvailableModels()`.

---

## Actions

Located at the bottom of the page in a sticky action bar (visible when scrolling).

### Create Mode

| Button            | Style                  | Behavior                                                  |
|-------------------|------------------------|-----------------------------------------------------------|
| **Create & Start**| Primary (`bg-primary text-primary-foreground rounded-full`) | Validate form -> save `staff.json` -> create working directory -> generate `CLAUDE.md` -> symlink Skills -> spawn Agent -> redirect to Staff Detail |
| **Cancel**        | Ghost (`variant="ghost" rounded-full`)   | Confirm if form has changes ("Discard changes?") -> navigate back to Dashboard |

### Edit Mode

| Button              | Style                  | Behavior                                                |
|---------------------|------------------------|---------------------------------------------------------|
| **Save & Restart**  | Primary (`bg-primary text-primary-foreground rounded-full`) | Validate form -> update `staff.json` -> regenerate `CLAUDE.md` -> restart subprocess -> redirect to Staff Detail |
| **Cancel**          | Ghost (`variant="ghost" rounded-full`)   | Confirm if form has changes -> navigate back to Staff Detail |

### Button Placement

```
+--------------------------------------------------------------+
|          [Cancel]                     [Create & Start]        |
+--------------------------------------------------------------+
```

Right-aligned primary action, left-aligned cancel. The bar uses `shadow-soft-float` when floating over content.

---

## Import from Template

### Entry Point

A dropdown button in the top-right header area: `[Import Template v]`. Opens a dropdown with two options:

1. **Browse Registry** -- opens a modal/sheet listing templates from the GitHub registry (`registry/templates/`).
2. **Import File** -- triggers a native file dialog (via Electron IPC) to select a `.json` export file.

### Browse Registry Flow

1. User clicks "Browse Registry".
2. Modal opens showing a grid of template cards fetched from the GitHub registry.
3. Each template card shows: name, role, required Skills (as pill badges), recommended Agent/Model.
4. User clicks "Use Template" on a card.
5. Modal closes. Form fields are pre-populated from the template JSON.
6. Skills listed in `required_skills` are auto-selected if installed. Missing Skills are shown with a warning badge: "Not installed -- go to Skills to add."
7. User reviews, adjusts, and submits.

### Import File Flow

1. User clicks "Import File".
2. Native file dialog opens (filtered to `.json` files).
3. Selected file is parsed and validated against the export schema.
4. If valid, form fields are pre-populated. Same Skills matching logic as templates.
5. If invalid, show an inline error: "Invalid Staff file. Expected an OpenStaff export JSON."

### Pre-fill Mapping

| Export JSON field      | Form field   |
|-----------------------|-------------|
| `role`                | Role        |
| `gather`              | Gather      |
| `execute`             | Execute     |
| `evaluate`            | Evaluate    |
| `kpi`                 | KPI         |
| `required_skills`     | Skills      |
| `recommended_agent`   | Agent       |
| `recommended_model`   | Model       |

Staff Name is left blank for the user to fill in. It is not included in exports/templates.

---

## Data Requirements

### API Calls (on mount)

| Endpoint                      | Purpose                              |
|-------------------------------|--------------------------------------|
| `GET /api/skills`             | List installed Skills (for Skills multi-select) |
| `GET /api/agents`             | List available Agents and their models |
| `GET /api/settings`           | Get default Agent/Model preferences  |
| `GET /api/staffs/:id`        | (Edit mode only) Load existing Staff config |
| `GET /api/registry/templates` | (If Browse Registry opened) Fetch template list |

### API Calls (on submit)

| Mode   | Endpoint                  | Method | Body              |
|--------|---------------------------|--------|-------------------|
| Create | `POST /api/staffs`        | POST   | Staff config JSON |
| Edit   | `PUT /api/staffs/:id`     | PUT    | Staff config JSON |

### Request Body

```json
{
  "name": "Meta Ads Creative Designer",
  "role": "Meta ads creative designer",
  "gather": "Collect trending posts from Instagram...",
  "execute": "Create 3 ad creatives with A/B test...",
  "evaluate": "Check CPI, CPM from Meta Ads dashboard...",
  "kpi": "CPI < $2.00, CTR > 3%",
  "skills": ["instagram", "meta-ads-api"],
  "agent": "claude-code",
  "model": "claude-sonnet-4-5"
}
```

---

## Interactions

| Interaction                        | Behavior                                                                       |
|------------------------------------|--------------------------------------------------------------------------------|
| Focus Gather/Execute/Evaluate      | Corresponding loop node highlights (scale + brightness)                        |
| Change Agent dropdown              | Model dropdown resets and repopulates with that Agent's models                 |
| Click Skill "x" pill              | Skill removed from selection immediately                                       |
| Click "+ Add Skill"               | Popover opens with available Skills list                                       |
| Click "Cancel" with dirty form    | Confirmation dialog: "You have unsaved changes. Discard?"                      |
| Click "Create & Start"            | Validate -> show loading state -> submit -> redirect                           |
| Browser back/navigate with dirty  | Same discard confirmation dialog                                               |
| Hover over loop nodes             | Subtle scale-up and tooltip showing the phase name                             |
| Keyboard: Tab through form        | Standard focus order: Name -> Role -> Gather -> Execute -> Evaluate -> KPI -> Skills -> Agent -> Model -> Cancel -> Submit |

---

## States

### Default (Empty Form)

- All fields empty. Loop visualization animating.
- "Create & Start" button is disabled until required fields are filled.

### Pre-filled (from Template/Import/Edit)

- Fields populated with data. Form is considered "dirty" immediately.
- Edit mode shows "Save & Restart" instead of "Create & Start".

### Validation Errors

- On submit attempt with invalid fields:
  - Scroll to first error field.
  - Show red border on invalid fields (`border-destructive`).
  - Show error message below each invalid field in `text-destructive text-sm`.
  - Error messages: "Staff name is required", "Role is required", "Gather instructions are required", etc.
- Real-time validation: clear error when user starts typing in an errored field.

### Submitting

- Primary button shows a spinner and "Creating..." / "Saving..." text.
- All form fields become disabled.
- Cancel button is hidden.

### Success

- Brief success state (button turns green with checkmark, 500ms).
- Auto-redirect to Staff Detail screen.
- Toast notification: "Staff created and started" / "Staff updated and restarted".

### Submit Error

- Re-enable form fields.
- Show error banner at top of form: "Failed to create Staff. {error message}" with `bg-destructive/10 text-destructive border border-destructive/20 rounded-[var(--radius)]`.
- Primary button returns to normal state.

---

## Responsive

| Breakpoint       | Layout Changes                                                      |
|------------------|---------------------------------------------------------------------|
| Desktop (>= 1024px) | Full layout as wireframed. Skills and Agent/Model side by side (2-column). |
| Tablet (640-1023px)  | Loop visualization nodes slightly smaller. Skills and Agent/Model stack vertically (1-column). |
| Mobile (< 640px)     | Loop visualization stacks vertically (top-to-bottom). All cards full width. Sticky action bar at bottom. |
