"""Build provider aliases from downloaded official directories, without runtime requests.

Usage: python3 scripts/build-map-aliases.py worldbank.json owid.json census-state.txt
OWID JSON is a conversion of regions.yml (e.g. Ruby's stdlib YAML + JSON).
Source URLs and snapshot hashes are documented in map/data/README.md.
"""
import csv
import hashlib
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1] / 'src/features/chart-types/map/data'
catalog = json.loads((root / 'catalog.json').read_text())
country_codes = {code: region['id'] for region in catalog['world'] for code in [region['id'], *region['aliases']]}
country_codes.update({'OWID_KOS': 'XK', 'OWID_CYN': 'CYN', 'OWID_SML': 'SOL'})
result = {'countries': {}, 'countryTotals': [], 'countryOutside': [], 'historical': [], 'states': {}, 'stateOutside': []}

def country(names, code, kind):
    names = list(dict.fromkeys(name for name in names if name))
    if kind != 'country':
        result[kind].extend(names)
    elif code:
        result['countries'].setdefault(code, []).extend(names)
    else:
        result['countryOutside'].extend(names)

for region in json.loads(Path(sys.argv[1]).read_text())[1]:
    country([region['id'], region['iso2Code'], region['name']], country_codes.get(region['iso2Code']) or country_codes.get(region['id']),
            'countryTotals' if region['region']['id'] == 'NA' else 'country')
for region in json.loads(Path(sys.argv[2]).read_text()):
    kind = 'historical' if region.get('is_historical') else 'countryTotals' if region.get('region_type') in {'aggregate', 'continent'} else 'country'
    country([region['code'], region['name'], region.get('short_name'), *region.get('aliases', [])], country_codes.get(region['code']), kind)

state_ids = {region['id'] for region in catalog['usa']}
for row in csv.DictReader(Path(sys.argv[3]).read_text().splitlines(), delimiter='|'):
    names = [row['STUSAB'], row['STATE_NAME'], row['STATE'], str(int(row['STATE'])), row['STATENS'], str(int(row['STATENS'])), f"0400000US{row['STATE']}", row['STATE'] + '000', str(int(row['STATE'] + '000'))]
    if 'US-' + row['STUSAB'] in state_ids:
        result['states']['US-' + row['STUSAB']] = names
    else:
        result['stateOutside'].extend(names)

for key in ['countries', 'states']:
    result[key] = {code: sorted(set(names)) for code, names in sorted(result[key].items())}
for key in ['countryTotals', 'countryOutside', 'historical', 'stateOutside']:
    result[key] = sorted(set(result[key]))
(root / 'provider-aliases.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
print('Mapped countries:', len(result['countries']), 'states:', len(result['states']))
print('Snapshot SHA256:', [(Path(path).name, hashlib.sha256(Path(path).read_bytes()).hexdigest()) for path in sys.argv[1:]])
