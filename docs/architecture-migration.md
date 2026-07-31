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
