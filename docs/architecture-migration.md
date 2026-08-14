# Chart architecture migration

Baseline: `13ac62d372432ae51536508084141bca953ea257` (clean worktree).

## Characterized legacy owners

- `core/chartRegistry.ts`: family semantics, grid arithmetic, axes, ECharts options and renderer graphics.
- `components/ChartCanvas.tsx`: frame remeasurement, ECharts lifecycle, renderer feedback, selection, direct labels, heatmap guides, treemap interaction, overlays and export state.
- ECharts: mark layout and additional automatic label layout.
- `CanvasSettings.tsx`: a second spacing model and reset literals.
- `chartExport.ts`: output serialization/font embedding; preview options were temporarily replaced during export.

## Compatibility boundaries

- `legacyChartConfigAdapter` normalizes the editor DTO into `ChartDocument` and a discriminated family spec.
- `ChartPlugin.buildOption` is retained temporarily and marked deprecated. Plugins expose `compile`; the renderer consumes `ChartScene`.
- Scene IDs wrap current `elementKey` values while old override keys remain readable.
- Existing HTML rich-text storage and sanitization remain unchanged.

## Specialized behavior retained

Treemap layout/font feedback, butterfly internal categories, direct labels, continuous heatmap guides, rich SVG export and current annotation/decorations coordinates remain specialized. They must be migrated independently after parity tests; none are treated as a standard legend or generic Cartesian behavior. Bubble's size guide is now a semantic inside-plot XY guide.

## Phase 2 checkpoint — native ordinary bars

Phase 2 baseline: `47f70f1282c778e3b51562ded863e8bdcc753c64`.

`ChartScene` is now an explicit `LegacyChartScene | NativeChartScene` union. Legacy payloads are visibly named and only legacy plugins can produce them. The six ordinary bar kinds compile semantic rect marks with stable series/datum/element IDs, resolve frame/axis/guide rails through the shared layout layer, and render through the native ECharts adapter. Their helper and interaction paths consume semantic mark metadata instead of parsing a legacy option.

The persisted `ChartConfig`, legacy element override keys, rich HTML fields, editor callbacks, and export entry points remain compatibility boundaries. Other families still use `compileLegacyScene`; this milestone does not claim a global migration. See `native-scene-migration.md` and `chart-family-parity.md` for the exact boundary.

## Phase 3 checkpoint — native basic line and area

Phase 3 baseline: `ab264f5d7a69a466935b25873d68c8e1379a7113`.

`NativeChartScene.plot` is now a discriminated bar/line/area union. Basic line, spline, step-line, area, stacked-area, and normalized-stacked-area compile semantic points, interpolation, missing-value policy, stroke/marker/fill intent, stable identities, and category-label plans. They share the native Cartesian frame/axis/text layout and render through plot-kind dispatch without reaching the legacy option builder.

Specialized interval charts, waterfall, butterfly, lollipop, dumbbell, distribution, heatmap, and treemap remain explicitly legacy.

## Phase 6 checkpoint — native smoothing

Phase 6 implementation baseline: `2924c29243a2fedefb5e6f6b270279ea9c70fa3b`.
Implementation completed in: `f43d45c`.

`moving-average-line` and `moving-average-scatter` now compile a dedicated `plot.kind = 'smoothing'`. Each source series owns stable raw and moving-average layer IDs; derived point IDs are based on the average layer and source datum identity, never on a calculated value. A pure trailing transform runs after shared visible-data preparation and emits a value only for a complete finite window.

Smoothing reuses the native point-scale Cartesian axes and frame, while its renderer consumes semantic layer roles and render modes. Raw marks remain the only source-editable points, moving-average labels/direct identification belong only to the derived layer, and the categorical legend targets typed layers. The old moving-average transform and smoothing option branch were removed from `chartRegistry.ts`.

## Phase 7 checkpoint — native interval charts

Phase 7 implementation baseline: `595385b73040b26095928d553ae27084b27003d4`.
Implementation completed in: `d939955`.

`range-line`, `step-range-line`, and `confidence-line` now compile `plot.kind = 'interval'`. Actual main/lower/upper fields remain unique source `SeriesId` lines; deterministic `IntervalGroupId` relationships reference them, while each non-editable band owns a derived `LayerId` and renderer-neutral cells. Linear Range cells split at data-space crossings and resolve the visually top boundary color per part. Step Range cells use the same start/end ownership as their source lines. Confidence cells require finite adjacent `lower <= main <= upper` triples and never bridge an invalid or missing point.

Interval charts reuse prepared point data and the shared native Cartesian frame, axes, guides, category-edge behavior, selection visitors, and export lifecycle. The dedicated ECharts adapter translates semantic cells into clipped polygons below visible source lines. The compiler resolves fill colors, opacity, source visibility, boundary presentation, legend/direct/value-label membership, and domain participation; neither the renderer nor `ChartCanvas` branches on the persisted interval product kind.

