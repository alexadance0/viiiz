export function deterministicDistributionOffset(observationIndex: number, groupIndex: number) {
  let value = Math.imul(observationIndex + 1, 0x9e3779b1) ^ Math.imul(groupIndex + 1, 0x85ebca6b)
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  return ((value >>> 0) / 0xffffffff) * 2 - 1
}
