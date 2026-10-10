import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createDefaultChartConfig } from '../src/entities/chart/model/defaultChartConfig'
import { parseProject, serializeProject, type EditorProject } from '../src/features/projects/project'

function fixture(): EditorProject {
  return {
    format: 'viiiz-project', version: 1, updatedAt: '2026-10-09T12:00:00Z', step: 'design', multiplesMode: false,
    table: { name: 'Мой проект', columns: ['date', 'value'], rows: [10, 30, 20].map((value, index) => ({ date: new Date(`2025-0${index + 1}-01T00:00:00Z`), value })), rawRows: [{ date: '2025-01-01', value: '10' }] },
    types: { date: 'date', value: 'number' },
    config: {
      ...createDefaultChartConfig(), kind: 'line', xField: 'date', yField: 'value', yFields: ['value'], title: 'Сохранённый график', subtitle: '', source: '', note: '', xAxisLabelRotate: 45,
      annotations: [{ id: 'note', x: 320, y: 250, width: 240, fontFamily: 'Onest', fontSize: 20, backgroundColor: 'transparent', borderColor: 'transparent', textAlign: 'left', fragments: [{ id: 'text', text: 'Важная точка', color: '#000', bold: false, italic: false }] }],
    },
  }
}

async function openProject(page: Page, project: EditorProject) {
  await page.getByLabel('Открыть файл проекта', { exact: true }).setInputFiles({ name: 'saved.viiiz', mimeType: 'application/json', buffer: Buffer.from(serializeProject(project)) })
  await expect(page.locator('.chart-canvas-shell').first()).toHaveAttribute('data-render-status', 'settled')
}
async function downloadProject(page: Page) {
  if (!await page.locator('.project-menu').evaluate((menu) => (menu as HTMLDetailsElement).open)) await page.locator('.project-menu > summary').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать проект', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/\.viiiz$/)
  return parseProject(await readFile((await file.path())!, 'utf8'))
}

test('project files preserve data, dates and annotations and autosave restores after reload', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/editor')
  await expect(page.getByRole('heading', { name: 'Добавьте данные' })).toBeVisible()
  const project = fixture()
  await openProject(page, project)
  await expect(page.locator('.canvas-paper')).toContainText('Сохранённый график')
  await expect(page.locator('.canvas-paper')).toContainText('Важная точка')
  await expect(page.locator('.project-name small')).toContainText('Сохранено в браузере')
  const exported = await downloadProject(page)
  expect(exported.table).toEqual(project.table)
  expect(exported.config.annotations).toEqual(project.config.annotations)
  expect(exported.config.xAxisLabelRotate).toBe(45)
  await page.reload()
  await expect(page.locator('.chart-canvas-shell').first()).toHaveAttribute('data-render-status', 'settled')
  await expect(page.locator('.canvas-paper')).toContainText('Сохранённый график')
  await expect(page.locator('.canvas-paper')).toContainText('Важная точка')
  expect((await downloadProject(page)).table.rows[0].date).toBeInstanceOf(Date)
  expect(errors).toEqual([])
  await page.screenshot({ path: 'output/project-restored.png', fullPage: true })
})

test('latest edits survive an immediate reload and invalid files leave the project intact', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.getByRole('heading', { name: 'Добавьте данные' })).toBeVisible()
  await openProject(page, fixture())
  await expect(page.locator('.project-name small')).toContainText('Сохранено в браузере')
  await page.getByRole('tab', { name: 'Текст', exact: true }).click()
  const headings = page.locator('summary').filter({ hasText: /^Заголовок и подзаголовок$/ })
  if (!await headings.evaluate((summary) => (summary.parentElement as HTMLDetailsElement).open)) await headings.click()
  await page.getByRole('textbox', { name: 'Заголовок', exact: true }).fill('Правка перед перезагрузкой')
  await page.reload()
  await expect(page.locator('.canvas-paper')).toContainText('Правка перед перезагрузкой')
  await page.getByLabel('Открыть файл проекта', { exact: true }).setInputFiles({ name: 'broken.viiiz', mimeType: 'application/json', buffer: Buffer.from('{"format":"viiiz-project","version":99}') })
  await expect(page.getByRole('alert')).toContainText('неверный формат')
  await expect(page.locator('.canvas-paper')).toContainText('Правка перед перезагрузкой')
  expect((await downloadProject(page)).config.title).toBe('Правка перед перезагрузкой')
})

test('project restore keeps every panel and does not mix undo history from previous projects', async ({ page }) => {
  await page.goto('/editor')
  await expect(page.getByRole('heading', { name: 'Добавьте данные' })).toBeVisible()
  const project = fixture()
  project.config.annotations = []
  const panel = { ...project.config, title: 'Первая панель' }
  project.config.multiples = { rows: 1, columns: 2, gap: 24, panels: [{ id: 'a', config: panel }, { id: 'b', config: { ...panel, kind: 'bar', title: 'Вторая панель' } }] }
  project.multiplesMode = true
  await openProject(page, project)
  await expect(page.locator('.canvas-paper')).toContainText('Первая панель')
  await expect(page.locator('.canvas-paper')).toContainText('Вторая панель')
  const saved = await downloadProject(page)
  expect(saved.multiplesMode).toBe(true)
  expect(saved.config.multiples?.panels.map((item) => item?.config.title)).toEqual(['Первая панель', 'Вторая панель'])
  await openProject(page, fixture())
  const undo = page.getByRole('button', { name: 'Отменить', exact: true })
  for (let index = 0; index < 3 && await undo.isEnabled(); index += 1) await undo.click()
  const standalone = await downloadProject(page)
  expect(standalone.multiplesMode).toBe(false)
  expect(standalone.config.multiples).toBeUndefined()
  expect(standalone.config.title).toBe('Сохранённый график')
})

test('file opening remains available when browser storage is unavailable and fits mobile', async ({ page }) => {
  await page.addInitScript(() => { indexedDB.open = () => { throw new DOMException('Storage blocked', 'SecurityError') } })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/editor')
  await expect(page.getByRole('heading', { name: 'Добавьте данные' })).toBeVisible()
  await page.locator('.project-menu > summary').click()
  await expect(page.getByRole('button', { name: 'Открыть проект…' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Скачать проект', exact: true })).toBeDisabled()
  await page.screenshot({ path: 'output/project-menu-mobile.png' })
  await openProject(page, fixture())
  await expect(page.getByRole('alert')).toContainText('Автосохранение недоступно')
  expect((await downloadProject(page)).config.title).toBe('Сохранённый график')
  await page.setViewportSize({ width: 320, height: 844 })
  const brand = await page.locator('.topbar .brand').boundingBox()
  const projectButton = await page.locator('.project-menu > summary').boundingBox()
  const exportButton = await page.locator('.export-menu > summary').boundingBox()
  expect(brand!.x + brand!.width).toBeLessThanOrEqual(projectButton!.x)
  expect(exportButton!.x + exportButton!.width).toBeLessThanOrEqual(320)
  await page.screenshot({ path: 'output/project-editor-mobile.png' })
})
