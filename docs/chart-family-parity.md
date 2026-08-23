# Chart family parity matrix

Phase 7 implementation baseline: `595385b73040b26095928d553ae27084b27003d4`.
Phase 7 implementation completed in: `d939955`.
Phase 7 stabilization started from: `a264fc3e2056939e27ba042f9cf52fda295159b3`.
Phase 7 stabilization completed in: `521224f`.
Full E2E verification: three consecutive runs passed (44/44 each), `--repeat-each=3` passed (132/132), and visual `--repeat-each=5` passed (35/35).

Phase 8 started from `b089ab3b5a0eeda0d242ae10482f91496340b82b` and completed in `70bb42f6aa024a92e6f765d08b200fd7e723e85c`.
Phase 9A started from that completion and its implementation completed in `abef01b4d646512ead007420b62ec7b308694ed5`.
Phase 9B started from `ccd66becf9b7fd293081055675d5295ba1bff026`; implementation completed in `cf3ec028ec87b74cbeb9e9eabb5b7cb6072c4aae`, migrated legacy shape geometry was deleted in `09b480b`, and the documentation checkpoint is `05f13ed4cb45a1b7a1a9e969ac4d9e70343bb172`.
Wave 1 started from `457e501d21403f7a30e81d18894c042b59d6b951`; font determinism completed in `237d7bf465f151e4eaa1ea06a4e64f9d4e52205c`, Histogram/KDE in `4b3f45eae17860ef13836b0ee74eccc9a1edac6b`, and integration in `97a0d14432a65dc88a66b262d5a656d87b1a52d1`.
Wave 2 started from `57a9357`; native Lollipop/Dumbbell implementation completed in `f8ea4a4` and review stabilization in `7e89a2d`.
Wave 3 started from `57a9357`; native Waterfall/Butterfly implementation completed in `db638ea`, legacy cleanup in `31dc990`, and review stabilization in `bb53313`.

| Kind | Family | Compiler | Layout | Interaction | Export | Legacy `buildOption` reachable? |
|---|---|---|---|---|---|---|
| bar | bar | native | native frame/axes | native metadata → callback adapter | existing SVG/PNG boundary | no |
| stacked-bar | bar | native | native frame/axes | native metadata → callback adapter | existing SVG/PNG boundary | no |
| normalized-stacked-bar | bar | native | native frame/axes | native metadata → callback adapter | existing SVG/PNG boundary | no |
| horizontal-bar | bar | native | native frame/axes | native metadata → callback adapter | existing SVG/PNG boundary | no |
| horizontal-stacked-bar | bar | native | native frame/axes | native metadata → callback adapter | existing SVG/PNG boundary | no |
| horizontal-normalized-stacked-bar | bar | native | native frame/axes | native metadata → callback adapter | existing SVG/PNG boundary | no |
| line | line | native | shared native Cartesian frame/axes | native point metadata → callback adapter | existing SVG/PNG boundary | no |
| spline | line | native | shared native Cartesian frame/axes | native point metadata → callback adapter | existing SVG/PNG boundary | no |
| step-line | line | native | shared native Cartesian frame/axes | native point metadata → callback adapter | existing SVG/PNG boundary | no |
| indexed-line | specialized line transform | native | shared native Cartesian frame/axes | native point metadata → callback adapter | existing SVG/PNG boundary | no |
| seasonal-line | specialized line transform | native | shared native Cartesian frame/axes | native point/year metadata → callback adapter | existing SVG/PNG boundary | no |
| area | area | native | shared native Cartesian frame/axes | native point metadata → callback adapter | existing SVG/PNG boundary | no |
| stacked-area | area | native | shared native Cartesian frame/axes | native point metadata → callback adapter | existing SVG/PNG boundary | no |
| normalized-stacked-area | area | native | shared native Cartesian frame/axes | native point metadata → callback adapter | existing SVG/PNG boundary | no |
| slope | specialized comparison | native | dedicated native Slope layout inside shared frame | native endpoint metadata → callback adapter | shared SVG/PNG boundary | no |
| lollipop / horizontal-lollipop | comparison stem | native | shared native Cartesian frame/axes + resolved stems/grid/direct guides | native endpoint and guide metadata | shared SVG/PNG boundary | no |
| dumbbell | paired comparison stem | native | shared native Cartesian frame/axes + resolved pair/change geometry | native endpoint and guide metadata; connectors derived | shared SVG/PNG boundary | no |
| waterfall | cumulative comparison | native | dedicated floating-bar/connector/label layout | resolved hit metadata → callback adapter | shared SVG/PNG boundary | no |
| butterfly | mirrored comparison | native | dedicated symmetric side-stack/category-rail layout | resolved hit metadata → callback adapter | shared SVG/PNG boundary | no |
| range-line / step-range-line / confidence-line | interval | native | shared native Cartesian frame/axes | visible source point metadata; derived bands excluded | shared SVG/PNG boundary | no |
| moving-average-line / moving-average-scatter | smoothing transform | native | shared native Cartesian frame/axes | raw native point metadata; derived layer non-editable | shared SVG/PNG boundary | no |
| scatter / bubble | continuous XY relationship | native | dedicated continuous XY layout inside shared frame | unique native point IDs; derived analytics excluded | shared SVG/PNG boundary | no |
| strip-plot / jitter-plot / beeswarm | observation distribution | native | dedicated lane/value layout; deterministic offsets | stable raw observation metadata | shared SVG/PNG boundary | no |
| counts-plot | exact-value distribution aggregate | native | dedicated lane/value layout | stable aggregate metadata | shared SVG/PNG boundary | no |
| barcode-plot | observation tick distribution | native | dedicated lane/value/tick layout | stable raw observation metadata | shared SVG/PNG boundary | no |
| boxplot | distribution summary shape | native | dedicated lane/value box geometry | raw observations editable; derived box excluded | shared SVG/PNG boundary | no |
| violinplot / raincloud / ridgeline | statistical density shapes | native | dedicated lane/value density geometry | raw observations editable; derived density excluded | shared SVG/PNG boundary | no |
| histogram / kde-plot | distribution frequency/density | native semantic frequency layers | native continuous value × frequency/density axes | stable bins and source observations | shared SVG/PNG boundary | no |
| heatmap | matrix | native | resolved cells and four-sided color guide | native custom renderer | semantic compiler/layout/renderer | yes |
| treemap | hierarchy | legacy | specialized hybrid | legacy/specialized | existing legacy path | yes |

