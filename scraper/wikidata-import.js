/**
 * Wikidata import — vertical-slice proof of concept for Pipeline v2.
 *
 * Thesis (see docs/pipeline-v2-rfc.md + the coverage matrix): for event-type
 * topics, Wikidata is a *structured* source where dates, precision, coordinates,
 * locations, ontology types and the canonical Wikipedia link all come for free —
 * no LLM, no date-resolution heuristics, no junk filtering. This script proves
 * the query → aggregate → map → load path end to end on one topic.
 *
 * The lead demo is World War I, where the v1 scraper produced a BROKEN 2-event
 * timeline; Wikidata has ~350 events scoped by `part of` (P361). Loading those
 * into the existing Event schema renders in the current frontend with zero UI
 * changes — a dramatic before/after.
 *
 * This is the canonical loader for Chronicle's data. It writes Wikidata-sourced
 * events into the `events` collection (the one the API serves) and rebuilds the
 * `timelines` collection from them. A dry run (query + aggregate + report, no
 * write) is the DEFAULT; pass --commit to actually write.
 *
 * Usage:
 *   node wikidata-import.js                 # World War I, dry run
 *   node wikidata-import.js --commit        # World War I → events, rebuild timelines
 *   node wikidata-import.js cold-war        # a different configured topic, dry
 *   node wikidata-import.js --commit --all  # load every configured topic, then rebuild
 */

import mongoose from 'mongoose'
import config from './config.js'

const WDQS = 'https://query.wikidata.org/sparql'
const UA = config.wikipedia.userAgent // reuse the contact UA — WDQS wants one too

// ── Topic recipes ────────────────────────────────────────────────────────────
// Each topic is a "scoping recipe": how to select its events out of Wikidata.
// The PoC ships the `part-of` recipe (the regime the coverage matrix showed is
// Wikidata-native). `qid` is the root item; events ≤2 `part of` hops below it
// with a P585 point-in-time are pulled.
const TOPICS = {
  'world-war-i': {
    qid: 'Q361',
    sourceArticle: 'Timeline of World War I',
    sourceUrl: 'https://en.wikipedia.org/wiki/Timeline_of_World_War_I',
    defaultCategory: 'War',
  },
  'cold-war': {
    qid: 'Q8683',
    sourceArticle: 'Timeline of the Cold War',
    sourceUrl: 'https://en.wikipedia.org/wiki/Timeline_of_the_Cold_War',
    defaultCategory: 'Politics',
  },
  'napoleonic-era': {
    qid: 'Q78994', // Napoleonic Wars
    sourceArticle: 'Timeline of the Napoleonic era',
    sourceUrl: 'https://en.wikipedia.org/wiki/Timeline_of_the_Napoleonic_era',
    defaultCategory: 'War',
  },
  'american-revolution': {
    qid: 'Q40949', // American Revolutionary War
    sourceArticle: 'Timeline of the American Revolution',
    sourceUrl: 'https://en.wikipedia.org/wiki/Timeline_of_the_American_Revolution',
    defaultCategory: 'War',
  },
  'french-revolution': {
    qid: 'Q6534', // French Revolution
    sourceArticle: 'Timeline of the French Revolution',
    sourceUrl: 'https://en.wikipedia.org/wiki/Timeline_of_the_French_Revolution',
    defaultCategory: 'Politics',
  },
  'mexican-war-of-independence': {
    qid: 'Q68750', // Mexican War of Independence
    sourceArticle: 'Timeline of the Mexican War of Independence',
    sourceUrl: 'https://en.wikipedia.org/wiki/Mexican_War_of_Independence',
    defaultCategory: 'War',
  },
}

