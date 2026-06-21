/**
 * Build a DRAFT gold evaluation set for Chronicle Pipeline v2.
 *
 * The gold set is the ground truth the v2 pipeline is measured against. This
 * script produces a *draft* for a human to review — it is NOT itself gold until
 * a person has verified it (see docs/pipeline-v2-rfc.md §8).
 *
 * What's trustworthy in the draft vs. what needs human eyes:
 *   • Dates (year / precision / referenced_years / multi-date) are derived with
 *     the tested deterministic resolver (utils/resolveDate.js) — high quality,
 *     but the multi-date "Ussher slice" is exactly where the resolver's leading-
 *     date prior can be wrong, so those rows are flagged for careful review.
 *   • wikiLink comes from the wikitext [[link]] extraction — usually right.
 *   • Categories are a best-effort *proposal* (copied from the nearest matching
 *     v1 event) — every one needs human confirmation.
 *
 * Sampling is stratified across articles, over-samples multi-date bullets (the
 * cases that test temporal grounding), and includes a few non-event ("junk")
 * bullets so the gold set can also score the junk filter. The sample is seeded
 * (deterministic) so re-runs are stable.
 *
 * Outputs:
 *   eval/gold_draft.jsonl   — schema-conforming (docs/pipeline-v2/gold_event.schema.json)
 *   eval/gold_review.csv    — human review sheet (open in a spreadsheet)
 *
 * Usage:  node build-gold-set.js
 */

import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import config from './config.js'
import { ParsedLine, Event } from './models/index.js'
import { resolveDate, detectEra } from './utils/resolveDate.js'

const TARGET = 280
const JUNK_GLOBAL = 15
const JUNK_RE = /^(see also|references|notes|sources|bibliography|further reading|external links|footnotes|citations)/i
const OUT_DIR = path.resolve(process.cwd(), '..', 'eval')

// Deterministic hash → stable "shuffle" without a dependency.
function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 2 ** 32
}

// All year-like tokens in a bullet (4-digit years, 3-digit, kya/mya, with era).
// Skips 1–2 digit day numbers. Used for referenced_years / multi-date.
function yearTokens(text, era) {
  const out = new Set()
  for (const m of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(kya|ka|mya|ma)\b/gi)) {
    out.add(-Math.round(parseFloat(m[1].replace(',', '.')) * (/^m/i.test(m[2]) ? 1e6 : 1e3)))
  }
  for (const m of text.matchAll(/\b(\d{3,4})\s*(bce?|ce|ad)?\b/gi)) {
    const n = Number(m[1])
    const e = m[2] ? (/^b/i.test(m[2]) ? 'BC' : 'AD') : era
    out.add(e === 'BC' ? -n : n)
  }
  return [...out]
}

