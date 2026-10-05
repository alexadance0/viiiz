// Rosstat regional OKATO codes, including its two selections excluding autonomous districts.
// Sources and territorial scope are documented in data/README.md.
export const russiaOkato: Record<string, string> = {
  'RU-BEL': '14000000000', 'RU-BRY': '15000000000', 'RU-VLA': '17000000000',
  'RU-VOR': '20000000000', 'RU-IVA': '24000000000', 'RU-KLU': '29000000000',
  'RU-KOS': '34000000000', 'RU-KRS': '38000000000', 'RU-LIP': '42000000000',
  'RU-MOS': '46000000000', 'RU-ORL': '54000000000', 'RU-RYA': '61000000000',
  'RU-SMO': '66000000000', 'RU-TAM': '68000000000', 'RU-TVE': '28000000000',
  'RU-TUL': '70000000000', 'RU-YAR': '78000000000', 'RU-MOW': '45000000000',
  'RU-KR': '86000000000', 'RU-KO': '87000000000', 'RU-NEN': '11100000000',
  'RU-ARK': '11001000000', 'RU-VLG': '19000000000', 'RU-KGD': '27000000000',
  'RU-LEN': '41000000000', 'RU-MUR': '47000000000', 'RU-NGR': '49000000000',
  'RU-PSK': '58000000000', 'RU-SPE': '40000000000', 'RU-AD': '79000000000',
  'RU-KL': '85000000000', 'RU-KDA': '03000000000', 'RU-AST': '12000000000',
  'RU-VGG': '18000000000', 'RU-ROS': '60000000000', 'RU-DA': '82000000000',
  'RU-IN': '26000000000', 'RU-KB': '83000000000', 'RU-KC': '91000000000',
  'RU-SE': '90000000000', 'RU-CE': '96000000000', 'RU-STA': '07000000000',
  'RU-BA': '80000000000', 'RU-ME': '88000000000', 'RU-MO': '89000000000',
  'RU-TA': '92000000000', 'RU-UD': '94000000000', 'RU-CU': '97000000000',
  'RU-PER': '57000000000', 'RU-KIR': '33000000000', 'RU-NIZ': '22000000000',
  'RU-ORE': '53000000000', 'RU-PNZ': '56000000000', 'RU-SAM': '36000000000',
  'RU-SAR': '63000000000', 'RU-ULY': '73000000000', 'RU-KGN': '37000000000',
  'RU-SVE': '65000000000', 'RU-KHM': '71100000000', 'RU-YAN': '71140000000',
  'RU-TYU': '71001000000', 'RU-CHE': '75000000000', 'RU-AL': '84000000000',
  'RU-BU': '81000000000', 'RU-TY': '93000000000', 'RU-KK': '95000000000',
  'RU-ALT': '01000000000', 'RU-ZAB': '76000000000', 'RU-KYA': '04000000000',
  'RU-IRK': '25000000000', 'RU-KEM': '32000000000', 'RU-NVS': '50000000000',
  'RU-OMS': '52000000000', 'RU-TOM': '69000000000', 'RU-SA': '98000000000',
  'RU-KAM': '30000000000', 'RU-PRI': '05000000000', 'RU-KHA': '08000000000',
  'RU-AMU': '10000000000', 'RU-MAG': '44000000000', 'RU-SAK': '64000000000',
  'RU-YEV': '99000000000', 'RU-CHU': '77000000000', 'UA-43': '35000000000',
  'UA-40': '67000000000', 'UA-14': '21000000000', 'UA-09': '43000000000',
  'UA-23': '23000000000', 'UA-65': '74000000000',
}

const extraNames: Record<string, string[]> = {
  'RU-AD': ['Республика Адыгея (Адыгея)'],
  'RU-TA': ['Республика Татарстан (Татарстан)'],
  'RU-UD': ['Удмуртская Республика'], 'RU-CU': ['Чувашская Республика', 'Чувашская Республика — Чувашия'],
  'RU-KB': ['Кабардино-Балкарская Республика', 'КБР'],
  'RU-KC': ['Карачаево-Черкесская Республика', 'КЧР'],
  'RU-SE': ['Северная Осетия', 'Северная Осетия — Алания', 'Республика Северная Осетия', 'РСО — Алания'],
  'RU-CE': ['Чеченская Республика'], 'RU-IN': ['Республика Ингушетия'],
  'RU-BA': ['Башкирия'], 'RU-TY': ['Тува', 'Республика Тува'],
  'RU-SA': ['Республика Саха', 'Саха (Якутия)'],
  'RU-KHM': ['ХМАО', 'ХМАО — Югра', 'Югра', 'Ханты-Мансийский автономный округ', 'Ханты-Мансийский округ'],
  'RU-YAN': ['ЯНАО', 'Ямало-Ненецкий округ'], 'RU-NEN': ['НАО', 'Ненецкий округ'],
  'RU-YEV': ['ЕАО', 'Еврейская автономия'], 'RU-CHU': ['Чукотский АО', 'Чукотка'],
  'RU-MOS': ['Подмосковье'], 'RU-MOW': ['город федерального значения Москва'],
  'RU-SPE': ['город федерального значения Санкт-Петербург'],
  'UA-40': ['город федерального значения Севастополь'],
}

