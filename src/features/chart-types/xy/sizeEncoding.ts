export interface SizeEncodingInput {
  minimumDiameter: number
  maximumDiameter: number
  maximumMagnitude: number
  missingDiameter: number
}

export function normalizeSizeRange(minimum = 6, maximum = 42) {
  return { minimumDiameter: Math.min(minimum, maximum), maximumDiameter: Math.max(minimum, maximum) }
}

export function encodeBubbleDiameter(value: unknown, input: SizeEncodingInput) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return input.missingDiameter
  const denominator = input.maximumMagnitude || 1
  return input.minimumDiameter + (input.maximumDiameter - input.minimumDiameter) * Math.sqrt(Math.abs(value) / denominator)
}

export function niceSizeGuideValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) return value
  const power = 10 ** Math.floor(Math.log10(value))
  const candidates = [1, 2, 3, 5, 7, 10].map((factor) => factor * power)
  return candidates.reduce((best, candidate) => candidate <= value && candidate > best ? candidate : best, candidates[0])
}
