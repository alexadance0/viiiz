import type { ReactNode } from 'react'
import type { ChartKind } from '../../../core/types'

const line = (points: string, key = 'line') => <polyline key={key} points={points} fill="none"/>
const dots = (points: Array<[number, number, number?]>, defaultRadius = 2) => points.map(([cx, cy, radius], index) => <circle key={`${cx}-${cy}-${index}`} cx={cx} cy={cy} r={radius ?? defaultRadius}/>)

function glyph(kind: ChartKind): ReactNode {
  switch (kind) {
    case 'pie': return <><path className="tone-1" d="M20 14V3a11 11 0 1 0 11 11z"/><path className="tone-2" d="M22 12V2a10 10 0 0 1 10 10z"/></>
    case 'donut': return <><path className="tone-1" d="M20 3a11 11 0 1 0 11 11h-5a6 6 0 1 1-6-6z"/><path className="tone-2" d="M22 2a10 10 0 0 1 10 10h-5a5 5 0 0 0-5-5z"/></>
    case 'bar': return <>{[8, 15, 22, 29].map((x, index) => <rect key={x} x={x} y={[15, 8, 12, 4][index]} width="5" height={[9, 16, 12, 20][index]}/>)}</>
    case 'stacked-bar': return <>{[[8,10,6,8],[17,5,8,11],[26,8,7,9]].flatMap(([x, top, upper, lower]) => [<rect className="tone-2" key={`${x}-top`} x={x} y={top} width="6" height={upper}/>,<rect className="tone-1" key={`${x}-bottom`} x={x} y={top + upper} width="6" height={lower}/>])}</>
    case 'normalized-stacked-bar': return <>{[[8,9],[17,14],[26,7]].flatMap(([x, split]) => [<rect className="tone-2" key={`${x}-top`} x={x} y="4" width="6" height={split}/>,<rect className="tone-1" key={`${x}-bottom`} x={x} y={4 + split} width="6" height={20 - split}/>])}</>
    case 'waterfall': return <><rect className="tone-1" x="4" y="17" width="6" height="7"/><rect className="tone-1" x="13" y="11" width="6" height="6"/><rect className="tone-3" x="22" y="11" width="6" height="4"/><rect className="tone-1" x="31" y="7" width="6" height="8"/><path className="connector" d="M10 17h3M19 11h3M28 15h3"/></>
    case 'horizontal-bar': return <>{[6, 12, 18].map((y, index) => <rect key={y} x="6" y={y} width={[18, 28, 23][index]} height="4"/>)}</>
    case 'horizontal-stacked-bar': return <>{[[5,[10,7,8]],[12,[8,12,11]],[19,[14,7,6]]].flatMap(([y, widths]) => { let x = 4; return (widths as number[]).map((width, index) => { const rect = <rect className={`tone-${index + 1}`} key={`${y}-${index}`} x={x} y={y as number} width={width} height="5"/>; x += width; return rect }) })}</>
    case 'horizontal-normalized-stacked-bar': return <>{[[5,[8,14,10]],[12,[15,7,10]],[19,[11,13,8]]].flatMap(([y, widths]) => { let x = 4; return (widths as number[]).map((width, index) => { const rect = <rect className={`tone-${index + 1}`} key={`${y}-${index}`} x={x} y={y as number} width={width} height="5"/>; x += width; return rect }) })}</>
    case 'butterfly': return <><rect className="tone-1" x="7" y="4" width="11" height="4"/><rect className="tone-2" x="22" y="4" width="8" height="4"/><rect className="tone-1" x="3" y="12" width="15" height="4"/><rect className="tone-2" x="22" y="12" width="15" height="4"/><rect className="tone-1" x="10" y="20" width="8" height="4"/><rect className="tone-2" x="22" y="20" width="11" height="4"/></>
    case 'lollipop': return <>{[8, 18, 29].map((x, index) => <g key={x}><path d={`M${x} 24V${[16, 10, 5][index]}`}/><circle cx={x} cy={[16, 10, 5][index]} r="2.5"/></g>)}</>
    case 'horizontal-lollipop': return <>{[7, 14, 21].map((y, index) => <g key={y}><path d={`M5 ${y}H${[23, 32, 27][index]}`}/><circle cx={[23, 32, 27][index]} cy={y} r="2.5"/></g>)}</>
    case 'dumbbell': return <>{[7, 14, 21].map((y, index) => <g key={y}><path d={`M${[7, 11, 5][index]} ${y}H${[30, 34, 25][index]}`}/><circle cx={[7, 11, 5][index]} cy={y} r="2.4"/><circle cx={[30, 34, 25][index]} cy={y} r="2.4"/></g>)}</>
    case 'line': return <>{line('4,21 11,15 18,17 26,8 36,4')}{dots([[4,21],[11,15],[18,17],[26,8],[36,4]], 1.4)}</>
    case 'spline': return <path d="M4 21C10 21 9 10 16 13s7 1 10-4 6-5 10-5" fill="none"/>
    case 'step-line': return <polyline points="4,21 12,21 12,15 21,15 21,9 30,9 30,4 36,4" fill="none"/>
    case 'indexed-line': return <>{line('4,14 12,10 20,9 28,6 36,4', 'up')}{line('4,14 12,14 20,15 28,12 36,13', 'middle')}{line('4,14 12,18 20,19 28,18 36,22', 'down')}</>
    case 'seasonal-line': return <><g className="raw-series"><path d="M4 21C9 18 11 10 16 12s6 7 11 4 5-8 9-7" fill="none"/><path d="M4 24C9 21 11 14 16 15s7 5 11 2 5-7 9-6" fill="none"/></g><path className="strong-line" d="M4 19C9 16 11 7 16 9s7 7 11 3 5-9 9-8" fill="none"/></>
    case 'slope': return <>{line('6,20 34,6','a')}{line('6,7 34,17','b')}{dots([[6,20],[34,6],[6,7],[34,17]],1.6)}</>
    case 'range-line': return <><path className="soft-fill" d="M4 17l7-7 8 3 8-8 9 3v7l-9-3-8 7-8-3-7 6z"/><path d="M4 17l7-7 8 3 8-8 9 3M4 22l7-6 8 3 8-7 9 3" fill="none"/></>
    case 'confidence-line': return <><path className="confidence-fill" d="M4 15C10 10 14 10 20 6c6-4 10-5 16-3v15c-6-2-10 0-16 4-6 4-10 3-16 5z"/><path className="strong-line" d="M4 21c6-5 10-4 16-7 6-4 10-5 16-4" fill="none"/></>
    case 'step-range-line': return <><path className="soft-fill" d="M4 20h8v-6h9V8h9V4h6v8h-6v6h-9v5h-9v2H4z"/><polyline points="4,20 12,20 12,14 21,14 21,8 30,8 30,4 36,4" fill="none"/></>
    case 'moving-average-line': return <><path className="raw-series" d="M4 23C7 23 7 17 10 16s5 5 8 3 3-8 6-8 5 5 8 2 3-7 5-7" fill="none"/><path className="strong-line" d="M5 22C15 19 25 13 36 6" fill="none"/></>
    case 'moving-average-scatter': return <><g className="raw-series">{dots([[5,23],[9,17],[13,20],[17,14],[21,17],[25,10],[29,13],[33,6],[37,8]],1.35)}</g><path className="strong-line" d="M5 22C15 19 25 13 36 6" fill="none"/></>
    case 'area': return <><path className="soft-fill" d="M4 24v-4c6-2 8-11 14-9s8 7 13-2c2-3 3-3 5-3v18z"/><path d="M4 20c6-2 8-11 14-9s8 7 13-2c2-3 3-3 5-3" fill="none"/></>
    case 'stacked-area': return <><path className="tone-3" d="M4 24V11c6-4 10-5 16-3s9-5 16-3v19z"/><path className="tone-2" d="M4 24V15c6-3 10-2 16-1s9-6 16-4v14z"/><path className="tone-1" d="M4 24v-5c6-2 10 1 16-1s10-4 16-2v8z"/></>
    case 'normalized-stacked-area': return <><path className="tone-3" d="M4 4h32v20H4z"/><path className="tone-2" d="M4 24V12c6-3 10 2 16 0s10-4 16-2v14z"/><path className="tone-1" d="M4 24v-5c6-3 10 1 16-1s10-4 16-2v8z"/></>
    case 'scatter': return <>{dots([[5,21],[9,16],[13,22],[16,11],[20,18],[24,7],[28,14],[32,4],[36,10]],1.45)}</>
    case 'bubble': return <>{dots([[7,20,3],[15,14,4.5],[25,17,2.5],[31,7,6],[36,21,2]])}</>
    case 'boxplot': return <><path d="M5 10v8m30-8v8M5 14h8m14 0h8"/><rect className="box" x="13" y="9" width="14" height="10"/></>
    case 'violinplot': return <><path className="density-fill" d="M4 14C9 13 10 8 17 7s11 4 19 7c-8 3-12 8-19 7S9 15 4 14z"/><rect className="box" x="14" y="11" width="13" height="6"/>{dots([[10,14],[15,14],[25,14],[31,14]],1.1)}</>
    case 'raincloud': return <><path className="density-fill" d="M4 10c6 0 8-6 15-7 8-1 12 5 17 7z"/><path d="M6 12v7m29-7v7M6 15.5h7m15 0h7"/><rect className="box" x="13" y="12" width="15" height="7"/>{dots([[6,23],[11,21],[16,24],[21,22],[27,24],[34,21]],1.3)}</>
    case 'histogram': return <>{[[5,18,5,6],[10,12,5,12],[15,6,5,18],[20,4,5,20],[25,10,5,14],[30,16,5,8]].map(([x,y,width,height]) => <rect key={x} x={x} y={y} width={width} height={height}/>)}</>
    case 'kde-plot': return <path className="soft-fill" d="M4 24C9 23 10 18 14 15s6-3 9-7 8-5 13 16z"/>
    case 'ridgeline': return <>{[[9,'M3 9c5 0 6-6 12-6s7 6 13 6h9'],[16,'M3 16c6 0 8-5 14-5s7 5 13 5h7'],[23,'M3 23c5 0 7-6 13-6s8 6 14 6h7']].map(([y,d],index) => <path className={`ridge tone-${index + 1}`} key={String(y)} d={`${d}v1H3z`}/>)}</>
    case 'beeswarm': return <>{dots([[6,14],[10,12],[10,16],[14,9],[14,14],[14,19],[18,11],[18,16],[22,8],[22,13],[22,18],[26,11],[26,16],[30,14],[34,14]],1.45)}</>
    case 'strip-plot': return <>{dots([[6,14],[9,14],[13,14],[16,14],[20,14],[22,14],[27,14],[31,14],[35,14]],1.5)}</>
    case 'jitter-plot': return <>{dots([[6,12],[9,16],[13,11],[16,15],[20,9],[22,17],[27,12],[31,16],[35,10]],1.5)}</>
    case 'counts-plot': return <>{dots([[5,14,1.4],[11,14,2],[19,14,4],[28,14,2.8],[35,14,1.6]])}</>
    case 'barcode-plot': return <>{[5,8,12,14,19,24,27,33,36].map((x) => <path key={x} d={`M${x} 5v18`}/>)}</>
    case 'heatmap': return <>{[0,1,2].flatMap((row) => [0,1,2,3].map((column) => <rect className={`tone-${(row + column) % 3 + 1}`} key={`${row}-${column}`} x={4 + column * 8} y={3 + row * 8} width="7" height="7"/>))}</>
    case 'treemap': return <><rect className="tone-1" x="4" y="3" width="19" height="22"/><rect className="tone-2" x="24" y="3" width="12" height="12"/><rect className="tone-3" x="24" y="16" width="12" height="9"/><path d="M4 14h19M14 14v11"/></>
    default: return line('4,21 12,13 20,16 28,7 36,4')
  }
}

export function ChartTypeIcon({ kind }: { kind: ChartKind }) {
  return <svg className="chart-type-icon" viewBox="0 0 40 28" aria-hidden="true" focusable="false">{glyph(kind)}</svg>
}