// ── instance-of (P31) label → Chronicle category ─────────────────────────────
// Keyword match on the English label of the event's type. Keeps the mapping
// general rather than enumerating hundreds of QIDs. Falls back to the topic's
// defaultCategory so every event lands in at least one bucket.
const CATEGORY_RULES = [
  [/battle|offensive|operation|siege|campaign|raid|bombardment|naval|mutiny|war\b|warfare|front\b/i, 'War'],
  [/treaty|armistice|ceasefire|peace|conference|summit|agreement|pact|declaration|coup|revolution|uprising|abdicat/i, 'Politics'],
  [/election|referendum|plebiscite/i, 'Politics'],
  [/law|act\b|decree|legislation/i, 'Law'],
  [/genocide|massacre|atrocity/i, 'Society'],
  [/pandemic|epidemic|famine|disaster|earthquake|flood/i, 'Natural Event'],
  [/invention|technology|aircraft|weapon/i, 'Technology'],
]

function mapCategory(typeLabels, fallback) {
  const cats = new Set()
  for (const label of typeLabels) {
    for (const [re, cat] of CATEGORY_RULES) if (re.test(label)) cats.add(cat)
  }
  if (cats.size === 0) cats.add(fallback)
  return [...cats]
}

// ── date formatting (reused conventions from utils/resolveDate.js) ────────────
// Wikidata returns ISO-8601 timestamps + a precision code (9=year, 10=month,
// 11=day). We never have to *parse a date out of prose* — it is already typed.
const PREC = { 11: 'day', 10: 'month', 9: 'year', 8: 'circa', 7: 'circa', 6: 'circa' }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function resolveWikidataDate(iso, precCode) {
  // ISO can be negative for BC, e.g. "-0044-03-15T00:00:00Z".
  const m = iso.match(/^([+-]?)(\d{1,})-(\d{2})-(\d{2})/)
  if (!m) return null
  const sign = m[1] === '-' ? -1 : 1
  const y = parseInt(m[2], 10)
  const month = parseInt(m[3], 10)
  const day = parseInt(m[4], 10)
  const year = sign * y // Wikidata year 0 == 1 BC; close enough for the PoC
  const prec = PREC[precCode] || 'year'

  const era = year < 0 ? ' BC' : year < 1000 ? ' AD' : ''
  const yAbs = Math.abs(year)
  let display
  if (prec === 'day') display = `${MONTHS[month - 1]} ${day}, ${yAbs}${era}`
  else if (prec === 'month') display = `${MONTHS[month - 1]} ${yAbs}${era}`
  else if (prec === 'circa') display = `c. ${yAbs}${era}`
  else display = `${yAbs}${era}`

  return { year, yearDisplay: display, datePrecision: prec }
}

// ── SPARQL ───────────────────────────────────────────────────────────────────
// One query, aggregated server-side so multivalued properties (location, type)
// don't fan the result out into duplicate rows. GROUP_CONCAT collapses them;
// SAMPLE picks one point-in-time statement per event.
function buildQuery(rootQid) {
  return `
SELECT ?event ?eventLabel
       (SAMPLE(?time) AS ?time) (SAMPLE(?prec) AS ?prec)
       (GROUP_CONCAT(DISTINCT ?typeLabel; separator="|") AS ?types)
       (GROUP_CONCAT(DISTINCT ?placeLabel; separator="|") AS ?places)
       (SAMPLE(?coord) AS ?coord)
       (SAMPLE(?article) AS ?article)
WHERE {
  ?event wdt:P361/wdt:P361? wd:${rootQid} .
  ?event p:P585 ?st . ?st psv:P585 ?tv .
  ?tv wikibase:timeValue ?time ; wikibase:timePrecision ?prec .
  OPTIONAL { ?event wdt:P31 ?type .
             ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel)="en") }
  OPTIONAL { ?event wdt:P276 ?place .
             ?place rdfs:label ?placeLabel . FILTER(LANG(?placeLabel)="en") }
  OPTIONAL { ?event wdt:P625 ?coord }
  OPTIONAL { ?article schema:about ?event ;
             schema:isPartOf <https://en.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
GROUP BY ?event ?eventLabel
`.trim()
}

