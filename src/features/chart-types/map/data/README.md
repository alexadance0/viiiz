# Bundled map geometry

Source: [Natural Earth](https://www.naturalearthdata.com/), public domain ([terms](https://www.naturalearthdata.com/about/terms-of-use/)). Downloaded 2026-10-03 from the Natural Earth maintainer's [GeoJSON mirror](https://github.com/nvkelso/natural-earth-vector/tree/master/geojson).

- `ne_10m_admin_1_states_provinces.geojson`: SHA-256 `22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5`.
- `ne_50m_admin_0_countries.geojson`: SHA-256 `3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb`.

Rebuild with `python3 scripts/build-map-data.py <admin1.geojson> <countries.geojson>`. The script uses only the Python standard library. Coordinates use Lambert conformal conic projections, are simplified to a 0.38-unit tolerance on a 1000-unit canvas, and rounded to two decimals. Small polygon fragments below 0.5 square units are omitted, while each region's largest polygon is retained. These are thematic chart boundaries, not survey geometry. Geometry is checked into the project; rendering and export require no external requests or API keys.

## Geographic scope

- Russia: 83 Russian administrative units plus Crimea, Sevastopol, Donetsk, Luhansk, Zaporizhzhia and Kherson (89 features). The six Ukrainian territories retain their Ukrainian ISO subdivision IDs, carry `disputed: true`, and use dashed outlines. Their full administrative extents represent Russian territorial claims, not actual control or internationally recognized sovereignty. Alias matching includes ДНР/ЛНР and full Russian names. Crimea and Sevastopol remain separate features. The source's incorrect Russian Altai Krai name is corrected without conflating it with Altai Republic.
- USA: 50 states plus Washington, DC. Alaska and the main Hawaiian islands appear in independently scaled insets. Tiny regions receive clickable point markers; Puerto Rico and other territories are outside this preset.
- Europe: 50 country features, including Turkey, Cyprus, Armenia, Azerbaijan and Georgia. Dependencies are omitted; Russia is clipped at 60°E and the view at 34–72°N and 25°W–60°E. Kosovo retains the source's separate geometry and disputed-status metadata. Country outlines otherwise follow Natural Earth's de facto boundary model, including Crimea. Country ISO A2/A3 codes, Russian and English names are recognized.

`catalog.json` contains only names, aliases and status metadata. The geometry files are imported by the chart compiler, keeping geometry out of the editor's initial UI bundle.

Label anchors are computed on the largest projected polygon using boundary clearance, respecting holes and concave coastlines. Text bounds are checked against the actual polygon and neighboring labels. Explicitly enabled labels take priority and use a leader line when the territory is too small; names and values can be toggled independently per territory.
