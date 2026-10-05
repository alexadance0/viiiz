import { test } from '@playwright/test'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

test('audit exported text collisions without changing snapshots', async ({ page }) => {
  test.skip(process.env.CHART_AUDIT !== '1')
  test.setTimeout(180_000)
  const directory = 'output/chart-audit-2026-10-03/browser'
  const results: unknown[] = []
  await page.setViewportSize({ width: 1100, height: 850 })
  for (const kind of readdirSync(directory)) {
    for (const file of readdirSync(`${directory}/${kind}`).filter((name) => name.endsWith('-export.svg'))) {
      await page.setContent(`<style>body{margin:0}svg{display:block}</style>${readFileSync(`${directory}/${kind}/${file}`, 'utf8')}`)
      await page.evaluate(() => document.fonts.ready)
      const collisions = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('svg text')].flatMap((element) => {
          const box = element.getBoundingClientRect(), style = getComputedStyle(element)
          if (!element.textContent?.trim() || Number(style.opacity) === 0 || box.width < .1 || box.height < .1) return []
          return [{ text: element.textContent.slice(0, 120), x: box.x, y: box.y, width: box.width, height: box.height }]
        })
        const pairs: unknown[] = []
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j]
          const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
          const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
          if (width > 2 && height > 2 && width * height > Math.min(a.width * a.height, b.width * b.height) * .25) pairs.push({ a, b, intersection: width * height })
        }
        return pairs.slice(0, 60)
      })
      results.push({ kind, file, collisions })
    }
  }
  writeFileSync('output/chart-audit-2026-10-03/export-text-collisions.json', JSON.stringify(results, null, 2))
})
