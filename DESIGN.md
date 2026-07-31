---
name: Виииз
description: A strict editorial data-visualization editor for fast, polished chart creation.
colors:
  ink: "#202027"
  muted: "#777580"
  line: "#e5e3eb"
  paper: "#ffffff"
  app-bg: "#f5f4f8"
  stage-bg: "#f2f1f5"
  primary-accent: "#6956e8"
  primary-accent-soft: "#f4f1ff"
  primary-accent-tint: "#ece8ff"
  success: "#36a476"
  warning: "#e4a52c"
  danger: "#db5a5a"
  chart-axis: "#55515e"
  chart-grid: "#d9d7df"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "29px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  xs: "3px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "15px"
spacing:
  xs: "4px"
  sm: "7px"
  md: "14px"
  lg: "20px"
  xl: "28px"
  section: "38px"
components:
  button-default:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "9px 14px"
  button-primary:
    backgroundColor: "{colors.primary-accent}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "9px 14px"
  input-default:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "9px 10px"
  panel-surface:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
---

# Design System: Виииз

## 1. Overview

**Creative North Star: "The Editorial Chart Desk"**

Виииз should feel like a precise editorial workstation for making charts: white surfaces, disciplined typography, visible structure, and quiet controls that help the user move from raw data to a polished export. The interface is a product tool, so the chart and data remain the main subject; styling exists to support confidence, speed, and legibility.

The current system uses DM Sans for the product shell, Manrope for stronger headings, compact control typography, white panels, pale lavender-gray backgrounds, and a single violet accent. The future direction should keep the useful restraint while moving away from generic SaaS polish: less decorative purple text, fewer heavy card tropes, more typographic hierarchy, cleaner alignment, and color used as a rare mark of state or emphasis.

It explicitly rejects bright startup SaaS templates, playful toy BI, cluttered Excel-like density, gradient-heavy marketing, excessive cards, decorative illustration, and visual noise. The strongest screens should look professional before they look expressive.

**Key Characteristics:**

- White-first editorial product UI with pale neutral work surfaces.
- Chart-first composition: the canvas gets the calmest, clearest region.
- Compact, legible controls for repeated analytical work.
- One sparse accent color used for selection, focus, primary action, and highlights.
- Flat-by-default surfaces with shadows reserved for real depth and modal separation.

## 2. Colors

The palette is a restrained neutral system with one violet accent and clear semantic status colors.

### Primary

