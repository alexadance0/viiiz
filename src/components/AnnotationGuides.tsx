import type { AlignmentGuide } from './annotationAlignment'
import './AnnotationGuides.css'

export function AnnotationGuides({ guides, width, height, scale = 1 }: { guides: AlignmentGuide[]; width: number; height: number; scale?: number }) {
  if (!guides.length) return null
  const unit = 1 / Math.max(.05, scale)
  return <svg className="annotation-alignment-guides" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
    {guides.map((guide, index) => {
      const horizontal = guide.gap != null ? guide.axis === 'x' : guide.axis === 'y'
      const x1 = horizontal ? guide.start : guide.position, y1 = horizontal ? guide.position : guide.start
      const x2 = horizontal ? guide.end : guide.position, y2 = horizontal ? guide.position : guide.end
      return <g key={index} data-guide-kind={guide.gap == null ? 'alignment' : 'gap'}><line x1={x1} y1={y1} x2={x2} y2={y2}/>{guide.gap != null && <>
        <path d={horizontal ? `M${x1},${y1 - 4 * unit}v${8 * unit} M${x2},${y2 - 4 * unit}v${8 * unit}` : `M${x1 - 4 * unit},${y1}h${8 * unit} M${x2 - 4 * unit},${y2}h${8 * unit}`}/>
        <text style={{ fontSize: 10 * unit, strokeWidth: 3 * unit }} x={(x1 + x2) / 2 + (horizontal ? 0 : 8 * unit)} y={(y1 + y2) / 2 - (horizontal ? 6 * unit : 0)}>{Math.round(guide.gap)} px</text>
      </>}</g>
    })}
  </svg>
}
