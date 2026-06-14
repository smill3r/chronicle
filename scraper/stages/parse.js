/**
 * Stage 3 — Parse
 *
 * Reads each cached wikitext and extracts raw event lines with their
 * heading context. Primary path uses wtf_wikipedia; falls back to
 * cheerio over the rendered HTML when too few lines are found.
 *
 * Also runs a quick date regex pre-pass to capture obvious inline
 * dates before sending lines to Ollama in Stage 4.
 *
 * Output: ParsedLine documents with status "pending_normalization".
 */

import wtf from 'wtf_wikipedia'
import * as cheerio from 'cheerio'
import { fetchPageHtml } from '../utils/wikipedia.js'
import { CrawlQueue, CrawlCache, ParsedLine } from '../models/index.js'

// Minimum number of lines a primary parse must yield before we fall back to cheerio
const MIN_LINES_THRESHOLD = 3

// Regex to detect obvious inline dates at the start of a bullet line.
// Captures: "3200 BC:", "c. 476 AD –", "1939:", "300–250 BC:"
const DATE_RE = /^(c\.\s*)?(-?\d{1,4})(\s*[–\-]\s*\d{1,4})?\s*(BC|BCE|AD|CE)?[:\-–]/i

/**
 * Parse a year and era out of a date string matched by DATE_RE.
 * Returns { inferredYear: number, inferredEra: "BC"|"AD"|null } or null.
 */
function extractInlineDate(line) {
  const match = line.match(DATE_RE)
  if (!match) return null

  const rawYear = parseInt(match[2], 10)
  const era = (match[4] ?? '').toUpperCase()

  const isBc = era === 'BC' || era === 'BCE'
  const inferredYear = isBc ? -Math.abs(rawYear) : rawYear
  const inferredEra = isBc ? 'BC' : 'AD'

  return { inferredYear, inferredEra }
}

/**
 * Primary parse path using wtf_wikipedia.
 * Returns an array of { headingContext, rawLine } objects.
 */
function parseWithWtf(wikitext, sections) {
  const doc = wtf(wikitext)
  const lines = []

  // Use the section index from the API to map section indices to heading text.
  // wtf_wikipedia section indices don't always align with the API's, so we
  // use the API sections array as a lookup by title.
  const sectionTitleMap = Object.fromEntries(
    (sections ?? []).map((s) => [s.line?.trim(), s.line?.trim()])
  )

  for (const section of doc.sections()) {
    const headingContext = section.title()?.trim() ?? ''

    for (const list of section.lists()) {
      for (const item of list.lines()) {
        const rawLine = item.text()?.trim()
        if (rawLine && rawLine.length > 10) {
          const links = item.links?.() ?? []
          const primaryLink = links[0]?.page?.()?.trim() ?? null
          lines.push({ headingContext, rawLine, primaryLink })
        }
      }
    }
  }

  return lines
}

/**
 * Fallback parse path using cheerio over rendered HTML.
 * Returns an array of { headingContext, rawLine } objects.
 */
function parseWithCheerio(html) {
  const $ = cheerio.load(html)
  const lines = []
  let currentHeading = ''

  // Remove noise elements before extracting text
  $('.mw-editsection, sup.reference, .navbox, .infobox, .sidebar').remove()

  $('.mw-parser-output').children().each((_, el) => {
    const tag = el.tagName?.toLowerCase()

    // Track the current section heading
    if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
      currentHeading = $(el).text().replace(/\[edit\]/gi, '').trim()
      return
    }

    // Extract list items — ul/ol/dl all appear in Wikipedia timeline articles
    if (tag === 'ul' || tag === 'ol') {
      $(el).find('> li').each((_, li) => {
        $(li).find('sup').remove()
        const rawLine = $(li).text().trim()
        if (rawLine && rawLine.length > 10) {
          lines.push({ headingContext: currentHeading, rawLine })
        }
      })
    }

    // Definition lists: <dt> carries the date, <dd> carries the event text.
    // Combine them so the date context isn't lost.
    if (tag === 'dl') {
      let dtText = ''
      $(el).children().each((_, child) => {
        const childTag = child.tagName?.toLowerCase()
        $(child).find('sup').remove()
        if (childTag === 'dt') {
          dtText = $(child).text().trim()
        } else if (childTag === 'dd') {
          const ddText = $(child).text().trim()
          if (ddText && ddText.length > 10) {
            const rawLine = dtText ? `${dtText}: ${ddText}` : ddText
            lines.push({ headingContext: currentHeading, rawLine })
          }
        }
      })
    }

    // Wikitable rows — many timeline articles use | date | event | format
    // instead of bullet lists. First cell is treated as the date prefix.
    if (tag === 'table' && $(el).is('.wikitable')) {
      $(el).find('> tbody > tr, > tr').each((_, tr) => {
        $(tr).find('sup').remove()

        const tds = $(tr).find('> td')
        if (tds.length === 0) return  // all-<th> header row — skip

        // Some tables use <th scope="row"> for the year column
        const rowTh = $(tr).find('> th[scope="row"]')
        let dateText = ''
        const eventParts = []

        if (rowTh.length > 0) {
          dateText = rowTh.first().text().trim()
          tds.each((_, td) => {
            const text = $(td).text().trim()
            if (text) eventParts.push(text)
          })
        } else {
          tds.each((i, td) => {
            const text = $(td).text().trim()
            if (i === 0) {
              dateText = text
            } else if (text) {
              eventParts.push(text)
            }
          })
        }

        const eventText = eventParts.join(' ')
        if (!eventText || eventText.length <= 10) return
        const rawLine = dateText ? `${dateText}: ${eventText}` : eventText
        lines.push({ headingContext: currentHeading, rawLine })
      })
    }
  })

  return lines
}

