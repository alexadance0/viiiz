Source: user-supplied `zywoo_weapon_kills_by_year_2018_2026_combined_other.csv`.
The CSV cites HLTV player statistics for ZywOo (player ID 11893).

Only `year` and the five original kill counts are included in the example:
`rifle_kills` → Винтовки, `sniper_kills` → Снайперские винтовки,
`smg_kills` → Пистолеты-пулемёты, `pistol_kills` → Пистолеты,
`utility_other_kills` → Гранаты и прочее.

`kills_total`, `source`, `is_partial_year` and precomputed share columns are
excluded from the site table. The five counts sum exactly to the source total
for every year. Marimekko calculates shares from these counts, retaining annual
totals for proportional widths. The CSV marks 2026 as partial; this is preserved
as a short chart note.
