import { expect, type Locator, type Page } from '@playwright/test'

export async function selectShape(page: Page, shape: Locator, fromEdge = false) {
  for (let click = 0; click < 2; click++) {
    const point = await shape.evaluate((element, fromEdge) => {
      const path = element as SVGGeometryElement, box = path.getBBox(), matrix = path.getScreenCTM()!
      const columns = fromEdge ? [.1, .2, .3, .4, .5, .6, .7, .8, .9] : [.5, .4, .6, .3, .7, .2, .8, .1, .9]
      for (const x of columns) for (const y of [.5, .4, .6, .3, .7, .2, .8, .1, .9]) {
        const local = new DOMPoint(box.x + box.width * x, box.y + box.height * y)
        if (path.isPointInFill(local)) {
          const screen = local.matrixTransform(matrix)
          const coveredByLabel = [...path.ownerSVGElement!.querySelectorAll('text, path[fill="rgba(0,0,0,0)"], path[fill-opacity="0"]')].some((text) => {
            if (text.tagName === 'path' && !/l[-\d.]+ 0l0 /.test(text.getAttribute('d') ?? '')) return false
            const bounds = text.getBoundingClientRect()
            return screen.x >= bounds.left - 2 && screen.x <= bounds.right + 2 && screen.y >= bounds.top - 2 && screen.y <= bounds.bottom + 2
          })
          if (!coveredByLabel) return { x: screen.x, y: screen.y }
        }
      }
      throw new Error('No shape interior point')
    }, fromEdge)
    await page.mouse.click(point.x, point.y)
    await expect(page.locator('.element-editor')).toBeVisible()
    await expect(page.locator('.chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
  }
}