- **Editorial Violet** (#6956e8): Used for primary actions, selected chart choices, focus rings, active steps, and rare emphasis. It should not become ordinary paragraph or label text.
- **Violet Wash** (#f4f1ff): Used as the selected or hover background behind controls when the violet accent needs a quieter surface.
- **Violet Tint** (#ece8ff): Used for small icon wells and highlight chips, especially when a stronger filled accent would compete with the chart.

### Secondary

- **Success Green** (#36a476): Used for clean data quality, completed steps, and positive validation.
- **Warning Amber** (#e4a52c): Used for data issues that need attention but do not block progress.
- **Danger Red** (#db5a5a): Used for destructive actions, failed states, and critical data issues.

### Neutral

- **Ink Black** (#202027): Primary UI text and the strongest structural color.
- **Muted Graphite** (#777580): Secondary labels, helper text, and low-priority metadata.
- **Rule Gray** (#e5e3eb): Dividers, input borders, panel boundaries, and table grid lines.
- **Paper White** (#ffffff): Panels, chart paper, controls, dialogs, and content surfaces.
- **App Lavender Gray** (#f5f4f8): Overall application shell background.
- **Stage Gray** (#f2f1f5): Canvas workbench background around the chart paper.
- **Chart Axis Gray** (#55515e): Default chart axis lines and strong chart annotations.
- **Chart Grid Gray** (#d9d7df): Default chart grid line color.

### Named Rules

**The Sparse Accent Rule.** Violet should mark selection, focus, primary action, or a deliberate highlight. Its rarity is what makes it useful.

**The White Desk Rule.** Main editing surfaces default to white. Use pale gray-lavender only to separate tool regions from the chart, not as decoration.

## 3. Typography

**Display Font:** Manrope (with sans-serif fallback)
**Body Font:** DM Sans (with sans-serif fallback)
**Label/Mono Font:** DM Sans for UI labels; monospace only for dates, masks, technical values, and row/step markers.

**Chart font library:** The editor also offers free-to-use families for chart content. The curated set includes Onest and Golos Text alongside Inter, IBM Plex Sans, Source Sans 3, PT Sans, Lato, Open Sans, Roboto, Montserrat, and Nunito. These options belong to exported chart typography, not to the product-shell hierarchy.

**Character:** The type system is compact and professional, with Manrope giving headings a precise editorial weight and DM Sans carrying dense product controls. The desired evolution is more typographic discipline, not more decorative type.

### Hierarchy

- **Display** (700, 38px, 1.05): Source-step and major workflow headings. Keep letter-spacing no tighter than -0.04em.
- **Headline** (700, 29px, 1.1): Data review and workspace-level headings.
- **Title** (700, 18px, 1.2): Panel titles, dialog headings, and component group headings.
- **Body** (400, 13px, 1.6): Explanatory copy, page prose, and user-facing descriptions. Keep longer prose within 65-75ch.
- **Label** (600, 8-11px, compact): Control labels, table metadata, toolbar text, and dense settings. Uppercase labels are allowed sparingly for inspector headings and file-type tags.

### Named Rules

**The Control Density Rule.** Product labels can be small, but not faint. If text is below 11px, contrast must be strong and spacing must be exact.

**The Editorial Weight Rule.** Use weight, scale, and spacing for emphasis before adding decorative color.

## 4. Elevation

Виииз is flat by default and uses tonal layering, borders, and sticky structure before shadows. Shadows appear when a surface genuinely floats above the workbench: chart paper, dialogs, hoverable project previews, dropdown-like controls, and selected canvas handles.

### Shadow Vocabulary

- **Review Lift** (`box-shadow: 0 8px 30px #2d284508`): Very soft lift for large review containers.
- **Canvas Paper Lift** (`box-shadow: 0 12px 35px #312c4712`): Workbench separation for the chart paper.
- **Logical Canvas Lift** (`box-shadow: 0 12px 35px #312c4720`): Stronger separation when the canvas is scaled inside the viewport.
- **Dialog Lift** (`box-shadow: 0 30px 90px #110d2738`): Modal separation over the backdrop.
- **Soft Hover Lift** (`box-shadow: 0 4px 12px #6956e812` or similar): Small interactive confirmation, used sparingly.

### Named Rules

**The Flat-At-Rest Rule.** Buttons, inputs, cards, and panels should not carry decorative shadow at rest. Use borders and filled states first.

**The No Ghost Card Rule.** Do not pair a 1px border with a wide decorative shadow on routine cards or buttons. Use one structural cue unless the surface is truly floating.

## 5. Components

### Buttons

- **Shape:** Slightly rounded rectangles (8-9px). Full pills are not part of the current product language.
- **Primary:** Violet fill (#6956e8) with white text and a matching border. Use for forward progress, export, and major creation actions.
- **Default:** White background, Rule Gray border, Ink text, 9px 14px padding, 600 weight.
- **Hover / Focus:** Hover changes border or pale violet background. Focus uses a violet ring (`0 0 0 3px #6956e817`).
- **Destructive:** Red text or soft red hover treatment; avoid large red fills unless the action is irreversible.

### Chips

- **Style:** Small bordered tags with 5-6px radius, compact uppercase or semibold text, and white or pale neutral backgrounds.
- **State:** Selected chips use a pale violet background plus violet border/text. Status chips use semantic color plus an icon or label so color is not the only signal.

### Cards / Containers

- **Corner Style:** 8-14px depending on scale. Large panels top out around 12-15px; chart paper stays nearly square at 3px.
- **Background:** White for real content and panels; pale neutral only for workbench, grouping, and inactive previews.
- **Shadow Strategy:** Flat by default. Use `Review Lift` or `Canvas Paper Lift` only for major surfaces that need spatial separation.
- **Border:** 1px Rule Gray is the default structural boundary.
- **Internal Padding:** Dense controls use 8-14px; panels and dialogs use 20-28px.

### Inputs / Fields

- **Style:** White fill, 1px Rule Gray border, 7-9px radius, compact text, and consistent height around 34px for settings controls.
- **Focus:** Violet border plus a pale focus ring. Keep the ring visible and high contrast enough for keyboard users.
- **Error / Disabled:** Error states use Danger Red with explanatory text. Disabled states use opacity and cursor changes, but labels remain readable.

### Navigation

- **Style:** Top navigation uses strong brand text and restrained links; the editor topbar uses a 68px white band with a centered project name and compact export controls.
- **Active / Progress:** Workflow steps use numbered circles and a connecting rule. Completed states use Success Green; active states use Editorial Violet.
- **Mobile:** Navigation collapses by hiding secondary labels and preserving the main action path.

### Data Review Table

- **Style:** Dense table cells with sticky row numbers and sticky headers, white and near-white row striping, and explicit data-quality markers.
- **State:** Warning and critical headers use top borders plus soft tinted backgrounds. Maintain text labels alongside color markers.
- **Interaction:** Selected columns use pale violet fill, violet top border, and inset rules; avoid adding decorative shadows.

### Chart Canvas

- **Style:** The chart paper is a near-square white editorial sheet inside a pale workbench. It should feel like the object being produced, not a preview card.
- **Controls:** Canvas handles, annotation tools, and selection affordances use violet outlines and pale fills. They should disappear visually when not selected.
- **Rule:** Never let UI chrome compete with the exported chart.

## 6. Do's and Don'ts

### Do:

- **Do** keep the chart canvas visually dominant and calmer than the surrounding tools.
- **Do** use #6956e8 for selected states, focus, primary actions, and rare highlight backgrounds.
- **Do** use white panels, #e5e3eb borders, and compact spacing to create structure before adding shadows.
- **Do** preserve strong text contrast, especially for 8-11px labels and table metadata.
- **Do** pair semantic colors with words, icons, or shape changes so chart and status states are accessible.
- **Do** use typography, whitespace, alignment, and rhythm as the main expressive layer.

### Don't:

- **Don't** make the product look like a bright startup SaaS template, a playful toy BI tool, a cluttered Excel clone, or an over-decorated dashboard.
- **Don't** use gradient-heavy marketing, decorative illustration, excessive cards, or visual noise.
- **Don't** turn violet into generic body text; use it as a sparse accent or background highlight.
- **Don't** add decorative shadows to routine buttons, inputs, or cards.
- **Don't** use colored side-stripe borders, gradient text, glassmorphism, or repeating decorative grid/stripe backgrounds.
- **Don't** hide important meaning behind color alone, especially in chart palettes, data-quality states, or validation.
