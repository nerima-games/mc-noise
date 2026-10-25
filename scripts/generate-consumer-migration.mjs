import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, 'package.json'))
const typescript = require('typescript')
const typescriptAst =
  typeof typescript.createProgram === 'function' ? undefined : require('typescript/unstable/ast')
const parseArguments = (args) => {
  const values = new Map()
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index]
    const value = args[index + 1]
    if (!['--base-ref', '--head-ref', '--base-dts', '--head-dts'].includes(name) || value === undefined) {
      throw new Error(
        'Usage: node scripts/generate-consumer-migration.mjs --base-ref <ref> --head-ref <ref> --base-dts <path> --head-dts <path>',
      )
    }
    if (values.has(name)) {
      throw new Error(`Duplicate argument: ${name}`)
    }
    values.set(name, value)
  }

  const required = ['--base-ref', '--head-ref', '--base-dts', '--head-dts']
  const missing = required.filter((name) => !values.has(name))
  if (missing.length > 0) {
    throw new Error(`Missing arguments: ${missing.join(', ')}`)
  }

  return {
    baseRef: values.get('--base-ref'),
    headRef: values.get('--head-ref'),
    baseDts: values.get('--base-dts'),
    headDts: values.get('--head-dts'),
  }
}

const readExports = (entryPath) => {
  if (typeof typescript.createProgram === 'function') {
    return readExportsWithCompilerApi(entryPath)
  }
  return readExportsWithSyncApi(entryPath)
}

