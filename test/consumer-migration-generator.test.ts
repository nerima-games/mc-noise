import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const copyCheckProject = (destinationRoot: string) => {
  const paths = [
    'docs/consumer-migration.md',
    'package.json',
    'scripts/generate-consumer-migration.mjs',
    'src',
    'test/fixtures/consumer-migration/api-model.json',
    'tsconfig.base.json',
    'tsconfig.release.json',
  ]

  for (const path of paths) {
    const destination = resolve(destinationRoot, path)
    mkdirSync(dirname(destination), { recursive: true })
    cpSync(resolve(projectRoot, path), destination, { recursive: true })
  }
  symlinkSync(resolve(projectRoot, 'node_modules'), resolve(destinationRoot, 'node_modules'), 'dir')
}

const runCheck = (root: string) =>
  spawnSync(process.execPath, [resolve(root, 'scripts/generate-consumer-migration.mjs'), '--check'], {
    cwd: root,
    encoding: 'utf8',
  })

describe('consumer migration generator check', () => {
  it(
    'checks snapshots and declarations without Git refs',
    () => {
      const isolatedRoot = mkdtempSync(resolve(tmpdir(), 'mc-noise-consumer-check-'))
      try {
        copyCheckProject(isolatedRoot)
        expect(existsSync(resolve(isolatedRoot, '.git'))).toBe(false)

        const initialCheck = runCheck(isolatedRoot)
        expect(initialCheck.error).toBeUndefined()
        expect(initialCheck.status).toBe(0)
        expect(initialCheck.stdout).toContain('Consumer migration docs are current')

        const snapshotPath = resolve(
          isolatedRoot,
          'test/fixtures/consumer-migration/api-model.json',
        )
        const validSnapshot = readFileSync(snapshotPath, 'utf8')
        const invalidSnapshot = JSON.parse(validSnapshot)
        invalidSnapshot.base.apiDigestWords[0] += 1
        writeFileSync(snapshotPath, `${JSON.stringify(invalidSnapshot, null, 2)}\n`)

        const invalidSnapshotCheck = runCheck(isolatedRoot)
        expect(invalidSnapshotCheck.error).toBeUndefined()
        expect(invalidSnapshotCheck.status).not.toBe(0)
        expect(invalidSnapshotCheck.stderr).toContain('Base API model checksum does not match')
        writeFileSync(snapshotPath, validSnapshot)

        const entrypoint = resolve(isolatedRoot, 'src/index.ts')
        const source = readFileSync(entrypoint, 'utf8')
        writeFileSync(
          entrypoint,
          `${source}\nexport type ConsumerMigrationCheckProbe = string\n`,
        )

        const changedDeclarationCheck = runCheck(isolatedRoot)
        expect(changedDeclarationCheck.error).toBeUndefined()
        expect(changedDeclarationCheck.status).not.toBe(0)
        expect(changedDeclarationCheck.stderr).toContain(
          'Current public declarations differ from the recorded candidate API model',
        )
      } finally {
        rmSync(isolatedRoot, { recursive: true, force: true })
      }
    },
    20_000,
  )

  it(
    'rejects stale generated documentation tables',
    () => {
      const isolatedRoot = mkdtempSync(resolve(tmpdir(), 'mc-noise-consumer-doc-check-'))
      try {
        copyCheckProject(isolatedRoot)

        const documentPath = resolve(isolatedRoot, 'docs/consumer-migration.md')
        const document = readFileSync(documentPath, 'utf8')
        const beginMarker = '<!-- BEGIN GENERATED SIGNATURE TABLES -->'
        const endMarker = '<!-- END GENERATED SIGNATURE TABLES -->'
        const beginIndex = document.indexOf(beginMarker)
        const endIndex = document.indexOf(endMarker)
        expect(beginIndex).toBeGreaterThanOrEqual(0)
        expect(endIndex).toBeGreaterThan(beginIndex)

        const staleDocument = [
          document.slice(0, beginIndex + beginMarker.length),
          '',
          'Stale generated tables.',
          '',
          document.slice(endIndex),
        ].join('\n')
        writeFileSync(documentPath, staleDocument)

        const staleDocumentationCheck = runCheck(isolatedRoot)
        expect(staleDocumentationCheck.error).toBeUndefined()
        expect(staleDocumentationCheck.status).not.toBe(0)
        expect(staleDocumentationCheck.stderr).toContain('Generated signature tables')
        expect(staleDocumentationCheck.stderr).toContain(
          'are stale; run the documented generation command',
        )
      } finally {
        rmSync(isolatedRoot, { recursive: true, force: true })
      }
    },
    20_000,
  )
})
