# Web design tokens

Status: W3 theme contract, not installed application CSS. This document owns
the concrete values consumed by the [interface system](web-interface-system.md).
Use a light, restrained palette with one accent, a familiar system sans and
compact product typography. Email's existing neutral styling is provisional
and is not a separate web theme.

## Token rules

The web's global stylesheet will expose semantic Tailwind theme variables for
canvas, surface, ink, muted text, border, accent, focus and feedback. Components
consume those roles rather than raw palette numbers. All color values use
OKLCH. A single light theme ships initially; do not expose a theme toggle.

Mood: a clearly labelled personal reference shelf, open in daylight. The
Impeccable seed is hue 230; the primary keeps that hue at a darker, readable
lightness. Pure white carries the reading surface, cool neutrals distinguish
controls, and chromatic emphasis stays below roughly ten percent of the page.
The pale notice accent is reserved for meaningful warnings, not decoration.

## Canonical color and type variables

For Tailwind's CSS theme namespace, use the following block in the future
global stylesheet. Theme colors create semantic utilities such as `bg-canvas`
and `text-ink`; custom type roles create `text-page` and `text-body`.
See the official [theme variable reference](https://tailwindcss.com/docs/theme).
Do not copy a second palette into components or email templates.

```css
@theme {
  --color-canvas: oklch(1 0 0);
  --color-surface: oklch(0.965 0.008 230);
  --color-ink: oklch(0.23 0.018 230);
  --color-muted: oklch(0.47 0.022 230);
  --color-border: oklch(0.62 0.02 230);
  --color-divider: oklch(0.89 0.008 230);
  --color-primary: oklch(0.43 0.08 230);
  --color-primary-hover: oklch(0.38 0.07 230);
  --color-primary-pressed: oklch(0.33 0.06 230);
  --color-primary-soft: oklch(0.94 0.025 230);
  --color-on-primary: oklch(1 0 0);
  --color-focus: oklch(0.43 0.08 230);
  --color-notice: oklch(0.96 0.045 95);
  --color-notice-ink: oklch(0.4 0.07 80);
  --color-danger: oklch(0.43 0.15 25);
  --color-danger-soft: oklch(0.95 0.02 25);
  --color-success: oklch(0.4 0.075 155);
  --color-success-soft: oklch(0.96 0.02 155);
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --text-meta: 0.875rem;
  --text-meta--line-height: 1.25rem;
  --text-body: 1rem;
  --text-body--line-height: 1.5rem;
  --text-row: 1.125rem;
  --text-row--line-height: 1.625rem;
  --text-section: 1.25rem;
  --text-section--line-height: 1.75rem;
  --text-page: 2rem;
  --text-page--line-height: 2.375rem;
  --text-page--letter-spacing: -0.02em;
  --spacing: 0.25rem;
  --radius-control: 0.5rem;
  --radius-panel: 0.75rem;
  --radius-tag: 0.25rem;
  --ease-feedback: cubic-bezier(0.22, 1, 0.36, 1);
}
```

Use `divider` only for decorative list separation. Inputs, secondary buttons
and other boundaries needed to identify a control use `border`. Body,
placeholder and disabled-control text use `ink` or `muted`, never a lighter
unverified gray. Do not dim whole controls with opacity; use surface plus
muted text and a disabled attribute. Pending controls preserve their label
and announce progress. Selection uses primary-soft with primary text; status
labels use the matching soft background and foreground. Focus uses the
outline with a canvas gap, including around primary-filled controls.

## Contrast evidence

Calculated 2026-10-05 from OKLCH to linear sRGB using the OKLab inverse matrix
and relative luminance `0.2126 R + 0.7152 G + 0.0722 B`; contrast is
`(lighter + 0.05) / (darker + 0.05)`. All listed colors are inside sRGB gamut;
ratios below are rounded to two decimals. This validates the chosen tokens,
not every eventual rendered combination. Recheck screenshots and computed
styles when the web exists, including hover, focus and background variants.

| Foreground / background | Ratio |
| --- | --- |
| Ink / canvas | 16.84:1 |
| Ink / surface | 15.24:1 |
| Muted / canvas | 6.78:1 |
| Muted / surface | 6.14:1 |
| On-primary / primary | 7.95:1 |
| On-primary / primary-hover | 9.85:1 |
| On-primary / primary-pressed | 12.06:1 |
| Primary / primary-soft | 6.70:1 |
| Border / canvas | 3.62:1 |
| Border / surface | 3.28:1 |
| Notice-ink / notice | 8.29:1 |
| Danger / danger-soft | 7.52:1 |
| Success / success-soft | 7.96:1 |

Focus against canvas uses the primary/canvas pair (7.95:1). Notice and
primary differ by 7.09:1; neither semantic meaning nor selection relies only
on that color difference.

## Type, spacing and shape

| Role | Value |
| --- | --- |
| Sans family | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |
| Small metadata | `0.875rem / 1.25rem`; regular |
| Body and controls | `1rem / 1.5rem`; regular, controls medium |
| Resource/row title | `1.125rem / 1.625rem`; semibold |
| Section heading | `1.25rem / 1.75rem`; semibold |
| Page heading | `2rem / 2.375rem`; semibold, `-0.02em` tracking |
| Wordmark | `1.125rem / 1.5rem`; bold, `-0.02em` tracking |
| Spacing unit | `0.25rem`; use 1, 2, 3, 4, 5, 6, 8, 10, 12 units |
| Page gutters | `1.25rem` below 640 px; `2rem` above |
| Shell maximum | `70rem` |
| Reader maximum | `48rem`; descriptions max `70ch` |
| Control height | minimum `2.75rem` |
| Control radius | `0.5rem` |
| Panel radius | `0.75rem`; list rows do not need enclosing panels |
| Tags | `0.25rem` radius; compact text, not interactive by default |
| Border | `1px`; no decorative accent side-stripes |
| Focus | `2px` solid outline with `3px` offset |
| Motion | `160ms`, `cubic-bezier(0.22, 1, 0.36, 1)`; immediate for reduced motion |
| Layers | content 0, sticky 10, dropdown 20, modal backdrop 30, modal 40, toast 50, tooltip 60 |

Use fixed rem typography; no fluid display headings. Text wraps with balanced
headings, normal readable prose, and `overflow-wrap: anywhere` for user content.
Controls and focus outlines remain visible at zoom. Avoid decorative shadows;
separators or surface changes establish grouping.
