# Native scene migration

## Checkpoint

Phase 2 baseline SHA: `47f70f1282c778e3b51562ded863e8bdcc753c64`.

Migrated kinds: `bar`, `stacked-bar`, `normalized-stacked-bar`, `horizontal-bar`, `horizontal-stacked-bar`, and `horizontal-normalized-stacked-bar`.

## Render path

```text
legacy ChartConfig adapter
  → native bar semantic compiler
  → NativeChartScene (rect marks, axes, guides, stable IDs)
  → shared frame/text/axis/reservation layout
  → ResolvedScene
  → native ECharts bar adapter
  → existing ChartCanvas lifecycle and SVG/PNG export
```

There is no silent native-to-legacy fallback. `compilerMode` is asserted by tests; a native plugin returning a legacy scene is treated as an error. A guard test replaces every migrated plugin's `buildOption` with a throwing function and verifies compile, render, element-color lookup, and value-label enumeration.

## Files introduced or materially changed

- `entities/chart/model`: explicit native/legacy scene union, semantic bar model, typed IDs, native-first selection and corrected family specs.
- `features/chart-layout`: independent X/Y spacing, identified/resolved rails, styled-run text measurement, and authoritative native bar geometry.
- `features/chart-types/bar`: semantic compiler and layout resolver.
- `features/chart-renderer/echarts`: native bar adapter and real scene dispatch.
- `core/chartRegistry.ts`: explicit compiler modes/capabilities and semantic helper branches.
- `components/ChartCanvas.tsx`: native geometry is preserved across the temporary legacy composition block; native category formatters are not post-mutated; renderer IDs are adapted to existing callbacks at the outer boundary.
- `src/test-fixtures/charts/bar.ts` and adjacent architecture tests: deterministic parity harness and guardrails.

## Deliberately retained compatibility

- Saved files still use `ChartConfig`; `compatibilityConfig` carries presentation fields until `ChartDocument` persistence is migrated.
- Existing `seriesStyles`, `elementStyles`, and category override keys remain unchanged and map onto stable native IDs.
- Existing callback DTOs, rich HTML storage/overlays, annotations/decorations, and export commands remain unchanged.
- Direct-series labels and value-label hit areas still use specialized ChartCanvas compatibility graphics after the semantic renderer emits stable metadata. Native frame geometry remains authoritative for the plot.
- `buildOption` remains on the plugin interface for unmigrated callers. For ordinary bars its implementation is a native compile/layout/render compatibility facade, not the legacy cartesian builder.
- Waterfall, butterfly, lollipop, dumbbell, line/area, relationship, distribution, heatmap, and treemap retain their legacy compilers.

## Tests added

- 25 reusable ordinary-bar characterization fixtures.
- compiler-mode, semantics, stable-ID, classification, layout rail, renderer translation, import guard, and throwing-builder tests.
- Existing unit and Playwright coverage continues to cover interaction, undo/redo, category multiline editing, horizontal bars, legends/direct labels, and SVG/PNG export.

## Known debt and next removable legacy code

The shared `cartesian()` source still contains an unreachable ordinary-bar branch because non-migrated line/area/specialized charts share the function. The next safe removal is to split the remaining legacy line/area builder from bar-only branches, then delete ordinary-bar conditions and their compatibility option-shape tests. This can happen only after specialized direct-label and value-label overlay geometry consumes resolved scene element bounds directly.

The next family milestone is basic line/area. Waterfall, butterfly, lollipop, dumbbell, heatmap, and treemap must remain separate migrations.
