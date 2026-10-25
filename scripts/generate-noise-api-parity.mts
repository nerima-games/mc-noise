import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  NOISE_API_PARITY_BASELINE,
  captureNoiseApiParitySamples,
} from '../test/noise-api-parity-support.js'

const baselineArgument = '--baseline-dir',
 baselineIndex = process.argv.indexOf(baselineArgument),
 baselineDirectoryArgument = process.argv[baselineIndex + 1]

if (baselineIndex < 0 || typeof baselineDirectoryArgument !== 'string') {
  throw new Error(`usage: pnpm exec tsx scripts/generate-noise-api-parity.mts ${baselineArgument} <jj-workspace>`)
}

const baselineDirectory = resolve(baselineDirectoryArgument),
 baselineCommit = execFileSync(
  'jj',
  ['-R', baselineDirectory, 'log', '-r', '@-', '--no-graph', '-T', 'commit_id'],
  { encoding: 'utf8' },
).trim()

if (baselineCommit !== NOISE_API_PARITY_BASELINE) {
  throw new Error(
    `baseline workspace parent must be ${NOISE_API_PARITY_BASELINE}, received ${baselineCommit}`,
  )
}

const baselineApi: object = await import(
  pathToFileURL(resolve(baselineDirectory, 'src/index.ts')).href
),
 fixture = {
  baselineCommit,
  samples: captureNoiseApiParitySamples(baselineApi),
  schemaVersion: 1,
}

if (fixture.samples.length !== 39) {
  throw new Error(`expected 39 parity samples, received ${fixture.samples.length}`)
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
 fixturePath = resolve(repositoryRoot, 'test/fixtures/noise-api-parity.json')
writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`)
process.stdout.write(`wrote ${fixture.samples.length} samples from ${baselineCommit}\n`)
