import type { ChartConfig, DataTable } from '../../../core/types'
import type { NativeAreaChartScene } from '../../../entities/chart/model/ChartScene'
import { compileNativePointScene, isNativeAreaKind } from '../line/compiler'

export { isNativeAreaKind, NATIVE_AREA_KINDS, type NativeAreaKind } from '../line/compiler'

export function compileNativeAreaScene(table: DataTable, config: ChartConfig): NativeAreaChartScene {
  if (!isNativeAreaKind(config.kind)) throw new Error(`Native area compiler cannot compile ${config.kind}.`)
  return compileNativePointScene(table, config, config.kind) as NativeAreaChartScene
}
