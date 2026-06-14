/**
 * Stage 4 — Normalize with Ollama
 *
 * Sends batches of parsed event lines to a local Ollama model, which
 * returns structured JSON matching the Event schema. Results are
 * validated with Zod and upserted into MongoDB.
 *
 * Lines that fail validation are retried once with a smaller batch.
 * Persistent failures are logged to the ParsedLine document for review.
 *
 * Runs with p-limit(config.ollama.concurrency) — keep this at 1–2 to
 * avoid overwhelming your local Ollama instance.
 */

import { Ollama } from 'ollama'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import pLimit from 'p-limit'
import config from '../config.js'
import { SYSTEM_PROMPT, buildUserMessage, CATEGORIES } from '../prompts/extractEvents.js'
import { CrawlQueue, ParsedLine, Event, Timeline, titleToSlug } from '../models/index.js'

// ─── Zod schema ───────────────────────────────────────────────────────────────

const EventSchema = z.object({
  year: z.number().int(),
  yearDisplay: z.string().min(1),
  datePrecision: z.enum(['year', 'month', 'day', 'circa', 'range', 'unknown']),
  title: z.string().min(1),
  description: z.string().default(''),
  category: z.array(z.enum(CATEGORIES)).default([]),
  location: z.array(z.string()).default([]),
  wikiLink: z.string().default(''),
})

const BatchSchema = z.object({
  events: z.array(EventSchema),
})

// ─── Ollama client ────────────────────────────────────────────────────────────

const ollama = new Ollama({ host: config.ollama.host })
const CHUNK_SIZE = 15 // event lines per Ollama request
const OLLAMA_TIMEOUT_MS = 90_000 // abort if Ollama doesn't respond within 90s

// ─── Core normalization call ──────────────────────────────────────────────────

/**
 * Send a batch of parsed lines to Ollama and return validated Event objects.
 * Throws if parsing or validation fails (caller handles retry).
 */
