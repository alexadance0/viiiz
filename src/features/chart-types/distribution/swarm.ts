export const packSwarmOffsets = (positions: readonly number[], diameter: number) => {
  const placed: Array<{ position: number; offset: number }> = []
  return positions.map((position) => {
    const candidates = [0]
    placed.forEach((point) => {
      const distance = Math.abs(position - point.position)
      if (distance >= diameter) return
      const cross = Math.sqrt(Math.max(0, diameter ** 2 - distance ** 2))
      candidates.push(point.offset - cross, point.offset + cross)
    })
    candidates.sort((left, right) => Math.abs(left) - Math.abs(right) || left - right)
    const offset = candidates.find((candidate) => placed.every((point) => (position - point.position) ** 2 + (candidate - point.offset) ** 2 >= (diameter - .01) ** 2)) ?? 0
    placed.push({ position, offset })
    return offset
  })
}

export const fitSwarmClouds = (positionClouds: readonly (readonly number[])[], preferredDiameter: number, maximumOffset: number) => {
  const diameter = Math.max(.25, preferredDiameter)
  const offsets = positionClouds.map((positions) => packSwarmOffsets(positions, diameter))
  const extent = Math.max(...offsets.flatMap((cloud) => cloud.map(Math.abs)), 0)
  const scale = extent > maximumOffset && extent > 0 ? maximumOffset / extent : 1
  return { offsets: offsets.map((cloud) => cloud.map((offset) => offset * scale)), diameter: diameter * scale }
}

export const fitSwarmOffsets = (positions: readonly number[], preferredDiameter: number, maximumOffset: number) => {
  const fitted = fitSwarmClouds([positions], preferredDiameter, maximumOffset)
  return { offsets: fitted.offsets[0], diameter: fitted.diameter }
}
