import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test.use({ viewport: { width: 1600, height: 1200 }, colorScheme: 'light' })
test.beforeEach(async ({ page }) => page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' }))

const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const setCheckbox = async (checkbox: Locator, selected: boolean) => {
  await checkbox.scrollIntoViewIfNeeded()
  if (await checkbox.isChecked() !== selected) await checkbox.press('Space')
}

const setSettingsCheckbox = async (root: Locator, label: string, selected: boolean) => {
  const control = root.locator('.settings-checkbox').filter({ hasText: new RegExp(`^${escaped(label)}$`) })
  const checkbox = control.locator('input[type="checkbox"]')
  await control.scrollIntoViewIfNeeded()
  if (await checkbox.isChecked() !== selected) await control.click()
}

const chartRevision = async (canvas: Locator) => Number(await canvas.getAttribute('data-render-revision') ?? 0)

const waitForStableBox = async (locator: Locator) => {
  await expect.poll(async () => locator.evaluate((element) => new Promise<boolean>((resolve) => {
    const first = element.getBoundingClientRect()
    requestAnimationFrame(() => {
      const second = element.getBoundingClientRect()
      resolve(first.width > 0 && first.height > 0 && Math.abs(first.x - second.x) < .25 && Math.abs(first.y - second.y) < .25 && Math.abs(first.width - second.width) < .25 && Math.abs(first.height - second.height) < .25)
    })
  }))).toBe(true)
}

const expectCanvasScreenshot = async (canvas: Locator, name: string) => {
  const transform = await canvas.evaluate((element) => (element as HTMLElement).style.transform)
  await canvas.evaluate((element) => { (element as HTMLElement).style.transform = 'none' })
  try {
    await waitForStableBox(canvas)
    await expect(canvas).toHaveScreenshot(name)
  } finally {
    await canvas.evaluate((element, value) => { (element as HTMLElement).style.transform = value }, transform)
  }
}

const expectPreviewSvgScreenshot = async (canvas: Locator, name: string) => {
  const transform = await canvas.evaluate((element) => (element as HTMLElement).style.transform)
  const svg = canvas.locator('.chart-canvas svg').first()
  const svgStyle = await svg.evaluate((element) => (element as SVGElement).getAttribute('style'))
  const size = await svg.evaluate((element) => ({
    width: Number(element.getAttribute('width')),
    height: Number(element.getAttribute('height')),
  }))
  await canvas.evaluate((element) => { (element as HTMLElement).style.transform = 'none' })
  await svg.evaluate((element, { width, height }) => {
    Object.assign((element as SVGElement).style, {
      display: 'block',
      width: `${width}px`,
      height: `${height}px`,
      maxWidth: 'none',
      flex: 'none',
      position: 'fixed',
      inset: '0 auto auto 0',
      zIndex: '9999',
    })
  }, size)
  try {
    await expect(svg).toHaveScreenshot(name, { maxDiffPixelRatio: .01 })
  } finally {
    await svg.evaluate((element, value) => {
      if (value === null) element.removeAttribute('style')
      else element.setAttribute('style', value)
    }, svgStyle)
    await canvas.evaluate((element, value) => { (element as HTMLElement).style.transform = value }, transform)
  }
}

const expectExportParity = async (page: Page, context: BrowserContext, name: string) => {
  const canvas = page.locator('.chart-canvas-shell')
  await waitForChartSettled(page, canvas)
  await expectPreviewSvgScreenshot(canvas, name)

  const menu = page.locator('.export-menu')
  if (!await menu.evaluate((element) => (element as HTMLDetailsElement).open)) await menu.locator(':scope > summary').click()
  await menu.locator('select').selectOption('1')

  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать SVG' }).click()
  const svg = await readFile(await (await svgDownload).path()!, 'utf8')
  const width = Number(svg.match(/<svg[^>]*\bwidth="([^"]+)"/i)?.[1])
  const height = Number(svg.match(/<svg[^>]*\bheight="([^"]+)"/i)?.[1])
  expect(width).toBeGreaterThanOrEqual(320)
  expect(height).toBeGreaterThanOrEqual(320)
  const svgPage = await context.newPage()
  await svgPage.setViewportSize({ width, height })
  await svgPage.setContent(`<style>html,body{margin:0;background:white}</style>${svg}`)
  await svgPage.evaluate(() => document.fonts.ready)
  await expect(svgPage.locator('svg')).toHaveScreenshot(name, { maxDiffPixelRatio: .01 })
  await svgPage.close()

  const pngDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать PNG' }).click()
  const png = await readFile(await (await pngDownload).path()!)
  expect(png.readUInt32BE(16)).toBe(width)
  expect(png.readUInt32BE(20)).toBe(height)
  const pngPage = await context.newPage()
  await pngPage.setViewportSize({ width, height })
  await pngPage.setContent(`<style>html,body{margin:0;background:white}img{display:block;width:${width}px;height:${height}px}</style><img src="data:image/png;base64,${png.toString('base64')}">`)
  await expect(pngPage.locator('img')).toHaveScreenshot(name, { maxDiffPixelRatio: .01 })
  await pngPage.close()
}

const addSeries = async (page: Page, names: string[]) => {
  const canvas = page.locator('.chart-canvas-shell')
  for (const name of names) await updateChart(page, canvas, () => setCheckbox(page.getByRole('checkbox', { name, exact: true }), true))
}

const waitForChartSettled = async (page: Page, canvas = page.locator('.chart-canvas-shell'), afterRevision?: number) => {
  await page.evaluate(() => document.fonts.ready)
  try {
    await expect.poll(async () => {
      const status = await canvas.getAttribute('data-render-status')
      const revision = await chartRevision(canvas)
      return status === 'settled' && (afterRevision == null || revision > afterRevision)
    }).toBe(true)
  } catch (cause) {
    if (await canvas.getAttribute('data-render-status') === 'error') throw new Error(await page.locator('.chart-render-error').innerText())
    throw cause
  }
  await expect(canvas).toHaveAttribute('data-render-settled', 'true')
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  await expect(canvas).toHaveAttribute('data-render-animation', 'off')
  await expect(page.locator('.chart-canvas svg')).toBeVisible()
  await expect(canvas).toContainText('Источник:')
  await waitForStableBox(canvas)
}

const updateChart = async (page: Page, canvas: Locator, action: () => Promise<unknown>) => {
  const previous = await chartRevision(canvas)
  await action()
  await waitForChartSettled(page, canvas, previous)
}

const waitForLayout = (page: Page) => waitForChartSettled(page)

const openDemoChart = async (page: Page, demo: string, chart?: string) => {
  await page.goto('/editor')
  await page.getByRole('button', { name: demo, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Проверьте данные' })).toBeVisible()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  if (chart) {
    const canvas = page.locator('.chart-canvas-shell')
    const previous = await chartRevision(canvas)
    await page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: new RegExp(`^${escaped(chart)}$`) }) }).click()
    await waitForChartSettled(page, canvas, previous)
  } else await waitForLayout(page)
}

