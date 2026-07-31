import type { DataTable, DataValue } from './types'

const makeTable = (name: string, input: Array<Record<string, DataValue>>): DataTable => {
  const columns = Array.from(new Set(input.flatMap(Object.keys)))
  return { name, columns, rows: input.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))) }
}

const demoRows = Array.from({ length: 36 }, (_, index) => {
  const seasonal = Math.sin(index / 2.2) * 14
  const revenue = Math.round(72 + index * 4.2 + seasonal)
  return {
    day: new Date(2025, 0, index + 1),
    week: new Date(2024, 0, 1 + index * 7),
    month: new Date(2022, index, 1),
    quarter: new Date(2017, index * 3, 1),
    half_year: new Date(2008, index * 6, 1),
    year: new Date(1990 + index, 0, 1),
    revenue,
    orders: Math.round(revenue * .43 + Math.cos(index / 3) * 4),
    profit: Math.round(revenue * (.16 + (index % 5) * .012)),
    plan: Math.round(76 + index * 4),
  }
})

export const demoTable: DataTable = {
  ...makeTable('Демо-данные · разные частоты', demoRows),
  timeProfiles: {
    day: { frequency: 'daily', label: 'Дневные', confidence: 100, source: 'intervals' },
    week: { frequency: 'weekly', label: 'Недельные', confidence: 100, source: 'intervals' },
    month: { frequency: 'monthly', label: 'Месячные', confidence: 100, source: 'intervals' },
    quarter: { frequency: 'quarterly', label: 'Квартальные', confidence: 100, source: 'intervals' },
    half_year: { frequency: 'semiannual', label: 'Полугодовые', confidence: 100, source: 'intervals' },
    year: { frequency: 'annual', label: 'Годовые', confidence: 100, source: 'intervals' },
  },
}

export const categoricalDemoTable = makeTable('Демо-данные · топ стран', [
  ['США', 29.2, 1], ['Китай', 18.7, 2], ['Германия', 4.7, 3], ['Япония', 4.1, 4], ['Индия', 3.9, 5],
  ['Великобритания', 3.6, 6], ['Франция', 3.2, 7], ['Италия', 2.4, 8], ['Канада', 2.2, 9], ['Бразилия', 2.2, 10],
].map(([country, gdp, place]) => ({ country: String(country), gdp_trillion_usd: Number(gdp), place: Number(place) })))

export const dumbbellDemoTable = makeTable('Демо-данные · до и после', [
  ['Север', 42, 57], ['Юг', 63, 58], ['Восток', 35, 49], ['Запад', 71, 71], ['Центр', 54, 68],
].map(([region, before, after]) => ({ region: String(region), before: Number(before), after: Number(after) })))

export const distributionDemoTable = makeTable('Демо-данные · распределения', [
  ['Север', [42, 45, 47, 48, 50, 51, 52, 54, 55, 58, 60, 66]],
  ['Юг', [35, 39, 41, 43, 44, 46, 47, 48, 50, 53, 57, 71]],
  ['Восток', [28, 31, 34, 37, 39, 41, 43, 45, 46, 49, 52, 56]],
  ['Запад', [51, 53, 55, 56, 58, 59, 61, 63, 64, 66, 69, 74]],
].flatMap(([region, values], regionIndex) => (values as number[]).map((profit, index) => ({ region: String(region), profit, orders: Math.round(profit * .62 + index * 1.7 + regionIndex * 4) }))))

export const entrepreneurshipDifficultiesDemoTable = makeTable('ВЦИОМ · трудности молодых предпринимателей', [
  ['Проблемы с клиентами и спросом', 'Мало или нет клиентов, заказов; сложный поиск клиентов; нестабильный спрос', 12],
  ['Проблемы с клиентами и спросом', 'Низкая покупательская и платёжная способность', 3],
  ['Проблемы с клиентами и спросом', 'Снижение рынков сбыта, падение продаж, давление маркетплейсов', 2],
  ['Финансовые трудности', 'Нехватка денег, капитала и инвестиций; низкий доход', 8],
  ['Финансовые трудности', 'Высокие расходы, аренда, цены на оборудование и материалы', 4],
  ['Финансовые трудности', 'Высокие процентные и кредитные ставки', 2],
  ['Финансовые трудности', 'Высокая инфляция и цены', 2],
  ['Налоги, законодательство и бюрократия', 'Высокая налоговая нагрузка', 3],
  ['Налоги, законодательство и бюрократия', 'Изменения законодательства и введение маркировки', 3],
  ['Налоги, законодательство и бюрократия', 'Административное давление, ограничения, бюрократия и отчётность', 2],
  ['Экономическая и политическая нестабильность', 'Санкции и внешняя политика государства', 3],
  ['Экономическая и политическая нестабильность', 'Нестабильность экономики, рынка и курса валют', 3],
  ['Экономическая и политическая нестабильность', 'Недостаток возможностей развития, роста и господдержки', 2],
  ['Личные и управленческие проблемы', 'Нехватка опыта, знаний, квалификации и коммуникативных навыков', 3],
  ['Личные и управленческие проблемы', 'Дефицит времени', 2],
  ['Личные и управленческие проблемы', 'Выгорание, депрессия, отсутствие мотивации, лень', 2],
  ['Кадровые проблемы', 'Дефицит кадров, низкая квалификация и качество работы', 5],
  ['Конкуренция и рыночные условия', 'Высокая конкуренция', 3],
  ['Конкуренция и рыночные условия', 'Демпинг цен со стороны конкурентов', 1],
  ['Маркетинг и продвижение', 'Дорогая реклама или нехватка средств на рекламу', 2],
  ['Маркетинг и продвижение', 'Блокировка необходимых сервисов и ресурсов', 2],
  ['Сейчас у меня нет никаких трудностей', 'Сейчас у меня нет никаких трудностей', 52],
  ['Другое', 'Другое', 6],
  ['Затрудняюсь ответить', 'Затрудняюсь ответить', 12],
].map(([category, difficulty, percent]) => ({ Категория: String(category), Трудность: String(difficulty), Процент: Number(percent) })))
