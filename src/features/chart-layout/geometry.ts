export interface Rect { x: number; y: number; width: number; height: number }
export interface Size { width: number; height: number }
export interface Insets { top: number; right: number; bottom: number; left: number }
export type CoordinateSpace = 'canvas' | 'content' | 'plot' | 'data' | 'parent'

export const insetRect = (rect: Rect, insets: Insets): Rect => ({
  x: rect.x + insets.left,
  y: rect.y + insets.top,
  width: Math.max(0, rect.width - insets.left - insets.right),
  height: Math.max(0, rect.height - insets.top - insets.bottom),
})

export const rotatedSize = ({ width, height }: Size, degrees: number): Size => {
  const radians = Math.abs(degrees) * Math.PI / 180
  return {
    width: Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians)),
    height: Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians)),
  }
}
