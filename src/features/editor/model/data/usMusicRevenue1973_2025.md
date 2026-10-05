# US recorded music revenue, 1973–2025

Retrieved 2026-10-05 from the official [RIAA US Revenue Database](https://www.riaa.com/u-s-sales-database/).
The page embeds public Tableau workbook `U_S_RecordedMusicAnalysis_17726391449720`:
https://public.tableau.com/workbooks/U_S_RecordedMusicAnalysis_17726391449720.twb

Source: the `Data/Extracts/federated_10x19ek0gjxv0j16kxqr70.hyper` extract, columns
`Year`, `Format`, `Format2`, `Format3`, `Value`, `CPI Adjustment`.
All records use `Format3 = Wholesale`. Exclude `Format2 = Total` to avoid double counting.
The JSON retains both nominal and inflation-adjusted annual totals for each group, in billions
of USD, rounded to nine decimal places after summing. The chart uses `CPI Adjustment`
directly, in 2025 dollars (2025 adjusted and nominal values are identical).

Grouping, exhaustive and mutually exclusive:

- 8-track: `8 - Track`.
- Vinyl: `LP/EP` and `Vinyl Single`.
- Cassette: `Cassette` and `Cassette Single`.
- CD: `CD` and `CD Single`.
- Downloads: every remaining `Format2 = Digital Downloads` record.
- Streaming: every `Format2 = Streaming` record.
- Other: all remaining records, including synchronization and other physical formats.

The combined 2025 total is $11.535297690 billion. Vinyl includes singles, so its total is
larger than the vinyl-album line in the annual PDF. Recent cassettes may be included in
RIAA's broader `Other Physical` category; do not infer that zero cassette-only revenue
means no cassette sales.

The reference image uses the earlier retail series, so these wholesale values should not
be compared directly to its dollar amounts. The chart does not reproduce the reference's
all-time cumulative format totals or its $1 billion grid intervals.

Latest complete annual report: [2025](https://www.riaa.com/wp-content/uploads/2026/03/RIAA-Year-End-Revenue-2025.pdf).
Latest publication: [Mid-Year 2026](https://www.riaa.com/wp-content/uploads/2026/09/2026-Mid-Year-Music-Industry-Revenue-Report.pdf).
The latter reports $5,974.9 million for January–June 2026. That nominal half-year number is
shown separately in the note, not appended to the annual inflation-adjusted series.