const openDesign = async (page: Page) => {
  await page.getByRole('button', { name: /Настроить оформление/ }).click()
  await waitForLayout(page)
}

const openSettings = async (page: Page, name: string) => {
  const sectionName = name === 'Оси, шкалы и подписи' ? 'Положение и подписи' : name
  const tabs = page.locator('.settings-category-tabs > .tabs__list-container [role=tab]')
  await tabs.first().waitFor()
  for (const tab of await tabs.all()) {
    const label = (await tab.textContent())!.trim()
    await tab.click()
    await expect(page.locator('.settings-category-title')).toHaveText(label)
    const summary = page.locator('summary').filter({ hasText: new RegExp(`^${escaped(sectionName)}$`) }).first()
    if (!await summary.count()) continue
    if (!await summary.evaluate((element) => (element.parentElement as HTMLDetailsElement).open)) await summary.click()
    return
  }
  throw new Error(`Не найден раздел настроек: ${name}`)
}

test('native heatmap resolves its continuous scale on every side', async ({ page }) => {
  test.setTimeout(120_000)
  await openDemoChart(page, 'Временной ряд', 'Тепловая карта')
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-plot-kind', 'heatmap')
  await openDesign(page)
  await openSettings(page, 'Ряды и пропуски')
  await updateChart(page, canvas, () => page.getByLabel('Сортировка рядов').selectOption('last'))
  await openSettings(page, 'Цветовая шкала')
  const position = page.getByLabel('Положение шкалы')
  for (const side of ['right', 'left', 'top', 'bottom'] as const) {
    await updateChart(page, canvas, () => position.selectOption(side))
    await expect(canvas.locator('svg')).toBeVisible()
    await expectCanvasScreenshot(canvas, `native-heatmap-scale-${side}.png`)
  }
})

test('native comparison and stem charts preserve both orientations and dense change labels', async ({ page }) => {
  test.setTimeout(120_000)
  await openDemoChart(page, 'Временной ряд', 'Леденцовая')
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-plot-kind', 'comparison-stem')
  await openDesign(page)
  await openSettings(page, 'Подписи значений')
  await updateChart(page, canvas, () => setCheckbox(page.getByRole('checkbox', { name: 'Показывать подписи значений' }), true))
  await updateChart(page, canvas, () => setCheckbox(page.getByRole('checkbox', { name: 'Скрывать пересекающиеся подписи' }), true))
  await expectCanvasScreenshot(canvas, 'native-lollipop-vertical-dense.png')

  await page.getByRole('navigation', { name: 'Этапы создания графика' }).getByRole('button', { name: /Тип графика/ }).click()
  await updateChart(page, canvas, () => page.getByRole('button', { name: 'Леденцовая горизонтальная', exact: true }).click())
  await expect(canvas).toHaveAttribute('data-plot-kind', 'comparison-stem')
  await expectCanvasScreenshot(canvas, 'native-lollipop-horizontal-dense.png')

  await openDemoChart(page, 'До → после', 'Гантельная')
  await expect(canvas).toHaveAttribute('data-plot-kind', 'comparison-stem')
  await openDesign(page)
  await openSettings(page, 'Гантельная диаграмма')
  await updateChart(page, canvas, () => setCheckbox(page.getByRole('checkbox', { name: 'Показывать изменение между точками' }), true))
  await updateChart(page, canvas, () => page.getByLabel('Формат изменения').selectOption('percent'))
  await updateChart(page, canvas, () => setCheckbox(page.getByRole('checkbox', { name: 'Цвет по направлению изменения' }), true))
  await expectCanvasScreenshot(canvas, 'native-dumbbell-horizontal-change.png')
  await updateChart(page, canvas, () => page.getByLabel('Ориентация').selectOption('vertical'))
  await expectCanvasScreenshot(canvas, 'native-dumbbell-vertical-change.png')
})

test('native Waterfall semantics stay visually stable', async ({ page }) => {
  await openDemoChart(page, 'До → после', 'Waterfall')
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-plot-kind', 'waterfall')
  await expectCanvasScreenshot(canvas, 'waterfall-default.png')

  await openDesign(page)
  await openSettings(page, 'Компоновка столбцов')
  await updateChart(page, canvas, () => setCheckbox(page.getByRole('checkbox', { name: 'Показывать итоговый столбец' }), false))
  await expectCanvasScreenshot(canvas, 'waterfall-without-total.png')

  await updateChart(page, canvas, () => setCheckbox(page.getByRole('checkbox', { name: 'Показывать итоговый столбец' }), true))
  await openSettings(page, 'Подписи значений')
  await updateChart(page, canvas, () => setCheckbox(page.getByRole('checkbox', { name: 'Показывать подписи значений' }), true))
  await updateChart(page, canvas, () => page.getByLabel('Что показывать').selectOption('both'))
  await updateChart(page, canvas, () => page.getByLabel('Знаки изменений').selectOption('plus-minus'))
  await expectCanvasScreenshot(canvas, 'waterfall-change-and-cumulative.png')
})

