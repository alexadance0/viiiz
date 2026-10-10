import type { ChartConfig } from '../../../core/types'
import { formatYAxisNumber } from '../../../core/numberFormat'

export const escapeTooltipText = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

type TooltipEntry = { seriesName?: string; value?: unknown; dataIndex?: number; data?: { displayValue?: string; displayCategory?: string; displayColor?: string; streamBand?: boolean; colorLabel?: string; directLegendLabel?: boolean; selectionTarget?: string } }

export function seriesTooltip(input: unknown, config: ChartConfig, series: Array<{ name: string; color: string }>, category: (index: number) => string) {
  const entries = (Array.isArray(input) ? input : [input]) as TooltipEntry[]
  const visible = entries.filter((entry) => entry?.seriesName && !entry.seriesName.startsWith('__') && !entry.data?.streamBand && !entry.data?.directLegendLabel && entry.data?.selectionTarget !== 'guide')
  if (!visible.length) return ''
  const rows = visible.map((entry) => {
    const name = entry.seriesName!
    const raw = Array.isArray(entry.value) ? entry.value.at(-1) : entry.value
    const value = entry.data?.displayValue ?? (typeof raw === 'number' && Number.isFinite(raw) ? formatYAxisNumber(raw, config) : '—')
    const color = entry.data?.displayColor ?? series.find((series) => series.name === name)?.color ?? '#202027'
    const safeColor = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(color) || /^(rgb|hsl)a?\([\d\s.,%/+-]+\)$/i.test(color) || /^[a-z]+$/i.test(color) ? color : '#202027'
    return { name, label: config.seriesStyles[name]?.legendLabel?.trim() || name, value, color: safeColor, detail: entry.data?.colorLabel }
  })
  const suffix = config.numberSuffix ?? ''
  const unit = suffix && rows.some((row) => row.value.endsWith(suffix)) ? suffix.trim() : ''
  const title = visible[0].data?.displayCategory ?? category(visible[0].dataIndex ?? 0)
  return `<div class="chart-tooltip-content" role="tooltip"><div class="chart-tooltip-header"><strong>${escapeTooltipText(title)}</strong>${unit ? `<span class="chart-tooltip-unit">${escapeTooltipText(unit)}</span>` : ''}</div><table class="chart-tooltip-table" aria-label="Значения рядов"><tbody>${rows.map((row) => {
    const value = unit && row.value.endsWith(suffix) ? row.value.slice(0, -suffix.length).trim() : row.value
    const muted = /^[-−+]?0([,.]0+)?$/.test(value)
    return `<tr class="chart-tooltip-row${muted ? ' is-muted' : ''}" data-series="${escapeTooltipText(row.name)}"><td><span class="chart-tooltip-name"><i class="chart-tooltip-swatch" style="background-color:${escapeTooltipText(row.color)}"></i><span>${escapeTooltipText(row.label)}${row.detail ? `<small>${escapeTooltipText(row.detail)}</small>` : ''}</span></span></td><td class="chart-tooltip-value">${escapeTooltipText(value)}</td></tr>`
  }).join('')}</tbody></table></div>`
}

export function activeTooltipHtml(html: string, name: string | null) {
  if (!name) return html
  const attribute = `data-series="${escapeTooltipText(name)}"`
  return html.replaceAll(attribute, `${attribute} data-active="true"`)
}

export function updateActiveTooltip(name: string | null) {
  document.querySelectorAll<HTMLElement>('.chart-tooltip-row').forEach((row) => { row.dataset.active = String(row.dataset.series === name) })
}

export function styleChartTooltip(option: Record<string, unknown>) {
  if (!option.tooltip || typeof option.tooltip !== 'object') return
  const original = option.tooltip as { formatter?: (...args: unknown[]) => unknown }
  const formatter = original.formatter
  option.tooltip = { ...option.tooltip,
    ...(formatter ? { formatter: (...args: unknown[]) => {
      const html = formatter(...args)
      return typeof html === 'string' && html && !html.startsWith('<div class="chart-tooltip-content"') ? `<div class="chart-tooltip-content chart-tooltip-details" role="tooltip">${html}</div>` : html
    } } : {}),
    renderMode: 'html', appendTo: () => document.body, className: 'chart-tooltip', confine: true, enterable: true,
    backgroundColor: '#ffffff', borderColor: '#d4d4d4', borderWidth: 1, padding: 0,
    textStyle: { fontFamily: 'Wix Madefor Text, sans-serif', fontSize: 10.5, color: '#202027' },
    transitionDuration: 0, hideDelay: 120,
    extraCssText: 'border-radius:0;box-shadow:0 3px 8px rgba(32,32,39,.12);max-width:min(300px,calc(100vw - 24px));white-space:normal',
  }
}
