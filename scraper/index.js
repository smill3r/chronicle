/**
 * Chronicle Scraper — Entry Point
 *
 * Usage:
 *   node index.js                    # run all stages from the beginning
 *   node index.js discover           # run only Stage 1
 *   node index.js fetch              # run only Stage 2
 *   node index.js parse              # run only Stage 3
 *   node index.js normalize          # run only Stage 4
 *   node index.js fetch --seed-only  # fetch only the seed titles in config.js
 *   node index.js discover --dry-run # discover titles but don't write to DB
 *
 * Set MONGO_URI env variable to override the default MongoDB connection:
 *   MONGO_URI=mongodb://localhost:27017/chronicle node index.js
 */

import mongoose from 'mongoose'
import config from './config.js'
import { discover } from './stages/discover.js'
import { fetch } from './stages/fetch.js'
import { parse } from './stages/parse.js'
import { normalize } from './stages/normalize.js'

const STAGES = { discover, fetch, parse, normalize }
const STAGE_ORDER = ['discover', 'fetch', 'parse', 'normalize']

async function connect() {
  await mongoose.connect(config.mongo.uri)
  console.log(`  Connected to MongoDB: ${config.mongo.uri}`)
}

async function disconnect() {
  await mongoose.disconnect()
}

async function main() {
  const args = process.argv.slice(2)
  const startStage = args.find((a) => STAGE_ORDER.includes(a)) ?? 'discover'
  const seedOnly = args.includes('--seed-only')
  const dryRun = args.includes('--dry-run')

  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║              Chronicle — Wikipedia Scraper               ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`  Starting from stage: ${startStage}`)
  if (seedOnly) console.log('  Mode: seed-only (using config.seedTitles)')
  if (dryRun) console.log('  Mode: dry-run (no DB writes)')
  console.log()

  await connect()

  const startIndex = STAGE_ORDER.indexOf(startStage)
  const stagesToRun = STAGE_ORDER.slice(startIndex)

  for (const stageName of stagesToRun) {
    const fn = STAGES[stageName]
    const opts = {}
    if (stageName === 'discover' && seedOnly) opts.seedOnly = true
    if (dryRun) opts.dryRun = true

    try {
      await fn(opts)
    } catch (err) {
      console.error(`\n✗ Stage "${stageName}" threw an unhandled error:`)
      console.error(err)
      console.error('\nScraper stopped. Fix the error and re-run from this stage:')
      console.error(`  node index.js ${stageName}`)
      await disconnect()
      process.exit(1)
    }
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║                   All stages complete ✓                  ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  await disconnect()
}

main()