test('native Butterfly semantics stay visually stable', async ({ page }) => {
  await openDemoChart(page, 'До → после', 'Butterfly')
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-plot-kind', 'butterfly')
  await expectCanvasScreenshot(canvas, 'butterfly-center.png')

  await openDesign(page)
  await openSettings(page, 'Подписи значений')
  await updateChart(page, canvas, () => setCheckbox(page.getByRole('checkbox', { name: 'Показывать подписи значений' }), true))
  await updateChart(page, canvas, () => page.getByLabel('Положение подписей').selectOption('bottom'))
  await expectCanvasScreenshot(canvas, 'butterfly-bottom-labels.png')
  await updateChart(page, canvas, () => setCheckbox(page.getByRole('checkbox', { name: 'Показывать подписи значений' }), false))

  await openSettings(page, 'Оси, шкалы и подписи')
  await updateChart(page, canvas, () => page.getByLabel('Положение категорий').selectOption('left'))
  await expectCanvasScreenshot(canvas, 'butterfly-categories-left.png')
  await updateChart(page, canvas, () => page.getByLabel('Положение категорий').selectOption('right'))
  await expectCanvasScreenshot(canvas, 'butterfly-categories-right.png')
})

test('native Distribution observation semantics stay visually stable', async ({ page }) => {
  test.setTimeout(120_000)
  await openDemoChart(page, 'Распределения', 'Strip plot')
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-plot-kind', 'distribution')
  await expectCanvasScreenshot(canvas, 'distribution-strip-default.png')

  await updateChart(page, canvas, () => page.getByLabel('Разбить цветом по категории').selectOption('region'))
  await expectCanvasScreenshot(canvas, 'distribution-strip-grouped.png')

  const choose = async (name: string) => {
    await updateChart(page, canvas, () => page.getByRole('button', { name, exact: true }).click())
    await expect(canvas).toHaveAttribute('data-plot-kind', 'distribution')
  }
  await choose('Jitter plot')
  await expectCanvasScreenshot(canvas, 'distribution-jitter-grouped.png')
  await choose('Beeswarm plot')
  await expectCanvasScreenshot(canvas, 'distribution-beeswarm-grouped.png')
  await choose('Counts plot')
  await expectCanvasScreenshot(canvas, 'distribution-counts-grouped.png')
  await choose('Barcode plot')
  await expectCanvasScreenshot(canvas, 'distribution-barcode-grouped.png')

  await openDesign(page)
  await openSettings(page, 'Форма распределения')
  await updateChart(page, canvas, () => page.getByLabel('Ориентация').selectOption('vertical'))
  await expectCanvasScreenshot(canvas, 'distribution-barcode-vertical.png')
})

test('native Distribution statistical shapes stay visually stable', async ({ page }) => {
  test.setTimeout(180_000)
  await openDemoChart(page, 'Распределения', 'Box plot')
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-plot-kind', 'distribution')
  await expectCanvasScreenshot(canvas, 'distribution-boxplot-default.png')
  await updateChart(page, canvas, () => page.getByLabel('Разбить цветом по категории').selectOption('region'))
  await expectCanvasScreenshot(canvas, 'distribution-boxplot-grouped.png')
  await openDesign(page)
  await openSettings(page, 'Форма распределения')
  const settings = page.locator('.distribution-settings')
  await updateChart(page, canvas, () => setCheckbox(settings.getByRole('checkbox', { name: 'Показывать все наблюдения' }), true))
  await expectCanvasScreenshot(canvas, 'distribution-boxplot-all-points.png')

  const choose = async (name: string) => {
    await page.getByRole('navigation', { name: 'Этапы создания графика' }).getByRole('button', { name: /Тип графика/ }).click()
    await updateChart(page, canvas, () => page.getByRole('button', { name, exact: true }).click())
    await openDesign(page)
    await openSettings(page, 'Форма распределения')
  }
  await choose('Violin plot')
  await expectCanvasScreenshot(canvas, 'distribution-violin-full.png')
  await updateChart(page, canvas, () => page.getByLabel('Форма скрипки').selectOption('half'))
  await updateChart(page, canvas, () => page.getByLabel('Сторона половины').selectOption('first'))
  await expectCanvasScreenshot(canvas, 'distribution-violin-half.png')
  await updateChart(page, canvas, () => page.getByLabel('Форма скрипки').selectOption('split'))
  await expectCanvasScreenshot(canvas, 'distribution-violin-split.png')
  await updateChart(page, canvas, () => page.getByLabel('Медиана и IQR').selectOption('lines'))
  await expectCanvasScreenshot(canvas, 'distribution-violin-lines-summary.png')

  await choose('Raincloud plot')
  await expectCanvasScreenshot(canvas, 'distribution-raincloud-overlay.png')
  await updateChart(page, canvas, () => page.getByLabel('Расположение точек').selectOption('separate'))
  await expectCanvasScreenshot(canvas, 'distribution-raincloud-separate.png')

  await choose('Ridgeline plot')
  await expectCanvasScreenshot(canvas, 'distribution-ridgeline-default.png')
  await updateChart(page, canvas, () => page.getByLabel('Перекрытие рядов, %').fill('80'))
  await expectCanvasScreenshot(canvas, 'distribution-ridgeline-overlap.png')
  await updateChart(page, canvas, () => page.getByLabel('Ориентация').selectOption('vertical'))
  await expectCanvasScreenshot(canvas, 'distribution-shapes-vertical.png')
})

test('native Distribution frequency semantics stay visually stable', async ({ page }) => {
  test.setTimeout(150_000)
  await openDemoChart(page, 'Распределения', 'Histogram', true)
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-plot-kind', 'distribution')
  await expectCanvasScreenshot(canvas, 'distribution-histogram-default.png')
  await updateChart(page, canvas, () => page.getByLabel('Разбить цветом по категории').selectOption('region'))
  await expectCanvasScreenshot(canvas, 'distribution-histogram-grouped.png')
  await openDesign(page)
  await openSettings(page, 'Форма распределения')
  await updateChart(page, canvas, () => page.getByLabel('Количество интервалов').fill('7'))
  await expectCanvasScreenshot(canvas, 'distribution-histogram-seven-bins.png')

  await page.getByRole('navigation', { name: 'Этапы создания графика' }).getByRole('button', { name: /Тип графика/ }).click()
  await updateChart(page, canvas, () => page.getByRole('button', { name: 'KDE plot', exact: true }).click())
  await expectCanvasScreenshot(canvas, 'distribution-kde-grouped.png')
  await updateChart(page, canvas, () => page.getByLabel('Разбить цветом по категории').selectOption(''))
  await expectCanvasScreenshot(canvas, 'distribution-kde-default.png')
  await openDesign(page)
  await openSettings(page, 'Форма распределения')
  await updateChart(page, canvas, () => page.getByLabel('Сглаживание плотности').fill('0.4'))
  await updateChart(page, canvas, () => page.getByLabel('Ориентация').selectOption('vertical'))
  await expectCanvasScreenshot(canvas, 'distribution-kde-wide-bandwidth-vertical.png')
})

