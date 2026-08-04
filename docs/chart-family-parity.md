# Chart family parity matrix

Phase 7 implementation baseline: `595385b73040b26095928d553ae27084b27003d4`.

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
| waterfall | waterfall | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| butterfly | butterfly | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| lollipop / horizontal-lollipop | lollipop | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| dumbbell | dumbbell | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| range-line / step-range-line / confidence-line | interval | native | shared native Cartesian frame/axes | visible source point metadata; derived bands excluded | shared SVG/PNG boundary | no |
| moving-average-line / moving-average-scatter | smoothing transform | native | shared native Cartesian frame/axes | raw native point metadata; derived layer non-editable | shared SVG/PNG boundary | no |
| scatter / bubble / distribution | corresponding semantic family | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| heatmap / treemap | matrix / hierarchy | legacy | specialized hybrid | legacy/specialized | existing legacy path | yes |

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