const readExportsWithCompilerApi = (entryPath) => {
  const program = typescript.createProgram([entryPath], {
    target: typescript.ScriptTarget.Latest,
    module: typescript.ModuleKind.NodeNext,
    moduleResolution: typescript.ModuleResolutionKind.NodeNext,
    skipLibCheck: true,
    noEmit: true,
  })
  const source = program.getSourceFile(entryPath)
  if (source === undefined) {
    throw new Error(`Could not parse declaration entrypoint: ${entryPath}`)
  }
  const checker = program.getTypeChecker()
  const moduleSymbol = checker.getSymbolAtLocation(source)
  if (moduleSymbol === undefined) {
    throw new Error(`Could not resolve module exports: ${entryPath}`)
  }
  const printer = typescript.createPrinter({ newLine: typescript.NewLineKind.LineFeed })
  return new Map(
    checker
      .getExportsOfModule(moduleSymbol)
      .map((symbol) => {
        const target = symbol.flags & typescript.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
        const declarations = target.getDeclarations() ?? []
        const signatures = declarations.map((declaration) => {
          const node = typescript.isVariableDeclaration(declaration)
            ? declaration.parent.parent
            : declaration
          return normalizeSignature(printer.printNode(typescript.EmitHint.Unspecified, node, node.getSourceFile()))
        })
        return [symbol.getName(), uniqueSorted(signatures)]
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  )
}

const readExportsWithSyncApi = (entryPath) => {
  const { API, SymbolFlags } = require('typescript/unstable/sync')
  const api = new API({ cwd: root })
  try {
    const snapshot = api.updateSnapshot({ openFiles: [entryPath] })
    try {
      const project = snapshot.getDefaultProjectForFile(entryPath)
      const source = project?.program.getSourceFile(entryPath)
      if (project === undefined || source === undefined) {
        throw new Error(`Could not parse declaration entrypoint: ${entryPath}`)
      }
      const { checker } = project
      const moduleSymbol = checker.getSymbolAtLocation(source)
      if (moduleSymbol === undefined) {
        throw new Error(`Could not resolve module exports: ${entryPath}`)
      }
      return new Map(
        checker
          .getExportsOfModule(moduleSymbol)
          .map((symbol) => {
            const target = symbol.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
            const declarations = target.declarations
              .map((handle) => handle.resolve(project))
              .filter((declaration) => declaration !== undefined)
            const signatures = declarations.map((declaration) => {
              const node = isVariableDeclaration(declaration)
                ? declaration.parent.parent
                : declaration
              return normalizeSignature(project.emitter.printNode(node))
            })
            if (signatures.length === 0) {
              throw new Error(`No declaration signature found for export ${symbol.name} in ${entryPath}`)
            }
            return [symbol.name, uniqueSorted(signatures)]
          })
          .sort(([left], [right]) => left.localeCompare(right)),
      )
    } finally {
      snapshot.dispose()
    }
  } finally {
    api.close()
  }
}

const isVariableDeclaration = (node) => {
  if (typeof typescript.isVariableDeclaration === 'function') {
    return typescript.isVariableDeclaration(node)
  }
  return typescriptAst.formatSyntaxKind(node.kind) === 'VariableDeclaration'
}

const normalizeSignature = (signature) => signature.replace(/\s+/gu, ' ').trim()

const uniqueSorted = (values) => [...new Set(values)].sort()

const groupBy = (values, keyOf) => {
  const groups = new Map()
  for (const value of values) {
    const key = keyOf(value)
    const group = groups.get(key) ?? []
    group.push(value)
    groups.set(key, group)
  }
  return groups
}

const classify = (name, baseSignatures, headSignatures) => {
  const baseText = baseSignatures.join(' ')
  const headText = headSignatures.join(' ')
  const baseSeedParameters = (baseText.match(/\bseed\s*:\s*[^,;)}]+/gu) ?? []).join('|')
  const headSeedParameters = (headText.match(/\bseed\s*:\s*[^,;)}]+/gu) ?? []).join('|')
  const baseSeedTypes = (baseText.match(/\bNoiseSeed(?:Value)?\b/gu) ?? []).length
  const headSeedTypes = (headText.match(/\bNoiseSeed(?:Value)?\b/gu) ?? []).length
  if (name === 'NoiseSeed' || baseSeedParameters !== headSeedParameters || baseSeedTypes !== headSeedTypes) {
    return 'seed'
  }

  const coordinateTypes =
    /\b(?:BlockAxis(?:Value)?|ChunkAxis(?:Value)?|PositionAxis(?:Value)?|LocalAxis|WorldAxis|ChunkHeight|GridDimension|GridStep|SampleStride|LatticeCoordinate|DensityCellSize|DensityPosition|DensityCoordinate)\b/gu
  const baseCoordinates = (baseText.match(coordinateTypes) ?? []).sort().join('|')
  const headCoordinates = (headText.match(coordinateTypes) ?? []).sort().join('|')
  if (
    /(?:Axis|Coordinate|ChunkHeight|GridDimension|GridStep|SampleStride|CellSize)$/u.test(name) ||
    baseCoordinates !== headCoordinates
  ) {
    return 'coordinates'
  }

  if (/\bResult(?:\.Result)?\s*</u.test(baseText) || /\bResult(?:\.Result)?\s*</u.test(headText)) {
    return 'result'
  }
  return 'other'
}

const renderTables = ({ baseRef, headRef, changedByCategory, addedExports, removedExports }) => {
  const categories = [
    ['seed', 'Seed brand changes'],
    ['coordinates', 'Coordinate brand changes'],
    ['result', 'Result changes'],
    ['other', 'Other signature changes'],
  ]
  const sections = categories.map(([category, title]) => {
    const rows = changedByCategory.get(category) ?? []
    return renderChangeTable(title, rows)
  })
  sections.push(renderAddedTable(addedExports))
  if (removedExports.length > 0) {
    sections.push(renderRemovedTable(removedExports))
  }

  return [
    `Compared declarations from \`${escapeHtml(baseRef)}\` and \`${escapeHtml(headRef)}\`. The AST comparison found ${changedByCategory.get('seed')?.length ?? 0} seed brand changes, ${changedByCategory.get('coordinates')?.length ?? 0} coordinate brand changes, ${changedByCategory.get('result')?.length ?? 0} Result changes, ${changedByCategory.get('other')?.length ?? 0} other signature changes, ${addedExports.length} added exports, and ${removedExports.length} removed exports.`,
    '',
    ...sections,
  ].join('\n')
}

