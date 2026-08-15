# Native migration contract

This contract is the required specification for every remaining chart-family migration.

1. The semantic scene is the source of truth.
2. Stable IDs never depend on labels, colors, or pixel coordinates.
3. Compilers and pure transforms do not import or produce ECharts structures.
4. Layout is the authoritative owner of resolved geometry.
5. The renderer only adapts resolved semantic geometry to ECharts.
6. `ChartCanvas` contains no chart-family geometry.
7. Derived graphics are typed layers or guides, never fake semantic series.
8. Existing persisted `ChartConfig` documents remain compatible.
9. Native selection, overrides, labels, and visitors read the scene rather than renderer output.
10. Preview, SVG, and PNG use the same semantic geometry and render lifecycle.
11. Rendering remains deterministic across font readiness, resize, revision, settle, and ZRender flush.
12. A migrated kind's legacy builder is protected by a throwing guard.
13. Once parity is proved, the migrated legacy runtime branch is deleted in the same wave.
14. A migration must not change unrelated native visual baselines without a documented reason.
15. No new runtime dependency is added unless the existing codebase and platform cannot meet the requirement.

## Standard pipeline

1. Characterize only family-specific transforms, geometry, settings, interactions, guides, selection, and transitions.
2. Extract the smallest pure transforms.
3. Compile a semantic scene with stable source identities.
4. Resolve all geometry in the family layout provider.
5. Render through the native adapter without reading `DataTable`.
6. Extend typed guides and scene visitors only for new semantic roles.
7. Add a throwing legacy guard and prove native dispatch.
8. Remove the migrated legacy runtime branch.
9. Run focused tests while implementing and one integration gate for the complete wave.

`ChartConfig` remains the persistence boundary until all runtime families are native. Do not combine family migration with persisted-schema redesign, a new state manager, global settings rewrites, or speculative universal scene abstractions.