## Bar characterization coverage

Reusable fixtures in `src/test-fixtures/charts/bar.ts` cover single/grouped/stacked/normalized and horizontal variants, mixed signs, zeros, long/multiline/many/date categories, axis side matrices, rotated and hidden axis furniture, multiline frame text, regular/direct identification, value labels, series/element overrides, sorting, and numeric formatting.

Parity is enforced at three layers:

- semantic compiler tests assert orientation, stacking, stable identity, override mapping, and ECharts-free output;
- layout/renderer tests assert resolved rails and exact translation of the authoritative plot rectangle;
- existing Playwright preview, interaction, explicit category-line, horizontal orientation, undo/redo, SVG, and PNG scenarios remain the focused visual/export regression layer.

## Basic line/area characterization coverage

Reusable fixtures in `src/test-fixtures/charts/lineArea.ts` cover gap/zero/connect missing values, linear/spline/step interpolation, markers, point and segment overrides, direct labels on both sides, date axes, log/manual domains, plain/stacked/normalized areas, fill opacity, axis-side/grid combinations, and multiline frame text.

The semantic compiler records point placement, interpolation, missing-value policy, stroke/marker/fill intent, stable point IDs, and the precomputed category-label plan. The renderer dispatches on `plot.kind`; throwing-builder tests prove that migrated kinds cannot fall back to the legacy cartesian builder.

## Specialized trend characterization coverage

Deterministic fixtures in `src/test-fixtures/charts/specializedTrends.ts` cover positive/negative/zero/missing index bases, multiple series, duplicate rendered date labels, monthly aggregation, missing months, accent/muted presentation, explicit color precedence, per-series direct labels, axis-side geometry, and SVG/PNG exports.

The transform pipelines are explicit and source-preserving:

```text
indexed: raw table → filtering/sorting/aggregation → percent/missing policy → index-to-base → semantic Line scene
seasonal: raw dated rows → year/month buckets → monthly aggregation → missing policy → semantic Line scene
```

## Phase 8 continuous XY parity

Scatter and Bubble compile `plot.kind = 'xy'`: X is linear/time, Y is linear/log, and neither axis is represented as a category. Visible series are the Y-field × optional stringified color-group product. A point ID includes source-row/measure identity, so duplicate X values remain distinct; the old `series + X` key remains only for saved `elementStyles` compatibility and is intentionally ambiguous.

Bubble uses semantic `sqrt-absolute` size encoding. Zero maps to the minimum diameter, maximum absolute magnitude maps to the maximum, negative values use magnitude, reversed configured bounds are ordered without mutation, and invalid per-row sizes use the ordinary point diameter. Its size-scale guide is an inside-plot overlay with resolved pixel geometry and coexists with the outside categorical legend.

