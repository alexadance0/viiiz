---
name: Виииз
description: A strict black-and-white editorial data-visualization editor.
colors:
  ink: "#202027"
  black: "#000000"
  muted: "#777580"
  line: "#d4d4d4"
  line-soft: "#d5d5d5"
  paper: "#ffffff"
  surface: "#f7f7f7"
  stage: "#f5f5f5"
  selected: "#f3f3f3"
  chart-axis: "#55515e"
  chart-grid: "#d9d7df"
  blue: "#1677a6"
  cyan: "#18aeda"
  indigo: "#4568e1"
  green: "#36a476"
  amber: "#e4a52c"
  orange: "#bd4b12"
  red: "#db5a5a"
  pink: "#e033ab"
typography:
  display:
    fontFamily: "Wix Madefor Display, sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Wix Madefor Display, sans-serif"
    fontSize: "29px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Wix Madefor Display, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Wix Madefor Text, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Wix Madefor Text, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  xs: "0"
  sm: "0"
  md: "0"
  lg: "0"
  xl: "0"
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
    rounded: "0"
    padding: "9px 14px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "0"
    padding: "9px 14px"
  input-default:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "9px 10px"
  panel-surface:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "0"
---

# Design System: Виииз

## 1. Direction

**Creative North Star: “The Editorial Chart Desk.”** The product should feel like a precise publishing tool: white paper, black structure, strong typography, and data as the main source of color. The Blog is the visual reference for the rest of the product.

The product shell is deliberately monochrome. Black communicates action and selection; gray communicates hierarchy and separation. Colored accents remain available for charts, article identities, semantic status, and illustrative landing-page content. They do not color generic UI chrome.

Key characteristics:

- Square geometry throughout the shell; no decorative rounded cards.
- White-first surfaces with black type and visible one-pixel rules.
- Typography and spacing create hierarchy before containers or color.
- Flat panels; shadows are limited to overlays that genuinely float.
- Functional circles remain circular: toggles, radio controls, color dots, canvas handles, and status markers.
- The animated chart gallery and visual trails remain expressive brand elements.

## 2. Color

### Product shell

- **Ink Black** (`#202027`): primary text, primary actions, active navigation, selection, and focus.
- **Paper White** (`#ffffff`): page, cards, controls, dialogs, and chart paper.
- **Muted Graphite** (`#777580`): secondary copy and metadata.
- **Rule Gray** (`#d4d4d4`, with `#d5d5d5` as an equivalent rendered rule): borders and separators.
- **Surface Gray** (`#f7f7f7`), **Stage Gray** (`#f5f5f5`), and **Selected Gray** (`#f3f3f3`): quiet grouping without colored chrome.
- **Chart Axis** (`#55515e`) and **Chart Grid** (`#d9d7df`): default chart structure.

### Meaningful accents

- **Blue** (`#1677a6`), **Cyan** (`#18aeda`), and **Indigo** (`#4568e1`): chart series, article identity, and landing illustration.
- **Green** (`#36a476`): positive state and chart data.
- **Amber** (`#e4a52c`): warning state and chart data.
- **Orange** (`#bd4b12`): canvas settings and the chart-type workflow step.
- **Red** (`#db5a5a`): destructive or failed state and chart data.
- **Pink** (`#e033ab`): chart or editorial accent only.

Color must never be the only carrier of meaning. Pair semantic color with text, shape, or an icon.

Workflow stages and chart categories may each own one accent from this palette. The accent marks only the current step, category heading, hover, focus, and selected chart type; inactive controls remain monochrome.

## 3. Typography

- **Display:** Wix Madefor Display, 700. Used for page, article, workflow, dialog, and panel headings.
- **Body/UI:** Wix Madefor Text, 400–700. Used for navigation, controls, descriptions, and metadata.
- **Chart library:** Onest is the preferred chart font. Other export-only choices remain available in the chart font selector.

Use weight, scale, alignment, and whitespace for emphasis. Labels may be compact, but text below 11px must remain high contrast.

## 4. Geometry and elevation

All cards, panels, buttons, inputs, dialogs, tabs, chips, previews, and chart paper use square corners. Do not imitate square geometry with tiny decorative radii.

Only intrinsically circular functional objects may use `50%` or a full-pill radius: toggle tracks and thumbs, radio buttons, color swatches, drag handles, status dots, and circular chart marks.

Routine components have no shadow. A restrained shadow is allowed only for popovers, dropdowns, and other temporary overlays when a border alone does not establish layering. Focus rings are accessibility affordances, not elevation.

## 5. Components

### Buttons and inputs

- Primary buttons: black fill, white text, black border.
- Default controls: white fill, black or gray border, black text.
- Selected controls: black fill with white text, or a black underline where filling would add too much visual weight.
- Hover: change fill or border without colored UI chrome. Small movement is acceptable only where it reinforces clickability.
- Focus: visible black/graphite ring with sufficient contrast.

### Panels and cards

- Prefer sections divided by rules over nested rounded cards.
- Keep the chart canvas dominant and quieter than its tools.
- Blog cards retain a black border; their authored accent color appears on hover and in their artwork.
- Adjacent items may share borders to avoid double visual weight.

### Navigation and settings

- Navigation is textual and restrained; active state is black.
- Settings categories form a flat icon tab strip with a black indicator.
- Chart-type categories use their assigned accent for the category name and the selected type.
- Inspector groups are separated by rules, not floating cards.
- Functional state stays visible during loading and transitions; avoid replacing whole panels with blank placeholders.

## 6. Do / don’t

Do:

- Keep white, black, typography, and rules as the product foundation.
- Preserve meaningful color in charts, statuses, article accents, the gallery, and visual trails.
- Use spacing and alignment to simplify dense screens.
- Preserve visible keyboard focus and readable disabled states.

Don’t:

- Reintroduce purple UI chrome, colored generic controls, gradients, glass effects, or decorative shadows.
- Add rounded cards or pill-shaped labels for style alone.
- Wrap every group in another container.
- Remove the chart gallery or animated trails; they are intentional brand elements.