test('native Scatter and Bubble semantics stay visually stable', async ({ page }) => {
  test.setTimeout(120_000)
  await openDemoChart(page, 'Временной ряд', 'Точечный')
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-plot-kind', 'xy')
  await expectCanvasScreenshot(canvas, 'scatter-default.png')

  await updateChart(page, canvas, () => setCheckbox(page.getByRole('checkbox', { name: 'orders', exact: true }), true))
  await expectCanvasScreenshot(canvas, 'scatter-multiple-series.png')
  await openDesign(page)
  await openSettings(page, 'Точки и зависимости')
  const scatter = page.locator('.scatter-settings')
  await updateChart(page, canvas, () => setSettingsCheckbox(scatter, 'Показывать', true))
  await expectCanvasScreenshot(canvas, 'scatter-labels-date-x.png')
  await updateChart(page, canvas, () => setSettingsCheckbox(scatter, 'Показать линию тренда', true))
  await updateChart(page, canvas, () => setSettingsCheckbox(scatter, 'Доверительная полоса 95%', true))
  await expectCanvasScreenshot(canvas, 'scatter-trend-band.png')

  await page.getByRole('navigation', { name: 'Этапы создания графика' }).getByRole('button', { name: /Тип графика/ }).click()
  await updateChart(page, canvas, () => page.getByRole('button', { name: 'Пузырьковая диаграмма' }).click())
  await openDesign(page)
  await openSettings(page, 'Точки и зависимости')
  const bubble = page.locator('.scatter-settings')
  await updateChart(page, canvas, () => setSettingsCheckbox(bubble, 'Показывать', false))
  await updateChart(page, canvas, () => setSettingsCheckbox(bubble, 'Показать линию тренда', false))
  await expectCanvasScreenshot(canvas, 'bubble-default-size-guide.png')
  await openSettings(page, 'Оси, шкалы и подписи')
  await updateChart(page, canvas, () => page.getByLabel('Положение оси Y').selectOption('right'))
  await updateChart(page, canvas, () => page.getByLabel('Положение оси X').selectOption('top'))
  await expectCanvasScreenshot(canvas, 'bubble-axis-top-right.png')
})

test('native smoothing semantics stay visually stable', async ({ page }) => {
  test.setTimeout(90_000)
  await openDemoChart(page, 'Временной ряд', 'Линия + среднее')
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-plot-kind', 'smoothing')
  await expectCanvasScreenshot(canvas, 'moving-average-line-default.png')

  await updateChart(page, canvas, () => page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: /^Точки \+ среднее$/ }) }).click())
  await expectCanvasScreenshot(canvas, 'moving-average-scatter-default.png')

  await updateChart(page, canvas, () => setCheckbox(page.getByRole('checkbox', { name: 'orders', exact: true }), true))
  await updateChart(page, canvas, () => page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: /^Линия \+ среднее$/ }) }).click())
  await expectCanvasScreenshot(canvas, 'moving-average-multiple-series.png')

  await openDesign(page)
  await openSettings(page, 'Легенда')
  await updateChart(page, canvas, () => page.getByText('Обычная', { exact: true }).click())
  await expectCanvasScreenshot(canvas, 'moving-average-long-legend.png')

  await updateChart(page, canvas, () => page.getByText('Справа у рядов', { exact: true }).click())
  await expectCanvasScreenshot(canvas, 'moving-average-direct-labels.png')

  await openSettings(page, 'Скользящее среднее')
  await updateChart(page, canvas, () => page.getByLabel('Период сглаживания').fill('365'))
  await expectCanvasScreenshot(canvas, 'moving-average-missing-window.png')
  await updateChart(page, canvas, () => page.getByLabel('Период сглаживания').fill('4'))

  await openSettings(page, 'Ряды данных')
  await page.locator('.series-settings .series-name-button').first().click()
  const editor = page.locator('.series-editor')
  await updateChart(page, canvas, () => editor.getByLabel('Толщина линии, px').fill('6'))
  await updateChart(page, canvas, () => editor.getByLabel('Тип линии').selectOption('dashed'))
  await updateChart(page, canvas, () => page.getByRole('button', { name: 'Снять выделение' }).click())
  await expectCanvasScreenshot(canvas, 'moving-average-custom-styles.png')

  await openSettings(page, 'Оси, шкалы и подписи')
  await updateChart(page, canvas, () => page.getByLabel('Положение оси X').selectOption('top'))
  await updateChart(page, canvas, () => page.getByLabel('Положение оси Y').selectOption('right'))
  await expectCanvasScreenshot(canvas, 'moving-average-axis-top-right.png')
})

