# Chart family parity matrix

Baseline: `47f70f1282c778e3b51562ded863e8bdcc753c64`.

| Kind | Family | Compiler | Layout | Interaction | Export | Legacy `buildOption` reachable? |
|---|---|---|---|---|---|---|
| bar | bar | native | native frame/axes | native metadata → callback adapter | existing SVG/PNG boundary | no |
| stacked-bar | bar | native | native frame/axes | native metadata → callback adapter | existing SVG/PNG boundary | no |
| normalized-stacked-bar | bar | native | native frame/axes | native metadata → callback adapter | existing SVG/PNG boundary | no |
| horizontal-bar | bar | native | native frame/axes | native metadata → callback adapter | existing SVG/PNG boundary | no |
| horizontal-stacked-bar | bar | native | native frame/axes | native metadata → callback adapter | existing SVG/PNG boundary | no |
| horizontal-normalized-stacked-bar | bar | native | native frame/axes | native metadata → callback adapter | existing SVG/PNG boundary | no |
| waterfall | waterfall | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| butterfly | butterfly | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| lollipop / horizontal-lollipop | lollipop | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| dumbbell | dumbbell | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| line / area / smoothing / interval | corresponding semantic family | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| scatter / bubble / distribution | corresponding semantic family | legacy | legacy/hybrid | legacy | existing legacy path | yes |
| heatmap / treemap | matrix / hierarchy | legacy | specialized hybrid | legacy/specialized | existing legacy path | yes |

## Bar characterization coverage

Reusable fixtures in `src/test-fixtures/charts/bar.ts` cover single/grouped/stacked/normalized and horizontal variants, mixed signs, zeros, long/multiline/many/date categories, axis side matrices, rotated and hidden axis furniture, multiline frame text, regular/direct identification, value labels, series/element overrides, sorting, and numeric formatting.

Parity is enforced at three layers:

- semantic compiler tests assert orientation, stacking, stable identity, override mapping, and ECharts-free output;
- layout/renderer tests assert resolved rails and exact translation of the authoritative plot rectangle;
- existing Playwright preview, interaction, explicit category-line, horizontal orientation, undo/redo, SVG, and PNG scenarios remain the focused visual/export regression layer.
