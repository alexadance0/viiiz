"""Build checked-in square grids. World input: Tile-Grid-Map-Full.json (see data/README.md)."""
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1] / 'src/features/chart-types/map/data'
catalog = json.loads((root / 'catalog.json').read_text())

def rows(lines, prefix=''):
    return {prefix + code: [x, y] for y, line in enumerate(lines) for x, code in enumerate(line.split()) if code != '.'}

usa = rows([
    '. . . . . . . . . . ME',
    '. . . . . WI . . . VT NH',
    'WA ID MT ND MN IL MI . NY MA .',
    'OR NV WY SD IA IN OH PA NJ CT RI',
    'CA UT CO NE MO KY WV VA MD DE .',
    '. AZ NM KS AR TN NC SC DC . .',
    '. . . OK LA MS AL GA . . .',
    'HI AK . TX . . . . FL . .',
], 'US-')
europe = rows([
    'IS . . . NO SE FI . . .',
    '. . . . . . EE . . .',
    'IE GB . . DK . LT LV . .',
    '. . BE NL DE PL BY RU . .',
    '. FR LU CH CZ SK UA . . .',
    'PT ES AD IT AT HU RO MD GE .',
    '. . MC SI HR BA RS BG TR AZ',
    '. MT SM VA . ME XK MK CY AM',
    '. . . . . AL GR . . .',
    '. . . . . . . . . .',
], '')
# Give the microstates their own cells near their neighbors.
europe['LI'] = [3, 7]
europe['VA'] = [4, 7]
ru = rows([
    '. . . . MUR . . . . . . . . . . . . .',
    '. . SPE KR . . . . . NEN . . . . . . CHU .',
    'KGD . LEN NGR VLG . . . ARK KO YAN . . KYA . SA MAG KAM',
    '. . PSK TVE YAR IVA KOS ME KIR PER KHM TYU TOM KEM IRK AMU KHA .',
    '. SMO KLU MOW MOS VLA NIZ CU TA UD SVE KGN NVS KK BU YEV PRI .',
    '. . BRY ORL TUL RYA MO ULY SAM BA CHE OMS ALT TY ZAB . . .',
    '. . . KRS LIP TAM PNZ SAR ORE . . . AL . . . . SAK',
    '. . UA-14 UA-09 BEL VOR VGG . . . . . . . . . . .',
    '. UA-23 UA-43 AD KDA ROS KL AST . . . . . . . . . .',
    '. UA-65 UA-40 . KC STA CE DA . . . . . . . . . .',
    '. . . . KB SE IN . . . . . . . . . . .',
], '')
russia = {code if code.startswith('UA-') else 'RU-' + code: cell for code, cell in ru.items()}

source = json.loads(Path(sys.argv[1]).read_text())
world = {row['alpha-2']: row['coordinates'] for row in source if row.get('coordinates') and row['alpha-2'] != 'AQ'}
definitions = {region['id']: region for region in catalog['world']}
world = {code: cell for code, cell in world.items() if code in definitions}
used = {tuple(cell) for cell in world.values()}
# Additional small territories keep a nearby anchor, then take the nearest free cell.
# Every territory receives its own tile; parent and dependent values stay separate.
anchors = {
    'GL': 'CA', 'PM': 'CA', 'BM': 'US', 'TC': 'BS', 'KY': 'CU', 'PR': 'DO', 'VI': 'DO', 'VG': 'DO',
    'AI': 'AG', 'MS': 'AG', 'BL': 'AG', 'MF': 'AG', 'SX': 'AG', 'AW': 'VE', 'CW': 'VE',
    'FK': 'AR', 'GS': 'AR', 'SH': 'AO', 'EH': 'MA', 'GG': 'GB', 'JE': 'GB', 'IM': 'GB',
    'FO': 'IS', 'AX': 'FI', 'LI': 'CH', 'MC': 'FR', 'AD': 'ES', 'SM': 'IT', 'VA': 'IT',
    'PS': 'IL', 'XK': 'RS', 'CYN': 'CY', 'SOL': 'SO', 'KAS': 'PK', 'HK': 'CN', 'MO': 'CN', 'CN-TW': 'JP',
    'IO': 'MV', 'IOA': 'AU', 'ATC': 'AU', 'NF': 'AU', 'HM': 'AU', 'TF': 'MG',
    'GU': 'PH', 'MP': 'PH', 'PW': 'PH', 'NC': 'VU', 'WF': 'FJ', 'AS': 'WS', 'CK': 'WS',
    'NU': 'WS', 'PF': 'WS', 'PN': 'NZ',
}
for code in sorted(set(definitions) - set(world)):
    anchor = world.get(anchors.get(code, ''))
    if anchor is None:
        raise ValueError('Missing geographical anchor: ' + code)
    x, y = min(((x, y) for y in range(0, 25) for x in range(0, 31) if (x, y) not in used), key=lambda cell: ((cell[0] - anchor[0]) ** 2 + (cell[1] - anchor[1]) ** 2, cell[1], cell[0]))
    world[code] = [x, y]
    used.add((x, y))