export function russiaRegionKey(value: unknown) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/ё/g, 'е').replace(/\*+$/, '')
    .replace(/(?<=[а-я.])\s*\(?\d+\)?\s*$/u, '') // Footnotes attached to names, never digits in codes.
    .replace(/^(?:г\.\s*|г\s+|город\s+)/u, '')
    .replace(/республика|респ\.?(?=\s|$|\))/gu, '')
    .replace(/область|обл\.?(?=\s|$|\))/gu, '')
    .replace(/автономн(?:ый|ая|ого|ой|ые|ых|ыми)|авт\.(?=\s)/gu, 'авт')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

export function regionalOkato(value: unknown) {
  const text = String(value ?? '').normalize('NFKC').replace(/\s/g, '').replace(/\*+$/, '')
  if (!/^(?:\d{10,11}(?:\.0+)?|\d+(?:\.\d+)?[eE]\+?\d+)$/.test(text)) return undefined
  const number = Number(text)
  return Number.isSafeInteger(number) && number >= 1e9 && number < 1e11 ? String(number).padStart(11, '0') : undefined
}

export function russiaRegionAliases(id: string, name: string) {
  const names = [name, ...(extraNames[id] ?? [])]
  const aliases = [...names, russiaOkato[id]]
  for (const full of names) {
    const abbreviated = full.replace(/автономный округ/g, 'АО').replace(/автономная область/g, 'АО')
    aliases.push(abbreviated)
    for (const name of [full, abbreviated]) {
      if (id === 'RU-KHM' || id === 'RU-YAN') aliases.push(`${name} (Тюменская область)`)
      if (id === 'RU-NEN') aliases.push(`${name} (Архангельская область)`)
    }
  }
  return aliases
}

const exclusions: Record<string, string[]> = {
  'RU-ARK': ['Ненецкого автономного округа', 'НАО', 'автономного округа'],
  'RU-TYU': ['автономных округов', 'Ханты-Мансийского автономного округа — Югры и Ямало-Ненецкого автономного округа', 'Ханты-Мансийского автономного округа и Ямало-Ненецкого автономного округа', 'ХМАО — Югры и ЯНАО', 'ХМАО и ЯНАО', 'Ханты-Мансийского АО и Ямало-Ненецкого АО'],
}
export const exclusiveRegionNames = new Map(Object.entries(exclusions).flatMap(([id, districts]) => districts.flatMap((districts) => ['без', 'кроме', 'не включая'].map((prefix) => [russiaRegionKey(`${id === 'RU-ARK' ? 'Архангельская' : 'Тюменская'} область (${prefix} ${districts})`), id] as const))))

const inclusiveNames = new Map(Object.entries({
  'RU-ARK': ['с автономным округом', 'включая автономный округ', 'с учетом автономного округа', 'с Ненецким автономным округом', 'включая Ненецкий автономный округ', 'с учетом НАО'],
  'RU-TYU': ['с автономными округами', 'включая автономные округа', 'с учетом автономных округов', 'включая ХМАО и ЯНАО', 'с ХМАО и ЯНАО', 'с учетом ХМАО и ЯНАО'],
}).flatMap(([id, suffixes]) => suffixes.map((suffix) => [russiaRegionKey(`${id === 'RU-ARK' ? 'Архангельская' : 'Тюменская'} область (${suffix})`), id] as const)))
export function inclusiveRussiaRegion(value: unknown) {
  const code = regionalOkato(value)
  return code === '11000000000' ? 'RU-ARK' : code === '71000000000' ? 'RU-TYU' : inclusiveNames.get(russiaRegionKey(value))
}

export function isRussiaTotal(value: unknown) {
  const key = russiaRegionKey(value)
  return /^(?:российскаяфедерация|россия|рф)(?:$|сучетом|без|вцелом)/.test(key)
    || /^(?:центральный|северозападный|южный|северокавказский|приволжский|уральский|сибирский|дальневосточный|крымский)федеральныйокруг$/.test(key)
    || ['цфо', 'сзфо', 'юфо', 'скфо', 'пфо', 'уфо', 'сфо', 'дфо', 'итого', 'всего', 'втомчисле', 'изних', '643'].includes(key)
}