async function callOllama(lines) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Ollama timed out after ${OLLAMA_TIMEOUT_MS / 1000}s`)), OLLAMA_TIMEOUT_MS)
  )
  const response = await Promise.race([
    ollama.chat({
      model: config.ollama.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(lines) },
      ],
      format: zodToJsonSchema(BatchSchema),
      options: {
        temperature: config.ollama.temperature,
      },
      keep_alive: config.ollama.keepAlive,
    }),
    timeout,
  ])

  const raw = response.message?.content ?? ''

  // Strip markdown fences if the model emits them despite instructions
  const cleaned = raw.replace(/```json|```/g, '').trim()

  const parsed = JSON.parse(cleaned)
  const events = BatchSchema.parse(parsed).events

  // Fix year sign errors: Ollama sometimes encodes AD years as negative.
  // If yearDisplay contains no BC/BCE indicator but year is negative, flip it.
  return events.map((ev) => {
    if (ev.year < 0 && !/BC|BCE/i.test(ev.yearDisplay)) {
      return { ...ev, year: -ev.year }
    }
    return ev
  })
}

/**
 * Normalize a single chunk of lines, with one retry on failure.
 * Falls back to sending lines one at a time if the full chunk fails.
 */
function enrichWithPrimaryLinks(events, lines) {
  // Positionally match Ollama's output events back to input lines to apply
  // the wikitext-extracted primaryLink where Ollama left wikiLink empty.
  // Positional match isn't guaranteed to be perfect but is good enough as a
  // best-effort improvement over Ollama's guesses.
  return events.map((ev, i) => ({
    ...ev,
    wikiLink: ev.wikiLink || lines[i]?.primaryLink || '',
  }))
}

async function normalizeChunk(lines, sourceTitle) {
  // First attempt: full chunk
  try {
    const events = await callOllama(lines)
    return enrichWithPrimaryLinks(events, lines)
  } catch (err) {
    console.warn(`  ⚠ Chunk failed for "${sourceTitle}": ${err.message}. Retrying one-by-one…`)
  }

  // Retry: one line at a time so we salvage as many events as possible
  const results = []
  for (const line of lines) {
    try {
      const events = await callOllama([line])
      results.push(...enrichWithPrimaryLinks(events, [line]))
    } catch (err) {
      console.warn(`    ✗ Single-line retry failed: "${line.rawLine.slice(0, 60)}…"`)
      // Mark this line as failed in MongoDB so it's visible for review
      await ParsedLine.updateOne(
        { sourceTitle, rawLine: line.rawLine },
        { $set: { status: 'failed' } }
      )
    }
  }
  return results
}

// ─── Upsert helpers ───────────────────────────────────────────────────────────

function titleToWikiUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

async function upsertEvents(events, sourceTitle) {
  let saved = 0
  for (const ev of events) {
    try {
      await Event.updateOne(
        { sourceArticle: sourceTitle, title: ev.title, year: ev.year },
        {
          $set: {
            ...ev,
            sourceArticle: sourceTitle,
            sourceUrl: titleToWikiUrl(sourceTitle),
            scrapedAt: new Date(),
          },
        },
        { upsert: true }
      )
      saved++
    } catch (err) {
      // Duplicate key errors from the unique index are expected on re-runs — ignore them
      if (err.code !== 11000) {
        console.warn(`    ⚠ Upsert error for event "${ev.title}": ${err.message}`)
      }
    }
  }
  return saved
}

// ─── Timeline builder ─────────────────────────────────────────────────────────

async function buildTimelines() {
  const rows = await Event.aggregate([
    {
      $group: {
        _id: '$sourceArticle',
        eventCount: { $sum: 1 },
        // Exclude year=0 (unknown) from the range — they'd collapse the span to 0
        yearStart: { $min: { $cond: [{ $eq: ['$year', 0] }, null, '$year'] } },
        yearEnd: { $max: { $cond: [{ $eq: ['$year', 0] }, null, '$year'] } },
        sourceUrl: { $first: '$sourceUrl' },
        allCategories: { $push: '$category' },
      },
    },
    {
      $project: {
        eventCount: 1,
        yearStart: 1,
        yearEnd: 1,
        sourceUrl: 1,
        categories: {
          $reduce: {
            input: '$allCategories',
            initialValue: [],
            in: { $setUnion: ['$$value', '$$this'] },
          },
        },
      },
    },
  ])

  for (const row of rows) {
    const title = row._id
    await Timeline.findOneAndUpdate(
      { title },
      {
        title,
        slug: titleToSlug(title),
        eventCount: row.eventCount,
        yearStart: row.yearStart,
        yearEnd: row.yearEnd,
        categories: row.categories.sort(),
        sourceUrl: row.sourceUrl,
      },
      { upsert: true, new: true }
    )
  }

  console.log(`  ✓ Timeline index rebuilt: ${rows.length} timelines.`)
}

// ─── Main stage function ──────────────────────────────────────────────────────

export async function normalize() {
  console.log('\n── Stage 4: Normalize (Ollama) ─────────────────────────────')

  // Group pending lines by source article
  const pending = await ParsedLine.find({ status: 'pending_normalization' }).lean()
  console.log(`  ${pending.length} lines pending normalization.`)

  if (pending.length === 0) {
    console.log('  Nothing to do.')
    return
  }

  // Group by source title
  const byTitle = pending.reduce((acc, line) => {
    ;(acc[line.sourceTitle] ??= []).push(line)
    return acc
  }, {})

  const titles = Object.keys(byTitle)
  console.log(`  Across ${titles.length} source articles.`)

  const limit = pLimit(config.ollama.concurrency)
  let totalSaved = 0
  let totalFailed = 0
  let articlesProcessed = 0

  await Promise.all(
    titles.map((sourceTitle, titleIdx) =>
      limit(async () => {
        const lines = byTitle[sourceTitle]

        // Split lines into chunks of CHUNK_SIZE
        const chunks = []
        for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
          chunks.push(lines.slice(i, i + CHUNK_SIZE))
        }

        const articleStart = Date.now()
        console.log(`\n  [${titleIdx + 1}/${titles.length}] "${sourceTitle}" — ${lines.length} lines, ${chunks.length} batches`)

        let articleSaved = 0
        let articleFailed = 0
        let batchesDone = 0

        for (const chunk of chunks) {
          try {
            const events = await normalizeChunk(chunk, sourceTitle)
            const saved = await upsertEvents(events, sourceTitle)
            articleSaved += saved

            // Mark lines as normalized
            const rawLines = chunk.map((l) => l.rawLine)
            await ParsedLine.updateMany(
              { sourceTitle, rawLine: { $in: rawLines }, status: 'pending_normalization' },
              { $set: { status: 'normalized' } }
            )
          } catch (err) {
            articleFailed += chunk.length
            totalFailed += chunk.length
            console.error(`\n  ✗ Chunk error for "${sourceTitle}": ${err.message}`)
          }

          batchesDone++
          const pct = Math.round((batchesDone / chunks.length) * 100)
          const filled = Math.round(pct / 5)
          const bar = '█'.repeat(filled) + '░'.repeat(20 - filled)
          const secs = ((Date.now() - articleStart) / 1000).toFixed(0)
          process.stdout.write(`\r  [${bar}] ${String(pct).padStart(3)}%  batch ${batchesDone}/${chunks.length}  ${secs}s  `)

          if (config.ollama.delayBetweenChunksMs > 0) {
            await new Promise((r) => setTimeout(r, config.ollama.delayBetweenChunksMs))
          }
        }

        process.stdout.write('\n')
        totalSaved += articleSaved
        articlesProcessed++

        // Update crawl queue
        const allDone = await ParsedLine.countDocuments({
          sourceTitle,
          status: 'pending_normalization',
        })
        if (allDone === 0) {
          await CrawlQueue.updateOne({ title: sourceTitle }, { $set: { status: 'normalized' } })
        }

        const elapsed = ((Date.now() - articleStart) / 1000).toFixed(1)
        console.log(`  ✓ ${articleSaved} events saved in ${elapsed}s`)
      })
    )
  )

  const totalEvents = await Event.countDocuments()
  console.log(`\n  ✓ Normalization complete.`)
  console.log(`    Events saved: ${totalSaved} | Lines failed: ${totalFailed}`)
  console.log(`    Total events in DB: ${totalEvents}`)

  await buildTimelines()
}
