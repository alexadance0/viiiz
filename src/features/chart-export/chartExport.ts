import type { ChartConfig, ChartTextStyle } from '../../core/types'
import { fontCatalog, localFontFaces } from '../../core/textFonts'

export interface ExportTextRun { text: string; color: string; fontFamily?: string; fontSize?: number; fontWeight?: number; italic?: boolean; underline?: boolean; backgroundColor?: string }
export interface ExportTextBlock { left: number; top: number; width: number; style: ChartTextStyle; runs: ExportTextRun[] }

export const customFontCss = (fonts: ChartConfig['customFonts']) => (fonts ?? []).map(({ name, dataUrl, weight = 400, style = 'normal' }) =>
  `@font-face{font-family:"${name.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}";src:url("${dataUrl}");font-weight:${weight};font-style:${style};}`
).join('')

const webFontFamilies = new Set(fontCatalog.filter(({ source }) => source !== 'system').map(({ family }) => family))
const remoteFontFamilies = new Set(fontCatalog.filter(({ source }) => source === 'remote').map(({ family }) => family))
const embeddedGoogleFonts = new Map<string, Promise<string>>()
const embeddedLocalFonts = new Map<string, Promise<string>>()

const dataUrl = (buffer: ArrayBuffer, type: string) => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return `data:${type};base64,${btoa(binary)}`
}

const fontRequests = (svg: SVGSVGElement) => [...svg.querySelectorAll<SVGElement>('[font-family], [style]')].reduce((requests, element) => {
  const style = element.getAttribute('style') ?? ''
  const family = (element.getAttribute('font-family') ?? style.match(/font-family:\s*([^;]+)/i)?.[1] ?? '').replace(/["']/g, '').split(',')[0].trim()
  if (!webFontFamilies.has(family)) return requests
  const weight = element.getAttribute('font-weight') ?? style.match(/font-weight:\s*([^;]+)/i)?.[1]?.trim() ?? '400'
  const italic = element.getAttribute('font-style') === 'italic' || /font-style:\s*italic/i.test(style)
  requests.add(`${family}|${italic ? 1 : 0}|${weight}`)
  return requests
}, new Set<string>())

const textWidth = (value: string, run: ExportTextRun, fallback: ChartTextStyle) => {
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return value.length * (run.fontSize ?? fallback.size) * .55
  context.font = `${run.italic ? 'italic ' : ''}${run.fontWeight ?? fallback.weight} ${run.fontSize ?? fallback.size}px ${run.fontFamily ?? fallback.fontFamily}`
  return context.measureText(value).width
}

const appendStyledText = (svg: SVGSVGElement, blocks: ExportTextBlock[]) => {
  blocks.forEach((block) => {
    const lineHeight = Math.round(block.style.size * block.style.lineHeight / 100)
    const lines: Array<Array<{ text: string; run: ExportTextRun; width: number }>> = [[]]
    let lineWidth = 0
    block.runs.forEach((run) => run.text.split(/(\s+|\n)/).forEach((text) => {
      if (!text) return
      if (text.includes('\n')) { lines.push([]); lineWidth = 0; return }
      const width = textWidth(text, run, block.style)
      const isWhitespace = /^\s+$/.test(text)
      if (!isWhitespace && lineWidth && lineWidth + width > block.width) { lines.push([]); lineWidth = 0 }
      if (isWhitespace && !lineWidth) return
      lines.at(-1)!.push({ text, run, width }); lineWidth += width
    }))
    lines.forEach((line, index) => {
      const width = line.reduce((total, part) => total + part.width, 0)
      let x = block.left + (block.style.align === 'center' ? (block.width - width) / 2 : block.style.align === 'right' ? block.width - width : 0)
      const y = block.top + index * lineHeight
      line.forEach(({ text, run, width: partWidth }) => {
        const size = run.fontSize ?? block.style.size
        const family = run.fontFamily ?? block.style.fontFamily
        const weight = run.fontWeight ?? block.style.weight
        if (run.backgroundColor && run.backgroundColor !== 'transparent') {
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          rect.setAttribute('x', String(x)); rect.setAttribute('y', String(y)); rect.setAttribute('width', String(partWidth)); rect.setAttribute('height', String(lineHeight)); rect.setAttribute('fill', run.backgroundColor)
          svg.append(rect)
        }
        const node = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        node.setAttribute('x', String(x)); node.setAttribute('y', String(y + (lineHeight - size) / 2 + size * .8)); node.setAttribute('fill', run.color); node.setAttribute('font-family', family); node.setAttribute('font-size', String(size)); node.setAttribute('font-weight', String(weight))
        if (run.italic) node.setAttribute('font-style', 'italic')
        if (run.underline) node.setAttribute('text-decoration', 'underline')
        node.textContent = text
        svg.append(node)
        x += partWidth
      })
    })
  })
}

const embedGoogleFonts = async (svg: SVGSVGElement) => {
  const requests = [...fontRequests(svg)].filter((request) => remoteFontFamilies.has(request.split('|')[0]))
  if (!requests.length) return ''
  const key = requests.sort().join(',')
  if (!embeddedGoogleFonts.has(key)) embeddedGoogleFonts.set(key, (async () => {
    const families = new Map<string, Array<{ italic: number; weight: string }>>()
    requests.forEach((request) => {
      const [family, italic, weight] = request.split('|')
      families.set(family, [...(families.get(family) ?? []), { italic: Number(italic), weight }])
    })
    const query = [...families].map(([family, styles]) => {
      const values = [...new Set(styles.map(({ italic, weight }) => `${italic},${weight}`))].join(';')
      return `family=${encodeURIComponent(family).replace(/%20/g, '+')}:ital,wght@${values}`
    }).join('&')
    const response = await fetch(`https://fonts.googleapis.com/css2?${query}&display=block`)
    if (!response.ok) return ''
    const css = await response.text()
    const urls = [...css.matchAll(/url\((https:\/\/[^)]+)\)\s*format\(['"]?([^'")]+)['"]?\)/g)]
    const replacements = await Promise.all(urls.map(async ([match, url, format]) => {
      const font = await fetch(url)
      if (!font.ok) return [match, match] as const
      return [match, `url("${dataUrl(await font.arrayBuffer(), `font/${format}`)}") format("${format}")`] as const
    }))
    return replacements.reduce((result, [from, to]) => result.replace(from, to), css)
  })().catch(() => ''))
  return embeddedGoogleFonts.get(key)!
}

const embedLocalFonts = async (svg: SVGSVGElement) => {
  const families = new Set([...fontRequests(svg)].map((request) => request.split('|')[0]))
  const faces = localFontFaces.filter(({ family }) => families.has(family))
  return (await Promise.all(faces.map((face) => {
    if (!embeddedLocalFonts.has(face.url)) embeddedLocalFonts.set(face.url, fetch(face.url).then(async (response) => response.ok ? dataUrl(await response.arrayBuffer(), 'font/woff2') : '').catch(() => ''))
    return embeddedLocalFonts.get(face.url)!.then((url) => url ? `@font-face{font-family:"${face.family}";src:url("${url}") format("woff2");font-weight:400 700;font-style:normal;unicode-range:${face.unicodeRange};}` : '')
  }))).join('')
}

const prepareSvg = async (svg: SVGSVGElement, config: Pick<ChartConfig, 'canvasWidth' | 'canvasHeight' | 'customFonts'>, scale = 1, textBlocks: ExportTextBlock[] = []) => {
  const width = Math.min(1000, Math.round(config.canvasWidth ?? svg.clientWidth))
  const height = Math.min(1000, Math.round(config.canvasHeight ?? svg.clientHeight))
  const exported = svg.cloneNode(true) as SVGSVGElement
  exported.setAttribute('viewBox', `0 0 ${svg.clientWidth} ${svg.clientHeight}`)
  exported.setAttribute('width', String(width * scale))
  exported.setAttribute('height', String(height * scale))
  appendStyledText(exported, textBlocks)
  const css = `${await embedLocalFonts(exported)}${await embedGoogleFonts(exported)}${customFontCss(config.customFonts)}`
  if (css) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = css
    exported.prepend(style)
  }
  return { exported, width, height }
}