The legacy `intervalLine()` builder, fake stacked Confidence base/fill series, custom Range band construction, and interval legend filtering were removed from `chartRegistry.ts`. Waterfall, butterfly, lollipop, dumbbell, distribution, heatmap, and treemap remain explicitly legacy.

## Phase 7.1 checkpoint — deterministic native rendering

Phase 7 stabilization started from: `a264fc3e2056939e27ba042f9cf52fda295159b3`.
Render-lifecycle implementation completed in: `a642d2c6a8f7f767906c7fe6ab04700d1263e979`.
Full stabilization completed in: `521224f`.

The old `renderedChartKind === config.kind` readiness flag described only initial layout availability. The authoritative preview contract is now a monotonic render revision with explicit loading, compiling, rendering, post-processing, settled, and error states. Settlement occurs after all option/graphic mutations, font readiness, logical resize, ZRender flush, and two animation frames; stale async work and temporary export swaps cannot publish a settled preview.

Playwright waits for a newer settled revision after interactions, verifies semantic/rendered kinds, reduced-motion animation state, SVG presence, and stable canvas bounds. Native Confidence direct-label rules were removed from the legacy helper. Line/Area, Smoothing, and Interval now call a typed Cartesian point base without disguising specialized plots as `plot.kind = 'line'`. At the Phase 7.1 checkpoint, Scatter/Bubble remained out of scope pending complete deterministic verification.

## Phase 8 checkpoint — native Scatter/Bubble

Phase 8 started from `b089ab3b5a0eeda0d242ae10482f91496340b82b` and completed in `70bb42f6aa024a92e6f765d08b200fd7e723e85c`.

Scatter and Bubble now dispatch through `plot.kind = 'xy'`, with truthful `x`/`y` channels and a dedicated continuous-axis layout. Only actual data groups live in `plot.series`; trend/band/reference/diagonal/quadrant layers and the size-scale guide have separate semantic types and stable IDs. The renderer consumes no table rows and `ChartCanvas` gained no Scatter geometry branches.

The legacy relationship builder, local bubble callback, fake stacked confidence band, `markLine`, `markArea`, fake size-guide series, legacy tooltip, and legend mutation were removed from `chartRegistry.ts`. Remaining legacy families are Waterfall, Butterfly, Lollipop, Horizontal Lollipop, Dumbbell, Distribution, Heatmap, and Treemap.

The final gate passed three consecutive full E2E runs (44/44 each), the full suite at `--repeat-each=3` (132/132), and the visual file at `--repeat-each=5` (35/35), with no expected snapshot changes. Playwright uses two parallel workers in the supported macOS snapshot environment to avoid host saturation from concurrent SVG/video/trace contexts; this remains a multi-worker verification path.

## Phase 9A checkpoint — native Distribution observations

Phase 9A started from the Phase 8 completion `70bb42f6aa024a92e6f765d08b200fd7e723e85c`; implementation completed in `abef01b4d646512ead007420b62ec7b308694ed5`.

Strip, Jitter, Beeswarm, Counts, and Barcode share one semantic `plot.kind = 'distribution'`: continuous numeric observations plus stable semantic lanes. Compiler-owned groups use measure × optional category identity; observations use raw row/field identity; exact Counts aggregates use aggregate identity; all retain their historical override keys separately. Pure statistics preserve interpolated quartiles and 1.5 IQR, while pure jitter preserves the legacy deterministic index seed.

The dedicated layout resolves frame/axes, measured lane labels, lane/value projection, cross-group swarm packing, jitter, Barcode endpoints, summaries, and semantic lane grids. The ECharts adapter receives final geometry and never reads the table or computes statistics/offsets. The five old renderer branches were deleted and guarded; Box, Violin, Raincloud, Histogram, KDE, and Ridgeline deliberately remain legacy.

## Phase 9B checkpoint — native Distribution shapes

Phase 9B started from `ccd66becf9b7fd293081055675d5295ba1bff026`; implementation completed in `cf3ec028ec87b74cbeb9e9eabb5b7cb6072c4aae`.

Boxplot, Violin, Raincloud, and Ridgeline now extend `plot.kind = 'distribution'` with discriminated box and density layers. Shared preparation owns stable source groups/observations and is also used by the remaining legacy Histogram/KDE boundary. A pure Gaussian shape transform owns the legacy peak-normalized density profile; layout owns every subgroup slot, side, polygon, summary primitive, raincloud offset, and ridge overlap/domain extension.

The renderer remains `DataTable`/statistics/KDE-free, source observations remain editable independently of visibility, and derived shapes never enter value-label selections. The four migrated kinds are explicitly native and their legacy entry point throws. Distribution is not yet fully native: Histogram and KDE remain the Phase 9C frequency-axis migration.
