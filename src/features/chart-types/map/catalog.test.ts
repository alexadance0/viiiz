import { describe, expect, it } from 'vitest'
import { findMapRegion, inferMapRegionField, mapRegions, matchMapRows } from './catalog'
import { russiaOkato } from './russiaRegions'
import { compileNativeMapScene, validateMapMapping } from './compiler'
import { createDefaultChartConfig } from '../../../entities/chart/model/defaultChartConfig'
import type { DataTable } from '../../../core/types'

const table = (rows: DataTable['rows']): DataTable => ({ name: 'Росстат', columns: ['Регион', 'Значение'], rows })
const config = { ...createDefaultChartConfig(), kind: 'map-russia' as const, xField: 'Регион', yField: 'Значение', yFields: ['Значение'], aggregation: 'none' as const, heatmapScaleMode: 'sequential' as const }

describe('Rosstat territorial matching', () => {
  it('recognizes every bundled regional code as text and an Excel number without conflating city/oblast', () => {
    expect(Object.keys(russiaOkato).sort()).toEqual(mapRegions('russia').map((region) => region.id).sort())
    expect(new Set(Object.values(russiaOkato)).size).toBe(89)
    for (const [id, code] of Object.entries(russiaOkato)) {
      expect(findMapRegion('russia', code)?.id, code).toBe(id)
      expect(findMapRegion('russia', Number(code))?.id, code).toBe(id)
      expect(findMapRegion('russia', Number(code).toExponential())?.id, code).toBe(id)
    }
    expect(findMapRegion('russia', '45000000000')?.name).toBe('Москва')
    expect(findMapRegion('russia', '46000000000')?.name).toBe('Московская область')
    expect(findMapRegion('russia', '77')?.id).toBe('RU-MOW')
    expect(findMapRegion('russia', 'Moscow')?.id).toBe('RU-MOW')
    expect(findMapRegion('russia', 'Moscow Oblast')?.id).toBe('RU-MOS')
    const scene = compileNativeMapScene(table([{ Регион: 'Москва', Значение: 12 }, { Регион: 'Московская обл.', Значение: 34 }]), config)
    const city = scene.plot.regions.find((region) => region.regionId === 'RU-MOW')!
    const oblast = scene.plot.regions.find((region) => region.regionId === 'RU-MOS')!
    expect(city.value).toBe(12)
    expect(oblast.value).toBe(34)
    expect(city.area).toBeLessThan(oblast.area / 10)
  })

  it.each([
    ['  г.Москва  ', 'RU-MOW'], ['г. Санкт-Петербург', 'RU-SPE'], ['город Севастополь', 'UA-40'],
    [' СВЕРДЛОВСКАЯ\u00a0обл. 1)', 'RU-SVE'], ['Орловская обл', 'RU-ORL'],
    ['Свердловская область (1)*', 'RU-SVE'],
    ['Респ. Татарстан (Татарстан)', 'RU-TA'], ['Республика Адыгея (Адыгея)', 'RU-AD'],
    ['Удмуртская Республика', 'RU-UD'], ['Чувашская Республика — Чувашия', 'RU-CU'],
    ['Кабардино-Балкарская Республика', 'RU-KB'], ['Карачаево-Черкесская Республика', 'RU-KC'],
    ['Чеченская Республика', 'RU-CE'], ['Республика Северная Осетия – Алания', 'RU-SE'],
    ['Кемеровская обл. — Кузбасс*', 'RU-KEM'], ['Респ. Саха (Якутия)', 'RU-SA'],
    ['ХМАО-Югра', 'RU-KHM'], ['Ханты-Мансийский авт. округ – Югра (Тюменская область)', 'RU-KHM'],
    ['ЯНАО (Тюменская обл.)', 'RU-YAN'], ['Ненецкий АО (Архангельская область)', 'RU-NEN'],
    ['Еврейская авт. область', 'RU-YEV'], ['ЕАО', 'RU-YEV'],
    ['Ханты-Мансийский округ', 'RU-KHM'], ['Ямало-Ненецкий округ', 'RU-YAN'],
    ['Ненецкий округ', 'RU-NEN'], ['Еврейская автономия', 'RU-YEV'], ['Чукотка', 'RU-CHU'],
    ['Тюменская обл. (кроме Ханты-Мансийского авт. округа - Югры и Ямало-Ненецкого авт. округа)', 'RU-TYU'],
    ['Архангельская область без НАО', 'RU-ARK'], ['Донецкая Народная Республика', 'UA-14'],
  ])('recognizes %s as %s', (name, id) => {
    expect(findMapRegion('russia', name)?.id).toBe(id)
  })

  it('skips totals, keeps component values and does not add a total to the exclusive oblast', () => {
    const source = table([
      { Регион: 'Российская Федерация', Значение: 999999 },
      { Регион: 'Уральский федеральный округ', Значение: 888888 },
      { Регион: 'Тюменская область (с автономными округами)', Значение: 300 },
      { Регион: 'ХМАО — Югра', Значение: 150 },
      { Регион: 'ЯНАО', Значение: 100 },
      { Регион: 'Тюменская область без автономных округов', Значение: 50 },
      { Регион: 11000000000, Значение: 120 },
      { Регион: 11100000000, Значение: 20 },
      { Регион: '11001000000**', Значение: 100 },
      { Регион: 'Неизвестный регион', Значение: 9999 },
    ])
    const matches = matchMapRows(source, 'Регион', 'russia')
    expect(matches.totals).toHaveLength(2)
    expect(matches.inclusive).toEqual(['Тюменская область (с автономными округами)', '11000000000'])
    expect(matches.unmatched).toEqual(['Неизвестный регион'])
    expect(validateMapMapping(source, config).ok).toBe(true)
    const scene = compileNativeMapScene(source, config)
    for (const [id, value] of [['RU-TYU', 50], ['RU-KHM', 150], ['RU-YAN', 100], ['RU-ARK', 100], ['RU-NEN', 20]]) {
      expect(scene.plot.regions.find((region) => region.regionId === id)?.value).toBe(value)
    }
    expect(scene.plot.colorDomain).toMatchObject({ min: 20, max: 150 })
  })

  it('never invents an exclusive value from inclusive totals, including tables containing only totals', () => {
    const source = table([{ Регион: 'Тюменская область (с автономными округами)', Значение: 300 }, { Регион: 'ХМАО', Значение: 150 }])
    expect(compileNativeMapScene(source, config).plot.regions.find((region) => region.regionId === 'RU-TYU')?.value).toBeNull()
    const totals = table([{ Регион: 'Архангельская область (включая Ненецкий автономный округ)', Значение: 120 }, { Регион: '71000000000', Значение: 300 }])
    expect(matchMapRows(totals, 'Регион', 'russia').inclusive).toHaveLength(2)
    expect(matchMapRows(totals, 'Регион', 'russia').unmatched).toHaveLength(0)
    expect(validateMapMapping(totals, config).ok).toBe(false)
  })

  it('treats plain oblast names as excluding autonomous districts even with district rows', () => {
    const source = table([
      { Регион: 'Тюменская обл.', Значение: 50 },
      { Регион: 'Архангельская область', Значение: 100 },
      { Регион: 'ХМАО', Значение: 150 },
      { Регион: 'ЯНАО', Значение: 70 },
      { Регион: 'НАО', Значение: 20 },
    ])
    expect(matchMapRows(source, 'Регион', 'russia').inclusive).toEqual([])
    const scene = compileNativeMapScene(source, config)
    for (const [id, value] of [['RU-TYU', 50], ['RU-ARK', 100], ['RU-KHM', 150], ['RU-YAN', 70], ['RU-NEN', 20]]) {
      expect(scene.plot.regions.find((region) => region.regionId === id)?.value).toBe(value)
    }
    expect(matchMapRows(table([{ Регион: 'Тюменская область', Значение: 50 }]), 'Регион', 'russia').matched).toHaveLength(1)
    expect(inferMapRegionField({ name: 'numeric', columns: ['Значение', 'Код'], rows: [{ Значение: 12, Код: 3000000000 }, { Значение: 99, Код: '45000000000' }] }, 'russia')).toBe('Код')
    expect(findMapRegion('russia', '45000000001')).toBeUndefined()
    expect(findMapRegion('russia', 'Свердлвская область')).toBeUndefined()
    expect(findMapRegion('russia', 'Алтай')?.id).not.toBe('RU-ALT')
  })
})

