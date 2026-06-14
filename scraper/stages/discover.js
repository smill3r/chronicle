/**
 * Stage 1 — Discovery
 *
 * Finds all "Timeline of…" Wikipedia article titles using two strategies:
 *   A) Title search with intitle:"Timeline of"
 *   B) Category walk from Category:Timelines_by_topic
 *
 * Results are deduped and written to the CrawlQueue collection with
 * status "pending". Hub pages (index pages that link to sub-articles)
 * are flagged and their sub-articles enqueued instead.
 *
 * Safe to re-run — existing titles are not overwritten.
 */

import { searchTitles, getCategoryMembers, fetchPage, isHubPage, extractHubLinks } from '../utils/wikipedia.js'
import { CrawlQueue } from '../models/index.js'

export async function discover({ seedOnly = false } = {}) {
  console.log('\n── Stage 1: Discovery ─────────────────────────────────────')

  let titles = []

  if (seedOnly) {
    // Fast path for testing — import seed list from config
    const { default: config } = await import('../config.js')
    titles = config.seedTitles
    console.log(`  Using ${titles.length} seed titles.`)
  } else {
    // Strategy A: title search
    console.log('  Searching for titles containing "Timeline of"…')
    const searchResults = await searchTitles('intitle:"Timeline of"')
    console.log(`  → Found ${searchResults.length} titles via search.`)

    // Strategy B: category walk
    console.log('  Walking Category:Timelines_by_topic…')
    const categoryResults = await getCategoryMembers('Category:Timelines_by_topic')
    console.log(`  → Found ${categoryResults.length} titles via category.`)

    // Merge and deduplicate
    titles = [...new Set([...searchResults, ...categoryResults])]
    console.log(`  → ${titles.length} unique titles after dedup.`)
  }

  // Write to crawl queue, skipping titles that already exist
  let added = 0
  let skipped = 0
  let hubsExpanded = 0

  for (const title of titles) {
    const exists = await CrawlQueue.exists({ title })
    if (exists) { skipped++; continue }

    // Detect hub pages by fetching a quick preview
    let type = 'article'
    let subTitles = []
    try {
      const { wikitext } = await fetchPage(title)
      if (isHubPage(wikitext)) {
        type = 'hub'
        subTitles = extractHubLinks(wikitext)
        hubsExpanded++
        console.log(`  ↳ Hub detected: "${title}" → ${subTitles.length} sub-articles`)
      }
    } catch (err) {
      console.warn(`  ⚠ Could not check "${title}" for hub: ${err.message}`)
    }

    if (type === 'hub') {
      // Save the hub itself as skipped, enqueue sub-articles
      await CrawlQueue.create({ title, type: 'hub', status: 'skipped' })
      for (const sub of subTitles) {
        const subExists = await CrawlQueue.exists({ title: sub })
        if (!subExists) {
          await CrawlQueue.create({ title: sub, type: 'article', discoveredFrom: title })
          added++
        }
      }
    } else {
      await CrawlQueue.create({ title, type: 'article' })
      added++
    }
  }

  const total = await CrawlQueue.countDocuments({ status: 'pending' })
  console.log(`  ✓ Discovery complete.`)
  console.log(`    Added: ${added} | Already queued: ${skipped} | Hubs expanded: ${hubsExpanded}`)
  console.log(`    Total pending: ${total}`)
}
