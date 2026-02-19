# Setup Wizard

## Purpose

A lightweight first-launch onboarding flow that introduces OpenStaff to non-developer users. Shown once on first launch (when `setup_completed === false`). The wizard does **NOT** install agents or collect API keys — that's the Agents screen's responsibility. The wizard explains the product concept and optionally configures Ngrok remote access.

---

## Navigation

- **Full-screen**: No sidebar, no app shell. The wizard owns the entire viewport.
- **Linear step flow**: Steps 1 through 3 in order.
- **On completion**: Sets `setup_completed = true` in config.json and navigates to Dashboard with a banner prompting agent setup.

---

## Layout

Single centered Card on `bg-background`. Step indicator above the card.

```
+----------------------------------------------------------------------+
|  bg-background (full viewport)                                        |
|                                                                       |
|                         OpenStaff (logo)                              |
|                                                                       |
|                       (1)----(2)----(3)                               |
|                        *      o      o     <- step indicator          |
|                                                                       |
|          +--------------------------------------------+               |
|          |  bg-card  rounded-[--radius]                |               |
|          |  border border-border                       |               |
|          |  max-w-lg  p-8                              |               |
|          |                                             |               |
|          |  [Icon / Illustration]                      |               |
|          |                                             |               |
|          |  Step Title (text-xl font-semibold)         |               |
|          |  Description (text-muted-foreground)        |               |
|          |                                             |               |
|          |  [Step-specific content area]               |               |
|          |                                             |               |
|          |             [  Next  ]   <- pill button     |               |
|          +--------------------------------------------+               |
|                                                                       |
+----------------------------------------------------------------------+
```

**Card dimensions**: `max-w-lg` (512px), centered. Padding `p-8`. Uses `bg-card` with `border border-border` and global `--radius`.

---

## Step Indicator Design

Horizontal numbered step indicator above the card with connecting lines.

```
    (1) -------- (2) -------- (3)
  Welcome      Remote       Done!
```

**Step states**:
- **Completed**: Filled circle with checkmark. Line `bg-primary`.
- **Active**: Filled circle with number. Circle `bg-primary`, label `text-foreground font-medium`.
- **Upcoming**: Outlined circle. `border border-border bg-card`, label `text-muted-foreground`.

---

## Step 1: Welcome

**Purpose**: Introduce OpenStaff and the Gather → Execute → Evaluate concept.

### Wireframe

```
+--------------------------------------------+
|                                             |
|        [OpenStaff logo - large]             |
|                                             |
|       Welcome to OpenStaff                  |
|   Manage your AI Staff running 24/7.        |
|   Each Staff works in an infinite loop:     |
|                                             |
|       ┌─────────┐                           |
|       │ Gather  │──→ Execute ──→ Evaluate   |
|       └─────────┘       ↑            │      |
|              └──────────────────────┘       |
|                                             |
|   Your Staff collects information,          |
|   does the work, and learns from results.   |
|   Endlessly.                                |
|                                             |
|              [ Get Started ]                |
|                                             |
+--------------------------------------------+
```

### Content

- **Icon**: OpenStaff logo, rendered large (64px).
- **Title**: "Welcome to OpenStaff" — `text-xl font-semibold text-foreground`.
- **Description**: Brief explanation of the infinite loop concept — `text-sm text-muted-foreground`.
- **Loop Illustration**: Small animated SVG showing the Gather → Execute → Evaluate cycle with a traveling dot. Uses `chart-1`, `chart-2`, `chart-3` for the three nodes.
- **CTA**: "Get Started" pill button (`rounded-full`).

### Behavior

- No "Back" button (first step).
- Clicking "Get Started" advances to Step 2.

---

## Step 2: Remote Access (Optional)

**Purpose**: Optionally configure Ngrok for remote dashboard access.

### Wireframe

```
+--------------------------------------------+
|                                             |
|            [Globe icon - large]             |
|                                             |
|     Access your dashboard from anywhere     |
|                          [Optional] badge   |
|   Monitor your Staff from your phone        |
|   or laptop. Configure this later in        |
|   Settings if you prefer.                   |
|                                             |
|   Ngrok API Key                             |
|   [________________________________]        |
|                                             |
|   Dashboard Password                        |
|   [________________________________]        |
|   This protects your remote dashboard.      |
|                                             |
|     [ Skip ]    [ Back ]    [ Next ]        |
|                                             |
+--------------------------------------------+
```

