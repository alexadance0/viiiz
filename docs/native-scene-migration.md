# Native scene migration

## Checkpoint

Phase 7 implementation baseline SHA: `595385b73040b26095928d553ae27084b27003d4`.
Phase 7 implementation completed in: `d939955`.

Phase 7 stabilization started from: `a264fc3e2056939e27ba042f9cf52fda295159b3`.
Phase 7 stabilization completed in: `521224f`.
Full E2E verification: three consecutive runs passed (44/44 each), `--repeat-each=3` passed (132/132), and the visual file passed five times (35/35).

Phase 8 started from `b089ab3b5a0eeda0d242ae10482f91496340b82b` and completed in `70bb42f6aa024a92e6f765d08b200fd7e723e85c`.

Phase 9A started from `70bb42f6aa024a92e6f765d08b200fd7e723e85c` and its native Distribution implementation completed in `abef01b4d646512ead007420b62ec7b308694ed5`.

Wave 2 native Lollipop/Dumbbell started from `57a9357`; the first implementation completed in `f8ea4a4` and the blocking-review stabilization is recorded by this checkpoint.

Migrated kinds: the six ordinary bar kinds plus `line`, `spline`, `step-line`, `indexed-line`, `seasonal-line`, `area`, `stacked-area`, `normalized-stacked-area`, `slope`, `moving-average-line`, `moving-average-scatter`, `range-line`, `step-range-line`, `confidence-line`, `scatter`, `bubble`, all Distribution kinds, `lollipop`, `horizontal-lollipop`, and `dumbbell`.

## Render path

```text
legacy ChartConfig adapter
  → native bar, prepared-line, area, dedicated Slope/smoothing/interval/XY/Distribution/comparison-stem semantic compiler
  → NativeChartScene (discriminated bar/line/area/slope/smoothing/interval/xy/distribution/comparison-stem plot, axes, guides, stable IDs)
  → shared frame/text/axis/reservation layout plus family-local resolved geometry
  → ResolvedScene
  → native ECharts adapter selected by semantic plot kind
  → existing ChartCanvas lifecycle and SVG/PNG export
```

There is no silent native-to-legacy fallback. `compilerMode` is asserted by tests; a native plugin returning a legacy scene is treated as an error. A guard test replaces every migrated plugin's `buildOption` with a throwing function and verifies compile, render, element-color lookup, and value-label enumeration.

## Files introduced or materially changed

- `entities/chart/model`: explicit native/legacy scene union, discriminated bar/line/area/slope/smoothing/interval plots, typed series/layer/group/datum IDs, and family-neutral semantic mark visitors.
- `features/chart-layout`: independent X/Y spacing, identified/resolved rails, styled-run text measurement, and authoritative native bar geometry.
- `features/chart-types/bar`, `line`, `area`, `slope`, `smoothing`, `interval`, `xy`, `distribution`, and `comparison-stem`: semantic compilers, pure specialized transforms, and family-owned resolved geometry.
- `features/chart-renderer/echarts`: native adapters selected only by semantic plot kind; comparison-stem consumes resolved endpoint/connector/grid/direct-guide geometry without table access.
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
- Interval groups retain persisted field triples, fill settings, `showBounds`, source styles, element override keys, and auto-grouping. Hidden Confidence bounds remain in domains and band validation but are absent from guides, value-label targets, tooltips, and selection visitors. Bands are silent derived layers and are never editable data rows.
- Waterfall, Butterfly, Heatmap, and Treemap retain their legacy compilers.

## Tests added

- 25 reusable ordinary-bar, 18 reusable basic-line/area, deterministic indexed/seasonal fixtures, and dedicated Slope characterization fixtures.
- compiler-mode, semantics, stable-ID, classification, layout rail, renderer translation, import guard, and throwing-builder tests.
- Existing unit and Playwright coverage continues to cover interaction, undo/redo, category multiline editing, horizontal bars, legends/direct labels, and SVG/PNG export.
- Focused Seasonal coverage separates none/standard/direct modes, group edits and visibility, explicit non-accent colors, persistence/reset/history, native/legacy family transitions, SVG/PNG parity, and seven visual baselines.
- Focused Slope coverage verifies typed two-position preparation, endpoint-label ownership and leaders, centered X labels, shared change semantics, local change-label placement, direction colors, missing/log cases, native/legacy transitions, history, preview/SVG/PNG parity, and a throwing legacy-builder guard.
- Focused smoothing coverage verifies transform order/window semantics, stable layer and derived-point identity, raw-only selection, layer legends, average-only direct labels, shared axis rails/domains, native family transitions, renderer isolation, SVG/PNG preview parity, and eight visual baselines.
- Focused interval coverage verifies pure linear crossing/step/confidence-gap geometry, prepared missing/percent behavior, stable group/band/cell identity, unique source lines, confidence visibility and boundary styling, shared top/right/multiline/rotated axes, linear/log/manual domains, guide/visitor filtering, renderer isolation, transitions, undo/redo, SVG/PNG export, and twelve visual baselines.
- Focused comparison-stem coverage verifies explicit Dumbbell role order, stale-sort isolation, missing pairs, stable IDs, linear/log domains in both orientations, dense labels, native category grids, direct notes/leaders/collision metadata, endpoint/connector interaction styling, typed guide clicks, preview/export behavior, and reviewed visual baselines.

## Known debt and next removable legacy code

The shared legacy `cartesian()` source still contains unreachable migrated-family generic code because remaining specialized comparison/relationship charts share the function. The moving-average branches and the complete interval builder—including fake Confidence stacks and custom Range bands—have been deleted. The next safe removal is to split the remaining specialized builders, then delete unreachable generic conditions and compatibility option-shape tests.

Waterfall, Butterfly, Heatmap, and Treemap remain separate migrations.

