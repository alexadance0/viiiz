import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

for (const kind of ['stream-graph', 'line', 'bar', 'horizontal-bar', 'stacked-area', 'bump', 'moving-average-line'] as const) {
  test(`${kind} wraps series names, pins their position and exports it`, async ({ page }) => {
    if (kind !== 'line') await page.emulateMedia({ reducedMotion: 'reduce' })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
    await page.goto('/editor')
    await page.evaluate(async (kind) => {
      await import('/src/index.css'); await import('/src/App.css')
      const fixture = await import('/src/test-fixtures/directLabels.browser.tsx')
      fixture.render(kind)
    }, kind)
    const canvas = page.locator('#direct-label-test-host .chart-canvas-shell')
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    await page.getByRole('button', { name: 'Расположение подписей', exact: true }).click()
    const handle = page.getByRole('button', { name: 'Переместить подпись Выручка от цифровой музыки', exact: true }).first()
    await expect(handle).toBeVisible()
    const before = (await handle.boundingBox())!
    const sameName = page.getByRole('button', { name: 'Переместить подпись Выручка от цифровой музыки', exact: true })
    const otherBefore = await sameName.count() > 1 ? await sameName.nth(1).boundingBox() : null
    const labelColor = await canvas.locator('svg text').filter({ hasText: /^Выручка от$/ }).first().getAttribute('fill')
    const leaders = canvas.locator(`svg [stroke="${labelColor}"][fill="none"]`)
    const leaderBefore = kind === 'bar' || kind === 'horizontal-bar' ? await leaders.evaluateAll((nodes) => nodes.map((node) => ['d', 'points', 'x1', 'y1', 'x2', 'y2'].map((key) => node.getAttribute(key)))) : []
    expect(before.height).toBeGreaterThan(30)
    const automaticRevision = (await canvas.getAttribute('data-render-revision'))!
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
    await page.mouse.down()
    await page.mouse.move(before.x + before.width / 2 - 35, before.y + before.height / 2 + 45, { steps: 6 })
    await page.mouse.up()
    await expect(canvas).not.toHaveAttribute('data-render-revision', automaticRevision)
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    await expect(page.locator('.direct-label-toolbar')).toContainText('Закреплено')
    const after = (await handle.boundingBox())!
    expect(after.y + after.height / 2 - before.y - before.height / 2).toBeCloseTo(45, 0)
    if (leaderBefore.length) expect(await leaders.evaluateAll((nodes) => nodes.map((node) => ['d', 'points', 'x1', 'y1', 'x2', 'y2'].map((key) => node.getAttribute(key))))).not.toEqual(leaderBefore)
    if (otherBefore) {
      const otherAfter = (await sameName.nth(1).boundingBox())!
      expect(otherAfter.y).toBeCloseTo(otherBefore.y, 0)
      expect(otherAfter.x).toBeCloseTo(otherBefore.x, 0)
    }
    const id = (await handle.getAttribute('data-label-id'))!
    const position = await page.evaluate(async (id) => (await import('/src/test-fixtures/directLabels.browser.tsx')).configuration().directLabelPositions![id], id)
    expect(position.y).toBeGreaterThan(0)
    const nameLines = ['Выручка от', 'цифровой музыки']
    const displayed = await canvas.locator('svg text').evaluateAll((nodes, nameLines) => nodes.filter((node) => nameLines.includes(node.textContent ?? '')).map((node) => { const point = new DOMPoint(Number(node.getAttribute('x')), Number(node.getAttribute('y'))).matrixTransform((node as SVGGraphicsElement).getCTM() ?? new DOMMatrix()); return { text: node.textContent, x: point.x, y: point.y } }), nameLines)
    const download = page.waitForEvent('download')
    await page.evaluate(async () => (await import('/src/test-fixtures/directLabels.browser.tsx')).exportSvg())
    const svg = await readFile((await (await download).path())!, 'utf8')
    expect(svg).toContain('цифровой музыки')
    expect(svg).not.toContain('direct-label-handle')
    const exported = await page.evaluate(({ svg, nameLines }) => {
      const root = document.importNode(new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement, true) as unknown as SVGSVGElement
      root.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden'
      document.body.append(root)
      const labels = [...root.querySelectorAll('text')].filter((node) => nameLines.includes(node.textContent ?? '')).map((node) => { const point = new DOMPoint(Number(node.getAttribute('x')), Number(node.getAttribute('y'))).matrixTransform(node.getCTM() ?? new DOMMatrix()); return { text: node.textContent, x: point.x, y: point.y } })
      root.remove()
      return labels
    }, { svg, nameLines })
    displayed.sort((a, b) => String(a.text).localeCompare(String(b.text)) || a.x - b.x || a.y - b.y)
    exported.sort((a, b) => String(a.text).localeCompare(String(b.text)) || a.x - b.x || a.y - b.y)
    expect(exported.length).toBe(displayed.length)
    expect(exported.length).toBeGreaterThanOrEqual(2)
    for (const [index, label] of exported.entries()) {
      expect(label.text).toBe(displayed[index].text)
      expect(label.x).toBeCloseTo(displayed[index].x, 2)
      expect(label.y).toBeCloseTo(displayed[index].y, 2)
    }
    const pinnedRevision = (await canvas.getAttribute('data-render-revision'))!
    await page.getByRole('button', { name: 'Вернуть все подписи автоматически', exact: true }).click()
    await expect(canvas).not.toHaveAttribute('data-render-revision', pinnedRevision)
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    const restored = (await handle.boundingBox())!
    expect(restored.y).toBeCloseTo(before.y, 0)
    expect(restored.x).toBeCloseTo(before.x, 0)
    if (leaderBefore.length) expect(await leaders.evaluateAll((nodes) => nodes.map((node) => ['d', 'points', 'x1', 'y1', 'x2', 'y2'].map((key) => node.getAttribute(key))))).toEqual(leaderBefore)
    expect(errors).toEqual([])
  })
}

