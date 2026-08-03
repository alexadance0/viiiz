# Native scene migration

## Checkpoint

Phase 6 implementation baseline SHA: `2924c29243a2fedefb5e6f6b270279ea9c70fa3b`.
Phase 6 completion commit: pending at documentation time.

Migrated kinds: the six ordinary bar kinds plus `line`, `spline`, `step-line`, `indexed-line`, `seasonal-line`, `area`, `stacked-area`, `normalized-stacked-area`, `slope`, `moving-average-line`, and `moving-average-scatter`.

## Render path

```text
legacy ChartConfig adapter
  → native bar, prepared-line, area, dedicated Slope, or dedicated smoothing semantic compiler
  → NativeChartScene (discriminated bar/line/area/slope/smoothing plot, axes, guides, stable IDs)
  → shared frame/text/axis/reservation layout plus family-local Slope geometry
  → ResolvedScene
  → native ECharts adapter selected by semantic plot kind
  → existing ChartCanvas lifecycle and SVG/PNG export
```

There is no silent native-to-legacy fallback. `compilerMode` is asserted by tests; a native plugin returning a legacy scene is treated as an error. A guard test replaces every migrated plugin's `buildOption` with a throwing function and verifies compile, render, element-color lookup, and value-label enumeration.

## Files introduced or materially changed

- `entities/chart/model`: explicit native/legacy scene union, discriminated bar/line/area/slope/smoothing plots, typed series/layer/datum IDs, and family-neutral semantic mark visitors.
- `features/chart-layout`: independent X/Y spacing, identified/resolved rails, styled-run text measurement, and authoritative native bar geometry.
- `features/chart-types/bar`, `line`, `area`, `slope`, and `smoothing`: semantic compilers, pure specialized transforms, shared Cartesian layout for point plots, and a dedicated Slope comparison layout.
- `features/chart-renderer/echarts`: native bar, point-plot, Slope, and smoothing adapters with semantic plot-kind dispatch.
- `core/chartRegistry.ts`: explicit compiler modes/capabilities and semantic helper branches.
- `components/ChartCanvas.tsx`: native geometry is preserved across the temporary legacy composition block; native category formatters are not post-mutated; renderer IDs are adapted to existing callbacks at the outer boundary.
- `src/test-fixtures/charts/bar.ts`, `lineArea.ts`, and adjacent architecture tests: deterministic parity harness and guardrails.

## Deliberately retained compatibility

- Saved files still use `ChartConfig`; `compatibilityConfig` carries presentation fields until `ChartDocument` persistence is migrated.
- Existing `seriesStyles`, `elementStyles`, and category override keys remain unchanged and map onto stable native IDs.
- Existing callback DTOs, rich HTML storage/overlays, annotations/decorations, and export commands remain unchanged.
- Direct-series guides now carry resolved per-series inclusion, labels, notes, text style, color, side, and leader-line policy. The shared renderer no longer derives direct-label inclusion from the legacy product kind. Wide line hit areas retain their ECharts compatibility representation.
- Categorical guides carry typed series and group items with stable IDs. Seasonal decides semantic membership only: `Seasonal accent ≠ legend mode`; its standard legend is accent series plus the non-accent `Остальные` group. Generic layout and rendering measure and draw that group without Seasonal branches or a fake plot series.
- `buildOption` remains on the plugin interface for unmigrated callers. For ordinary bars its implementation is a native compile/layout/render compatibility facade, not the legacy cartesian builder.
- Slope keeps persisted `slopeXValues`, family flags, change-label/direction-color settings, legend/direct settings, series styles, callback keys, annotations, and decorations. Old documents omit the new optional fields and retain the previous appearance because change labels and direction colors default off. It does not expose ordinary legend/direct guides, and its local guide/label graphics never create fake semantic or renderer series.
- Waterfall, butterfly, lollipop, dumbbell, interval lines, scatter/bubble, distribution, heatmap, and treemap retain their legacy compilers.

## Tests added

- 25 reusable ordinary-bar, 18 reusable basic-line/area, deterministic indexed/seasonal fixtures, and dedicated Slope characterization fixtures.
- compiler-mode, semantics, stable-ID, classification, layout rail, renderer translation, import guard, and throwing-builder tests.
- Existing unit and Playwright coverage continues to cover interaction, undo/redo, category multiline editing, horizontal bars, legends/direct labels, and SVG/PNG export.
- Focused Seasonal coverage separates none/standard/direct modes, group edits and visibility, explicit non-accent colors, persistence/reset/history, native/legacy family transitions, SVG/PNG parity, and seven visual baselines.
- Focused Slope coverage verifies typed two-position preparation, endpoint-label ownership and leaders, centered X labels, shared change semantics, local change-label placement, direction colors, missing/log cases, native/legacy transitions, history, preview/SVG/PNG parity, and a throwing legacy-builder guard.
- Focused smoothing coverage verifies transform order/window semantics, stable layer and derived-point identity, raw-only selection, layer legends, average-only direct labels, shared axis rails/domains, native family transitions, renderer isolation, SVG/PNG preview parity, and eight visual baselines.

## Known debt and next removable legacy code

The shared legacy `cartesian()` source still contains unreachable ordinary-bar, basic-line/area, and smoothing-compatible generic code because remaining specialized interval/comparison charts share the function. The moving-average transform, generated raw/average series branch, and smoothing legend override have been deleted. The next safe removal is to split the remaining specialized builders, then delete migrated generic conditions and their compatibility option-shape tests.

Waterfall, butterfly, lollipop, dumbbell, range-line, step-range-line, confidence-line, scatter/bubble, distribution, heatmap, and treemap remain separate migrations.
