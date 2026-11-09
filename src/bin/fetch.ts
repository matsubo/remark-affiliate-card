#!/usr/bin/env node
// affiliate-card fetch — refreshes a site's amazon-products.json.
//
// Scans the posts for ASINs, asks the Creators API about the ones that are new
// or stale, and writes the result back. Entries it cannot refresh are kept as
// they were: a delisted product should keep rendering the name captured when it
// still existed.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractAsinsFromPosts } from '../creators/asins.js'
import { createClient } from '../creators/client.js'
import { loadConfig } from '../creators/config.js'
import type { CreatorsProduct } from '../creators/parse.js'
import { DEFAULT_MAX_AGE_DAYS, syncProducts } from '../creators/sync.js'
import { createTokenManager } from '../creators/token.js'

interface Options {
  postsDir: string
  outFile: string
  force: boolean
  maxAgeDays: number
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    postsDir: 'src/content/posts',
    outFile: 'src/data/amazon-products.json',
    force: false,
    maxAgeDays: DEFAULT_MAX_AGE_DAYS,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--force') options.force = true
    else if (arg === '--posts') options.postsDir = argv[++i] ?? options.postsDir
    else if (arg === '--out') options.outFile = argv[++i] ?? options.outFile
    else if (arg === '--max-age') {
      const value = argv[++i]
      const days = Number(value)
      // Number('') is 0 and Number(undefined) is NaN; both would silently mean
      // "refetch everything" or "never refetch", so neither is accepted.
      if (!value || !Number.isFinite(days) || days <= 0) {
        console.error(`--max-age needs a positive number of days, got ${value ?? 'nothing'}`)
        process.exit(1)
      }
      options.maxAgeDays = days
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'Usage: affiliate-card fetch [options]',
          '',
          '  --posts <dir>     posts to scan   (default src/content/posts)',
          '  --out <file>      product file    (default src/data/amazon-products.json)',
          `  --max-age <days>  refetch entries older than this (default ${DEFAULT_MAX_AGE_DAYS})`,
          '  --force           refetch everything, ignoring cache freshness',
          '',
          'Credentials come from .env or the environment:',
          '  AMAZON_CREATOR_CREDENTIAL_ID, AMAZON_CREATOR_SECRET, AMAZON_AFFILIATE_TAG',
        ].join('\n'),
      )
      process.exit(0)
    }
  }

  return options
}

/**
 * Minimal .env reader.
 *
 * Deliberately not a dependency: this needs `KEY=value` and nothing more, and
 * real environment variables must win so CI secrets override a stray local file.
 */
function readDotEnv(path: string): Record<string, string> {
  const values: Record<string, string> = {}
  let text: string
  try {
    text = readFileSync(path, 'utf-8')
  } catch {
    return values
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const raw = trimmed.slice(eq + 1).trim()
    values[key] = raw.replace(/^["'](.*)["']$/, '$1')
  }
  return values
}

function readJson(path: string): Record<string, CreatorsProduct> {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, CreatorsProduct>
  } catch {
    return {}
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== 'fetch')
  const options = parseArgs(args)
  const root = process.cwd()

  const env = { ...readDotEnv(resolve(root, '.env')), ...process.env }
  const config = loadConfig(env)

  const postsDir = resolve(root, options.postsDir)
  const outFile = resolve(root, options.outFile)

  const asins = extractAsinsFromPosts(postsDir)
  console.log(`Found ${asins.length} unique ASINs in ${options.postsDir}`)

  const existing = readJson(outFile)

  const result = await syncProducts({
    asins,
    existing,
    client: createClient(config, {
      tokenManager: createTokenManager(config),
      retry: {
        onRetry: ({ status, waitMs }) =>
          console.log(`  rate limited (HTTP ${status}); retrying in ${waitMs / 1000}s`),
      },
    }),
    partnerTag: config.partnerTag,
    force: options.force,
    maxAgeDays: options.maxAgeDays,
    log: (message) => console.log(message),
  })

  // Stable key order keeps the committed diff to the entries that changed.
  const ordered: Record<string, CreatorsProduct> = {}
  for (const key of Object.keys(result.products).sort()) {
    ordered[key] = result.products[key]!
  }
  writeFileSync(outFile, `${JSON.stringify(ordered, null, 2)}\n`, 'utf-8')

  console.log(
    `Done. Cached: ${result.cached}, Fetched: ${result.fetched}, Unresolved: ${result.missing.length}`,
  )
  if (result.missing.length > 0) {
    console.log('Unresolved ASINs keep whatever was captured before, or a plain affiliate link.')
  }

  if (result.systemicFailure) {
    console.error('\nEvery batch failed — check the credentials and connectivity.')
    process.exit(1)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
