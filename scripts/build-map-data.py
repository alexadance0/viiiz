"""Build compact, projected map assets from Natural Earth GeoJSON (stdlib only).
Usage: python3 scripts/build-map-data.py /tmp/viiiz-admin1.geojson /tmp/viiiz-countries.geojson
"""
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1] / 'src/features/chart-types/map/data'

def conic(lon0, parallel1, parallel2):
    p1, p2 = map(math.radians, (parallel1, parallel2))
    n = math.log(math.cos(p1) / math.cos(p2)) / math.log(math.tan(math.pi / 4 + p2 / 2) / math.tan(math.pi / 4 + p1 / 2))
    f = math.cos(p1) * math.tan(math.pi / 4 + p1 / 2) ** n / n
    def project(point):
        lon, lat = point[:2]
        delta = (lon - lon0 + 180) % 360 - 180
        rho = f / math.tan(math.pi / 4 + math.radians(min(89, max(-89, lat))) / 2) ** n
        return [rho * math.sin(n * math.radians(delta)), rho * math.cos(n * math.radians(delta))]
    return project

def polygons(feature):
    g = feature['geometry']
    return [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']

def clip(ring, axis, bound, greater):
    result = []
    for a, b in zip(ring, ring[1:] + ring[:1]):
        ai, bi = (a[axis] >= bound, b[axis] >= bound) if greater else (a[axis] <= bound, b[axis] <= bound)
        if ai: result.append(a)
        if ai != bi:
            t = (bound - a[axis]) / (b[axis] - a[axis])
            result.append([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
    return result

def projected(feature, project, bounds=None):
    output = []
    for polygon in polygons(feature):
        rings = []
        for ring in polygon:
            coords = [[p[0] + 360 if bounds and feature['properties'].get('ADM0_A3') == 'RUS' and p[0] < 0 else p[0], p[1]] for p in ring[:-1]]
            if bounds:
                for axis, bound, greater in bounds:
                    coords = clip(coords, axis, bound, greater)
                    if not coords: break
            if len(coords) >= 3: rings.append([project(p) for p in coords])
        if rings: output.append(rings)
    return output

def simplify(points, epsilon=.38):
    if len(points) <= 2: return points
    a, b = points[0], points[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = dx * dx + dy * dy
    def distance(p):
        t = min(1, max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) if length else 0
        return (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2
    index = max(range(1, len(points) - 1), key=lambda i: distance(points[i]))
    if distance(points[index]) > epsilon ** 2:
        return simplify(points[:index + 1], epsilon)[:-1] + simplify(points[index:], epsilon)
    return [a, b]

def ring_area(points):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:] + points[:1])) / 2

def fit(items, rect):
    pts = [p for item in items for polygon in item['polygons'] for ring in polygon for p in ring]
    xmin, xmax = min(p[0] for p in pts), max(p[0] for p in pts)
    ymin, ymax = min(p[1] for p in pts), max(p[1] for p in pts)
    x, y, width, height = rect
    scale = min(width / (xmax - xmin), height / (ymax - ymin))
    offset_x, offset_y = x + (width - (xmax - xmin) * scale) / 2, y + (height - (ymax - ymin) * scale) / 2
    for item in items:
        item['polygons'] = [[[[round(offset_x + (p[0] - xmin) * scale, 2), round(offset_y + (p[1] - ymin) * scale, 2)] for p in ring] for ring in poly] for poly in item['polygons']]

def finish(items):
    for item in items:
        # Simplify closed rings in two arcs; retain the largest polygon even for city regions.
        shapes = sorted(item['polygons'], key=lambda p: abs(ring_area(p[0])), reverse=True)
        result = []
        for i, polygon in enumerate(shapes):
            if i and abs(ring_area(polygon[0])) < .5: continue
            rings = []
            for j, ring in enumerate(polygon):
                if j and abs(ring_area(ring)) < .5: continue
                mid = max(range(len(ring)), key=lambda k: (ring[k][0] - ring[0][0]) ** 2 + (ring[k][1] - ring[0][1]) ** 2)
                arc = simplify(ring[:mid + 1])[:-1] + simplify(ring[mid:] + [ring[0]])[:-1]
                rings.append(arc if len(arc) >= 3 else ring)
            result.append(rings)
        item['polygons'] = result
        # A vertex-based anchor kept inside the largest exterior ring, not an ocean centroid.
        ring = result[0][0]
        xs, ys = [p[0] for p in ring], [p[1] for p in ring]
        center = [sum(xs) / len(xs), sum(ys) / len(ys)]
        def inside(pt):
            flag = False
            for a, b in zip(ring, ring[1:] + ring[:1]):
                if (a[1] > pt[1]) != (b[1] > pt[1]) and pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]: flag = not flag
            return flag
        if not inside(center):
            center = next(([min(xs) + (max(xs) - min(xs)) * ix / 10, min(ys) + (max(ys) - min(ys)) * iy / 10] for iy in range(1, 10) for ix in range(1, 10) if inside([min(xs) + (max(xs) - min(xs)) * ix / 10, min(ys) + (max(ys) - min(ys)) * iy / 10])), ring[0])
        item['center'] = [round(p, 2) for p in center]
        item['area'] = round(sum(abs(ring_area(poly[0])) - sum(abs(ring_area(r)) for r in poly[1:]) for poly in result), 2)
    return items

admin = json.loads(Path(sys.argv[1]).read_text())['features']
countries = json.loads(Path(sys.argv[2]).read_text())['features']
ru_projection, us_projection, eu_projection = conic(100, 50, 70), conic(-96, 33, 45), conic(15, 35, 65)
extras = {'UA-43': ('Республика Крым', ['Крым', 'Crimea', 'RU-CR']), 'UA-40': ('Севастополь', ['Sevastopol', 'RU-SEV']), 'UA-14': ('Донецкая область', ['ДНР', 'Донецкая Народная Республика', 'Donetsk']), 'UA-09': ('Луганская область', ['ЛНР', 'Луганская Народная Республика', 'Luhansk', 'Lugansk']), 'UA-23': ('Запорожская область', ['Zaporizhzhia', 'Zaporozhye']), 'UA-65': ('Херсонская область', ['Kherson'])}
renamed = {'RU-ALT': 'Алтайский край', 'RU-AL': 'Республика Алтай', 'RU-SA': 'Республика Саха (Якутия)', 'RU-KEM': 'Кемеровская область — Кузбасс'}
ru, us = [], []
for feature in admin:
    p = feature['properties']; code = p.get('iso_3166_2'); nation = p.get('adm0_a3')
    if not p.get('name'): continue
    if nation == 'RUS' or code in extras:
        name = extras[code][0] if code in extras else renamed.get(code, p.get('name_ru') or p['name'])
        aliases = list(dict.fromkeys([x for x in [p.get('name'), p.get('name_ru'), p.get('name_en'), *(extras.get(code, ('', []))[1])] if x and x != name]))
        if code == 'RU-ALT': aliases = [x for x in aliases if x not in ['Республика Алтай', 'Altai Republic']]
        if code == 'RU-SA': aliases += ['Якутия', 'Саха']
        if code == 'RU-KEM': aliases += ['Кузбасс', 'Кемеровская область']
        if code == 'RU-MOW': aliases += ['77', 'г. Москва']
        if code == 'RU-SPE': aliases += ['78', 'СПб', 'Петербург']
        ru.append({'id': code, 'name': name, 'aliases': aliases, 'disputed': code in extras, 'polygons': projected(feature, ru_projection)})
    if nation == 'USA':
        project = conic(-154, 55, 65) if code == 'US-AK' else conic(-157, 15, 25) if code == 'US-HI' else us_projection
        # The Hawaiian inset represents the inhabited main islands.
        bounds = [(0, -161, True), (0, -154, False), (1, 18, True), (1, 23, False)] if code == 'US-HI' else None
        us.append({'id': code, 'name': p['name'], 'aliases': list(dict.fromkeys(x for x in [p.get('name_ru'), p.get('postal'), p.get('name_en')] if x and x != p['name'])), 'disputed': False, 'polygons': projected(feature, project, bounds)})
eu = []
excluded = {'JEY','GGY','IMN','ALD','FRO'}
for feature in countries:
    p = feature['properties']; a3 = p['ADM0_A3']
    if (p.get('CONTINENT') != 'Europe' and a3 not in {'TUR','CYP','ARM','GEO','AZE'}) or a3 in excluded: continue
    a2 = {'NOR':'NO','FRA':'FR','KOS':'XK'}.get(a3, p['ISO_A2'])
    name = {'BLR':'Беларусь','MDA':'Молдова','KOS':'Косово'}.get(a3, p['NAME_RU'])
    shapes = projected(feature, eu_projection, [(0,-25,True),(0,60,False),(1,34,True),(1,72,False)])
    if not shapes: continue
    aliases = list(dict.fromkeys(x for x in [p['NAME'],p.get('NAME_LONG'),p.get('NAME_EN'),p.get('NAME_RU'),a3] if x and x != name))
    if a3 == 'GBR': aliases += ['UK','Великобритания','United Kingdom','Great Britain','Британия']
    if a3 == 'CZE': aliases += ['Czech Republic']
    eu.append({'id':a2,'name':name,'aliases':aliases,'disputed':a3=='KOS','polygons':shapes})
fit(ru, (0,0,1000,590))
fit([x for x in us if x['id'] not in {'US-AK','US-HI'}], (0,0,1000,475))
fit([x for x in us if x['id']=='US-AK'], (20,480,265,150))
fit([x for x in us if x['id']=='US-HI'], (320,510,170,110))
fit(eu, (0,0,800,800))
metadata = {}
for key, items, width, height in [('russia',ru,1000,590),('usa',us,1000,640),('europe',eu,800,800)]:
    items = finish(items)
    metadata[key] = [{k:v for k,v in item.items() if k not in {'polygons','center','area'}} for item in items]
    data = {'width':width,'height':height,'regions':{item['id']:{k:item[k] for k in ['polygons','center','area']} for item in items}}
    target = ROOT / f'{key}.json'; target.write_text(json.dumps(data, ensure_ascii=False, separators=(',',':'))+'\n')
    print(key,len(items),target.stat().st_size,'bytes')
(ROOT/'catalog.json').write_text(json.dumps(metadata, ensure_ascii=False, separators=(',',':'))+'\n')
assert len(ru)==89 and len(us)==51
print('Source SHA256:',[(Path(p).name,hashlib.sha256(Path(p).read_bytes()).hexdigest()) for p in sys.argv[1:]])