test('native interval semantics stay visually stable', async ({ page }) => {
  test.setTimeout(120_000)
  await openDemoChart(page, 'Временной ряд', 'Диапазон между линиями')
  const canvas = page.locator('.chart-canvas-shell')
  await expect(canvas).toHaveAttribute('data-chart-kind', 'range-line')
  await expect(canvas).toHaveAttribute('data-plot-kind', 'interval')
  await expectCanvasScreenshot(canvas, 'range-line-default.png')

  await openDesign(page)
  await openSettings(page, 'Диапазон между линиями')
  const range = page.locator('.line-variant-settings')
  await updateChart(page, canvas, () => range.getByLabel('Нижняя граница').selectOption('plan'))
  await updateChart(page, canvas, () => range.getByLabel('Верхняя граница').selectOption('revenue'))
  await expectCanvasScreenshot(canvas, 'range-line-crossing-by-bound.png')
  await updateChart(page, canvas, () => range.locator('label').filter({ hasText: /^Цвет заливки/ }).locator('select').selectOption('custom'))
  await expectCanvasScreenshot(canvas, 'range-line-custom-fill.png')

  await page.getByRole('navigation', { name: 'Этапы создания графика' }).getByRole('button', { name: /Тип графика/ }).click()
  await updateChart(page, canvas, () => page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: /^Ступенчатый диапазон$/ }) }).click())
  await expect(canvas).toHaveAttribute('data-chart-kind', 'step-range-line')
  await openDesign(page)
  await openSettings(page, 'Диапазон между линиями')
  const step = page.locator('.line-variant-settings')
  await updateChart(page, canvas, () => step.locator('label').filter({ hasText: /^Цвет заливки/ }).locator('select').selectOption('by-bound'))
  await updateChart(page, canvas, () => step.getByLabel('Переход между значениями').selectOption('start'))
  await expectCanvasScreenshot(canvas, 'step-range-start.png')
  await updateChart(page, canvas, () => step.getByLabel('Переход между значениями').selectOption('end'))
  await expectCanvasScreenshot(canvas, 'step-range-end.png')

  await page.getByRole('navigation', { name: 'Этапы создания графика' }).getByRole('button', { name: /Тип графика/ }).click()
  await updateChart(page, canvas, () => page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: /^Линия с интервалом$/ }) }).click())
  await expect(canvas).toHaveAttribute('data-chart-kind', 'confidence-line')
  await openDesign(page)
  await openSettings(page, 'Линия с интервалом')
  const confidence = page.locator('.line-variant-settings')
  const selectConfidenceField = async (label: 'Средняя линия' | 'Нижняя граница' | 'Верхняя граница', value: string) => {
    await openSettings(page, 'Линия с интервалом')
    await confidence.locator('.interval-group').first().getByLabel(label).selectOption(value)
  }
  let previous = await chartRevision(canvas)
  await selectConfidenceField('Верхняя граница', 'plan')
  await selectConfidenceField('Нижняя граница', 'profit')
  await selectConfidenceField('Средняя линия', 'orders')
  await selectConfidenceField('Верхняя граница', 'revenue')
  await waitForChartSettled(page, canvas, previous)
  await expectCanvasScreenshot(canvas, 'confidence-line-default.png')
  await openSettings(page, 'Линия с интервалом')
  await updateChart(page, canvas, () => setCheckbox(confidence.locator('.interval-group').first().getByRole('checkbox', { name: 'Подписывать границы справа' }), true))
  await expectCanvasScreenshot(canvas, 'confidence-line-show-bounds.png')
  previous = await chartRevision(canvas)
  await selectConfidenceField('Средняя линия', 'revenue')
  await selectConfidenceField('Нижняя граница', 'orders')
  await selectConfidenceField('Верхняя граница', 'plan')
  await waitForChartSettled(page, canvas, previous)
  await expectCanvasScreenshot(canvas, 'confidence-line-invalid-gap.png')
  await openSettings(page, 'Линия с интервалом')
  await updateChart(page, canvas, () => confidence.getByRole('button', { name: 'Добавить группу' }).click())
  await openSettings(page, 'Линия с интервалом')
  previous = await chartRevision(canvas)
  await confidence.locator('.interval-group').nth(1).getByLabel('Верхняя граница').selectOption('revenue')
  await openSettings(page, 'Линия с интервалом')
  await confidence.locator('.interval-group').nth(1).getByLabel('Нижняя граница').selectOption('profit')
  await openSettings(page, 'Линия с интервалом')
  await confidence.locator('.interval-group').nth(1).getByLabel('Средняя линия').selectOption('orders')
  await waitForChartSettled(page, canvas, previous)
  await expectCanvasScreenshot(canvas, 'confidence-line-multiple-groups.png')
  await openSettings(page, 'Линия с интервалом')
  await updateChart(page, canvas, () => confidence.locator('label').filter({ hasText: /^Цвет заливки/ }).locator('select').selectOption('custom'))
  await expectCanvasScreenshot(canvas, 'confidence-line-custom-fill.png')

  await openSettings(page, 'Оси, шкалы и подписи')
  await updateChart(page, canvas, () => page.getByLabel('Положение оси X').selectOption('top'))
  await updateChart(page, canvas, () => page.getByLabel('Положение оси Y').selectOption('right'))
  await expectCanvasScreenshot(canvas, 'interval-axis-top-right.png')
  await openSettings(page, 'Легенда')
  await updateChart(page, canvas, () => page.getByText('Слева у рядов', { exact: true }).click())
  await expectCanvasScreenshot(canvas, 'interval-direct-labels.png')
})

