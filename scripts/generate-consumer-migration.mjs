import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, 'package.json'))
const packageName = require(resolve(root, 'package.json')).name
const typescript = require('typescript')
const typescriptAst =
  typeof typescript.createProgram === 'function' ? undefined : require('typescript/unstable/ast')
const typeFlags =
  typescript.TypeFlags ?? require('typescript/unstable/sync').TypeFlags
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
  const publicSymbols = checker.getExportsOfModule(moduleSymbol)
  const publicDeclarations = publicSymbols.flatMap((symbol) => {
    const target = symbol.flags & typescript.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    return target.getDeclarations() ?? []
  })
  const exportsByName = new Map(
    publicSymbols
      .map((symbol) => {
        const target = symbol.flags & typescript.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
        const declarations = target.getDeclarations() ?? []
        const signatures = declarations.map((declaration) => {
          const node = typescript.isVariableDeclaration(declaration)
            ? declaration.parent.parent
            : declaration
          return normalizeSignature(printer.printNode(typescript.EmitHint.Unspecified, node, node.getSourceFile()))
        })
        return [
          symbol.getName(),
          {
            signatures: uniqueSorted(signatures),
            fields: readPublicFields(
              checker,
              target,
              undefined,
              typescript.SymbolFlags,
              (node) => printer.printNode(typescript.EmitHint.Unspecified, node, node.getSourceFile()),
              packageName,
            ),
            brandType: findBrandType(signatures),
          },
        ]
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  )
  return {
    exports: exportsByName,
    referencedDependencyFields: readReferencedDependencyFields(
      program,
      checker,
      publicDeclarations,
      undefined,
      typescript.SymbolFlags,
      (node) => printer.printNode(typescript.EmitHint.Unspecified, node, node.getSourceFile()),
    ),
    availableBrandFactories: collectAvailableBrandFactories(
      program,
      checker,
      undefined,
      typescript.SymbolFlags,
      (node) => printer.printNode(typescript.EmitHint.Unspecified, node, node.getSourceFile()),
    ),
  }
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
      const publicSymbols = checker.getExportsOfModule(moduleSymbol)
      const publicDeclarations = publicSymbols.flatMap((symbol) => {
        const target = symbol.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
        return target.declarations
          .map((declaration) => declaration.resolve(project))
          .filter((declaration) => declaration !== undefined)
      })
      const exportsByName = new Map(
        publicSymbols
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
            return [
              symbol.name,
              {
                signatures: uniqueSorted(signatures),
                fields: readPublicFields(
                  checker,
                  target,
                  project,
                  SymbolFlags,
                  (node) => project.emitter.printNode(node),
                  packageName,
                ),
                brandType: findBrandType(signatures),
              },
            ]
          })
          .sort(([left], [right]) => left.localeCompare(right)),
      )
      return {
        exports: exportsByName,
        referencedDependencyFields: readReferencedDependencyFields(
          project.program,
          checker,
          publicDeclarations,
          project,
          SymbolFlags,
          (node) => project.emitter.printNode(node),
        ),
        availableBrandFactories: collectAvailableBrandFactories(
          project.program,
          checker,
          project,
          SymbolFlags,
          (node) => project.emitter.printNode(node),
        ),
      }
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

const readPublicFields = (checker, symbol, project, symbolFlags, printNode, provider) => {
  const typeSymbolFlags = symbolFlags.TypeAlias | symbolFlags.Interface | symbolFlags.Class
  if ((symbol.flags & typeSymbolFlags) === 0) return []

  const declaredType = checker.getDeclaredTypeOfSymbol(symbol)
  const variants = isUnionType(declaredType)
    ? (declaredType.types ?? declaredType.getTypes())
    : [declaredType]
  const fields = variants.flatMap((variant, index) => {
    const properties = checker.getPropertiesOfType(variant)
    const variantName = getVariantName(checker, properties, project, variants.length, index)
    return properties.flatMap((property) => {
      const propertyName = String(property.name)
      if (propertyName.startsWith('__') || propertyName.startsWith('~') || /^\d+$/u.test(propertyName)) {
        return []
      }
      const declaration = (property.declarations ?? [])
        .map((candidate) => resolveDeclaration(candidate, project))
        .find((candidate) => candidate !== undefined && !isTypeScriptLibraryFile(candidate.getSourceFile().fileName))
      if (declaration === undefined) return []

      return [{
        provider,
        variant: variantName,
        name: propertyName,
        optional: (property.flags & symbolFlags.Optional) !== 0,
        signature: normalizeSignature(printNode(declaration)),
      }]
    })
  })
  return fields.sort((left, right) =>
    left.variant.localeCompare(right.variant) || left.name.localeCompare(right.name),
  )
}

