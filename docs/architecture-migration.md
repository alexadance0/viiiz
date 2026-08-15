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

Specialized interval and Distribution charts, Scatter/Bubble, Lollipop/Horizontal Lollipop, and Dumbbell are native. Waterfall, Butterfly, Heatmap, and Treemap remain explicitly legacy.

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

The legacy `intervalLine()` builder, fake stacked Confidence base/fill series, custom Range band construction, and interval legend filtering were removed from `chartRegistry.ts`. Later phases also removed the Distribution and Lollipop/Dumbbell runtime builders. Waterfall, Butterfly, Heatmap, and Treemap remain explicitly legacy.

## Phase 7.1 checkpoint — deterministic native rendering

Phase 7 stabilization started from: `a264fc3e2056939e27ba042f9cf52fda295159b3`.
Render-lifecycle implementation completed in: `a642d2c6a8f7f767906c7fe6ab04700d1263e979`.
Full stabilization completed in: `521224f`.

The old `renderedChartKind === config.kind` readiness flag described only initial layout availability. The authoritative preview contract is now a monotonic render revision with explicit module loading, font loading, compiling, rendering, post-processing, settled, and error states. The central font loader resolves the chart's configured families before compilation; settlement then occurs after all option/graphic mutations, logical resize, ZRender flush, and two animation frames. Stale async work and temporary export swaps cannot publish a settled preview.

Playwright waits for a newer settled revision after interactions, verifies semantic/rendered kinds, reduced-motion animation state, SVG presence, and stable canvas bounds. Native Confidence direct-label rules were removed from the legacy helper. Line/Area, Smoothing, and Interval now call a typed Cartesian point base without disguising specialized plots as `plot.kind = 'line'`. At the Phase 7.1 checkpoint, Scatter/Bubble remained out of scope pending complete deterministic verification.

## Phase 8 checkpoint — native Scatter/Bubble

Phase 8 started from `b089ab3b5a0eeda0d242ae10482f91496340b82b` and completed in `70bb42f6aa024a92e6f765d08b200fd7e723e85c`.

Scatter and Bubble now dispatch through `plot.kind = 'xy'`, with truthful `x`/`y` channels and a dedicated continuous-axis layout. Only actual data groups live in `plot.series`; trend/band/reference/diagonal/quadrant layers and the size-scale guide have separate semantic types and stable IDs. The renderer consumes no table rows and `ChartCanvas` gained no Scatter geometry branches.

The legacy relationship builder, local bubble callback, fake stacked confidence band, `markLine`, `markArea`, fake size-guide series, legacy tooltip, and legend mutation were removed from `chartRegistry.ts`. At the Phase 8 checkpoint Lollipop and Dumbbell were still legacy; Wave 2 later migrated them. Current legacy families are Waterfall, Butterfly, Heatmap, and Treemap.

The final gate passed three consecutive full E2E runs (44/44 each), the full suite at `--repeat-each=3` (132/132), and the visual file at `--repeat-each=5` (35/35), with no expected snapshot changes. Playwright uses two parallel workers in the supported macOS snapshot environment to avoid host saturation from concurrent SVG/video/trace contexts; this remains a multi-worker verification path.

## Phase 9A checkpoint — native Distribution observations

Phase 9A started from the Phase 8 completion `70bb42f6aa024a92e6f765d08b200fd7e723e85c`; implementation completed in `abef01b4d646512ead007420b62ec7b308694ed5`.

Strip, Jitter, Beeswarm, Counts, and Barcode share one semantic `plot.kind = 'distribution'`: continuous numeric observations plus stable semantic lanes. Compiler-owned groups use measure × optional category identity; observations use raw row/field identity; exact Counts aggregates use aggregate identity; all retain their historical override keys separately. Pure statistics preserve interpolated quartiles and 1.5 IQR, while pure jitter preserves the legacy deterministic index seed.

The dedicated layout resolves frame/axes, measured lane labels, lane/value projection, cross-group swarm packing, jitter, Barcode endpoints, summaries, and semantic lane grids. The ECharts adapter receives final geometry and never reads the table or computes statistics/offsets. The old renderer branches were deleted and guarded; subsequent phases completed Box, Violin, Raincloud, Ridgeline, Histogram, and KDE.

## Phase 9B checkpoint — native Distribution shapes

Phase 9B started from `ccd66becf9b7fd293081055675d5295ba1bff026`; implementation completed in `cf3ec028ec87b74cbeb9e9eabb5b7cb6072c4aae`, migrated legacy shape geometry was deleted in `09b480b`, and the documentation checkpoint is `05f13ed4cb45a1b7a1a9e969ac4d9e70343bb172`.

