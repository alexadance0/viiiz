import type { ChartSeriesStyle } from '../core/types'
import type { ChartTemplate, TemplateVariant } from '../features/chart-templates/templates'

function MiniChart({ variant, compact = false }: { variant: TemplateVariant; compact?: boolean }) {
  const { style, sourceKind: kind } = variant
  const colors = style.palette ?? [style.color ?? '#202027'], ink = style.valueText?.color ?? '#202027'
  const stroke = variant.seriesAppearance[0] ?? {}
  const line = (appearance: Partial<ChartSeriesStyle>) => ({ strokeWidth: Math.min(5, appearance.lineWidth ?? 2), strokeDasharray: appearance.lineType === 'dashed' ? '6 4' : appearance.lineType === 'dotted' ? '2 3' : undefined })
  const horizontal = kind.includes('horizontal') || kind === 'butterfly'
  const circular = kind === 'pie' || kind === 'donut'
  const matrix = kind === 'heatmap' || kind === 'waffle' || kind.includes('map') && kind !== 'treemap'
  const hierarchy = kind === 'treemap'
  const flow = kind === 'sankey'
  const scatter = ['scatter', 'bubble', 'connected-scatter'].includes(kind)
  const curve = kind.includes('line') || kind.includes('area') || ['slope', 'bump', 'stream-graph'].includes(kind)
  const distribution = ['boxplot', 'violinplot', 'raincloud', 'kde-plot', 'ridgeline', 'beeswarm', 'strip-plot', 'jitter-plot', 'counts-plot', 'barcode-plot'].includes(kind)
  const curvePath = (series: number) => {
    if (kind === 'spline' || kind === 'stream-graph' && style.streamSmooth !== false || kind === 'bump' && style.bumpSmooth) return series ? 'M25,130C60,70 90,120 125,75S185,55 222,60' : 'M25,118C60,108 90,124 125,98S185,70 222,88'
    const values = series ? [130, 85, 105, 75, 40, 60] : [118, 108, 124, 98, 70, 88]
    return [25, 60, 90, 125, 185, 222].map((x, i) => !i ? `M${x},${values[i]}` : kind.includes('step') ? `H${x}V${values[i]}` : `L${x},${values[i]}`).join('')
  }
  const legend = style.showLegend && !compact
  const top = legend ? 53 : 40
  const axes = !circular && !matrix && !hierarchy && !flow
  return <svg viewBox="0 0 240 160" className="template-mini-chart" data-thumbnail-kind={kind} aria-hidden="true">
    <rect width="240" height="160" fill={style.canvasBackground ?? '#fff'}/>
    <text x="14" y="24" fill={style.titleText?.color ?? ink} fontFamily={style.titleText?.fontFamily} fontWeight={style.titleText?.weight ?? 700} fontSize={Math.min(20, Math.max(12, (style.titleText?.size ?? 32) / 2))}>Заголовок</text>
    {legend && <g fontSize="8" fill={style.legendText?.color ?? ink} fontFamily={style.legendText?.fontFamily}>{[0, 1].map((i) => <g key={i}><rect x={14 + i * 74} y="34" width="9" height="6" fill={colors[i % colors.length]}/><text x={28 + i * 74} y="41">{i ? 'Серия B' : 'Серия A'}</text></g>)}</g>}
    {axes && style.showHorizontalGrid !== false && [top + 15, 95, 130].map((y) => <line key={y} x1="24" y1={y} x2="224" y2={y} stroke={style.gridColor ?? '#d4d4d4'} strokeWidth={Math.min(2, style.gridWidth ?? .6)}/>)}
    {circular ? <g transform="translate(125 95)"><circle r="39" fill={colors[0]}/><path d="M0,0V-39A39,39 0 0,1 37,12Z" fill={colors[1 % colors.length]}/><path d="M0,0L37,12A39,39 0 0,1 -27,28Z" fill={colors[2 % colors.length]}/>{kind === 'donut' && <circle r={Math.min(30, Math.max(10, (style.pieInnerRadius ?? 45) / 2))} fill={style.canvasBackground ?? '#fff'}/>}</g>
      : hierarchy ? <g><rect x="20" y={top} width="120" height={134 - top} fill={colors[0]}/><rect x="144" y={top} width="76" height="44" fill={colors[1 % colors.length]}/><rect x="144" y={top + 48} width="36" height={86 - top} fill={colors[2 % colors.length]}/><rect x="184" y={top + 48} width="36" height={86 - top} fill={colors[3 % colors.length]}/><text x="28" y={top + 20} fontSize="12" fill={style.treemapLeafText?.color ?? ink}>A</text></g>
      : matrix ? <g>{Array.from({ length: 32 }, (_, i) => <rect key={i} x={24 + i % 8 * 24} y={top + Math.floor(i / 8) * 21} width="19" height="16" rx={kind === 'waffle' ? Math.min(6, style.waffleRadius ?? 0) : 0} fill={kind === 'heatmap' ? [style.heatmapLowColor ?? colors[0], style.heatmapMidColor ?? colors[1 % colors.length], style.heatmapHighColor ?? colors[2 % colors.length]][i % 3] : colors[Math.floor(i / 8) % colors.length]}/>)}</g>
      : flow ? <g><path d={`M35,${top + 20}C100,${top + 20} 140,105 205,105`} fill="none" stroke={colors[0]} strokeWidth="22" opacity={style.sankeyLinkOpacity ?? .5}/><path d={`M35,${top + 65}C100,${top + 65} 140,65 205,65`} fill="none" stroke={colors[1 % colors.length]} strokeWidth="17" opacity={style.sankeyLinkOpacity ?? .5}/><rect x="25" y={top + 5} width="10" height="76" fill={colors[0]}/><rect x="205" y={top + 5} width="10" height="76" fill={colors[1 % colors.length]}/></g>
      : scatter ? <g>{[0, 1, 2, 3, 4, 5, 6].map((i) => <circle key={i} cx={38 + i * 28} cy={125 - i * 9 - i % 2 * 14} r={kind === 'bubble' ? 5 + i % 3 * 3 : Math.min(7, (style.scatterPointSize ?? 10) / 2)} fill={style.scatterHollow ? 'none' : colors[i % 2 % colors.length]} stroke={colors[i % 2 % colors.length]} opacity={style.scatterOpacity ?? .8}/>)}</g>
      : curve ? <g>{[0, 1].map((i) => <g key={i}>{(kind.includes('area') || kind === 'stream-graph') && <path d={`${curvePath(i)}L222,132H25Z`} fill={colors[i % colors.length]} opacity={kind === 'stream-graph' ? .8 : style.areaFillOpacity ?? .32}/>}<path d={curvePath(i)} fill="none" stroke={colors[i % colors.length]} {...line(variant.seriesAppearance[i] ?? stroke)}/>{stroke.showMarker && [25, 125, 222].map((x, j) => <circle key={x} cx={x} cy={(i ? [130, 75, 60] : [118, 98, 88])[j]} r={Math.min(5, (stroke.markerSize ?? 7) / 2)} fill={stroke.markerFill ?? colors[i % colors.length]} stroke={stroke.markerBorder ?? colors[i % colors.length]}/>)}</g>)}</g>
      : distribution ? <g>{[0, 1, 2].map((i) => <g key={i} stroke={colors[i % colors.length]} fill={colors[i % colors.length]}><line x1={65 + i * 60} y1={top + i * 7} x2={65 + i * 60} y2="129"/><rect x={51 + i * 60} y={top + 22 + i * 6} width="28" height="32" fillOpacity=".35"/><line x1={51 + i * 60} y1={top + 36 + i * 6} x2={79 + i * 60} y2={top + 36 + i * 6}/></g>)}</g>
      : <g>{[40, 64, 48, 77, 58].map((value, i) => <g key={i}><rect x={horizontal ? 25 : 32 + i * 38} y={horizontal ? top + i * 16 : 132 - value} width={horizontal ? value * 2 : Math.min(27, (style.barWidth ?? 60) / 3)} height={horizontal ? 11 : value} fill={colors[i % colors.length]} fillOpacity={style.barFillOpacity ?? 1}/>{style.showValues && <text x={horizontal ? 30 + value * 2 : 32 + i * 38} y={horizontal ? top + i * 16 + 9 : 127 - value} fill={ink} fontSize="8">{value}</text>}</g>)}</g>}
    {axes && style.showXAxisLine !== false && <line x1="24" y1="133" x2="224" y2="133" stroke={style.axisLineColor ?? ink}/>}
    {axes && style.showXAxisLabels !== false && <g fontSize="8" fill={style.xAxisLabelText?.color ?? ink} fontFamily={style.xAxisLabelText?.fontFamily}>{['1', '2', '3', '4'].map((label, i) => <text key={label} x={35 + i * 60} y="147">{label}</text>)}</g>}
  </svg>
}

export function TemplateThumbnail({ template }: { template: ChartTemplate }) {
  const variants = template.variants?.length ? template.variants : [template]
  return <div className={`template-thumbnail${variants.length > 1 ? ' composition' : ''}`} aria-hidden="true">{variants.slice(0, 4).map((variant) => <MiniChart key={variant.sourceKind} variant={variant} compact={variants.length > 1}/>)}</div>
}