test('editor keeps series placement controls in the direct legend settings and supports undo', async ({ page }) => {
  await page.goto('/editor')
  await page.getByRole('button', { name: 'Музыка в США · 1973–2025', exact: true }).click()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: /Настроить оформление/ }).click()
  const canvas = page.locator('.chart-canvas-shell[data-chart-kind="stream-graph"]')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  const menu = page.locator('.canvas-floating-menu')
  await expect(menu.getByRole('button', { name: 'Расположение подписей', exact: true })).toHaveCount(0)
  const legend = page.locator('details.legend-settings')
  await legend.locator(':scope > summary').click()
  await legend.getByRole('button', { name: 'Расположение подписей', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Переносить длинные названия на две строки', exact: true })).toBeChecked()
  const handle = page.getByRole('button', { name: 'Переместить подпись CD', exact: true })
  const before = (await handle.boundingBox())!
  const revision = (await canvas.getAttribute('data-render-revision'))!
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
  await page.mouse.down()
  await page.mouse.move(before.x + before.width / 2 + 20, before.y + before.height / 2 + 25, { steps: 5 })
  await page.mouse.up()
  await expect(canvas).not.toHaveAttribute('data-render-revision', revision)
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await expect(page.locator('.direct-label-toolbar')).toContainText('Закреплено')
  const pinnedRevision = (await canvas.getAttribute('data-render-revision'))!
  await menu.getByRole('button', { name: 'Отменить', exact: true }).click()
  await expect(canvas).not.toHaveAttribute('data-render-revision', pinnedRevision)
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await expect(page.locator('.direct-label-toolbar')).toContainText('Автоматически')
  const restored = (await handle.boundingBox())!
  expect(restored.x).toBeCloseTo(before.x, 0)
  expect(restored.y).toBeCloseTo(before.y, 0)
})

test('return to automatic restores every moved label and leaving legend settings exits placement mode', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/editor')
  await page.getByRole('button', { name: 'Музыка в США · 1973–2025', exact: true }).click()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByRole('button', { name: /Настроить оформление/ }).click()
  const canvas = page.locator('.chart-canvas-shell[data-chart-kind="stream-graph"]')
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  const legend = page.locator('details.legend-settings')
  await legend.locator(':scope > summary').click()
  await legend.getByRole('button', { name: 'Расположение подписей', exact: true }).click()
  const originals: Array<{ name: string; x: number; y: number }> = []
  for (const name of ['CD', 'Винил']) {
    const handle = page.getByRole('button', { name: `Переместить подпись ${name}`, exact: true })
    const box = (await handle.boundingBox())!
    originals.push({ name, x: box.x + box.width / 2, y: box.y + box.height / 2 })
    const revision = (await canvas.getAttribute('data-render-revision'))!
    await handle.press('Shift+ArrowDown')
    await expect(canvas).not.toHaveAttribute('data-render-revision', revision)
    await expect(canvas).toHaveAttribute('data-render-status', 'settled')
    const moved = (await handle.boundingBox())!
    expect(moved.y + moved.height / 2).toBeGreaterThan(box.y + box.height / 2 + 1)
  }
  const reset = legend.getByRole('button', { name: 'Вернуть все подписи автоматически', exact: true })
  await expect(reset).toBeEnabled()
  const revision = (await canvas.getAttribute('data-render-revision'))!
  await reset.click()
  await expect(canvas).not.toHaveAttribute('data-render-revision', revision)
  await expect(canvas).toHaveAttribute('data-render-status', 'settled')
  await expect(reset).toBeDisabled()
  for (const original of originals) {
    const restored = (await page.getByRole('button', { name: `Переместить подпись ${original.name}`, exact: true }).boundingBox())!
    expect(restored.x + restored.width / 2).toBeCloseTo(original.x, 0)
    expect(restored.y + restored.height / 2).toBeCloseTo(original.y, 0)
  }
  await legend.locator(':scope > summary').click()
  await expect(page.locator('.direct-label-handles')).toHaveCount(0)
  await legend.locator(':scope > summary').click()
  await expect(legend.getByRole('button', { name: 'Расположение подписей', exact: true })).toHaveAttribute('aria-pressed', 'false')
})
