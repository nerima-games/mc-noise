import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, 'package.json'))
const packageName = require(resolve(root, 'package.json')).name
const typescript = require('typescript')
const typescriptAst =
  typeof typescript.createProgram === 'function' ? undefined : require('typescript/unstable/ast')
const typeFlags =
  typescript.TypeFlags ?? require('typescript/unstable/sync').TypeFlags
const modelPath = resolve(root, 'test/fixtures/consumer-migration/api-model.json')
const generatedDocumentPath = resolve(root, 'docs/consumer-migration.md')
const trackedBuildInputs = [
  'src',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.npmrc',
  'tsconfig.base.json',
  'tsconfig.release.json',
]
const parseArguments = (args) => {
  if (args.length === 1 && args[0] === '--check') {
    return { check: true }
  }

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
    check: false,
    baseRef: values.get('--base-ref'),
    headRef: values.get('--head-ref'),
    baseDts: values.get('--base-dts'),
    headDts: values.get('--head-dts'),
  }
}

const resolveRef = (ref) => {
  const resolvedRef = execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
  if (!/^[\da-f]{40,64}$/iu.test(resolvedRef)) {
    throw new Error(`Could not resolve ${ref} to a commit`)
  }
  return resolvedRef
}

const listGitBuildInputs = (ref) =>
  execFileSync('git', ['ls-tree', '-r', '-z', '--name-only', ref, '--', ...trackedBuildInputs], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
    .sort()

const listDirectoryBuildInputs = (projectRoot) => {
  const files = []
  const visit = (directory, relativeDirectory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = resolve(directory, entry.name)
      const relativePath = `${relativeDirectory}/${entry.name}`
      if (entry.isDirectory()) {
        visit(absolutePath, relativePath)
      } else if (entry.isFile()) {
        files.push(relativePath)
      }
    }
  }
  visit(resolve(projectRoot, 'src'), 'src')
  for (const input of trackedBuildInputs.filter((path) => path !== 'src')) {
    try {
      statSync(resolve(projectRoot, input))
      files.push(input)
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error
      }
    }
  }
  return files.sort()
}

const buildInputFingerprint = (paths, readContent) => {
  const hash = createHash('sha256')
  for (const path of paths) {
    const content = readContent(path)
    let declarationRelevantContent = content
    if (path === 'package.json') {
      const { name, type, dependencies, devDependencies, peerDependencies, optionalDependencies, exports, types, typesVersions, imports } =
        JSON.parse(content.toString('utf8'))
      declarationRelevantContent = JSON.stringify({
        name,
        type,
        dependencies,
        devDependencies: { typescript: devDependencies?.typescript },
        peerDependencies,
        optionalDependencies,
        exports,
        types,
        typesVersions,
        imports,
      })
    }
    hash.update(path).update('\0').update(declarationRelevantContent).update('\0')
  }
  return hash.digest('hex')
}

const fingerprintGitBuildInputs = (ref) => {
  const paths = listGitBuildInputs(ref)
  const required = ['package.json', 'pnpm-lock.yaml', 'tsconfig.base.json', 'tsconfig.release.json']
  const missing = required.filter((path) => !paths.includes(path))
  if (missing.length > 0) {
    throw new Error(`Commit ${ref} is missing declaration build inputs: ${missing.join(', ')}`)
  }
  return buildInputFingerprint(paths, (path) =>
    execFileSync('git', ['show', `${ref}:${path}`], { cwd: root }),
  )
}