const readReferencedDependencyFields = (
  program,
  checker,
  publicDeclarations,
  project,
  symbolFlags,
  printNode,
) => {
  const dependencyName = '@nerima-games/mc-kernel'
  const typeSymbolFlags = symbolFlags.TypeAlias | symbolFlags.Interface | symbolFlags.Class
  const sourceFiles = getProgramSourceFiles(program, project)
  const packageRoot = sourceFiles
    .map((source) => getDeclarationPackageRoot(source.fileName ?? source.path, dependencyName))
    .find((candidate) => candidate !== undefined)
  if (packageRoot === undefined) {
    throw new Error(`Could not find ${dependencyName} package root in the TypeScript program`)
  }
  const dependencyPackage = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'))
  if (dependencyPackage.name !== dependencyName) {
    throw new Error(`Unexpected package at ${packageRoot}: ${dependencyPackage.name}`)
  }

  const sourceByPath = new Map(
    sourceFiles.map((source) => [normalizeFilePath(source.fileName ?? source.path), source]),
  )
  const publicEntrypoints = collectTypeEntrypoints(dependencyPackage.exports)
    .map((entrypoint) => sourceByPath.get(normalizeFilePath(resolve(packageRoot, entrypoint))))
    .filter((source) => source !== undefined)
  const publicDependencyTypes = new Map()
  for (const entrypoint of publicEntrypoints) {
    const moduleSymbol = checker.getSymbolAtLocation(entrypoint)
    if (moduleSymbol === undefined) continue
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const target = exported.flags & symbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
      if ((target.flags & typeSymbolFlags) === 0) continue
      const name = typeof target.getName === 'function' ? target.getName() : target.name
      if (!publicDependencyTypes.has(target)) {
        const fields = readPublicFields(checker, target, project, symbolFlags, printNode, dependencyName)
        if (fields.length > 0) publicDependencyTypes.set(target, { name, fields })
      }
    }
  }

  const reachableSymbols = collectReferencedSymbols(publicDeclarations, checker, project)
  const fieldsByName = new Map()
  for (const [symbol, entry] of publicDependencyTypes) {
    if (reachableSymbols.has(symbol)) fieldsByName.set(entry.name, entry.fields)
  }
  return fieldsByName
}

const collectReferencedSymbols = (declarations, checker, project) => {
  const symbols = new Set()
  const visited = new Set()
  const visit = (node) => {
    if (node === undefined || node === null || visited.has(node)) return
    visited.add(node)
    if (isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node)
      if (symbol !== undefined) {
        symbols.add(symbol.flags & symbolFlagsAlias ? checker.getAliasedSymbol(symbol) : symbol)
      }
    }
    const visitChild = (child) => visit(child)
    if (typeof node.forEachChild === 'function') {
      node.forEachChild(visitChild)
    } else {
      typescript.forEachChild(node, visitChild)
    }
  }
  for (const candidate of declarations) visit(resolveDeclaration(candidate, project))
  return symbols
}

const symbolFlagsAlias = typescript.SymbolFlags?.Alias ?? require('typescript/unstable/sync').SymbolFlags.Alias

const isIdentifier = (node) =>
  typeof typescript.isIdentifier === 'function'
    ? typescript.isIdentifier(node)
    : typescriptAst.formatSyntaxKind(node.kind) === 'Identifier'

const collectTypeEntrypoints = (exports) => {
  const entrypoints = []
  const visit = (condition) => {
    if (typeof condition === 'string') {
      if (condition.endsWith('.d.ts')) entrypoints.push(condition)
      return
    }
    if (condition === null || typeof condition !== 'object') return
    if (typeof condition.types === 'string') {
      visit(condition.types)
      return
    }
    for (const value of Object.values(condition)) visit(value)
  }
  for (const value of Object.values(exports ?? {})) visit(value)
  return uniqueSorted(entrypoints)
}

