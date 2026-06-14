/**
 * Stage 2 — Fetch & Cache
 *
 * Downloads wikitext for every "pending" title in the CrawlQueue
 * and stores it in CrawlCache. Skips titles whose cache entry is
 * still fresh (within config.wikipedia.cacheMaxAgeDays).
 *
 * Serial requests (p-limit(1)) with a delay to respect Wikipedia's
 * rate limits. Updates CrawlQueue status on success or failure.
 */

import pLimit from 'p-limit'
import config from '../config.js'
import { fetchPage } from '../utils/wikipedia.js'
import { CrawlQueue, CrawlCache } from '../models/index.js'

const { cacheMaxAgeDays } = config.wikipedia

export async function fetch() {
  console.log('\n── Stage 2: Fetch & Cache ──────────────────────────────────')

  const pending = await CrawlQueue.find({ status: 'pending', type: 'article' }).lean()
  console.log(`  ${pending.length} articles to fetch.`)

  // Serial — one request at a time to stay within Wikipedia's rate limits
  const limit = pLimit(1)
  let fetched = 0
  let cacheHits = 0
  let errors = 0

  await Promise.all(
    pending.map((item) =>
      limit(async () => {
        const { title } = item

        // Check cache freshness
        const cutoff = new Date(Date.now() - cacheMaxAgeDays * 86_400_000)
        const cached = await CrawlCache.findOne({ title, fetchedAt: { $gt: cutoff } })
        if (cached) {
          cacheHits++
          await CrawlQueue.updateOne({ title }, { $set: { status: 'fetched' } })
          return
        }

        try {
          const { wikitext, sections } = await fetchPage(title)

          if (!wikitext) {
            throw new Error('Empty wikitext returned')
          }

          await CrawlCache.findOneAndUpdate(
            { title },
            { title, wikitext, sections, fetchedAt: new Date() },
            { upsert: true, new: true }
          )

          await CrawlQueue.updateOne({ title }, { $set: { status: 'fetched', error: null } })
          fetched++
          process.stdout.write(`  ✓ [${fetched + cacheHits}/${pending.length}] ${title}\n`)

        } catch (err) {
          errors++
          console.error(`  ✗ Failed to fetch "${title}": ${err.message}`)
          await CrawlQueue.updateOne(
            { title },
            { $set: { status: 'failed', error: err.message } }
          )
        }
      })
    )
  )

  console.log(`\n  ✓ Fetch complete.`)
  console.log(`    Fetched: ${fetched} | Cache hits: ${cacheHits} | Errors: ${errors}`)
}
