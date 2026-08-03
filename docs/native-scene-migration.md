# Native scene migration

## Checkpoint

Phase 5 implementation baseline SHA: `91c8ca96f345db2adda6bb3c49eb40c8c87982da`.

Migrated kinds: the six ordinary bar kinds plus `line`, `spline`, `step-line`, `indexed-line`, `seasonal-line`, `area`, `stacked-area`, `normalized-stacked-area`, and `slope`.

## Render path

```text
legacy ChartConfig adapter
  → native bar, prepared-line, area, or dedicated Slope semantic compiler
  → NativeChartScene (discriminated bar/line/area/slope plot, axes, guides, stable IDs)
  → shared frame/text/axis/reservation layout plus family-local Slope geometry
  → ResolvedScene
  → native ECharts adapter selected by semantic plot kind
  → existing ChartCanvas lifecycle and SVG/PNG export
```

There is no silent native-to-legacy fallback. `compilerMode` is asserted by tests; a native plugin returning a legacy scene is treated as an error. A guard test replaces every migrated plugin's `buildOption` with a throwing function and verifies compile, render, element-color lookup, and value-label enumeration.

## Files introduced or materially changed

- `entities/chart/model`: explicit native/legacy scene union, discriminated bar/line/area/slope plots, typed IDs, and family-neutral semantic mark visitors.
- `features/chart-layout`: independent X/Y spacing, identified/resolved rails, styled-run text measurement, and authoritative native bar geometry.
- `features/chart-types/bar`, `line`, `area`, and `slope`: semantic compilers, pure specialized preparation, shared Cartesian layout for ordinary point plots, and a dedicated Slope comparison layout.
- `features/chart-renderer/echarts`: native bar, point-plot, and Slope adapters with semantic plot-kind dispatch.
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
- Slope keeps persisted `slopeXValues`, family flags, legend/direct settings, series styles, callback keys, annotations, and decorations. It does not expose ordinary legend/direct guides, and its local guide graphics never create a fake semantic or renderer `__slope-guides__` series.
- Waterfall, butterfly, lollipop, dumbbell, interval lines, smoothing, scatter/bubble, distribution, heatmap, and treemap retain their legacy compilers.

## Tests added

- 25 reusable ordinary-bar, 18 reusable basic-line/area, deterministic indexed/seasonal fixtures, and dedicated Slope characterization fixtures.
- compiler-mode, semantics, stable-ID, classification, layout rail, renderer translation, import guard, and throwing-builder tests.
- Existing unit and Playwright coverage continues to cover interaction, undo/redo, category multiline editing, horizontal bars, legends/direct labels, and SVG/PNG export.
- Focused Seasonal coverage separates none/standard/direct modes, group edits and visibility, explicit non-accent colors, persistence/reset/history, native/legacy family transitions, SVG/PNG parity, and seven visual baselines.
- Focused Slope coverage verifies typed two-position preparation, endpoint-label semantics, local collision layout, internal guides, native/legacy transitions, history, preview/SVG/PNG parity, a throwing legacy-builder guard, and seven reviewed visual baselines.

## Known debt and next removable legacy code

The shared legacy `cartesian()` source still contains unreachable ordinary-bar and basic-line/area branches because specialized line, smoothing, and comparison charts share the function. The next safe removal is to split those specialized builders, then delete the migrated conditions and their compatibility option-shape tests. This can happen only after specialized direct-label and value-label overlay geometry consumes resolved scene element bounds directly.

Waterfall, butterfly, lollipop, dumbbell, moving-average-line, moving-average-scatter, range-line, step-range-line, confidence-line, scatter/bubble, distribution, heatmap, and treemap remain separate migrations.