test('Seasonal legend semantics stay visually stable', async ({ page }) => {
  await page.goto('/editor')
  await page.getByRole('button', { name: 'Временной ряд', exact: true }).click()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByLabel('Период / ось X').selectOption('month')
  await page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: /^Сравнение по годам$/ }) }).click()
  await waitForLayout(page)
  await openDesign(page)
  await openSettings(page, 'Легенда')

  const canvas = page.locator('.chart-canvas-shell')
  await page.getByText('Без легенды', { exact: true }).click()
  await expectCanvasScreenshot(canvas, 'seasonal-none-accent.png')

  await page.getByText('Обычная', { exact: true }).click()
  await expect(page.locator('.chart-canvas svg text').filter({ hasText: /^Остальные$/ })).toBeVisible()
  await expectCanvasScreenshot(canvas, 'seasonal-standard-one-accent.png')

  await openSettings(page, 'Сравнение по годам')
  await setCheckbox(page.locator('.line-variant-settings').getByRole('checkbox', { name: '2023', exact: true }), true)
  await expectCanvasScreenshot(canvas, 'seasonal-standard-two-accents.png')

  await openSettings(page, 'Легенда')
  const standardCards = page.locator('.legend-settings .legend-options:not(.direct-legend-options) .series-label-card')
  await standardCards.last().getByLabel('Подпись').fill('Предыдущие периоды')
  await expect(page.locator('.chart-canvas svg text').filter({ hasText: /^Предыдущие периоды$/ })).toBeVisible()
  await expectCanvasScreenshot(canvas, 'seasonal-standard-renamed-others.png')

  await setCheckbox(standardCards.last().getByRole('checkbox'), false)
  await expect(page.locator('.chart-canvas svg text').filter({ hasText: /^Предыдущие периоды$/ })).toHaveCount(0)
  await expectCanvasScreenshot(canvas, 'seasonal-standard-hidden-others.png')

  await openSettings(page, 'Сравнение по годам')
  await setCheckbox(page.locator('.line-variant-settings').getByRole('checkbox', { name: '2023', exact: true }), false)
  await openSettings(page, 'Легенда')
  await page.getByText('Справа у рядов', { exact: true }).click()
  await expectCanvasScreenshot(canvas, 'seasonal-direct-accent.png')

  const directCards = page.locator('.direct-legend-options .series-label-card')
  await setCheckbox(directCards.filter({ has: page.getByRole('checkbox', { name: '2023', exact: true }) }).getByRole('checkbox'), true)
  await expectCanvasScreenshot(canvas, 'seasonal-direct-custom-series.png')
})

test('native Slope semantics stay visually stable', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/editor')
  await page.getByRole('button', { name: 'Временной ряд', exact: true }).click()
  await page.getByRole('button', { name: /Выбрать график/ }).click()
  await page.getByLabel('Период / ось X').selectOption('month')
  await page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: /^Наклонный график$/ }) }).click()
  await waitForLayout(page)
  const canvas = page.locator('.chart-canvas-shell')
  await expectCanvasScreenshot(canvas, 'slope-default.png')
  await expectCanvasScreenshot(canvas, 'slope-endpoint-label-ownership.png')

  await openDesign(page)
  await openSettings(page, 'Наклонный график')
  const values = page.getByRole('checkbox', { name: 'Подписывать значения' })
  const names = page.getByRole('checkbox', { name: 'Подписывать названия рядов справа' })
  const scale = page.getByRole('checkbox', { name: 'Показывать подписи шкалы Y' })
  await setCheckbox(names, false)
  await expectCanvasScreenshot(canvas, 'slope-values-only.png')
  await setCheckbox(values, false)
  await setCheckbox(names, true)
  await expectCanvasScreenshot(canvas, 'slope-names-only.png')
  await setCheckbox(values, true)
  await setCheckbox(scale, true)
  await expectCanvasScreenshot(canvas, 'slope-y-scale.png')

  await page.getByRole('navigation', { name: 'Этапы создания графика' }).getByRole('button', { name: /Тип графика/ }).click()
  for (const measure of ['orders', 'profit', 'plan']) await setCheckbox(page.getByRole('checkbox', { name: measure, exact: true }), true)
  await page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: /^Наклонный график$/ }) }).click()
  await waitForLayout(page)
  await openDesign(page)
  await expectCanvasScreenshot(canvas, 'slope-many-series-collision.png')
  await expectCanvasScreenshot(canvas, 'slope-collision-leaders.png')

  await openSettings(page, 'Оси, шкалы и подписи')
  await page.getByLabel('Положение оси X').selectOption('top')
  await expectCanvasScreenshot(canvas, 'slope-date-axis-top.png')
  await expectCanvasScreenshot(canvas, 'slope-x-label-centered.png')

  await page.getByRole('navigation', { name: 'Этапы создания графика' }).getByRole('button', { name: /Тип графика/ }).click()
  const positions = page.getByRole('group', { name: 'Позиции по оси X' }).getByRole('button')
  for (const index of [0, 35]) if (await positions.nth(index).getAttribute('aria-pressed') === 'true') await positions.nth(index).click()
  await positions.nth(3).click()
  await positions.nth(9).click()
  await page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: /^Наклонный график$/ }) }).click()
  await waitForLayout(page)
  await openDesign(page)
  await openSettings(page, 'Наклонный график')
  const slopeSettings = page.locator('.line-variant-settings')
  await setCheckbox(slopeSettings.getByRole('checkbox', { name: 'Показывать изменение' }), true)
  await setCheckbox(slopeSettings.getByRole('checkbox', { name: 'Цвет по направлению изменения' }), true)
  await expectCanvasScreenshot(canvas, 'slope-change-increase-decrease.png')
  await expectCanvasScreenshot(canvas, 'slope-change-neutral.png')
  await slopeSettings.locator('label').filter({ hasText: /^Формат/ }).locator('select').selectOption('percent')
  await slopeSettings.getByLabel('Знаков после запятой').fill('1')
  await expectCanvasScreenshot(canvas, 'slope-change-percent.png')
  await slopeSettings.locator('label').filter({ hasText: /^Расположение/ }).locator('select').selectOption('end')
  await expectCanvasScreenshot(canvas, 'slope-change-label-positions.png')
  await expectCanvasScreenshot(canvas, 'slope-crossing-lines.png')

  await slopeSettings.getByRole('button', { name: 'Сбросить изменение' }).click()
  await page.getByRole('navigation', { name: 'Этапы создания графика' }).getByRole('button', { name: /Тип графика/ }).click()
  const restoredPositions = page.getByRole('group', { name: 'Позиции по оси X' }).getByRole('button')
  for (const index of [3, 9]) if (await restoredPositions.nth(index).getAttribute('aria-pressed') === 'true') await restoredPositions.nth(index).click()
  await restoredPositions.nth(0).click()
  await restoredPositions.nth(35).click()
  await page.locator('.chart-choice-grid button').filter({ has: page.locator('b').filter({ hasText: /^Наклонный график$/ }) }).click()
  await waitForLayout(page)
  await openDesign(page)

  await openSettings(page, 'Ряды данных')
  await page.locator('.series-settings .series-name-button').filter({ hasText: /^revenue$/ }).click()
  const seriesEditor = page.locator('.series-editor')
  await expect(seriesEditor).toBeVisible()
  await seriesEditor.getByLabel('Толщина линии, px').fill('6')
  await seriesEditor.getByLabel('Тип линии').selectOption('dashed')
  await seriesEditor.getByLabel('Форма').selectOption('diamond')
  await seriesEditor.getByLabel('Размер, px').fill('16')
  await page.getByRole('button', { name: 'Снять выделение' }).click()
  await expectCanvasScreenshot(canvas, 'slope-custom-series-styles.png')
})