Regression, 95% confidence envelopes, references, the clipped X=Y diagonal, and quadrants are derived semantic layers. They are silent, absent from legends/tooltips/selections/value-label listings, and never become fake source series. The old Scatter/Bubble builder is permanently throwing and its ECharts option construction has been removed.

## Phase 9A Distribution observation parity

All five migrated variants share stable semantic groups, lanes, observations, full summary statistics, orientation mapping, value-domain persistence, lane labels, legend membership, and mean/median summary marks. Strip permits overplotting. Jitter uses the exact deterministic legacy hash. Beeswarm packs every category subgroup sharing a lane as one pixel-space cloud. Counts groups by exact numeric value and resolves `baseSize × sqrt(count)` before rendering. Barcode compiles strokes and resolves perpendicular endpoints in layout.

Raw and Barcode selections expose every source observation without ECharts introspection; Counts exposes only stable exact-value aggregate marks. Historical `elementStyles`, label fields, category labels/colors/order/visibility, series ordering, point/tick opacity, marker overrides, and summary precedence remain compatible through separate legacy keys. Compiler/layout contain no ECharts vocabulary, renderer contains no `DataTable`, and lane grid/summary marks are silent graphics rather than fake series.

## Phase 9B Distribution shape parity

Box, Violin, Raincloud, and Ridgeline extend the same stable groups, lanes, observations, statistics, axes, grids, legends, and visitors. Box layers carry actual 1.5-IQR inlier whiskers, Q1/Q3, median styling, and source-ID outlier visibility. Density layers use the legacy peak-normalized Gaussian sum, bandwidth `max(groupSpan × ratio, globalSpan / 1000)`, 81 samples, and 1.75-bandwidth tails with zero endpoints.

Layout owns subgroup slots, full/half/split sides, density polygons, statistic extents, raincloud offsets and point modes, asymmetric ridge overlap, Histogram rectangles, KDE curves, and continuous frequency projection. The shared renderer draws only resolved primitives and structured tooltips. Raw observation IDs and legacy override keys do not depend on orientation, bandwidth, side, overlap, or canvas size. All eleven Distribution variants are native.

Seasonal emphasis and identification are independent: `Seasonal accent ≠ legend mode`. With no legend, accent changes only stroke presentation. The standard Seasonal legend contains individual accent-year items plus one semantic `Остальные` group for ordinary muted non-accent years; a non-accent year with an explicit color remains an individual truthful item. Direct mode uses the shared direct-series guide, defaults accent years on and non-accent years off, and respects explicit per-series overrides.

`Остальные` has a stable legend-item ID and computed year membership, but is never added to plot data as a fake series. Its label and visibility use the same persisted legend overrides, reset, undo/redo, preview, and SVG/PNG path as ordinary legend items.

## Slope characterization coverage

Deterministic fixtures in `src/test-fixtures/charts/slope.ts` and focused compiler/renderer tests cover natural and explicit two-position selection, typed date/string/number identity, prepared-order retention, aggregation, percent and missing values, mixed signs, manual/log domains, both axis sides, number formatting, series styles, stable IDs, and source immutability.

Slope now has its own semantic `plot.kind = 'slope'`, compiler, layout, and renderer. The shared frame still owns title/subtitle/note/source anchors; the Slope layout owns the 25%/75% comparison positions, guide extents, endpoint rails, internal Y-scale rail, exact multiline endpoint boxes, collision displacement, leaders, and change-label geometry. ECharts point-label collision is disabled: layout is the single owner, so an isolated endpoint remains exactly on its data anchor and only displaced labels receive leaders. Values and names follow the preserved matrix: left value only; right value plus series name; values-only on both sides; names-only on the right.

Horizontal/vertical guides, the internal comparison scale, endpoint labels, leaders, and optional change labels are semantic Slope fields and render as local graphics. Change descriptors use the renderer-neutral shared direction/absolute/percent contract also used by Dumbbell; a zero base formats as `н/д`. Direction coloring is opt-in and temporarily resolves connector, markers, endpoint/change labels, and leaders without overwriting stored series colors. X labels stay centered on their 25%/75% ticks for bottom/top, multiline, and rotated modes. No fake guide/change series exists in the scene or renderer output. Standard and direct legend settings remain persisted but are intentionally ignored while Slope is active.

## Smoothing characterization coverage

The transform order is explicit:

```text
raw table → filtering/sorting/aggregation → percent/missing policy → trailing inclusive moving average → semantic smoothing layers
```

The window is rounded with a minimum of two and is not upper-clamped by the compiler. A derived value exists only when the entire trailing window contains finite values; otherwise it is `null`. Both raw and derived values participate in the declared value domain, with manual/log domains and zero-line settings retained by the shared Cartesian contract.