Boxplot, Violin, Raincloud, and Ridgeline extend `plot.kind = 'distribution'` with discriminated box and density layers. Shared preparation owns stable source groups/observations for all eleven kinds. Pure transforms own peak-normalized shape density, normalized frequency KDE, and Histogram bins; layout owns every subgroup slot, side, polygon, bin rectangle, KDE curve, summary primitive, raincloud offset, ridge overlap, and continuous frequency projection.

The renderer remains `DataTable`/statistics/KDE/binning-free, source observations remain editable independently of visibility, and derived shapes never enter value-label selections. All Distribution kinds are explicitly native, their legacy entry point throws, and the final legacy Distribution runtime branch has been removed.

## Wave 1 checkpoint — deterministic fonts and Distribution frequency

Wave 1 started from `457e501d21403f7a30e81d18894c042b59d6b951`. Font determinism was implemented in `237d7bf465f151e4eaa1ea06a4e64f9d4e52205c`, Histogram/KDE in `4b3f45eae17860ef13836b0ee74eccc9a1edac6b`, and both parallel tracks were integrated in `97a0d14432a65dc88a66b262d5a656d87b1a52d1`.

Critical DM Sans, Manrope, and Onest faces now come from repository-local WOFF2 files and share one readiness boundary across preview, SVG, and PNG. The previous Google-hosted files and the pinned local files have slightly different glyph metrics; therefore the 15 affected Smoothing, Interval, and dense-Lollipop baselines were regenerated once after a three-repeat run reproduced identical pixel diffs every time. No screenshot tolerance changed.

## Wave 2 checkpoint — native Lollipop and Dumbbell

Wave 2 started from `57a9357` after integrating the deterministic-font and Distribution-frequency work; the first native implementation is `f8ea4a4` and this checkpoint includes the blocking-review stabilization.

Lollipop, Horizontal Lollipop, and Dumbbell now share semantic `plot.kind = 'comparison-stem'`. Endpoints are the only source-editable marks. Stems, pair connectors, change labels, direct-guide leaders, and category grid lines are derived layers or resolved geometry. Explicit Dumbbell start/end fields own their roles regardless of generic series ordering, stale bar sorting is ignored, incomplete pairs are omitted, and sorting never changes endpoint identity.

The comparison layout owns linear/log projection, positive log domains, both orientations, dense value-label visibility, direct-label note/leader/collision placement, and category-grid coordinates. Its renderer consumes no table and exposes endpoint/guide metadata at the callback boundary. `ChartCanvas` does not calculate comparison geometry or convert its grid positions. Both legacy runtime builders were removed and replaced with a throwing guard.

## Wave 3 checkpoint — native Waterfall and Butterfly

Wave 3 started from `57a9357`; implementation completed in `db638ea`, legacy cleanup in `31dc990`, and review stabilization in `bb53313`.

Waterfall now compiles `plot.kind = 'waterfall'`: source steps retain raw/aggregate identity, cumulative start/end values are semantic, and the optional total owns a stable synthetic datum ID independent of its editable label. Connectors and change/cumulative label intent are scene data. Its dedicated layout resolves floating rectangles, connector endpoints, label fit/placement, and dense-label visibility before rendering.

Butterfly now compiles `plot.kind = 'butterfly'`: left/right fields are explicit semantic sides, magnitudes are normalized once, each side stacks independently, and the value domain is symmetric. Its dedicated layout owns mirrored rectangles and center/left/right category placement; the renderer consumes resolved geometry and exposes a renderer-neutral hit map to the outer callback adapter.

Both plugins are explicitly native, their legacy entry points throw, and their old `ChartCanvas` split-axis/category/bar-hit and Waterfall pointer-geometry helpers were removed. Representative visual baselines cover three states per family plus Butterfly bottom-label placement. Remaining legacy families are Heatmap and Treemap.

The blocking-review stabilization makes this boundary strict: Butterfly side segments share one category row and touch at cumulative stack edges; category placement is semantic before frame reservation, and resolved category rectangles drive both central editing and selection. Waterfall null steps keep finite cumulative connectors across their slots, while element colors and label placements—including the synthetic total—remain authoritative. Both compilers restore the source-family `ChartDocument`, Butterfly validation composes generic duplicate-category checks with side mapping, and the outer canvas contains no Waterfall/Butterfly family event or category-geometry branch.