test('critical chart-label layouts stay visually stable', async ({ page }) => {
  await openDemoChart(page, 'Топ стран', 'Столбцы')
  await setCheckbox(page.getByRole('checkbox', { name: 'place', exact: true }), true)
  await openDesign(page)
  await openSettings(page, 'Компоновка столбцов')
  await page.getByLabel('Ширина группы, %').fill('100')
  await page.getByLabel('Расстояние между рядами, %').fill('0')
  await openSettings(page, 'Легенда')
  await page.getByText('Справа у рядов', { exact: true }).click()
  await openSettings(page, 'Подписи значений')
  await setCheckbox(page.getByRole('checkbox', { name: 'Показывать подписи значений' }), true)

  await page.getByLabel('Положение подписей').selectOption('inside-bottom')
  await expectCanvasScreenshot(page.locator('.chart-canvas-shell'), 'grouped-bar-direct-inside.png')

  await page.getByLabel('Положение подписей').selectOption('top')
  await expectCanvasScreenshot(page.locator('.chart-canvas-shell'), 'grouped-bar-direct-outside.png')

  await setCheckbox(page.getByRole('checkbox', { name: 'Автоматически помещать подпись внутрь' }), true)
  await expectCanvasScreenshot(page.locator('.chart-canvas-shell'), 'grouped-bar-absorbed.png')
})

test('normalized and horizontal bars keep their label geometry', async ({ page }) => {
  await openDemoChart(page, 'Временной ряд', 'Нормированные столбцы')
  await setCheckbox(page.getByRole('checkbox', { name: 'orders', exact: true }), true)
  await openDesign(page)
  await openSettings(page, 'Легенда')
  await page.getByText('Справа у рядов', { exact: true }).click()
  await openSettings(page, 'Подписи значений')
  await setCheckbox(page.getByRole('checkbox', { name: 'Показывать подписи значений' }), true)
  await setCheckbox(page.getByRole('checkbox', { name: 'Автоматически помещать подпись внутрь' }), true)
  await setCheckbox(page.getByRole('checkbox', { name: 'Скрывать пересекающиеся подписи' }), true)
  const valueLabels = await page.locator('.chart-canvas svg text').evaluateAll((nodes) => nodes.flatMap((node) => {
    const text = node.textContent?.trim() ?? ''
    if (!/^-?\d+,\d+%$/.test(text)) return []
    const box = node.getBoundingClientRect()
    return [{ text, left: box.left, right: box.right, top: box.top, bottom: box.bottom }]
  }))
  const overlaps = valueLabels.flatMap((label, index) => valueLabels.slice(index + 1).flatMap((other) =>
    Math.min(label.right, other.right) - Math.max(label.left, other.left) > 1
      && Math.min(label.bottom, other.bottom) - Math.max(label.top, other.top) > 1
      ? [[label, other]] : []))
  expect(overlaps, JSON.stringify(valueLabels)).toEqual([])
  await expectCanvasScreenshot(page.locator('.chart-canvas-shell'), 'normalized-bar-absorbed-direct.png')

  await page.getByRole('navigation', { name: 'Этапы создания графика' }).getByRole('button', { name: /Тип графика/ }).click()
  await page.getByRole('button', { name: 'Линейчатая', exact: true }).click()
  await openDesign(page)
  await openSettings(page, 'Легенда')
  await page.getByText('Над рядами', { exact: true }).click()
  await openSettings(page, 'Подписи значений')
  await setCheckbox(page.getByRole('checkbox', { name: 'Показывать подписи значений' }), true)
  await setCheckbox(page.getByRole('checkbox', { name: 'Автоматически помещать подпись внутрь' }), false)
  await page.getByLabel('Положение подписей').selectOption('inside-top')
  await expectCanvasScreenshot(page.locator('.chart-canvas-shell'), 'horizontal-bar-direct-inside.png')

  await page.getByRole('navigation', { name: 'Этапы создания графика' }).getByRole('button', { name: /Тип графика/ }).click()
  await page.getByRole('button', { name: 'Леденцовая', exact: true }).click()
  await openDesign(page)
  await openSettings(page, 'Подписи значений')
  await setCheckbox(page.getByRole('checkbox', { name: 'Показывать подписи значений' }), true)
  const lollipopValueSizes = await page.locator('.chart-canvas svg text').evaluateAll((nodes) => [...new Set(nodes.flatMap((node) =>
    ['202', '218', '83', '95'].includes(node.textContent?.trim() ?? '') ? [Number.parseFloat(getComputedStyle(node).fontSize)] : []))])
  expect(lollipopValueSizes).toEqual([17])
  await expectCanvasScreenshot(page.locator('.chart-canvas-shell'), 'dense-lollipop-adaptive-labels.png')
})

