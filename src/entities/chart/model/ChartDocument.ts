import type { ChartAnnotation, ChartConfig, ChartDecoration, DataTable } from '../../../core/types'
import type { CompositionSpacing } from '../../../features/chart-layout/spacing'
import type { ChartSpec } from './ChartSpec'

export interface ChartDocument {
  version: 1
  canvas: { width: number; height: number; background: string }
  composition: CompositionSpacing
  theme: { palette: string[]; fontFamily: string }
  data: { table: DataTable; xField: string; yFields: string[]; seriesField: string }
  chart: ChartSpec
  annotations: ChartAnnotation[]
  decorations: ChartDecoration[]
  overrides: Pick<ChartConfig, 'elementStyles' | 'seriesStyles' | 'categoryLabelOverrides'>
}