short_ru = {'RU-MOW': 'Мск', 'RU-MOS': 'Мос', 'RU-SPE': 'СПб', 'RU-SA': 'Якут', 'RU-AL': 'Р. Алт', 'RU-ALT': 'Алт. к', 'RU-KHM': 'ХМАО', 'RU-YAN': 'ЯНАО', 'RU-NEN': 'НАО', 'RU-YEV': 'ЕАО', 'UA-43': 'Крым', 'UA-40': 'Сев', 'UA-14': 'ДНР', 'UA-09': 'ЛНР', 'UA-23': 'Зап', 'UA-65': 'Хер', 'RU-SE': 'Осет'}
short_ru.update({'RU-KDA': 'Крд', 'RU-KYA': 'Крас', 'RU-KC': 'Кчр', 'RU-KB': 'Кбр', 'RU-KR': 'Кар', 'RU-VLG': 'Волог', 'RU-VGG': 'Волг', 'RU-NGR': 'Новг', 'RU-NVS': 'Ново', 'RU-KOS': 'Кост', 'RU-STA': 'Став', 'RU-TAM': 'Тамб', 'RU-TYU': 'Тюм', 'RU-TY': 'Тыва', 'RU-ME': 'Мари', 'RU-KO': 'Коми', 'RU-PER': 'Перм', 'RU-CHU': 'Чук', 'RU-BA': 'Бшкр', 'RU-KGD': 'Кали', 'RU-SAR': 'Сарат', 'RU-MO': 'Морд', 'RU-SVE': 'Свер', 'RU-KGN': 'Кург', 'RU-ORE': 'Орен', 'RU-ZAB': 'Заб', 'RU-PSK': 'Пск'})
short_ru.update({'RU-KLU': 'Калу', 'RU-KL': 'Калм'})
output = {}
for preset, grid in [('russia', russia), ('usa', usa), ('europe', europe), ('world', world)]:
    expected = {region['id'] for region in catalog[preset]}
    assert set(grid) == expected, (preset, sorted(expected - set(grid)), sorted(set(grid) - expected))
    assert len({tuple(cell) for cell in grid.values()}) == len(grid), preset
    labels = {region['id']: short_ru.get(region['id'], region['name'].replace('Республика ', '').split()[0][:3]) if preset == 'russia' else region['id'].replace('US-', '') for region in catalog[preset]}
    if preset == 'europe':
        labels.update({row['alpha-2']: row['alpha-3'] for row in source if row['alpha-2'] in expected})
        labels['XK'] = 'KOS'
    if preset == 'world': labels['CN-TW'] = 'TW'
    assert len(set(labels.values())) == len(labels), (preset, [label for label in labels.values() if list(labels.values()).count(label) > 1])
    output[preset] = {code: {'column': cell[0], 'row': cell[1], 'label': labels[code]} for code, cell in grid.items()}
(root / 'tile-grids.json').write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')
print({preset: len(grid) for preset, grid in output.items()})