function csvCell(v) {
  const s = Array.isArray(v) ? v.join('; ') : String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  await mongoose.connect(config.mongo.uri)

  const lines = await mongoose.connection.db
    .collection('parsedlines').find({}).toArray()

  // index v1 events per article for best-effort category proposals
  const evByArticle = {}
  for (const e of await Event.find({}, { title: 1, category: 1, sourceArticle: 1 }).lean()) {
    (evByArticle[e.sourceArticle] ??= []).push(e)
  }
  const proposeCategories = (article, raw) => {
    const cands = evByArticle[article] ?? []
    const rawL = raw.toLowerCase()
    let best = null, bestScore = 0
    for (const e of cands) {
      const kws = e.title.split(/\s+/).filter((w) => w.length > 4)
      const score = kws.reduce((n, k) => n + (rawL.includes(k.toLowerCase()) ? 1 : 0), 0)
      if (score > bestScore) { bestScore = score; best = e }
    }
    return bestScore >= 2 ? best.category : []
  }

  // annotate every bullet
  const annotated = lines.map((l) => {
    const era = detectEra(l.headingContext)
    const d = resolveDate({ rawLine: l.rawLine, headingContext: l.headingContext })
    const toks = yearTokens(l.rawLine, era)
    const referenced = toks.filter((y) => y !== d.year)
    const isEvent = !JUNK_RE.test(l.headingContext || '')
    return {
      id: `${l.sourceTitle}::${String(l._id)}`,
      article: l.sourceTitle,
      section: l.headingContext || '',
      bullet: l.rawLine,
      year: d.year,
      display: d.yearDisplay,
      precision: d.datePrecision,
      referenced,
      multiDate: toks.length > 1,
      isEvent,
      wikiLink: l.primaryLink || '',
      categories: isEvent ? proposeCategories(l.sourceTitle, l.rawLine) : [],
      _sort: hash(String(l._id)),
    }
  })

  // ── stratified sample ──────────────────────────────────────────────────────
  const events = annotated.filter((a) => a.isEvent)
  const junk = annotated.filter((a) => !a.isEvent).sort((a, b) => a._sort - b._sort).slice(0, JUNK_GLOBAL)

  const byArticle = {}
  for (const a of events) (byArticle[a.article] ??= []).push(a)
  const total = events.length

  const picked = []
  for (const [article, group] of Object.entries(byArticle)) {
    const alloc = Math.max(6, Math.min(40, Math.round(TARGET * group.length / total)))
    const multi = group.filter((a) => a.multiDate).sort((a, b) => a._sort - b._sort)
    const single = group.filter((a) => !a.multiDate).sort((a, b) => a._sort - b._sort)
    const wantMulti = Math.min(multi.length, Math.ceil(alloc / 2))
    picked.push(...multi.slice(0, wantMulti), ...single.slice(0, alloc - wantMulti))
  }
  const sample = [...picked, ...junk].sort((a, b) => {
    // hard cases first so the reviewer hits the important rows early
    const rank = (x) => (x.isEvent ? 0 : 2) + (x.multiDate ? -1 : 0)
    return rank(a) - rank(b) || a.article.localeCompare(b.article) || a.year - b.year
  })

  // ── write outputs ───────────────────────────────────────────────────────────
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const jsonl = sample.map((s) => JSON.stringify({
    id: s.id,
    source: { article_title: s.article, revision_id: 0, section_path: s.section ? [s.section] : [], bullet_text: s.bullet },
    true_year: s.year,
    true_precision: s.precision,
    referenced_years: s.referenced,
    true_categories: s.categories,
    true_wikilink: s.wikiLink,
    is_event: s.isEvent,
    is_multi_date: s.multiDate,
    labeler: 'DRAFT-needs-review',
  })).join('\n')
  fs.writeFileSync(path.join(OUT_DIR, 'gold_draft.jsonl'), jsonl + '\n')

  const cols = ['id', 'article', 'section', 'bullet_text', 'proposed_year', 'proposed_display',
    'precision', 'referenced_years', 'multi_date', 'is_event', 'proposed_wikilink',
    'proposed_categories', 'date_ok? (y/n)', 'corrected_year', 'corrected_categories', 'notes']
  const rows = sample.map((s) => [
    s.id.split('::')[1].slice(-6), s.article.replace('Timeline of ', ''), s.section, s.bullet,
    s.year, s.display, s.precision, s.referenced, s.multiDate, s.isEvent, s.wikiLink,
    s.categories, '', '', '', '',
  ].map(csvCell).join(','))
  fs.writeFileSync(path.join(OUT_DIR, 'gold_review.csv'), [cols.join(','), ...rows].join('\n') + '\n')

  // ── stats ─────────────────────────────────────────────────────────────────
  const n = sample.length
  console.log(`\n✓ Draft gold set: ${n} bullets → eval/gold_draft.jsonl + eval/gold_review.csv`)
  console.log(`  multi-date (grounding slice): ${sample.filter((s) => s.multiDate).length}`)
  console.log(`  junk / non-event:             ${sample.filter((s) => !s.isEvent).length}`)
  console.log(`  BC:                           ${sample.filter((s) => s.year < 0).length}`)
  console.log(`  unresolved (year 0):          ${sample.filter((s) => s.year === 0 && s.isEvent).length}`)
  console.log(`  with proposed categories:     ${sample.filter((s) => s.categories.length).length}`)
  console.log(`  per article:`)
  const pa = {}
  for (const s of sample) pa[s.article.replace('Timeline of ', '')] = (pa[s.article.replace('Timeline of ', '')] || 0) + 1
  Object.entries(pa).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    ${String(v).padStart(3)}  ${k}`))

  await mongoose.disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
