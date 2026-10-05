import ts from 'typescript'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const output = 'output/chart-audit-2026-10-03'
mkdirSync(output, { recursive: true })
const program = ts.createProgram(['src/core/types.ts'], { strict: true, skipLibCheck: true })
const checker = program.getTypeChecker()
const source = program.getSourceFile('src/core/types.ts')
const config = source.statements.find((node) => ts.isInterfaceDeclaration(node) && node.name.text === 'ChartConfig')
const fields = checker.getPropertiesOfType(checker.getTypeAtLocation(config)).map((symbol) => {
  const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration)
  const union = type.isUnion() ? type.types : [type]
  return {
    name: symbol.name, type: checker.typeToString(type),
    values: union.flatMap((type) => type.flags & ts.TypeFlags.StringLiteral ? [type.value] : type.flags & ts.TypeFlags.BooleanLiteral ? [type.intrinsicName === 'true'] : type.flags & ts.TypeFlags.NumberLiteral ? [type.value] : []),
    number: union.some((type) => Boolean(type.flags & ts.TypeFlags.Number)),
    string: union.some((type) => Boolean(type.flags & ts.TypeFlags.String)),
    references: [], controls: [],
  }
})
const indexed = new Map(fields.map((field) => [field.name, field]))
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) { if (entry.name !== 'test-fixtures') scan(path); continue }
    if (!/\.(ts|tsx)$/.test(path) || /\.test\./.test(path) || path === 'src/core/types.ts') continue
    const code = readFileSync(path, 'utf8')
    const file = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const line = (node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
    function visit(node) {
      if (ts.isPropertyAccessExpression(node) && indexed.has(node.name.text) && /config/i.test(node.expression.getText(file))) {
        indexed.get(node.name.text).references.push({ path, line: line(node) })
      }
      if (ts.isJsxSelfClosingElement(node) && /(?:NumberInput|ColorControl|TextStyleEditor|MarkerSettings)$/.test(node.tagName.getText(file))) {
        const attributes = node.attributes.properties
        const value = attributes.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(file) === 'value')
        const access = value?.initializer?.getText(file).match(/config\.(\w+)/)?.[1]
        if (indexed.has(access)) {
          const minimum = attributes.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(file) === 'min')
          const maximum = attributes.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(file) === 'max')
          const numeric = (attribute) => { const raw = attribute?.initializer?.getText(file).replace(/["'{}]/g, ''); return raw && Number.isFinite(Number(raw)) ? Number(raw) : undefined }
          indexed.get(access).controls.push({ path, line: line(node), component: node.tagName.getText(file), min: numeric(minimum), max: numeric(maximum) })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
  }
}
scan('src')
writeFileSync(join(output, 'settings-inventory.json'), JSON.stringify({ date: '2026-10-03', fields }, null, 2))
console.log(JSON.stringify({ settings: fields.length, referenced: fields.filter((field) => field.references.length).length, numeric: fields.filter((field) => field.number).length, enums: fields.filter((field) => field.values.length).length, structured: fields.filter((field) => !field.number && !field.string && !field.values.length).map((field) => field.name) }))
