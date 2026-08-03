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

Treemap layout/font feedback, butterfly internal categories, direct labels, continuous heatmap/bubble guides, rich SVG export and current annotation/decorations coordinates remain specialized. They must be migrated independently after parity tests; none are treated as a standard legend or generic Cartesian behavior.

## Phase 2 checkpoint — native ordinary bars

Phase 2 baseline: `47f70f1282c778e3b51562ded863e8bdcc753c64`.

`ChartScene` is now an explicit `LegacyChartScene | NativeChartScene` union. Legacy payloads are visibly named and only legacy plugins can produce them. The six ordinary bar kinds compile semantic rect marks with stable series/datum/element IDs, resolve frame/axis/guide rails through the shared layout layer, and render through the native ECharts adapter. Their helper and interaction paths consume semantic mark metadata instead of parsing a legacy option.

The persisted `ChartConfig`, legacy element override keys, rich HTML fields, editor callbacks, and export entry points remain compatibility boundaries. Other families still use `compileLegacyScene`; this milestone does not claim a global migration. See `native-scene-migration.md` and `chart-family-parity.md` for the exact boundary.

## Phase 3 checkpoint — native basic line and area

Phase 3 baseline: `ab264f5d7a69a466935b25873d68c8e1379a7113`.

`NativeChartScene.plot` is now a discriminated bar/line/area union. Basic line, spline, step-line, area, stacked-area, and normalized-stacked-area compile semantic points, interpolation, missing-value policy, stroke/marker/fill intent, stable identities, and category-label plans. They share the native Cartesian frame/axis/text layout and render through plot-kind dispatch without reaching the legacy option builder.

Specialized interval charts, waterfall, butterfly, lollipop, dumbbell, scatter/bubble, distribution, heatmap, and treemap remain explicitly legacy.

## Phase 6 checkpoint — native smoothing

Phase 6 implementation baseline: `2924c29243a2fedefb5e6f6b270279ea9c70fa3b`.
Implementation completed in: `f43d45c`.

`moving-average-line` and `moving-average-scatter` now compile a dedicated `plot.kind = 'smoothing'`. Each source series owns stable raw and moving-average layer IDs; derived point IDs are based on the average layer and source datum identity, never on a calculated value. A pure trailing transform runs after shared visible-data preparation and emits a value only for a complete finite window.

Smoothing reuses the native point-scale Cartesian axes and frame, while its renderer consumes semantic layer roles and render modes. Raw marks remain the only source-editable points, moving-average labels/direct identification belong only to the derived layer, and the categorical legend targets typed layers. The old moving-average transform and smoothing option branch were removed from `chartRegistry.ts`.