const getDeclarationPackageRoot = (filePath, packageName) => {
  const normalized = normalizeFilePath(filePath)
  const packagePath = `/node_modules/${packageName}/`
  const packageIndex = normalized.lastIndexOf(packagePath)
  return packageIndex < 0 ? undefined : normalized.slice(0, packageIndex + packagePath.length - 1)
}

const normalizeFilePath = (filePath) => resolve(filePath).replaceAll('\\', '/')

const getProgramSourceFiles = (program, project) => {
  const sourceFiles = typeof program.getSourceFiles === 'function'
    ? program.getSourceFiles()
    : program
        .getSourceFileNames()
        .map((filePath) => program.getSourceFile(filePath))
        .filter((source) => source !== undefined)
  return sourceFiles.map((source) => resolveDeclaration(source, project))
}

const isUnionType = (type) =>
  typeof type.isUnion === 'function' ? type.isUnion() : (type.flags & typeFlags.Union) !== 0

const resolveDeclaration = (declaration, project) =>
  typeof declaration.resolve === 'function' ? declaration.resolve(project) : declaration

const isTypeScriptLibraryFile = (filePath) => /(?:^|\/)lib(?:\.[^/]+)?\.d\.ts$/u.test(filePath)

const getVariantName = (checker, properties, project, variantCount, index) => {
  if (variantCount < 2) return ''
  const discriminant = properties.find((property) => ['kind', 'type', 'tag'].includes(property.name))
  if (discriminant !== undefined) {
    const declaration = (discriminant.declarations ?? [])
      .map((candidate) => resolveDeclaration(candidate, project))
      .find((candidate) => candidate !== undefined)
    if (declaration !== undefined) {
      const discriminantType = checker.getTypeOfSymbolAtLocation(discriminant, declaration)
      const literalFlags = typeFlags.StringLiteral | typeFlags.NumberLiteral
      if ((discriminantType.flags & literalFlags) !== 0) {
        return `${discriminant.name}=${checker.typeToString(discriminantType, declaration)}`
      }
    }
  }
  return `variant ${index + 1}`
}

const findBrandType = (signatures) => {
  const match = signatures.join(' ').match(/\bBrand(?:\.Brand)?\.Constructor<([A-Za-z_$][\w$]*)>/u)
  return match?.[1]
}

const collectAvailableBrandFactories = (program, checker, project, symbolFlags, printNode) => {
  const sourceFiles = typeof program.getSourceFiles === 'function'
    ? program.getSourceFiles()
    : program
        .getSourceFileNames()
        .filter((filePath) => {
          const provider = getDeclarationPackage(filePath)
          return provider === packageName || provider === '@nerima-games/mc-kernel'
        })
        .map((filePath) => program.getSourceFile(filePath))
        .filter((source) => source !== undefined)
  const factories = new Map()

  for (const source of sourceFiles) {
    const provider = getDeclarationPackage(source.fileName)
    if (provider !== packageName && provider !== '@nerima-games/mc-kernel') continue
    const moduleSymbol = checker.getSymbolAtLocation(source)
    if (moduleSymbol === undefined) continue

    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const target = exported.flags & symbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
      const declarations = typeof target.getDeclarations === 'function'
        ? (target.getDeclarations() ?? [])
        : (target.declarations ?? [])
      const rendered = declarations
        .map((candidate) => resolveDeclaration(candidate, project))
        .filter((declaration) => declaration !== undefined)
        .map((declaration) => {
          const node = isVariableDeclaration(declaration)
            ? declaration.parent.parent
            : declaration
          return printNode(node)
        })
      const brandType = findBrandType(rendered)
      if (brandType === undefined) continue

      const declaration = declarations
        .map((candidate) => resolveDeclaration(candidate, project))
        .find((candidate) => candidate !== undefined)
      const declarationPackage = declaration === undefined
        ? provider
        : getDeclarationPackage(declaration.getSourceFile().fileName)
      const name = typeof exported.getName === 'function' ? exported.getName() : exported.name
      const factory = { name, brandType, provider: declarationPackage }
      factories.set(`${factory.name}\0${factory.brandType}\0${factory.provider}`, factory)
    }
  }

  return [...factories.values()]
}