## Phase 8 native XY

`scatter` and `bubble` now compile a dedicated `CartesianXYPlotScene`. Continuous X/Y scales, final point marker/label styles, tooltip display values, categorical grouping, size encoding, and all analytical decisions are complete before the ECharts adapter. Layout measures continuous tick labels with the actual numeric/date formatters and resolves the Bubble size guide relative to the authoritative plot rectangle.

Linear regression is a pure transform. The trend uses the existing least-squares slope/intercept, 31 deterministic samples, and the existing 95% mean-band delta `1.96 × residualStandardError × sqrt(1/n + (x-xMean)^2/Sxx)`. References, diagonal, quadrants, confidence bands, and size guides are typed layers/guides rather than `markLine`, `markArea`, stacked fake bands, or fake source series.

Native `ElementId` uses source-row/measure identity and therefore does not collapse duplicate X rows. Persisted `legacyKey = series + X` remains readable for overrides; duplicate-X overrides retain their historical shared-key limitation. The legacy relationship builder was removed and replaced by a throwing guard.

## Phase 9A native Distribution observations

`strip-plot`, `jitter-plot`, `beeswarm`, `counts-plot`, and `barcode-plot` now compile `plot.kind = 'distribution'`. A group is the stable measure × optional typed category relationship; semantic lanes keep their own IDs and labels, and raw observation IDs use source row plus measure rather than value, order, label, or pixel position. Persisted row and `count:<value>` override keys remain separate `legacyKey` compatibility fields.

The compiler produces observations, exact-value Counts aggregates, Barcode strokes, full interpolated-quartile/1.5-IQR statistics, and mean/median summary intent. Layout owns the continuous value projection, semantic numeric lane axis, measured label rails, deterministic legacy jitter, cross-group-per-lane swarm packing, Barcode endpoints, summary extents, and lane-grid lines. The dedicated renderer consumes resolved geometry without a `DataTable`, statistics, jitter, swarm, or fake grid series. `DistributionSettings` now imports the neutral series-color helper directly.

The migrated five legacy branches were removed and their legacy entry point throws. Phase 9B subsequently migrated Box, Violin, Raincloud, and Ridgeline. Wave 1 Track B migrated `histogram` and `kde-plot`, so all eleven Distribution kinds are now native and the final legacy Distribution builder is gone.

## Phase 9B native Distribution shapes

Phase 9B started from `ccd66becf9b7fd293081055675d5295ba1bff026`; implementation completed in `cf3ec028ec87b74cbeb9e9eabb5b7cb6072c4aae`, migrated legacy shape geometry was deleted in `09b480b`, and the documentation checkpoint is `05f13ed4cb45a1b7a1a9e969ac4d9e70343bb172`.

`prepareDistributionGroups` is now the single pure source of selected fields, categories, stable groups/lanes, raw observations, colors, and interpolated-quartile/1.5-IQR statistics for every Distribution kind. Shape density preserves its peak-normalized 81-sample transform; frequency KDE preserves normalized Gaussian density, 121 samples, bandwidth fallback, 1.75-bandwidth tails, and zero endpoints. Histogram preserves 3–80 bins, inclusive final bounds, custom domains, range formatting, and median-height summaries.

Box summary, density, Histogram, KDE, and frequency-summary layers have stable IDs. Layout resolves grouped boxes, full/half/split violins, line/box summaries, one-sided Raincloud composition, hollow point rows, orientation-specific Ridgeline overlap/domain extension, Histogram rectangles, and KDE curves. The ECharts adapter consumes resolved geometry without table, statistics, KDE, binning, subgroup, or side decisions. Source observations remain editable through semantic visitors even when their marks are hidden; derived shapes remain non-editable.

## Wave 1 deterministic font boundary

Wave 1 started from `457e501d21403f7a30e81d18894c042b59d6b951`. Font determinism completed in `237d7bf465f151e4eaa1ea06a4e64f9d4e52205c`, native Histogram/KDE completed in `4b3f45eae17860ef13836b0ee74eccc9a1edac6b`, and integration completed in `97a0d14432a65dc88a66b262d5a656d87b1a52d1`.

Repository-local DM Sans, Manrope, and Onest faces are loaded before semantic compilation and text measurement. Preview and export await the same catalog and exports embed the same local faces. Fifteen existing snapshots were refreshed because the former Google-hosted files and pinned local assets have reproducibly different metrics; repeat3 produced the same diffs in all nine focused runs, and tolerance remains unchanged.

## Phase 7.1 render lifecycle

`ChartCanvas` now exposes a monotonic preview lifecycle (`data-render-status`, settled revision, chart kind, and semantic plot kind). A revision settles only after the display option, compatibility graphics, font readiness, logical resize, ZRender flush, and two browser frames. Stale callbacks, render errors, and temporary export options cannot settle a newer or non-preview frame.

Visual tests wait for a strictly newer settled revision after render-affecting interactions and verify a stable non-zero canvas box. Expected screenshots remain unchanged. Native Line/Area/Smoothing/Interval share a typed Cartesian point-render model; Smoothing and Interval no longer cast their semantic plots to Line. Confidence direct-label membership now comes only from its semantic guide, not `ChartCanvas.directLegendGraphics`.

Visual baselines are platform-specific (`chromium-darwin`). Critical product/chart families (DM Sans, Manrope, and Onest) are repository-local WOFF2 assets registered through the central font catalog. The render lifecycle waits for the exact chart families before compilation, invalidates text measurements, and only then reaches resize/ZRender settlement. SVG and PNG exports reuse that readiness boundary and embed the same local faces; the offline Playwright gate blocks Google Fonts and verifies preview/export dimensions. Optional chart families remain lazy-loaded when selected. Cross-platform font rasterization is not treated as pixel-identical.
