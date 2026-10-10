import { expect, test } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const { PNG } = require(join(dirname(require.resolve('playwright-core')), 'lib/utilsBundle.js'))
const directory = 'output/annotation-export'

test('thick outlines on Latin and Cyrillic M stay within the stroke radius without spikes', async ({ page }) => {
  await mkdir(directory, { recursive: true })
  await page.setViewportSize({ width: 640, height: 440 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await page.goto('/editor')
  const renderGlyphs = (html: string, width = 600, height = 400, textWidth = 300, fontSize = 72) => page.evaluate(async ({ html, width, height, textWidth, fontSize }) => {
    await import('/src/index.css')
    await import('/src/App.css')
    const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
    renderConfig('bar', { canvasWidth: width, canvasHeight: height, canvasBackground: '#db5a5a', color: '#db5a5a', palette: ['#db5a5a'], xField: 'category', yField: 'value', yFields: ['value'], seriesField: '', showTitle: false, showSubtitle: false, showNote: false, showSource: false, showLegend: false, showValues: false, showXAxisTitle: false, showYAxisTitle: false, showXAxisLine: false, showYAxisLine: false, showXAxisLabels: false, showYAxisLabels: false, showXTicks: false, showYTicks: false, showHorizontalGrid: false,
      annotations: [{ id: 'm', x: 100, y: 80, width: textWidth, fontFamily: 'Onest, sans-serif', fontSize, textAlign: 'left', backgroundColor: 'transparent', borderColor: 'transparent', textStrokeColor: '#ffffff', textStrokeWidth: 12, fragments: [], html }],
    }, { name: 'M', columns: ['category', 'value'], rows: [{ category: 'A', value: 1 }] })
  }, { html, width, height, textWidth, fontSize })
  await renderGlyphs('<b>MMM<br>МММ</b>')
  const shell = page.locator('#chart-audit-host .chart-canvas-shell')
  await expect(shell).toHaveAttribute('data-render-status', 'settled')
  const image = PNG.sync.read(await shell.screenshot({ path: `${directory}/rounded-m-editor.png` }))
  let inkTop = image.height, haloTop = image.height, inkBottom = 0, haloBottom = 0, inkLeft = image.width, haloLeft = image.width, inkRight = 0, haloRight = 0
  for (let y = 50; y < 320; y++) for (let x = 80; x < 420; x++) {
    const index = (y * image.width + x) * 4
    const channels = [image.data[index], image.data[index + 1], image.data[index + 2]]
    if (channels.every((value) => value < 90)) { inkTop = Math.min(inkTop, y); inkBottom = Math.max(inkBottom, y); inkLeft = Math.min(inkLeft, x); inkRight = Math.max(inkRight, x) }
    if (channels.every((value) => value > 230)) { haloTop = Math.min(haloTop, y); haloBottom = Math.max(haloBottom, y); haloLeft = Math.min(haloLeft, x); haloRight = Math.max(haloRight, x) }
  }
  expect(inkTop).toBeLessThan(inkBottom)
  expect(haloTop).toBeGreaterThanOrEqual(inkTop - 7)
  expect(haloBottom).toBeLessThanOrEqual(inkBottom + 7)
  const margins = [inkTop - haloTop, haloBottom - inkBottom, inkLeft - haloLeft, haloRight - inkRight]
  margins.forEach((margin) => expect(margin).toBeGreaterThanOrEqual(5))
  expect(Math.max(...margins) - Math.min(...margins)).toBeLessThanOrEqual(1)
  const download = page.waitForEvent('download')
  await page.evaluate(async () => (await import('/src/test-fixtures/chartAudit.browser.tsx')).exportSvg())
  const svg = await readFile((await (await download).path())!, 'utf8')
  expect(svg).toContain('stroke-linejoin="round"')
  expect(svg).not.toContain('stroke-linejoin="miter"')
  await renderGlyphs('<b>Мё<br>i j ···…</b>')
  await expect(shell).toHaveAttribute('data-render-status', 'settled')
  await expect(shell.locator('.annotation-halo text').first()).toHaveAttribute('fill', 'rgb(255, 255, 255)')
  await shell.screenshot({ path: `${directory}/dots-editor.png` })
  await renderGlyphs('<b>Текст  ё.     :::</b><br>авп   вап.    апв')
  await expect(shell).toHaveAttribute('data-render-status', 'settled')
  const gaps = await shell.locator('.annotation-halo [data-text-layer="foreground"] text').evaluateAll((nodes) => nodes.flatMap((node) => {
    const text = node.textContent ?? '', match = / {2,}/.exec(text)
    if (!match) return []
    const element = node as SVGTextContentElement
    const length = element.getSubStringLength(match.index, match[0].length)
    const single = element.getSubStringLength(match.index, 1)
    return [{ length, expected: single * match[0].length }]
  }))
  expect(gaps.length).toBeGreaterThan(0)
  gaps.forEach(({ length, expected }) => expect(length).toBeCloseTo(expected, 0))
  await shell.screenshot({ path: `${directory}/spaces-editor.png` })
  await page.setViewportSize({ width: 1040, height: 790 })
  await renderGlyphs('Текст  аннотации М.    ::::<br>пр рпмр рмпрм   ав<br>авп вап вап   авп вап.<br>апв.      амв. ав. вмавп<br>а.   авп ва.   апв ап.', 1000, 750, 880, 64)
  await expect(shell).toHaveAttribute('data-render-status', 'settled')
  await shell.screenshot({ path: `${directory}/long-text-editor.png` })
})

for (const font of ['Onest, sans-serif', 'Wix Madefor Text, sans-serif', 'Georgia, serif']) {
  for (const [width, height] of [[600, 400], [1000, 750]]) {
    test(`annotations preserve editor, SVG and PNG appearance: ${font}, ${width}×${height}`, async ({ page, context }) => {
      test.setTimeout(60_000)
      await mkdir(directory, { recursive: true })
      await page.setViewportSize({ width: width + 40, height: height + 40 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.route('**/src/main.tsx', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }))
      await page.goto('/editor')
      await page.evaluate(async ({ font, width, height }) => {
        await import('/src/index.css')
        await import('/src/App.css')
        const { auditFixture } = await import('/src/test-fixtures/chartAudit.ts')
        const fixture = auditFixture('bar')
        const textStyles = Object.fromEntries(Object.entries(fixture.config).filter(([key, value]) => key.endsWith('Text') && value && typeof value === 'object' && 'size' in value).map(([key, value]) => [key, { ...value, fontFamily: font }]))
        const annotation = { id: 'note', x: 42, y: 24, width: 190, fontFamily: font, fontSize: 18, textAlign: 'left', backgroundColor: '#ffffff', borderColor: '#d4d4d4', textStrokeColor: '#ffffff', textStrokeWidth: 4, fragments: [], html: '<b>Пик  роста: ё…</b><br><i>€   12 345,67</i><br><span style="background-color:rgba(228,165,44,0.45)">Длинное  пояснение с переносами строк</span>' }
        const footnote = { ...annotation, id: 'source', x: width - 235, y: height - 100, width: 205, fontSize: 14, textAlign: 'right', borderColor: 'transparent', backgroundColor: 'transparent', html: 'Источник: данные<br>2024–2026 · 35%<br>₽, €, ±, ≥' }
        const { renderConfig } = await import('/src/test-fixtures/chartAudit.browser.tsx')
        renderConfig('bar', { ...textStyles, canvasWidth: width, canvasHeight: height, xField: 'category', yField: 'value', yFields: ['value'], seriesField: '', showTitle: false, showSubtitle: false, showNote: false, showSource: false, showLegend: false, showValues: false, showXAxisTitle: false, showYAxisTitle: false,
          annotations: [annotation, footnote], decorations: [
            { id: 'area', type: 'area', x: width * .25, y: height * .4, width: width * .25, height: height * .3, color: '#e4a52c', opacity: .18, lineWidth: 1, lineType: 'solid' },
            { id: 'curve', type: 'curved-line', x: 120, y: 160, width: width * .35, height: height * .25, color: '#202027', opacity: 1, lineWidth: 2, lineType: 'dashed', arrowPlacement: 'end', arrowHead: 'filled', startAnchor: { annotationId: 'note', side: 'bottom' }, controlPoints: { first: { x: 0, y: 50 }, second: { x: -50, y: 0 } } },
            { id: 'arrow', type: 'arrow', x: width * .55, y: height * .35, width: width * .25, height: height * .15, color: '#202027', opacity: 1, lineWidth: 6, lineType: 'solid', arrowPlacement: 'end', arrowHead: 'filled' },
          ],
        }, { name: 'export', columns: ['category', 'value'], rows: [{ category: 'A', value: 10 }, { category: 'B', value: 25 }, { category: 'C', value: 17 }] })
      }, { font, width, height })
      const shell = page.locator('#chart-audit-host .chart-canvas-shell')
      await expect(shell).toHaveAttribute('data-render-status', 'settled')
      await expect(shell.locator('.annotation-halo text').first()).toHaveAttribute('fill', 'rgb(255, 255, 255)')
      await expect(shell.locator('.annotation-halo [data-text-layer="highlight"] rect').first()).toHaveAttribute('fill', 'rgba(228, 165, 44, 0.45)')
      const stem = `${directory}/${font.split(',')[0].replaceAll(' ', '-')}-${width}x${height}`
      const preview = PNG.sync.read(await shell.screenshot({ path: `${stem}-editor.png`, animations: 'disabled' }))
      const textMetrics = await shell.locator('.annotation-foreground').evaluateAll((elements) => elements.flatMap((element) => {
        const canvas = element.closest('.chart-canvas-shell')!.getBoundingClientRect()
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), records = []
        while (walker.nextNode()) {
          const node = walker.currentNode, range = document.createRange(); range.selectNodeContents(node)
          const bounds = range.getBoundingClientRect(), style = getComputedStyle(node.parentElement!)
          records.push({ text: node.textContent, x: bounds.x - canvas.x, y: bounds.y - canvas.y, width: bounds.width, height: bounds.height, font: style.font, spacing: style.letterSpacing, kerning: style.fontKerning })
        }
        return records
      }))
      await writeFile(`${stem}-text.json`, JSON.stringify(textMetrics, null, 2))
      await writeFile(`${stem}-outline.json`, JSON.stringify(await shell.locator('.annotation-halo text').evaluateAll((nodes) => nodes.map((node) => {
        const style = getComputedStyle(node)
        return { text: node.textContent, x: node.getAttribute('x'), y: node.getAttribute('y'), font: style.font, synthesis: style.fontSynthesis, features: style.fontFeatureSettings, kerning: style.fontKerning, stroke: style.stroke, width: style.strokeWidth }
      })), null, 2))
      const results: Record<string, number> = {}
      for (const format of ['svg', 'png']) {
        const download = page.waitForEvent('download')
        await page.evaluate(async (format) => { const fixture = await import('/src/test-fixtures/chartAudit.browser.tsx'); await (format === 'svg' ? fixture.exportSvg() : fixture.exportPng()) }, format)
        const path = `${stem}.${format}`
        await (await download).saveAs(path)
        let buffer: Buffer
        if (format === 'svg') {
          const source = await readFile(path, 'utf8')
          const exported = await context.newPage()
          await exported.setViewportSize({ width, height })
          await exported.setContent(`<style>body{margin:0}svg{display:block}</style>${source}`)
          await exported.evaluate(() => document.fonts.ready)
          await expect(exported.locator('g[data-annotation-id]')).toHaveCount(2)
          await expect(exported.locator('g[data-annotation-id="note"]')).toContainText('Пик  роста', { useInnerText: false })
          buffer = await exported.locator('svg').screenshot({ path: `${stem}-svg.png` })
          await exported.close()
        } else buffer = await readFile(path)
        const image = PNG.sync.read(buffer)
        expect([image.width, image.height]).toEqual([preview.width, preview.height])
        let difference = 0
        for (let offset = 0; offset < image.data.length; offset += 4) if (Math.max(...[0, 1, 2].map((channel) => Math.abs(image.data[offset + channel] - preview.data[offset + channel]))) > 24) difference++
        results[format] = difference / (image.width * image.height)
      }
      await writeFile(`${stem}-comparison.json`, JSON.stringify(results, null, 2))
      expect(results.svg, 'Editor/SVG pixel differences').toBeLessThan(.0001)
      expect(results.png, 'Editor/PNG pixel differences').toBeLessThan(.0001)
    })
  }
}