describe('OWID, World Bank, Census and BEA territorial matching', () => {
  it.each([
    ['world', 'Iran, Islamic Rep.', 'IR'], ['world', 'Korea, Rep.', 'KR'],
    ['world', "Korea, Dem. People's Rep.", 'KP'], ['world', 'Congo, Dem. Rep.', 'CD'],
    ['world', 'Congo, Rep.', 'CG'], ['world', 'Egypt, Arab Rep.', 'EG'],
    ['world', 'Venezuela, RB', 'VE'], ['world', 'West Bank and Gaza', 'PS'],
    ['world', 'OWID_KOS', 'XK'], ['europe', 'XKX', 'XK'],
    ['world', 'OWID_CYN', 'CYN'], ['world', 'OWID_SML', 'SOL'],
    ['world', 'Democratic Republic of Congo', 'CD'], ['world', 'East Timor', 'TL'],
    ['world', 'Cape Verde', 'CV'], ['world', 'Czech Republic', 'CZ'],
    ['world', 'NAM', 'NA'], ['world', 'United States', 'US'],
    ['usa', '06', 'US-CA'], ['usa', '6', 'US-CA'], ['usa', '0400000US06', 'US-CA'],
    ['usa', '06000', 'US-CA'], ['usa', '6000', 'US-CA'], ['usa', '01779778', 'US-CA'],
    ['usa', '1779778', 'US-CA'], ['usa', 'District of Columbia', 'US-DC'],
  ] as const)('recognizes %s / %s as %s', (preset, value, id) => {
    expect(findMapRegion(preset, value)?.id).toBe(id)
  })

  it('excludes OWID and World Bank groups and historical entities without losing Namibia or Congo', () => {
    const source = table([
      { Регион: 'OWID_NAM', Значение: 9999 }, { Регион: 'NAM', Значение: 20 },
      { Регион: 'WLD', Значение: 9999 }, { Регион: 'OWID_WRL', Значение: 9999 },
      { Регион: 'High income', Значение: 9999 }, { Регион: 'HIC', Значение: 9999 },
      { Регион: 'OWID_USS', Значение: 9999 }, { Регион: 'OWID_KOS', Значение: 30 },
      { Регион: 'Congo, Dem. Rep.', Значение: 40 },
    ])
    const matches = matchMapRows(source, 'Регион', 'world')
    expect(matches.totals).toHaveLength(5)
    expect(matches.historical).toEqual(['OWID_USS'])
    expect(matches.unmatched).toEqual([])
    const scene = compileNativeMapScene(source, { ...config, kind: 'map-world' })
    expect(scene.plot.regions.find((region) => region.regionId === 'NA')?.value).toBe(20)
    expect(scene.plot.regions.find((region) => region.regionId === 'XK')?.value).toBe(30)
    expect(scene.plot.regions.find((region) => region.regionId === 'CD')?.value).toBe(40)
    expect(scene.plot.colorDomain).toMatchObject({ min: 20, max: 40 })
    expect(findMapRegion('world', 'OWID_NAM')).toBeUndefined()
  })

  it('separates known territories without geometry from unrecognized values', () => {
    const world = matchMapRows(table([{ Регион: 'GIB' }, { Регион: 'GUF' }, { Регион: 'Atlantis' }]), 'Регион', 'world')
    expect(world.outside).toEqual(['GIB', 'GUF'])
    expect(world.unmatched).toEqual(['Atlantis'])
    const europe = matchMapRows(table([{ Регион: 'USA' }, { Регион: 'CHN' }, { Регион: 'DEU' }]), 'Регион', 'europe')
    expect(europe.outside).toEqual(['USA', 'CHN'])
    expect(europe.matched[0].region?.id).toBe('DE')
    const usa = matchMapRows(table([{ Регион: 72 }, { Регион: 'PR' }, { Регион: 'Puerto Rico' }, { Регион: 'US' }, { Регион: '06001' }, { Регион: '0500000US06001' }]), 'Регион', 'usa')
    expect(usa.outside).toEqual(['72', 'PR', 'Puerto Rico'])
    expect(usa.totals).toEqual(['US'])
    expect(usa.unmatched).toEqual(['06001', '0500000US06001'])
    expect(usa.matched).toEqual([])
  })

  it('infers provider geographic headers when numerical observations also resemble state codes', () => {
    const numeric: DataTable = { name: 'Census', columns: ['Value', 'state'], rows: [{ Value: 12, state: 6 }, { Value: 36, state: 48 }] }
    expect(inferMapRegionField(numeric, 'usa')).toBe('state')
    expect(inferMapRegionField({ name: 'sales', columns: ['month', 'value'], rows: [{ month: 'January', value: 6 }, { month: 'February', value: 48 }] }, 'usa')).toBe('month')
    expect(inferMapRegionField({ ...numeric, columns: ['Value', 'GEO_ID'], rows: [{ Value: 12, GEO_ID: '0400000US06' }] }, 'usa')).toBe('GEO_ID')
    expect(validateMapMapping(table([{ Регион: 'OWID_WRL', Значение: 10 }]), { ...config, kind: 'map-world' }).ok).toBe(false)
  })
})
