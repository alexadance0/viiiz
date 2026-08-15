import type { ChartConfig } from './types'

export interface FontCatalogEntry {
  value: string
  label: string
  family: string
  source: 'local' | 'remote' | 'system'
  weights: readonly number[]
  selectable?: boolean
}

export interface LocalFontFace {
  family: 'DM Sans' | 'Manrope' | 'Onest'
  url: string
  unicodeRange: string
}

const weights = [400, 500, 600, 700] as const

export const fontCatalog: readonly FontCatalogEntry[] = [
  { value: 'DM Sans, sans-serif', label: 'DM Sans', family: 'DM Sans', source: 'local', weights, selectable: false },
  { value: 'Manrope, sans-serif', label: 'Manrope', family: 'Manrope', source: 'local', weights, selectable: false },
  { value: 'Onest, sans-serif', label: 'Onest', family: 'Onest', source: 'local', weights, selectable: true },
  { value: 'Golos Text, sans-serif', label: 'Golos Text', family: 'Golos Text', source: 'remote', weights, selectable: true },
  { value: 'Inter, sans-serif', label: 'Inter', family: 'Inter', source: 'remote', weights },
  { value: 'Lato, sans-serif', label: 'Lato', family: 'Lato', source: 'remote', weights },
  { value: 'Roboto, sans-serif', label: 'Roboto', family: 'Roboto', source: 'remote', weights },
  { value: 'Open Sans, sans-serif', label: 'Open Sans', family: 'Open Sans', source: 'remote', weights },
  { value: 'Montserrat, sans-serif', label: 'Montserrat', family: 'Montserrat', source: 'remote', weights },
  { value: 'PT Sans, sans-serif', label: 'PT Sans', family: 'PT Sans', source: 'remote', weights },
  { value: 'Source Sans 3, sans-serif', label: 'Source Sans 3', family: 'Source Sans 3', source: 'remote', weights },
  { value: 'Nunito, sans-serif', label: 'Nunito', family: 'Nunito', source: 'remote', weights },
  { value: 'IBM Plex Sans, sans-serif', label: 'IBM Plex Sans', family: 'IBM Plex Sans', source: 'remote', weights },
  { value: 'Arial, sans-serif', label: 'Arial', family: 'Arial', source: 'system', weights },
  { value: 'Verdana, sans-serif', label: 'Verdana', family: 'Verdana', source: 'system', weights },
  { value: 'Georgia, serif', label: 'Georgia', family: 'Georgia', source: 'system', weights },
  { value: 'Courier New, monospace', label: 'Courier New', family: 'Courier New', source: 'system', weights },
  { value: 'system-ui, sans-serif', label: 'Системный', family: 'system-ui', source: 'system', weights },
] as const

export const textFonts = fontCatalog.filter(({ selectable }) => selectable !== false).map(({ value, label }) => [value, label] as const)

export const localFontFaces: readonly LocalFontFace[] = [
  { family: 'DM Sans', url: '/fonts/dm-sans-latin-ext.woff2', unicodeRange: 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF' },
  { family: 'DM Sans', url: '/fonts/dm-sans-latin.woff2', unicodeRange: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD' },
  { family: 'Manrope', url: '/fonts/manrope-cyrillic-ext.woff2', unicodeRange: 'U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F' },
  { family: 'Manrope', url: '/fonts/manrope-cyrillic.woff2', unicodeRange: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' },
  { family: 'Manrope', url: '/fonts/manrope-greek.woff2', unicodeRange: 'U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF' },
  { family: 'Manrope', url: '/fonts/manrope-vietnamese.woff2', unicodeRange: 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB' },
  { family: 'Manrope', url: '/fonts/manrope-latin-ext.woff2', unicodeRange: 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF' },
  { family: 'Manrope', url: '/fonts/manrope-latin.woff2', unicodeRange: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD' },
  { family: 'Onest', url: '/fonts/onest-cyrillic-ext.woff2', unicodeRange: 'U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F' },
  { family: 'Onest', url: '/fonts/onest-cyrillic.woff2', unicodeRange: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' },
  { family: 'Onest', url: '/fonts/onest-latin-ext.woff2', unicodeRange: 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF' },
  { family: 'Onest', url: '/fonts/onest-latin.woff2', unicodeRange: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD' },
] as const

export const fontFamilyName = (value: string) => value.replace(/["']/g, '').split(',')[0].trim()

export function collectFontFamilies(value: unknown) {
  const result = new Set<string>()
  const seen = new WeakSet<object>()
  const visit = (current: unknown) => {
    if (!current || typeof current !== 'object' || seen.has(current)) return
    seen.add(current)
    if (Array.isArray(current)) { current.forEach(visit); return }
    Object.entries(current).forEach(([key, child]) => {
      if (key === 'fontFamily' && typeof child === 'string') result.add(fontFamilyName(child))
      else visit(child)
    })
  }
  visit(value)
  return [...result].sort()
}

const localLoads = new Map<string, Promise<void>>()
const remoteLoads = new Map<string, Promise<void>>()
const customLoads = new Map<string, Promise<void>>()

const loadLocalFace = (face: LocalFontFace) => {
  const key = `${face.family}|${face.url}`
  if (!localLoads.has(key)) localLoads.set(key, new FontFace(face.family, `url("${face.url}") format("woff2")`, { weight: '400 700', style: 'normal', unicodeRange: face.unicodeRange }).load().then((loaded) => { document.fonts.add(loaded) }))
  return localLoads.get(key)!
}

const loadRemoteFamily = (entry: FontCatalogEntry) => {
  if (!remoteLoads.has(entry.family)) remoteLoads.set(entry.family, new Promise<void>((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(entry.family).replace(/%20/g, '+')}:wght@${entry.weights.join(';')}&display=swap`
    link.dataset.chartFont = entry.family
    link.onload = () => { void Promise.all(entry.weights.map((weight) => document.fonts.load(`${weight} 12px "${entry.family}"`, 'AaБб123'))).then(() => resolve(), () => resolve()) }
    link.onerror = () => resolve()
    document.head.append(link)
  }))
  return remoteLoads.get(entry.family)!
}

const loadCustomFont = ({ name, dataUrl, weight = 400, style = 'normal' }: NonNullable<ChartConfig['customFonts']>[number]) => {
  const key = `${name}|${weight}|${style}|${dataUrl}`
  if (!customLoads.has(key)) customLoads.set(key, new FontFace(name, `url(${dataUrl})`, { weight: String(weight), style }).load().then((font) => { document.fonts.add(font) }))
  return customLoads.get(key)!
}

export async function waitForChartFonts(families: readonly string[], customFonts: ChartConfig['customFonts'] = []) {
  if (typeof document === 'undefined' || !document.fonts || typeof FontFace === 'undefined') return
  const requested = new Set(families.map(fontFamilyName))
  const loads = fontCatalog.flatMap((entry) => !requested.has(entry.family) ? [] : entry.source === 'local'
    ? localFontFaces.filter((face) => face.family === entry.family).map(loadLocalFace)
    : entry.source === 'remote' ? [loadRemoteFamily(entry)] : [])
  loads.push(...(customFonts ?? []).map(loadCustomFont))
  await Promise.all(loads.map((load) => load.catch(() => undefined)))
  await document.fonts.ready
}

export const loadCriticalFonts = () => waitForChartFonts(['DM Sans', 'Manrope', 'Onest'])