test('treemap preview and exports keep complete labels and matching dimensions', async ({ page, context }) => {
  await openDemoChart(page, 'Трудности бизнеса')
  await openDesign(page)

  const previewText = (await page.locator('.chart-canvas svg text').allTextContents()).join(' ').replaceAll('\u200b', '')
  expect(previewText).toContain('Затрудняюсь ответить')
  expect(previewText).toContain('Нестабильность')
  expect(previewText).not.toContain('…')
  const footerBoxes = await page.locator('.chart-canvas svg text').evaluateAll((nodes) => nodes.flatMap((node) => {
    const text = node.textContent?.replaceAll('\u200b', '') ?? ''
    if (!text.startsWith('Молодые предприниматели') && !text.startsWith('Источник:')) return []
    const box = node.getBoundingClientRect()
    return [{ text, x: box.x, y: box.y, width: box.width, height: box.height }]
  }))
  const noteBox = footerBoxes.find(({ text }) => text.startsWith('Молодые предприниматели'))
  const sourceBox = footerBoxes.find(({ text }) => text.startsWith('Источник:'))
  expect(noteBox).toBeDefined()
  expect(sourceBox).toBeDefined()
  expect(sourceBox!.y).toBeGreaterThanOrEqual(noteBox!.y + noteBox!.height + 4)
  await expectCanvasScreenshot(page.locator('.chart-canvas-shell'), 'treemap-long-russian-labels.png')

  await page.locator('.export-menu > summary').click()
  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать SVG' }).click()
  const svg = await readFile(await (await svgDownload).path()!, 'utf8')
  expect(svg).toContain('Затрудняюсь')
  expect(svg).toContain('ответить')
  expect(svg).not.toContain('…')
  expect(svg).toMatch(/width="1000"/)
  expect(svg).toMatch(/height="750"/)

  const svgPage = await context.newPage()
  await svgPage.setContent(`<style>html,body{margin:0;background:white}</style>${svg}`)
  await expect(svgPage.locator('svg')).toHaveScreenshot('treemap-export-svg.png')
  await svgPage.close()

  const pngDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать PNG' }).click()
  const png = await readFile(await (await pngDownload).path()!)
  expect(png.readUInt32BE(16)).toBe(2000)
  expect(png.readUInt32BE(20)).toBe(1500)
  const pngPage = await context.newPage()
  await pngPage.setContent(`<style>html,body{margin:0;background:white}img{display:block;width:1000px;height:750px}</style><img src="data:image/png;base64,${png.toString('base64')}">`)
  await expect(pngPage.locator('img')).toHaveScreenshot('treemap-export-png.png')
  await pngPage.close()
})

test.describe('preview, SVG and PNG stay visually identical', () => {
  test('bars: many categories, long labels and a narrow canvas', async ({ page, context }) => {
    await openDemoChart(page, 'Топ стран', 'Столбцы')
    await openDesign(page)
    const canvas = page.locator('.chart-canvas-shell')
    await openSettings(page, 'Холст')
    await updateChart(page, canvas, () => page.getByRole('button', { name: 'Свой размер' }).click())
    await updateChart(page, canvas, async () => { await page.getByLabel('Ширина, px').fill('420'); await page.getByLabel('Ширина, px').blur() })
    await updateChart(page, canvas, async () => { await page.getByLabel('Высота, px').fill('560'); await page.getByLabel('Высота, px').blur() })
    await expectExportParity(page, context, 'export-parity-bars-narrow.png')
  })

  test('areas: multiple series', async ({ page, context }) => {
    await openDemoChart(page, 'Временной ряд', 'Нормированные области')
    await addSeries(page, ['orders', 'profit', 'plan'])
    await openDesign(page)
    await expectExportParity(page, context, 'export-parity-areas-many-series.png')
  })

  test('interval', async ({ page, context }) => {
    await openDemoChart(page, 'Временной ряд', 'Диапазон между линиями')
    await openDesign(page)
    await expectExportParity(page, context, 'export-parity-interval.png')
  })

  test('scatter: multiple series', async ({ page, context }) => {
    await openDemoChart(page, 'Временной ряд', 'Точечный')
    await addSeries(page, ['orders', 'profit'])
    await openDesign(page)
    await expectExportParity(page, context, 'export-parity-scatter-many-series.png')
  })

  test('distribution', async ({ page, context }) => {
    await openDemoChart(page, 'Распределения', 'Raincloud plot')
    await openDesign(page)
    await expectExportParity(page, context, 'export-parity-distribution.png')
  })

  test('heatmap: multiple rows', async ({ page, context }) => {
    await openDemoChart(page, 'Временной ряд', 'Тепловая карта')
    await addSeries(page, ['orders', 'profit', 'plan'])
    await openDesign(page)
    await expectExportParity(page, context, 'export-parity-heatmap.png')
  })

  test('treemap: long Russian labels', async ({ page, context }) => {
    await openDemoChart(page, 'Трудности бизнеса')
    await openDesign(page)
    await expectExportParity(page, context, 'export-parity-treemap-long-labels.png')
  })

  test('butterfly', async ({ page, context }) => {
    await openDemoChart(page, 'До → после', 'Butterfly')
    await openDesign(page)
    await expectExportParity(page, context, 'export-parity-butterfly.png')
  })

  test('waterfall: positive and negative changes', async ({ page, context }) => {
    await openDemoChart(page, 'До → после', 'Waterfall')
    await openDesign(page)
    await expectExportParity(page, context, 'export-parity-waterfall-negative.png')
  })

  test('line: missing, negative, very large and very small values', async ({ page, context }) => {
    const csv = [
      'category,large,change,tiny',
      'Очень длинная категория номер один,1000000000,-900000000,0.0001',
      'Очень длинная категория номер два,800000000,-400000000,0.0002',
      'Очень длинная категория номер три,,0,0.0003',
      'Очень длинная категория номер четыре,300000000,250000000,',
      'Очень длинная категория номер пять,-100000000,600000000,0.0005',
      'Очень длинная категория номер шесть,500000000,-200000000,0.0004',
    ].join('\n')
    await page.goto('/editor')
    await page.locator('input[type="file"][accept*=".csv"]').setInputFiles({ name: 'edge-values.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
    await expect(page.getByRole('heading', { name: 'Проверьте данные' })).toBeVisible()
    await page.getByRole('button', { name: /Выбрать график/ }).click()
    await page.getByRole('button', { name: /^Линия$/ }).click()
    await waitForChartSettled(page)
    await addSeries(page, ['change', 'tiny'])
    await openDesign(page)
    const canvas = page.locator('.chart-canvas-shell')
    await openSettings(page, 'Холст')
    await updateChart(page, canvas, () => page.getByRole('button', { name: 'Свой размер' }).click())
    await updateChart(page, canvas, async () => { await page.getByLabel('Ширина, px').fill('480'); await page.getByLabel('Ширина, px').blur() })
    await expectExportParity(page, context, 'export-parity-line-edge-values.png')
  })
})
