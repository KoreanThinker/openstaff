# Brand Logo

## Core concept

The OpenStaff logo visualizes the product's main loop:

- One continuous infinity loop shape = never-ending execution flow
- Three anchor dots = Gather / Execute / Evaluate
- Gradient badge = multi-agent energy and momentum

## Variants

`OpenStaffLogo` supports two variants:

- `vivid` (default): gradient rounded badge for primary branding surfaces
- `mono`: foreground-only mark for constrained or low-contrast contexts

Wordmark styles (`wordmarkVariant`):

- `split`: `Open` in foreground + `Staff` in success color
- `gradient`: gradient-highlighted `Staff` for hero sections
- `mono`: one-color wordmark for minimal/system contexts

File: `src/renderer/src/components/brand/OpenStaffLogo.tsx`

## Usage examples

```tsx
<OpenStaffLogo size={22} />
<OpenStaffLogo showWordmark size={24} />
<OpenStaffLogo size={64} animated />
<OpenStaffLogo variant="mono" size={18} />
<OpenStaffLogo showWordmark wordmarkVariant="gradient" />
```

## Placement rules

- App shell sidebar: `vivid` + wordmark in expanded mode, mark-only when collapsed.
- Setup wizard hero: `vivid` + `wordmarkVariant="gradient"` + animated for first-impression branding.
- Tray icon: dedicated monochrome raster (`resources/trayTemplate.png`).

## Asset sources

- App icon master: `build/icon.svg`
- App icon rasters: `build/icon.png`, `build/icon.icns`
- GitHub wordmark: `build/logo-wordmark.svg`
- Tray icon vector: `build/trayTemplate.svg`
- Tray icon rasters: `resources/trayTemplate.png`, `resources/trayTemplate@2x.png`

## Typographic notes

- `gradient`: highest visual emphasis, strongest tracking compression for hero.
- `split`: default navigation wordmark for best readability/brand contrast.
- `mono`: utility context where color accents are undesirable.

## Tray icon notes

- Tray icon is intentionally simplified versus full app icon for 16px clarity.
- Keep it monochrome black template for macOS menu bar auto-invert behavior.
