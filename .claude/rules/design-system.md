---
paths:
  - "src/renderer/**/*.tsx"
  - "src/renderer/**/*.ts"
  - "src/renderer/**/*.css"
---

# UI/UX Design System & Coding Guidelines

You are an expert Frontend Engineer developing a Desktop & Web App using React, Tailwind CSS, and shadcn/ui.
Our design language is based on a modern "Bento Grid" style, characterized by highly rounded cards, clean spacing, and perfect Light/Dark mode contrast.

Strictly adhere to the following rules for EVERY component and page you build.

## 1. Layout & Shapes (The Bento Grid)
- **Cards are the core:** Wrap almost all content in shadcn/ui `<Card>` components.
- **Rounding:** By default, cards use the global `--radius` (which is heavily rounded at `1.5rem / 24px`). Do NOT override this with hardcoded values.
- **Pills/Badges:** For small interactive elements (e.g., date pickers, 'Create' buttons, status tags), use `rounded-full` to create a perfect pill shape.
- **Spacing:** Use standard gaps. For grid layouts, use `gap-4` or `gap-6`.

## 2. Color System (Strict CSS Variables)
- NEVER use hardcoded Tailwind color names for UI backgrounds or text (e.g., avoid `bg-gray-100`, `text-slate-800`, `bg-[#f0f0f0]`).
- **MUST USE** the semantic CSS variables defined in `global.css`:
  - Main background: `bg-background`
  - Card background: `bg-card`
  - Primary text: `text-foreground`
  - Secondary/Gray text: `text-muted-foreground`
  - Borders: `border-border`
- **Exception for Accents:** For charts, trend percentages (like "+36.8%"), use the custom semantic classes: `text-success`, `bg-success/20`, `text-destructive`.

## 3. Dark Mode
- The system is built for perfect dark mode toggle using standard Tailwind `dark:` variants combined with our CSS variables.
- Since we use CSS variables (e.g., `bg-background`), you rarely need to write `dark:bg-something` manually. The CSS variables handle the color swap automatically. Let the variables do the work.

## 4. Shadows & Borders
- Cards generally have a very subtle border (`border border-border`) and no default shadow.
- For floating elements (like toast notifications, sticky action bars, or hovering badges), use the custom tailwind shadow class: `shadow-soft-float` (and `dark:shadow-soft-float-dark` if needed).

## 5. Component Usage
- Always import and use the pre-built `shadcn/ui` components from `@/components/ui/...` first. Do not build native HTML `<button>` or `<input>` from scratch unless absolutely necessary.

## 6. Staff Status Indicators (Strict Rules)
- **Running:** `<div className="w-2 h-2 rounded-full bg-success animate-status-pulse" />`
- **Stopped:** `<div className="w-2 h-2 rounded-full bg-muted-foreground" />` (Neutral, inactive)
- **Error:** `<div className="w-2 h-2 rounded-full bg-destructive" />`
- **Warning (Backoff):** `<div className="w-2 h-2 rounded-full bg-warning" />`

## 7. Typography Use Cases
- Standard UI (Dashboards, Tables, Cards) -> `font-sans` (Inter).
- Log viewers, Terminal outputs, API responses -> `font-mono` (JetBrains Mono). Text in mono should generally be smaller (e.g., `text-xs` or `text-sm`).

## 8. Sidebar & Navigation Pattern (Bento Style)
- The app should use a discrete side navigation approach.
- Do NOT use a heavy, edge-to-edge traditional sidebar. Instead, either use an icon-heavy minimal sidebar (like the mobile/tablet reference images) or a floating pill-shaped navigation layout to maintain the airy, rounded Bento feel.
- Active navigation items should use soft backgrounds (e.g., `bg-muted` or a very low opacity primary color) with heavily rounded corners (`rounded-xl` or `rounded-full`).

## 9. Charts & Data Visualization
- Use `chart-1` through `chart-5` color tokens for multi-metric charts.
- `chart-1` (green) is the default/primary metric color.
- For single-metric trend lines, use `chart-1` for positive trends and `chart-5` for negative.
- Chart backgrounds should be transparent (inherit from `bg-card`).
- Grid lines should use `border-border` at low opacity.