async function runSparql(query) {
  const url = `${WDQS}?format=json&query=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`WDQS ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return json.results.bindings
}

// Wikipedia article title from the sitelink URL, e.g.
// https://en.wikipedia.org/wiki/Battle_of_the_Somme → "Battle of the Somme"
function wikiTitleFromUrl(url) {
  if (!url) return ''
  try {
    const slug = decodeURIComponent(url.split('/wiki/')[1] || '')
    return slug.replace(/_/g, ' ')
  } catch { return '' }
}

const NOW_YEAR = new Date().getFullYear()

function toEvent(row, topic) {
  const date = resolveWikidataDate(row.time.value, parseInt(row.prec.value, 10))
  if (!date) return null
  // Guard: a `point in time` in the future is a data error for a historical
  // timeline (e.g. a planned declassification or estimated date), not an event.
  if (date.year > NOW_YEAR + 1) return null
  // Guard: the label service returns the bare Q-id when an item has no English
  // label. Those items also lack an English Wikipedia article (no title, image,
  // or summary to show), so drop them as unviewable noise.
  if (/^Q\d+$/.test(row.eventLabel.value)) return null
  const types = row.types?.value ? row.types.value.split('|').filter(Boolean) : []
  const places = row.places?.value ? row.places.value.split('|').filter(Boolean) : []
  const wikiLink = wikiTitleFromUrl(row.article?.value)
  return {
    ...date,
    title: row.eventLabel.value,
    description: '', // enrichment (Wikipedia extract) is a separate, later step
    category: mapCategory(types, topic.defaultCategory),
    location: places,
    wikiLink,
    sourceArticle: topic.sourceArticle,
    sourceUrl: topic.sourceUrl,
    scrapedAt: new Date(),
    // provenance — what makes this row reproducible / auditable
    wikidataId: row.event.value.split('/').pop(),
  }
}

// Query + aggregate + dedupe + report one topic. Returns the deduped events.
async function fetchTopic(topic) {
  console.log(`\n▶ ${topic.sourceArticle}  (root ${topic.qid})`)
  console.log('  querying WDQS…')
  const rows = await runSparql(buildQuery(topic.qid))

  const events = rows.map((r) => toEvent(r, topic)).filter(Boolean)
  // dedup on (wikidataId) — the GROUP BY already collapses fan-out, but guard.
  const byId = new Map()
  for (const e of events) byId.set(e.wikidataId, e)
  const deduped = [...byId.values()].sort((a, b) => a.year - b.year)

  const withLink = deduped.filter((e) => e.wikiLink).length
  const years = deduped.map((e) => e.year)
  console.log(`  ✓ ${deduped.length} unique events  (${rows.length} rows)  `
    + `span ${Math.min(...years)}…${Math.max(...years)}  links ${Math.round(100 * withLink / deduped.length)}%`)
  return deduped
}