const fingerprintDirectoryBuildInputs = (projectRoot, ref) => {
  const expectedPaths = listGitBuildInputs(ref)
  const actualPaths = listDirectoryBuildInputs(projectRoot)
  const expectedSet = new Set(expectedPaths)
  const actualSet = new Set(actualPaths)
  const missing = expectedPaths.filter((path) => !actualSet.has(path))
  const extra = actualPaths.filter((path) => !expectedSet.has(path))
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Declaration input tree does not match ${ref}: missing [${missing.join(', ')}], extra [${extra.join(', ')}]`,
    )
  }
  const directoryFingerprint = buildInputFingerprint(expectedPaths, (path) =>
    readFileSync(resolve(projectRoot, path)),
  )
  const refFingerprint = fingerprintGitBuildInputs(ref)
  if (directoryFingerprint !== refFingerprint) {
    throw new Error(`Declaration inputs at ${projectRoot} do not match commit ${ref}`)
  }
  return directoryFingerprint
}

const findPackageRoot = (declarationPath) => {
  const absolutePath = resolve(declarationPath)
  if (absolutePath.endsWith('/dist/index.d.ts') === false) {
    throw new Error(`Expected a package dist/index.d.ts path: ${declarationPath}`)
  }
  let directory = dirname(dirname(absolutePath))
  while (directory !== dirname(directory)) {
    try {
      const candidate = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'))
      if (candidate.name === packageName) {
        return directory
      }
    } catch (error) {
      if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
        throw error
      }
    }
    directory = dirname(directory)
  }
  throw new Error(`Could not find ${packageName} package root for ${declarationPath}`)
}

const validateDeclarationInput = (ref, declarationPath, role) => {
  const resolvedRef = resolveRef(ref)
  const absolutePath = resolve(declarationPath)
  readFileSync(absolutePath)
  const projectRoot = findPackageRoot(absolutePath)
  const inputFingerprint = fingerprintDirectoryBuildInputs(projectRoot, resolvedRef)
  if (existsSync(resolve(projectRoot, '.git'))) {
    const checkoutRoot = execFileSync('git', ['-C', projectRoot, 'rev-parse', '--show-toplevel'], {
      cwd: root,
      encoding: 'utf8',
    }).trim()
    if (resolve(checkoutRoot) !== projectRoot) {
      throw new Error(`${role} declaration path is not at its git checkout root: ${absolutePath}`)
    }
    const checkoutRef = resolveRef(execFileSync('git', ['-C', projectRoot, 'rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim())
    if (checkoutRef !== resolvedRef) {
      throw new Error(`${role} declaration checkout is ${checkoutRef}, expected ${resolvedRef}`)
    }
  }
  return {
    ref: resolvedRef,
    dtsSha256: createHash('sha256').update(readFileSync(absolutePath)).digest('hex'),
    buildInputsSha256: inputFingerprint,
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

const serializeDeclarations = (declarations) => ({
  exports: [...declarations.exports.entries()],
  referencedDependencyFields: [...declarations.referencedDependencyFields.entries()],
  availableBrandFactories: [...declarations.availableBrandFactories].sort((left, right) =>
    left.name.localeCompare(right.name) || left.brandType.localeCompare(right.brandType),
  ),
})

const deserializeDeclarations = (serialized) => ({
  exports: new Map(serialized.exports),
  referencedDependencyFields: new Map(serialized.referencedDependencyFields),
  availableBrandFactories: serialized.availableBrandFactories,
})

const hashJson = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const hashJsonWords = (value) => hashJson(value).match(/.{8}/gu).map((word) => Number.parseInt(word, 16))

const readGeneratedSection = () => {
  const document = readFileSync(generatedDocumentPath, 'utf8')
  const begin = '<!-- BEGIN GENERATED SIGNATURE TABLES -->'
  const end = '<!-- END GENERATED SIGNATURE TABLES -->'
  const beginIndex = document.indexOf(begin)
  const endIndex = document.indexOf(end)
  if (
    beginIndex < 0 ||
    endIndex <= beginIndex ||
    document.indexOf(begin, beginIndex + begin.length) >= 0 ||
    document.indexOf(end, endIndex + end.length) >= 0
  ) {
    throw new Error(`Expected one ordered marker pair in ${generatedDocumentPath}`)
  }
  return document.slice(beginIndex + begin.length, endIndex).trim()
}

const createDeclarationsFromSource = () => {
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'mc-noise-consumer-migration-'))
  const outputDirectory = resolve(temporaryRoot, 'dist')
  mkdirSync(outputDirectory, { recursive: true })
  symlinkSync(resolve(root, 'node_modules'), resolve(temporaryRoot, 'node_modules'), 'dir')
  const entryPath = resolve(outputDirectory, 'index.d.ts')
  try {
    execFileSync(
      resolve(root, 'node_modules/.bin/tsc'),
      [
        '-p',
        resolve(root, 'tsconfig.release.json'),
        '--pretty',
        'false',
        '--emitDeclarationOnly',
        '--outDir',
        outputDirectory,
      ],
      { cwd: root, stdio: 'inherit' },
    )
    return readExports(entryPath)
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

const checkGeneratedSection = () => {
  const snapshot = JSON.parse(readFileSync(modelPath, 'utf8'))
  if (snapshot.format !== 1 || snapshot.package !== packageName) {
    throw new Error(`Unsupported consumer migration API model: ${modelPath}`)
  }
  if (
    JSON.stringify(hashJsonWords(snapshot.base.declarations)) !==
    JSON.stringify(snapshot.base.apiDigestWords)
  ) {
    throw new Error(`Base API model checksum does not match ${modelPath}`)
  }
  const baseDeclarations = deserializeDeclarations(snapshot.base.declarations)
  const currentDeclarations = createDeclarationsFromSource()
  const actualHead = serializeDeclarations(currentDeclarations)
  if (JSON.stringify(hashJsonWords(actualHead)) !== JSON.stringify(snapshot.head.apiDigestWords)) {
    throw new Error(
      `Current public declarations differ from the recorded candidate API model for ${snapshot.head.ref}; regenerate the migration tables and API model`,
    )
  }

  const changedExports = []
  const addedExports = []
  const removedExports = []
  for (const [name, baseExport] of baseDeclarations.exports) {
    const headExport = currentDeclarations.exports.get(name)
    if (headExport === undefined) {
      removedExports.push({ name, baseSignatures: baseExport.signatures })
    } else if (JSON.stringify(baseExport.signatures) !== JSON.stringify(headExport.signatures)) {
      changedExports.push({ name, baseSignatures: baseExport.signatures, headSignatures: headExport.signatures })
    }
  }
  for (const [name, headExport] of currentDeclarations.exports) {
    if (!baseDeclarations.exports.has(name)) {
      addedExports.push({ name, headSignatures: headExport.signatures })
    }
  }
  const changedByCategory = groupBy(changedExports, ({ name, baseSignatures, headSignatures }) =>
    classify(name, baseSignatures, headSignatures),
  )
  const fieldChanges = findFieldChanges(
    baseDeclarations.exports,
    currentDeclarations.exports,
    baseDeclarations.referencedDependencyFields,
    currentDeclarations.referencedDependencyFields,
  )
  const brandFactories = findNewBrandFactories(
    baseDeclarations.exports,
    currentDeclarations.exports,
    currentDeclarations.availableBrandFactories,
  )
  const generatedSection = renderTables({
    baseRef: snapshot.base.ref,
    headRef: snapshot.head.ref,
    changedByCategory,
    addedExports,
    removedExports,
    fieldChanges,
    brandFactories,
  })
  if (readGeneratedSection() !== generatedSection) {
    throw new Error(
      `Generated signature tables in ${generatedDocumentPath} are stale; run the documented generation command`,
    )
  }
  console.log(
    `Consumer migration docs are current for base ${snapshot.base.ref} and candidate ${snapshot.head.ref}.`,
  )
}

const writeModelSnapshot = (base, head) => {
  const snapshot = {
    format: 1,
    package: packageName,
    base: { ...base.metadata, apiDigestWords: hashJsonWords(base.declarations), declarations: base.declarations },
    head: { ...head.metadata, apiDigestWords: hashJsonWords(head.declarations) },
  }
  mkdirSync(dirname(modelPath), { recursive: true })
  writeFileSync(modelPath, `${JSON.stringify(snapshot, null, 2)}\n`)
}

const isVariableDeclaration = (node) => {
  if (typeof typescript.isVariableDeclaration === 'function') {
    return typescript.isVariableDeclaration(node)
  }
  return typescriptAst.formatSyntaxKind(node.kind) === 'VariableDeclaration'
}

const readPublicFields = (checker, symbol, project, symbolFlags, printNode, provider) => {
  const typeSymbolFlags = symbolFlags.TypeAlias | symbolFlags.Interface | symbolFlags.Class
  if ((symbol.flags & typeSymbolFlags) === 0) {
    return []
  }

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
      if (declaration === undefined) {
        return []
      }

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
    if (moduleSymbol !== undefined) {
      for (const exported of checker.getExportsOfModule(moduleSymbol)) {
        const target = exported.flags & symbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
        if ((target.flags & typeSymbolFlags) !== 0) {
          const name = typeof target.getName === 'function' ? target.getName() : target.name
          if (!publicDependencyTypes.has(target)) {
            const fields = readPublicFields(checker, target, project, symbolFlags, printNode, dependencyName)
            if (fields.length > 0) {
              publicDependencyTypes.set(target, { name, fields })
            }
          }
        }
      }
    }
  }

  const reachableSymbols = collectReferencedSymbols(publicDeclarations, checker, project)
  const fieldsByName = new Map()
  for (const [symbol, entry] of publicDependencyTypes) {
    if (reachableSymbols.has(symbol)) {
      fieldsByName.set(entry.name, entry.fields)
    }
  }
  return fieldsByName
}

const collectReferencedSymbols = (declarations, checker, project) => {
  const symbols = new Set()
  const visited = new Set()
  const visit = (node) => {
    if (node === undefined || node === null || visited.has(node)) {
      return
    }
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
  for (const candidate of declarations) {
    visit(resolveDeclaration(candidate, project))
  }
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
      if (condition.endsWith('.d.ts')) {
        entrypoints.push(condition)
      }
      return
    }
    if (condition === null || typeof condition !== 'object') {
      return
    }
    if (typeof condition.types === 'string') {
      visit(condition.types)
      return
    }
    for (const value of Object.values(condition)) {
      visit(value)
    }
  }
  for (const value of Object.values(exports ?? {})) {
    visit(value)
  }
  return uniqueSorted(entrypoints)
}

const getDeclarationPackageRoot = (filePath, targetPackageName) => {
  const normalized = normalizeFilePath(filePath)
  const packagePath = `/node_modules/${targetPackageName}/`
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
  if (variantCount < 2) {
    return ''
  }
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
  const match = signatures.join(' ').match(/\bBrand(?:\.Brand)?\.Constructor<(?<brandType>[A-Za-z_$][\w$]*)>/u)
  return match?.groups?.brandType
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
    if (provider === packageName || provider === '@nerima-games/mc-kernel') {
      const moduleSymbol = checker.getSymbolAtLocation(source)
      if (moduleSymbol !== undefined) {
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
          if (brandType !== undefined) {
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
      }
    }
  }

  return [...factories.values()]
}

const getDeclarationPackage = (filePath) => {
  const normalized = filePath.replaceAll('\\', '/')
  const nodeModulesIndex = normalized.lastIndexOf('/node_modules/')
  if (nodeModulesIndex < 0) {
    return packageName
  }
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
    `Compared declarations from the mc-noise 0.4.x base revision \`${escapeHtml(baseRef)}\` to the mc-noise 0.5.0 candidate revision \`${escapeHtml(headRef)}\`.`,
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
  if (field === undefined) {
    return 'Not present'
  }
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
if (argumentsByName.check) {
  checkGeneratedSection()
} else {
  const basePath = resolve(argumentsByName.baseDts)
  const headPath = resolve(argumentsByName.headDts)
  const baseMetadata = validateDeclarationInput(argumentsByName.baseRef, basePath, 'Base')
  const headMetadata = validateDeclarationInput(argumentsByName.headRef, headPath, 'Candidate')
  const baseDeclarations = readExports(basePath)
  const headDeclarations = readExports(headPath)
  const baseModel = serializeDeclarations(baseDeclarations)
  const headModel = serializeDeclarations(headDeclarations)
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

  const changedByCategory = groupBy(changedExports, ({ name, baseSignatures, headSignatures }) =>
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
    baseRef: baseMetadata.ref,
    headRef: headMetadata.ref,
    changedByCategory,
    addedExports,
    removedExports,
    fieldChanges,
    brandFactories,
  })
  writeModelSnapshot(
    { metadata: baseMetadata, declarations: baseModel },
    { metadata: headMetadata, declarations: headModel },
  )
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
    console.log(`  ${category}: ${changedByCategory.get(category)?.length ?? 0} changed`)
  }
}