const renderChangeTable = (title, rows) => {
  const tableRows = rows
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(({ name, baseSignatures, headSignatures }) =>
      `| \`${escapeHtml(name)}\` | ${signatureCell(baseSignatures)} | ${signatureCell(headSignatures)} |`,
    )
  return [
    `<details>`,
    `<summary>${title} (${rows.length})</summary>`,
    '',
    '| Export | Before | After |',
    '| --- | --- | --- |',
    ...tableRows,
    '',
    '</details>',
  ].join('\n')
}

const renderAddedTable = (rows) => {
  const tableRows = rows
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(({ name, headSignatures }) =>
      `| \`${escapeHtml(name)}\` | Not exported | ${signatureCell(headSignatures)} |`,
    )
  return [
    `<details>`,
    `<summary>Added exports (${rows.length})</summary>`,
    '',
    '| Export | Before | After |',
    '| --- | --- | --- |',
    ...tableRows,
    '',
    '</details>',
  ].join('\n')
}

const renderRemovedTable = (rows) => {
  const tableRows = rows
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(({ name, baseSignatures }) =>
      `| \`${escapeHtml(name)}\` | ${signatureCell(baseSignatures)} | Not exported |`,
    )
  return [
    `<details>`,
    `<summary>Removed exports (${rows.length})</summary>`,
    '',
    '| Export | Before | After |',
    '| --- | --- | --- |',
    ...tableRows,
    '',
    '</details>',
  ].join('\n')
}

const signatureCell = (signatures) =>
  signatures
    .map((signature) => `<code>${escapeHtml(signature).replaceAll('|', '&#124;')}</code>`)
    .join('<br>')

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('`', '&#96;')

const writeGeneratedSection = (generatedSection) => {
  const documentPath = resolve(root, 'docs/consumer-migration.md')
  const document = readFileSync(documentPath, 'utf8')
  const begin = '<!-- BEGIN GENERATED SIGNATURE TABLES -->'
  const end = '<!-- END GENERATED SIGNATURE TABLES -->'
  const beginIndex = document.indexOf(begin)
  const endIndex = document.indexOf(end)
  if (
    beginIndex < 0 ||
    endIndex <= beginIndex ||
    document.indexOf(begin, beginIndex + begin.length) >= 0
  ) {
    throw new Error(`Expected one ordered marker pair in ${documentPath}`)
  }
  const before = document.slice(0, beginIndex + begin.length)
  const after = document.slice(endIndex)
  writeFileSync(documentPath, `${before}\n\n${generatedSection}\n\n${after}`)
}

const argumentsByName = parseArguments(process.argv.slice(2))
const basePath = resolve(argumentsByName.baseDts)
const headPath = resolve(argumentsByName.headDts)
readFileSync(basePath)
readFileSync(headPath)

const baseExports = readExports(basePath)
const headExports = readExports(headPath)
const changedExports = []
const addedExports = []
const removedExports = []

for (const [name, baseSignatures] of baseExports) {
  const headSignatures = headExports.get(name)
  if (headSignatures === undefined) {
    removedExports.push({ name, baseSignatures })
  } else if (JSON.stringify(baseSignatures) !== JSON.stringify(headSignatures)) {
    changedExports.push({ name, baseSignatures, headSignatures })
  }
}

for (const [name, headSignatures] of headExports) {
  if (!baseExports.has(name)) {
    addedExports.push({ name, headSignatures })
  }
}

const groupedChanges = groupBy(changedExports, ({ name, baseSignatures, headSignatures }) =>
  classify(name, baseSignatures, headSignatures),
)
const generatedSection = renderTables({
  baseRef: argumentsByName.baseRef,
  headRef: argumentsByName.headRef,
  changedByCategory: groupedChanges,
  addedExports,
  removedExports,
})
writeGeneratedSection(generatedSection)

console.log(
  `Generated consumer migration signatures: ${changedExports.length} changed, ${addedExports.length} added, ${removedExports.length} removed.`,
)
for (const category of ['seed', 'coordinates', 'result', 'other']) {
  console.log(`  ${category}: ${groupedChanges.get(category)?.length ?? 0} changed`)
}
