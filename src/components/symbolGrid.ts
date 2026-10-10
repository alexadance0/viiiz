export const SYMBOL_GRID = {
  cellWidth: 22,
  cellHeight: 22,
  font: '500 17px ui-monospace, SFMono-Regular, Menlo, monospace',
  baselineOffset: 0.5,
} as const

const textColors = {
  left: [224, 51, 171],
  center: [22, 119, 166],
  right: [17, 157, 211],
  bottom: [228, 165, 44],
} as const

export function symbolGridColorAt(x: number, y: number, width: number, height: number) {
  const horizontal = Math.min(1, Math.max(0, x / width))
  const vertical = Math.min(1, Math.max(0, y / height))
  const amount = horizontal < 0.5 ? horizontal * 2 : (horizontal - 0.5) * 2
  const from = horizontal < 0.5 ? textColors.left : textColors.center
  const to = horizontal < 0.5 ? textColors.center : textColors.right
  const bottomWeight = Math.max(0, vertical - 0.58) * 0.52
  return from.map((channel, index) => {
    const mixed = channel + (to[index] - channel) * amount
    return mixed + (textColors.bottom[index] - mixed) * bottomWeight
  })
}
