# Chart family parity matrix

Phase 4 implementation baseline: `ee59a994f4bac379129487214e744ad198e999b9`.

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
| waterfall | waterfall | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| butterfly | butterfly | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| lollipop / horizontal-lollipop | lollipop | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| dumbbell | dumbbell | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| slope | specialized line | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| range-line / step-range-line / confidence-line | interval | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| moving-average-line / moving-average-scatter | smoothing | legacy | legacy/hybrid | legacy | existing legacy path | yes |
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