const getDeclarationPackage = (filePath) => {
  const normalized = filePath.replaceAll('\\', '/')
  const nodeModulesIndex = normalized.lastIndexOf('/node_modules/')
  if (nodeModulesIndex < 0) return packageName
  const packagePath = normalized.slice(nodeModulesIndex + '/node_modules/'.length)
  const [first, second] = packagePath.split('/')
  return first.startsWith('@') ? `${first}/${second}` : first
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

const findFieldChanges = (baseExports, headExports, baseDependencyFields, headDependencyFields) => {
  const makeTypes = (exports, dependencyFields) => {
    const types = new Map(
      [...exports].map(([name, entry]) => [
        `${packageName}\0${name}`,
        { name, provider: packageName, fields: entry.fields },
      ]),
    )
    for (const [name, fields] of dependencyFields) {
      types.set(`@nerima-games/mc-kernel\0${name}`, {
        name,
        provider: '@nerima-games/mc-kernel',
        fields,
      })
    }
    return types
  }

  const baseTypes = makeTypes(baseExports, baseDependencyFields)
  const headTypes = makeTypes(headExports, headDependencyFields)
  const changes = []
  for (const typeKey of new Set([...baseTypes.keys(), ...headTypes.keys()])) {
    const baseType = baseTypes.get(typeKey)
    const headType = headTypes.get(typeKey)
    const { name: exportName, provider } = headType ?? baseType
    const baseFields = new Map((baseType?.fields ?? []).map((field) => [`${field.variant}\0${field.name}`, field]))
    const headFields = new Map((headType?.fields ?? []).map((field) => [`${field.variant}\0${field.name}`, field]))
    for (const fieldKey of new Set([...baseFields.keys(), ...headFields.keys()])) {
      const before = baseFields.get(fieldKey)
      const after = headFields.get(fieldKey)
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changes.push({ exportName, provider, before, after })
      }
    }
  }
  return changes
}

const findNewBrandFactories = (baseExports, headExports, availableBrandFactories) => {
  const baseSurface = publicSurfaceText(baseExports)
  const headSurface = publicSurfaceText(headExports)
  const factories = new Map()

  for (const factory of availableBrandFactories) {
    const newlyExported = headExports.get(factory.name)?.brandType === factory.brandType &&
      baseExports.get(factory.name)?.brandType !== factory.brandType
    const newlyReferenced = containsIdentifier(headSurface, factory.brandType) &&
      !containsIdentifier(baseSurface, factory.brandType)
    if (newlyExported || newlyReferenced) {
      factories.set(`${factory.name}\0${factory.brandType}`, factory)
    }
  }

  return [...factories.values()].sort((left, right) => left.name.localeCompare(right.name))
}

const publicSurfaceText = (exports) =>
  [...exports.values()]
    .flatMap((entry) => [...entry.signatures, ...entry.fields.map(({ signature }) => signature)])
    .join('\n')

const containsIdentifier = (text, identifier) =>
  new RegExp(`\\b${identifier}\\b`, 'u').test(text)

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

