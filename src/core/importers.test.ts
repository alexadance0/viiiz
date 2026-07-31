import { zipSync, strToU8 } from 'fflate'
import { parquetWriteBuffer } from 'hyparquet-writer'
import { DOMParser } from '@xmldom/xmldom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { convertColumn, inferTypes } from './dataProfile'
import { demoTable, distributionDemoTable, dumbbellDemoTable, importExcelSheets, importFile, importGoogleSheet, importGoogleSheets } from './importers'
import { normalizeImportedTable } from './normalization'

const xml = (value: string) => strToU8(value)
function xlsxFile(headers = ['Дата', 'Сумма', 'Статус']): File {
  const sheetRows = [
    headers,
    ['2024-Q1', '1 234,5', 'p'],
    ['2024-Q2', '1.500,25', 'e'],
    ['2024-Q3', ':', 'c'],
  ].map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => `<c r="${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${cell}</t></is></c>`).join('')}</row>`).join('')
  const bytes = zipSync({
    '[Content_Types].xml': xml('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
    '_rels/.rels': xml('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': xml('<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': xml('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': xml(`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`),
  })
  return new File([bytes], 'agency.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

function multiSheetFile(): File {
  const data = (header: string, value: string) => `<row r="1"><c r="A1" t="inlineStr"><is><t>${header}</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>${value}</t></is></c></row>`
  const worksheet = (rows: string) => xml(`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`)
  const bytes = zipSync({
    '[Content_Types].xml': xml('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
    '_rels/.rels': xml('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': xml('<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Россия" sheetId="1" r:id="rId1"/><sheet name="Казахстан" sheetId="2" r:id="rId2"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': xml('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': worksheet(data('Страна', 'Россия')),
    'xl/worksheets/sheet2.xml': worksheet(data('Страна', 'Казахстан')),
  })
  return new File([bytes], 'countries.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

afterEach(() => vi.unstubAllGlobals())

describe('CSV import and normalization integration', () => {
  it('handles semicolon CSV with decimal commas and day-first dates', async () => {
    const source = [
      'Дата;Сумма;Комментарий',
      '01.02.20;1 234,50;первая',
      '25.03.20;−42,25;вторая',
      '04.05.20;—;третья',
    ].join('\n')
    const imported = await importFile(new File([source], 'data.csv', { type: 'text/csv' }))
    const table = normalizeImportedTable(imported, 'ru-RU')

    expect(table.columns).toEqual(['Дата', 'Сумма', 'Комментарий'])
    expect(table.rows[0].Сумма).toBe(1234.5)
    expect(table.rows[1].Сумма).toBe(-42.25)
    expect(table.rows[2].Сумма).toBeNull()
    expect((table.rows[0].Дата as Date).getMonth()).toBe(1)
    expect(inferTypes(table)).toMatchObject({ Дата: 'date', Сумма: 'number', Комментарий: 'text' })
  })

  it('does not mutate immutable raw values through repeated type changes', async () => {
    const imported = await importFile(new File(['id;value\n1;20,5\n2;30,75'], 'data.csv', { type: 'text/csv' }))
    const original = normalizeImportedTable(imported)
    const date = convertColumn(original, 'value', 'date')
    const text = convertColumn(date, 'value', 'text')
    const number = convertColumn(text, 'value', 'number')

    expect(number.rows.map((row) => row.value)).toEqual([20.5, 30.75])
    expect(number.rawRows?.map((row) => row.value)).toEqual(['20,5', '30,75'])
  })
})

describe('other data sources', () => {
  it('provides a sizeable demo with all supported regular frequencies', () => {
    expect(demoTable.rows).toHaveLength(36)
    expect(Object.values(demoTable.timeProfiles ?? {}).map((profile) => profile.frequency)).toEqual([
      'daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual',
    ])
    expect(demoTable.rows[0].month).toBeInstanceOf(Date)
    expect(demoTable.columns).toEqual(expect.arrayContaining(['revenue', 'orders', 'profit', 'plan']))
    expect(dumbbellDemoTable.columns).toEqual(['region', 'before', 'after'])
    expect(dumbbellDemoTable.rows).toHaveLength(5)
    expect(distributionDemoTable.columns).toEqual(['region', 'profit', 'orders'])
    expect(distributionDemoTable.rows).toHaveLength(48)
    expect(new Set(distributionDemoTable.rows.map((row) => row.region)).size).toBe(4)
  })
  it('imports and normalizes a real XLSX container', async () => {
    vi.stubGlobal('DOMParser', DOMParser)
    const imported = await importFile(xlsxFile())
    const table = normalizeImportedTable(imported)
    expect(table.rows[0].Дата).toBeInstanceOf(Date)
    expect(table.timeProfiles?.Дата.frequency).toBe('quarterly')
    expect(table.rows.map((row) => row.Сумма)).toEqual([1234.5, 1500.25, null])
  })

  it('discovers and reads every sheet in an XLSX workbook', async () => {
    vi.stubGlobal('DOMParser', DOMParser)
    const sheets = await importExcelSheets(multiSheetFile())
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Россия', 'Казахстан'])
    expect(sheets.map((sheet) => sheet.table.rows[0].Страна)).toEqual(['Россия', 'Казахстан'])
  })

  it('keeps Excel columns with blank or duplicate headers distinct', async () => {
    vi.stubGlobal('DOMParser', DOMParser)
    const [sheet] = await importExcelSheets(xlsxFile(['Значение', 'Значение', '']))
    expect(sheet.table.columns).toEqual(['Значение', 'Значение_2', 'column_3'])
    expect(sheet.table.rows[0]).toMatchObject({ Значение: '2024-Q1', Значение_2: '1 234,5', column_3: 'p' })
  })

  it('imports a Snappy-compressed Parquet file', async () => {
    const buffer = parquetWriteBuffer({ columnData: [
      { name: 'period', data: ['2023M12', '2024M01', '2024M02'], type: 'STRING' },
      { name: 'value', data: ['10,5', '11,25', '.'], type: 'STRING' },
    ] })
    const imported = await importFile(new File([buffer], 'agency.parquet', { type: 'application/vnd.apache.parquet' }))
    const table = normalizeImportedTable(imported)
    expect(table.rows[0].period).toBeInstanceOf(Date)
    expect(table.timeProfiles?.period.frequency).toBe('monthly')
    expect(table.rows.map((row) => row.value)).toEqual([10.5, 11.25, null])
  })

  it('imports public Google Sheets CSV and preserves localized formats', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('period;value\n2024-S1;1 234,5\n2024-S2;:', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const imported = await importGoogleSheet('https://docs.google.com/spreadsheets/d/test-sheet-id/edit?gid=42')
    const table = normalizeImportedTable(imported)
    expect(fetchMock).toHaveBeenCalledWith('https://docs.google.com/spreadsheets/d/test-sheet-id/export?format=csv&gid=42')
    expect(table.timeProfiles?.period.frequency).toBe('semiannual')
    expect(table.rows.map((row) => row.value)).toEqual([1234.5, null])
  })

  it('uses the default sheet when a Google Sheets link has no gid', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('label,value\nA,1', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await importGoogleSheet('https://docs.google.com/spreadsheets/d/test-sheet-id/edit?usp=sharing')
    expect(fetchMock).toHaveBeenCalledWith('https://docs.google.com/spreadsheets/d/test-sheet-id/export?format=csv')
  })

  it('recognizes a sheet identifier supplied in the URL fragment', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('label,value\nA,1', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await importGoogleSheet('https://docs.google.com/spreadsheets/d/test-sheet-id/edit#gid=42')
    expect(fetchMock).toHaveBeenCalledWith('https://docs.google.com/spreadsheets/d/test-sheet-id/export?format=csv&gid=42')
  })

  it('loads every Google Sheets tab through the workbook export', async () => {
    vi.stubGlobal('DOMParser', DOMParser)
    const workbook = multiSheetFile()
    const fetchMock = vi.fn().mockResolvedValue(new Response(workbook, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const sheets = await importGoogleSheets('https://docs.google.com/spreadsheets/d/test-sheet-id/edit')
    expect(fetchMock).toHaveBeenCalledWith('https://docs.google.com/spreadsheets/d/test-sheet-id/export?format=xlsx')
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Россия', 'Казахстан'])
  })
})