### Content

- **Icon**: Lucide `Globe` icon, 48px, `text-muted-foreground`.
- **Title**: "Access your dashboard from anywhere" — `text-xl font-semibold`.
- **Optional badge**: `rounded-full bg-muted text-muted-foreground text-xs px-2 py-0.5`.
- **Description**: "Monitor your Staff from your phone or laptop. You can always configure this later in Settings." — `text-sm text-muted-foreground`.
- **Ngrok API Key input**: `<Input>` with label.
- **Dashboard Password input**: `<Input type="password">` with helper text.

### Behavior

- Both fields optional.
- **"Skip"**: Advances to Step 3 without saving.
- **"Next"**: Validates (both fields required if either is filled), saves encrypted, advances.
- **"Back"**: Returns to Step 1.

---

## Step 3: Complete!

**Purpose**: Welcome the user and direct them to the Dashboard.

### Wireframe

```
+--------------------------------------------+
|                                             |
|          [Sparkles icon - large]            |
|                                             |
|         You're all set!                     |
|   OpenStaff is ready. Here's what to do     |
|   next:                                     |
|                                             |
|     +------------------------------------+  |
|     |  1. Set up an AI Agent             |  |
|     |     (Go to Agents in the sidebar)  |  |
|     |  2. Create your first Staff        |  |
|     |  3. Watch it work 24/7             |  |
|     +------------------------------------+  |
|                                             |
|         [ Go to Dashboard  -> ]             |
|                                             |
+--------------------------------------------+
```

### Content

- **Icon**: Lucide `Sparkles` icon, 48px, `text-success`.
- **Title**: "You're all set!" — `text-xl font-semibold`.
- **Next steps**: Numbered list in `bg-muted rounded-xl p-4`. Emphasizes "Set up an AI Agent" as step 1.
- **CTA**: "Go to Dashboard" pill button.

### Behavior

- No "Back" button.
- Clicking CTA:
  1. Sets `setup_completed = true` in config.json.
  2. Navigates to Dashboard.
  3. Dashboard shows a banner: "Set up your first AI agent to start creating Staff" with a link to Agents page.

---

## Data Requirements

### Read

| Source | Data | Used In |
|--------|------|---------|
| `config.json` | `setup_completed` | Wizard mount check |

### Write

| Target | Data | Written In |
|--------|------|------------|
| `config.json` | `ngrok_api_key` (encrypted) | Step 2 on Next |
| `config.json` | `ngrok_auth_password` (encrypted) | Step 2 on Next |
| `config.json` | `setup_completed = true` | Step 3 on CTA |

---

## Interactions

| Button | Variant | Appears In | Behavior |
|--------|---------|------------|----------|
| Get Started | `default`, `rounded-full` | Step 1 | Advance to Step 2 |
| Next | `default`, `rounded-full` | Step 2 | Validate & save, advance |
| Back | `ghost`, `rounded-full` | Step 2 | Return to previous step |
| Skip | `ghost`, `rounded-full` | Step 2 | Skip to Step 3 |
| Go to Dashboard | `default`, `rounded-full`, wide | Step 3 | Complete wizard |

**Keyboard**: `Enter` triggers primary action. `Escape` does nothing.

---

## States

### Step 2: Remote Access

| State | Visual |
|-------|--------|
| **Empty** | Both inputs empty. "Next" and "Skip" enabled. |
| **Partial** | One field filled. Warning: "Both fields needed." "Next" disabled, "Skip" enabled. |
| **Complete** | Both filled. "Next" enabled. |

---

## Responsive

- **Card**: `max-w-lg` centered. On smaller windows: `mx-4`.
- **Step indicator**: Labels hidden on narrow windows (<640px), numbered circles only.
- **Web UI via Ngrok**: Wizard only runs in Electron (first launch). Never shown in Ngrok web.

---

## Animations

- **Step transitions**: Fade + slide (200ms).
- **Loop illustration** (Step 1): Animated traveling dot on the Gather→Execute→Evaluate path (8-10s cycle).
- **Button enable**: Opacity transition 50% → 100%.
- **Step indicator**: Circle fill transition on completion (200ms).