const download = (href: string, filename: string) => {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.click()
}

export interface ChartExportOptions { filename?: string; scale?: number }

export async function exportChartAsSvg(svg: SVGSVGElement, config: Pick<ChartConfig, 'canvasWidth' | 'canvasHeight' | 'customFonts'>, options: ChartExportOptions = {}, textBlocks?: ExportTextBlock[]) {
  await document.fonts?.ready
  const { exported } = await prepareSvg(svg, config, options.scale ?? 1, textBlocks)
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(exported)], { type: 'image/svg+xml' }))
  download(url, `${options.filename?.trim() || 'chart'}.svg`)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportChartAsPng(svg: SVGSVGElement, config: Pick<ChartConfig, 'canvasWidth' | 'canvasHeight' | 'customFonts'>, options: ChartExportOptions = {}, textBlocks?: ExportTextBlock[]) {
  await document.fonts?.ready
  const scale = options.scale ?? Math.max(2, Math.ceil(window.devicePixelRatio || 1))
  const { exported, width, height } = await prepareSvg(svg, config, scale, textBlocks)
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(exported)], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Не удалось подготовить PNG')); image.src = url })
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Браузер не поддерживает экспорт PNG')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    download(canvas.toDataURL('image/png'), `${options.filename?.trim() || 'chart'}.png`)
  } finally {
    URL.revokeObjectURL(url)
  }
}
