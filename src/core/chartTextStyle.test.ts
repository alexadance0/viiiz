import { expect, it } from 'vitest'
import { applyCanvasTheme, applyChartTextStyle, canvasThemeColors } from './chartTextStyle'
import { createDefaultChartConfig } from '../entities/chart/model/defaultChartConfig'
import { createPanelConfig } from '../features/editor/model/multiples'

it('changes every chart font, including local text overrides, without changing type sizes', () => {
  const original = createDefaultChartConfig()
  const panel = createPanelConfig(original, 'Panel')
  panel.elementStyles.point = { color: '#db5a5a', valueText: { ...panel.valueText, size: 19 } }
  panel.seriesStyles.series = { directLabelText: { ...panel.legendText, size: 15 } }
  panel.annotations = [{ id: 'note', x: 0, y: 0, width: 100, fontFamily: 'Arial', fontSize: 16, textAlign: 'left', backgroundColor: 'transparent', borderColor: 'transparent', html: '', fragments: [] }]
  original.multiples = { columns: 2, rows: 1, gap: 24, panels: [{ id: 'first', config: panel }, null] }
  const changed = applyChartTextStyle(original, { fontFamily: 'Georgia' })
  const child = changed.multiples!.panels[0]!.config
  expect(changed.titleText).toEqual({ ...original.titleText, fontFamily: 'Georgia' })
  expect(child.titleText.size).toBe(20)
  expect(child.axisLabelText).toEqual({ ...panel.axisLabelText, fontFamily: 'Georgia' })
  expect(child.elementStyles.point.valueText).toEqual({ ...panel.elementStyles.point.valueText, fontFamily: 'Georgia' })
  expect(child.seriesStyles.series.directLabelText!.fontFamily).toBe('Georgia')
  expect(child.annotations[0].fontFamily).toBe('Georgia')
  expect(child.annotations[0].fontSize).toBe(16)
  expect(child.elementStyles.point.color).toBe('#db5a5a')
  expect(original.titleText.fontFamily).not.toBe('Georgia')
  expect(changed.multiples!.panels[1]).toBeNull()
})

it('applies canvas themes to the whole composition while preserving typography and data colors', () => {
  const original = createDefaultChartConfig()
  const panel = createPanelConfig(original, 'Panel')
  panel.elementStyles.point = { color: '#db5a5a', valueText: { ...panel.valueText, size: 19 } }
  panel.annotations = [{ id: 'note', x: 0, y: 0, width: 100, fontFamily: 'Arial', fontSize: 16, textAlign: 'left', backgroundColor: 'transparent', borderColor: 'transparent', textStrokeColor: '#ffffff', html: '', fragments: [{ id: 'text', text: 'Note', color: '#222222', bold: true, italic: false }] }]
  original.multiples = { columns: 2, rows: 1, gap: 24, panels: [{ id: 'first', config: panel }, null] }
  const dark = applyCanvasTheme(original, 'dark')
  const child = dark.multiples!.panels[0]!.config
  for (const config of [dark, child]) {
    expect(config.canvasTheme).toBe('dark')
    expect(config.canvasBackground).toBe(canvasThemeColors.dark.background)
    expect(config.titleText.color).toBe(canvasThemeColors.dark.text)
    expect(config.axisLabelText.color).toBe(canvasThemeColors.dark.text)
    expect(config.noteText.color).toBe(canvasThemeColors.dark.muted)
    expect(config.gridColor).toBe(canvasThemeColors.dark.grid)
  }
  expect(child.elementStyles.point.color).toBe('#db5a5a')
  expect(child.elementStyles.point.valueText).toEqual({ ...panel.elementStyles.point.valueText, color: canvasThemeColors.dark.text })
  expect(child.annotations[0].fragments[0].color).toBe(canvasThemeColors.dark.text)
  expect(child.annotations[0].textStrokeColor).toBe(canvasThemeColors.dark.background)
  expect(dark.titleText.fontFamily).toBe(original.titleText.fontFamily)
  expect(dark.titleText.size).toBe(original.titleText.size)
  expect(dark.palette).toEqual(original.palette)
  expect(dark.multiples!.panels[1]).toBeNull()
  const light = applyCanvasTheme(dark, 'light')
  expect(light.canvasBackground).toBe('#ffffff')
  expect(light.titleText.color).toBe(canvasThemeColors.light.text)
  expect(light.multiples!.panels[0]!.config.axisLabelText.color).toBe(canvasThemeColors.light.text)
  expect(original.canvasTheme).toBeUndefined()
})
