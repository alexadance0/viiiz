export interface RegressionPoint { x: number; y: number }
export interface LinearRegressionResult {
  slope: number
  intercept: number
  residualStandardError: number
  xMean: number
  sxx: number
  count: number
}

export function linearRegression(points: readonly RegressionPoint[]): LinearRegressionResult | null {
  if (points.length < 2) return null
  const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length
  const sxx = points.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0)
  const slope = sxx ? points.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0) / sxx : 0
  const intercept = yMean - slope * xMean
  const sse = points.reduce((sum, point) => sum + (point.y - intercept - slope * point.x) ** 2, 0)
  return { slope, intercept, residualStandardError: Math.sqrt(sse / Math.max(1, points.length - 2)), xMean, sxx, count: points.length }
}

export function sampleRegression(result: LinearRegressionResult, minimum: number, maximum: number, count = 31) {
  return Array.from({ length: count }, (_, index) => {
    const x = minimum + (maximum - minimum) * index / Math.max(1, count - 1)
    const y = result.intercept + result.slope * x
    const delta = 1.96 * result.residualStandardError * Math.sqrt(1 / result.count + (result.sxx ? (x - result.xMean) ** 2 / result.sxx : 0))
    return { x, y, lower: y - delta, upper: y + delta }
  })
}
