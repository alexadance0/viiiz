import { expect, test } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'

test('large charts preserve their geometry while selection and annotations skip compilation', async ({ page }) => {
  test.setTimeout(90_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  await page.evaluate(async () => {
    await import('/src/index.css')
    await import('/src/App.css')
    await import('/src/test-fixtures/chartPerformance.browser.tsx')
  })
  const settled = () => expect(page.locator('.chart-canvas-shell')).toHaveAttribute('data-render-status', 'settled')
  const measurements = () => page.evaluate(async () => ({ ...(await import('/src/test-fixtures/chartPerformance.browser.tsx')).measurements }))
  const displayGeometry = () => page.locator('.chart-canvas svg').evaluate((svg) => [...svg.querySelectorAll('path,text,rect')].filter((node) => {
    const style = getComputedStyle(node)
    return !node.getAttribute('transform')?.startsWith('matrix(0,0,0,0,') && !(style.fillOpacity === '0' && (style.stroke === 'none' || style.strokeOpacity === '0'))
  }).map((node) => ({ text: node.textContent, attributes: [...node.attributes].filter(({ name }) => !name.startsWith('ecmeta_')).map(({ name, value }) => [name, value]).sort() })))
  const geometry = () => page.evaluate(async () => {
    const svg = await (await import('/src/test-fixtures/chartPerformance.browser.tsx')).svg()
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
    return [...document.querySelectorAll('path,text')].map((node) => ['d', 'x', 'y', 'transform', 'fill', 'stroke', 'stroke-width'].map((attribute) => node.getAttribute(attribute)).concat(node.textContent)).filter((row) => row.some(Boolean))
  })
  await settled()
  const initial = await measurements(), before = await geometry()
  const beforeDisplay = await displayGeometry()
  await page.evaluate(async () => (await import('/src/test-fixtures/chartPerformance.browser.tsx')).hover('y'))
  await settled()
  await page.evaluate(async () => (await import('/src/test-fixtures/chartPerformance.browser.tsx')).hover(null))
  await settled()
  await page.evaluate(async () => (await import('/src/test-fixtures/chartPerformance.browser.tsx')).select({ selectedSeriesName: 'y', selectedSettingsSection: 'element' }))
  await settled()
  await page.evaluate(async () => (await import('/src/test-fixtures/chartPerformance.browser.tsx')).select({}))
  await settled()
  await page.evaluate(async () => (await import('/src/test-fixtures/chartPerformance.browser.tsx')).selectPoint())
  await settled()
  await page.evaluate(async () => (await import('/src/test-fixtures/chartPerformance.browser.tsx')).select({}))
  await settled()
  const selected = await measurements()
  expect(await displayGeometry()).toEqual(beforeDisplay)
  await page.evaluate(async () => {
    const fixture = await import('/src/test-fixtures/chartPerformance.browser.tsx')
    for (let x = 0; x < 5; x++) fixture.update({ decorations: [{ id: 'arrow', type: 'arrow', x: 100 + x * 10, y: 100, width: 100, height: 50, color: '#202027', opacity: 1, lineWidth: 2, lineType: 'solid' }] })
  })
  await settled()
  await page.evaluate(async () => (await import('/src/test-fixtures/chartPerformance.browser.tsx')).update({ decorations: [] }))
  await settled()
  const annotated = await measurements(), after = await geometry()
  expect(after).toEqual(before)
  const report = { initial, selected, annotated, geometry: before }
  if (process.env.PERF_BASELINE === '1') await writeFile('/tmp/viiiz-performance-baseline.json', JSON.stringify(report))
  else {
    expect(selected.compiles).toBe(initial.compiles)
    expect(annotated.compiles).toBe(initial.compiles)
    expect(annotated.seriesUpdates).toBe(selected.seriesUpdates)
    if (process.env.PERF_COMPARE === '1') {
      const baseline = JSON.parse(await readFile('/tmp/viiiz-performance-baseline.json', 'utf8'))
      expect(before).toEqual(baseline.geometry)
      console.log(JSON.stringify({ before: baseline.annotated, after: annotated }))
    }
  }
})