Every source group has stable `raw` and `moving-average` layer identities. Line mode renders a thin faded raw line; scatter mode renders faded borderless raw points; both render the average as the full source-styled line. Raw value labels and direct labels are suppressed. Derived value labels follow the chart setting, while direct identification targets only average layers and retains source legend labels, notes, text styles, and leader settings. The standard legend has typed layer targets and semantic line/point/opacity markers.

## Interval characterization coverage

The shared transform order is:

```text
raw table → filtering/sorting/aggregation → percent/missing policy → interval validation/cells → semantic interval scene
```

Range and Step Range prepare exactly the selected lower/upper fields and ignore `seriesField`. Linear cells split deterministic data-space crossings; `by-bound` fill follows the visually top real source series on each part. Step cells and both source lines share exact `start`/`end` ownership. Confidence prepares unique fields referenced by explicit groups, or complete automatic `yFields` triples, and creates cells only across adjacent finite ordered triples. Hidden bounds remain real source series in the domain and band relationship but do not leak into guides, labels, tooltip, selection, or callbacks.

Stable `IntervalGroupId` values derive from participating `SeriesId` values and stable band-cell IDs derive from the band plus adjacent category identities and part number. Bands contain no renderer vocabulary, source identity, or editability. The interval ECharts adapter renders clipped silent polygons below visible real lines and dispatches only on `plot.kind = 'interval'`.

## Comparison-stem parity

Lollipop and Dumbbell compile one `ComparisonStemPlotScene`. A Lollipop source point owns its stable raw/aggregate datum and element IDs; its baseline stem owns a derived `LayerId`. Dumbbell resolves its explicit start field before its explicit end field even when persisted `seriesOrder` is reversed. Only complete pairs enter the plot; `difference`/`start`/`end` sorting reorders stable category and endpoint references without changing IDs. Stale generic `barCategorySort` is intentionally neutralized.

The value domain is linear or strictly positive logarithmic in either orientation. Nonpositive log endpoints remain source semantics but produce neither invalid pixel geometry nor unresolved renderer connectors. Layout owns endpoint, connector, change-label, dense-value-label, category-grid, and direct-guide geometry. Direct guides include notes, optional or displacement-required leaders, bounded non-overlapping one-dimensional collision displacement, and typed guide click metadata. Guide clicks focus the legend editor without creating a faux selected element or dimming real series. Custom endpoint marks and their derived stems/connectors participate in the existing series hover/selection dimming contract. The renderer reads no `DataTable`; `ChartCanvas` contains no Lollipop/Dumbbell geometry branch.

## Phase 7.1 integration checkpoint

The interval semantic migration and its integration quality are tracked separately. Integration now uses an explicit revision-aware final-frame contract for preview, transitions, resize/font completion, and export restoration. Full-suite and repeated visual verification capture only `settled` revisions. Phase 8 moved Scatter/Bubble to native XY, Wave 1 completed Distribution, Wave 2 completed Lollipop/Dumbbell, Wave 3 completed Waterfall/Butterfly, and Wave 4 completed Heatmap. The only remaining unmigrated family is Treemap.

## Wave 4 checkpoint: native Heatmap

Heatmap now compiles explicit matrix cells, including missing cells, stable datum identities, row order, value labels, colors, and an asymmetric continuous color guide. Layout owns all cell rectangles and guide reservations on every side; the custom renderer consumes those resolved bounds without `HeatmapChart`, `VisualMapComponent`, renderer-model feedback, or `ChartCanvas` scale positioning.

## Wave 3 Waterfall and Butterfly parity

Waterfall preserves cumulative steps, mixed signs and missing deltas, optional total/total value, connector styling, change/cumulative/both labels, sign modes, automatic inside/outside placement, overlap hiding, per-element styles, tooltips, selection, and stable export. The total uses `syntheticDatumId('waterfall-total', measure)` so changing its display label does not change native identity.

Butterfly preserves absolute magnitudes, distinct left/right field mapping, independent multi-measure side stacks, symmetric axes, center/left/right category placement, date/category overrides, series and element styles, labels, tooltips, two-stage series/element selection, and export. Compiler and layout tests prove side/domain/geometry ownership; renderer tests prove resolved custom geometry and selection identity; three visual cases per family pin the main layout variants.

Post-review parity also covers null Waterfall steps at the beginning/middle/end, element-specific Waterfall colors and label positions, contiguous Butterfly stack segments, duplicate-category validation, source-family document specs, mirrored label placement/contrast, and selectable center categories whose editor rectangles come directly from native layout. The legacy Butterfly entry uses the same throwing-guard boundary as Waterfall and is excluded from the generic cartesian factory.