const slugify = (title) =>
  title.replace(/^Timeline of\s+/i, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Pull human-readable "about this topic" info for a root entity: the Wikidata
// one-line description, the lead paragraph + hero image from its main Wikipedia
// article, and the article title. Used to enrich the timeline page.
async function fetchTopicInfo(qid) {
  const out = { wikiLink: '', tagline: '', description: '', heroImage: '' }
  try {
    const ed = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
      { headers: { 'User-Agent': UA } })
    if (!ed.ok) return out
    const entity = (await ed.json()).entities?.[qid]
    out.tagline = entity?.descriptions?.en?.value ?? ''
    const article = entity?.sitelinks?.enwiki?.title
    if (!article) return out
    out.wikiLink = article

    const sum = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article.replace(/ /g, '_'))}`,
      { headers: { 'User-Agent': UA } })
    if (sum.ok) {
      const d = await sum.json()
      out.description = d.extract ?? ''
      out.heroImage = d.thumbnail?.source ?? ''
    }
  } catch { /* best-effort enrichment — leave blanks on failure */ }
  return out
}

// Rebuild the `timelines` collection (browse list + slug→title resolution) by
// aggregating whatever is now in `events`. Keeps metadata in sync with the data
// and enriches each timeline with "about this topic" info from Wikidata.
async function rebuildTimelines(db) {
  const agg = await db.collection('events').aggregate([
    { $group: {
      _id: '$sourceArticle',
      eventCount: { $sum: 1 },
      yearStart: { $min: '$year' },
      yearEnd: { $max: '$year' },
      categories: { $addToSet: '$category' },
      sourceUrl: { $first: '$sourceUrl' },
    } },
  ]).toArray()

  const byArticle = Object.fromEntries(Object.values(TOPICS).map((t) => [t.sourceArticle, t]))

  const timelines = db.collection('timelines')
  await timelines.deleteMany({})
  for (const t of agg) {
    const cats = [...new Set(t.categories.flat())].sort()
    const topic = byArticle[t._id]
    const info = topic ? await fetchTopicInfo(topic.qid) : { wikiLink: '', tagline: '', description: '', heroImage: '' }
    await timelines.insertOne({
      title: t._id,
      slug: slugify(t._id),
      eventCount: t.eventCount,
      yearStart: t.yearStart,
      yearEnd: t.yearEnd,
      categories: cats,
      sourceUrl: t.sourceUrl || '',
      tagline: info.tagline,
      description: info.description,
      heroImage: info.heroImage,
      wikiLink: info.wikiLink,
      updatedAt: new Date(),
      createdAt: new Date(),
    })
  }
  console.log(`\n  ✓ rebuilt timelines: ${agg.length} topic(s) (with topic descriptions)`)
}

async function main() {
  const args = process.argv.slice(2)
  const commit = args.includes('--commit')
  const all = args.includes('--all')

  // Rebuild the timelines collection (counts + topic descriptions) from the
  // events already in the DB, without re-querying every topic's events.
  if (args.includes('--rebuild')) {
    await mongoose.connect(config.mongo.uri)
    await rebuildTimelines(mongoose.connection.db)
    await mongoose.disconnect()
    console.log()
    return
  }

  const slug = args.find((a) => !a.startsWith('--')) || 'world-war-i'
  const slugs = all ? Object.keys(TOPICS) : [slug]

  for (const s of slugs) {
    if (!TOPICS[s]) {
      console.error(`Unknown topic "${s}". Known: ${Object.keys(TOPICS).join(', ')}`)
      process.exit(1)
    }
  }

  console.log(`\nWikidata import — ${commit ? 'COMMIT → events' : 'DRY RUN (no write)'}`)

  const fetched = []
  for (const s of slugs) fetched.push([TOPICS[s], await fetchTopic(TOPICS[s])])

  if (!commit) {
    console.log('\nDRY RUN — nothing written. Re-run with --commit to load into events.\n')
    return
  }

  await mongoose.connect(config.mongo.uri)
  const col = mongoose.connection.db.collection('events')
  // Indexes the API relies on (recreated here since this loader owns `events`).
  await col.createIndex({ wikidataId: 1 }, { unique: true })
  await col.createIndex({ year: 1 })
  await col.createIndex({ sourceArticle: 1, year: 1 })
  await col.createIndex({ category: 1, year: 1 })
  await col.createIndex({ title: 'text', description: 'text' })
  let total = 0
  for (const [topic, deduped] of fetched) {
    for (const e of deduped) {
      await col.updateOne({ wikidataId: e.wikidataId }, { $set: e }, { upsert: true })
    }
    total += deduped.length
    console.log(`  ✓ ${deduped.length} → events  (${topic.sourceArticle})`)
  }
  console.log(`\n  ✓ ${total} events upserted into \`events\``)

  await rebuildTimelines(mongoose.connection.db)
  await mongoose.disconnect()
  console.log()
}

main().catch((e) => { console.error('\n✗', e.message, '\n'); process.exit(1) })