const renderTables = ({
  baseRef,
  headRef,
  changedByCategory,
  addedExports,
  removedExports,
  fieldChanges,
  brandFactories,
}) => {
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
  sections.push(renderRemovedTable(removedExports))
  sections.push(renderFieldChangesTable(fieldChanges))
  sections.push(renderBrandFactoriesTable(brandFactories))

  return [
    `Compared declarations from base \`${escapeHtml(baseRef)}\` to candidate \`${escapeHtml(headRef)}\`.`,
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
  if (rows.length === 0) {
    return [
      `<details>`,
      `<summary>Removed exports</summary>`,
      '',
      'No removed exports.',
      '',
      '</details>',
    ].join('\n')
  }

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

const renderFieldChangesTable = (rows) => {
  const tableRows = rows
    .sort((left, right) =>
      left.provider.localeCompare(right.provider) ||
      left.exportName.localeCompare(right.exportName) ||
      (left.after?.variant ?? left.before?.variant ?? '').localeCompare(right.after?.variant ?? right.before?.variant ?? '') ||
      (left.after?.name ?? left.before?.name ?? '').localeCompare(right.after?.name ?? right.before?.name ?? ''),
    )
    .map(({ exportName, provider, before, after }) => {
      const variant = after?.variant ?? before?.variant ?? ''
      return `| \`${escapeHtml(provider)}\` | \`${escapeHtml(exportName)}\` | ${variant === '' ? 'All variants' : `<code>${escapeHtml(variant)}</code>`} | ${fieldCell(before)} | ${fieldCell(after)} |`
    })
  return [
    `<details>`,
    `<summary>Public type and interface field changes (${rows.length})</summary>`,
    '',
    '| Provider | Type | Variant | Field before | Field after |',
    '| --- | --- | --- | --- | --- |',
    ...tableRows,
    '',
    '</details>',
  ].join('\n')
}

const renderBrandFactoriesTable = (rows) => {
  const tableRows = rows
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(({ name, brandType, provider }) =>
      `| \`${escapeHtml(name)}\` | \`${escapeHtml(brandType)}\` | \`${escapeHtml(provider)}\` | <code>${escapeHtml(name)}.result(value)</code> |`,
    )
  return [
    `<details>`,
    `<summary>New brand value constructors (${rows.length})</summary>`,
    '',
    'Call the listed constructor `.result(value)` method and handle its `Result` before using the branded value.',
    '',
    '| Constructor | Branded type | Package | Checked construction |',
    '| --- | --- | --- | --- |',
    ...tableRows,
    '',
    '</details>',
  ].join('\n')
}

const fieldCell = (field) => {
  if (field === undefined) return 'Not present'
  const optionality = field.optional ? 'optional' : 'required'
  return `${signatureCell([field.signature])} (${optionality})`
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

const baseDeclarations = readExports(basePath)
const headDeclarations = readExports(headPath)
const baseExports = baseDeclarations.exports
const headExports = headDeclarations.exports
const changedExports = []
const addedExports = []
const removedExports = []

for (const [name, baseExport] of baseExports) {
  const headExport = headExports.get(name)
  if (headExport === undefined) {
    removedExports.push({ name, baseSignatures: baseExport.signatures })
  } else if (JSON.stringify(baseExport.signatures) !== JSON.stringify(headExport.signatures)) {
    changedExports.push({
      name,
      baseSignatures: baseExport.signatures,
      headSignatures: headExport.signatures,
    })
  }
}

for (const [name, headExport] of headExports) {
  if (!baseExports.has(name)) {
    addedExports.push({ name, headSignatures: headExport.signatures })
  }
}

const groupedChanges = groupBy(changedExports, ({ name, baseSignatures, headSignatures }) =>
  classify(name, baseSignatures, headSignatures),
)
const fieldChanges = findFieldChanges(
  baseExports,
  headExports,
  baseDeclarations.referencedDependencyFields,
  headDeclarations.referencedDependencyFields,
)
const brandFactories = findNewBrandFactories(
  baseExports,
  headExports,
  headDeclarations.availableBrandFactories,
)
const generatedSection = renderTables({
  baseRef: argumentsByName.baseRef,
  headRef: argumentsByName.headRef,
  changedByCategory: groupedChanges,
  addedExports,
  removedExports,
  fieldChanges,
  brandFactories,
})
writeGeneratedSection(generatedSection)

console.log(
  `Generated consumer migration signatures: ${changedExports.length} changed, ${addedExports.length} added, ${removedExports.length} removed.`,
)
const changedExportTypes = new Set(
  fieldChanges.filter(({ provider }) => provider === packageName).map(({ exportName }) => exportName),
).size
const changedDependencyTypes = new Set(
  fieldChanges
    .filter(({ provider }) => provider !== packageName)
    .map(({ provider, exportName }) => `${provider}\0${exportName}`),
).size
console.log(
  `  fields: ${fieldChanges.length} changes across ${changedExportTypes} mc-noise exported types and ${changedDependencyTypes} referenced mc-kernel ${changedDependencyTypes === 1 ? 'type' : 'types'}; new brands: ${brandFactories.length}`,
)
for (const category of ['seed', 'coordinates', 'result', 'other']) {
  console.log(`  ${category}: ${groupedChanges.get(category)?.length ?? 0} changed`)
}