export async function parse() {
  console.log('\n── Stage 3: Parse ──────────────────────────────────────────')

  const fetched = await CrawlQueue.find({ status: 'fetched', type: 'article' }).lean()
  console.log(`  ${fetched.length} articles to parse.`)

  let parsed = 0
  let usedFallback = 0
  let errors = 0

  for (const item of fetched) {
    const { title } = item

    try {
      const cache = await CrawlCache.findOne({ title }).lean()
      if (!cache) throw new Error('No cache entry found')

      // Detect redirect pages early — they produce no useful content
      if (/^#redirect\s*\[\[/i.test(cache.wikitext.trim())) {
        const target = (cache.wikitext.match(/\[\[([^\]]+)\]\]/) ?? [])[1] ?? '?'
        console.warn(`  ↳ "${title}" is a redirect → [[${target}]]. Marking skipped.`)
        await CrawlQueue.updateOne({ title }, { $set: { status: 'skipped', error: `redirect:${target}` } })
        continue
      }

      // Primary path
      let lines = parseWithWtf(cache.wikitext, cache.sections)
      let usingFallback = false

      // Fallback to cheerio if primary yields too few lines
      if (lines.length < MIN_LINES_THRESHOLD) {
        console.log(`  ↳ wtf yielded ${lines.length} lines for "${title}", fetching HTML fallback…`)

        let html = cache.html
        if (!html) {
          html = await fetchPageHtml(title)
          // Cache the HTML too
          await CrawlCache.updateOne({ title }, { $set: { html } })
        }

        lines = parseWithCheerio(html)
        usingFallback = true
        usedFallback++
      }

      if (lines.length === 0) {
        console.warn(`  ⚠ No lines extracted from "${title}" (even after fallback). Marking skipped.`)
        await CrawlQueue.updateOne({ title }, { $set: { status: 'skipped' } })
        continue
      }

      // Date pre-pass + upsert to ParsedLine
      let upserted = 0
      for (const { headingContext, rawLine, primaryLink = null } of lines) {
        const dateInfo = extractInlineDate(rawLine)

        await ParsedLine.updateOne(
          { sourceTitle: title, rawLine },
          {
            $set: {
              sourceTitle: title,
              headingContext,
              rawLine,
              primaryLink,
              inferredYear: dateInfo?.inferredYear ?? null,
              inferredEra: dateInfo?.inferredEra ?? null,
              status: 'pending_normalization',
            },
          },
          { upsert: true }
        )
        upserted++
      }

      await CrawlQueue.updateOne({ title }, { $set: { status: 'parsed', error: null } })
      parsed++
      console.log(
        `  ✓ [${parsed}/${fetched.length}] "${title}" → ${upserted} lines` +
        (usingFallback ? ' (cheerio fallback)' : '')
      )

    } catch (err) {
      errors++
      console.error(`  ✗ Failed to parse "${title}": ${err.message}`)
      await CrawlQueue.updateOne({ title }, { $set: { status: 'failed', error: err.message } })
    }
  }

  const totalPending = await ParsedLine.countDocuments({ status: 'pending_normalization' })
  console.log(`\n  ✓ Parse complete.`)
  console.log(`    Articles: ${parsed} parsed | ${usedFallback} used cheerio fallback | ${errors} errors`)
  console.log(`    Lines pending normalization: ${totalPending}`)
}
