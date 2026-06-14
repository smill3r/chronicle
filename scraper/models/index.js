import mongoose from 'mongoose'

// ─── Crawl Queue ──────────────────────────────────────────────────────────────
// Tracks every title we intend to process and its current pipeline status.

const crawlQueueSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true },
    type: { type: String, enum: ['article', 'hub'], default: 'article' },
    status: {
      type: String,
      enum: ['pending', 'fetched', 'parsed', 'normalized', 'failed', 'skipped'],
      default: 'pending',
      index: true,
    },
    error: { type: String, default: null },
    discoveredFrom: { type: String, default: null }, // hub title that spawned this
  },
  { timestamps: true }
)

export const CrawlQueue = mongoose.model('CrawlQueue', crawlQueueSchema)

// ─── Crawl Cache ──────────────────────────────────────────────────────────────
// Stores raw Wikipedia API responses so we never re-fetch.

const crawlCacheSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true },
    wikitext: { type: String, default: '' },
    sections: { type: mongoose.Schema.Types.Mixed, default: [] },
    html: { type: String, default: null }, // populated on cheerio fallback
    fetchedAt: { type: Date, default: Date.now, index: true },
  }
)

export const CrawlCache = mongoose.model('CrawlCache', crawlCacheSchema)

// ─── Parsed Lines ─────────────────────────────────────────────────────────────
// One document per raw event line extracted from a Wikipedia article.
// These are the inputs to Stage 4 (Ollama normalization).

const parsedLineSchema = new mongoose.Schema(
  {
    sourceTitle: { type: String, required: true, index: true },
    headingContext: { type: String, default: '' },  // section heading text
    rawLine: { type: String, required: true },       // full text of the bullet
    inferredYear: { type: Number, default: null },   // from date pre-pass regex
    inferredEra: { type: String, default: null },    // "BC" | "AD" | null
    primaryLink: { type: String, default: null }, // first [[wikitext link]] found in this bullet
    status: {
      type: String,
      enum: ['pending_normalization', 'normalized', 'failed'],
      default: 'pending_normalization',
      index: true,
    },
  },
  { timestamps: true }
)

parsedLineSchema.index({ sourceTitle: 1, rawLine: 1 }, { unique: true })

export const ParsedLine = mongoose.model('ParsedLine', parsedLineSchema)

// ─── Event ────────────────────────────────────────────────────────────────────
// A normalized historical event document, ready for the React frontend.

const eventSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },          // signed int — negative = BC
    yearDisplay: { type: String, required: true },   // human-readable, e.g. "c. 3200 BC"
    datePrecision: {
      type: String,
      enum: ['year', 'month', 'day', 'circa', 'range', 'unknown'],
      default: 'year',
    },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: [String], default: [], index: true },
    location: { type: [String], default: [], index: true },
    wikiLink: { type: String, default: '' },
    wikiSummary: { type: String, default: '' },   // cached Wikipedia intro extract
    wikiThumbnail: { type: String, default: '' }, // cached Wikipedia thumbnail URL
    sourceArticle: { type: String, required: true },
    sourceUrl: { type: String, required: true },
    scrapedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

// Primary query patterns the React frontend will use:
eventSchema.index({ year: 1 })                        // timeline slider / year range
eventSchema.index({ sourceArticle: 1, year: 1 })      // all events for one timeline, sorted
eventSchema.index({ category: 1, year: 1 })           // category filter + chronological sort
eventSchema.index({ location: 1, year: 1 })           // location filter + chronological sort
eventSchema.index({ title: 'text', description: 'text' }) // keyword search
eventSchema.index(                                    // dedup key
  { sourceArticle: 1, title: 1, year: 1 },
  { unique: true }
)

export const Event = mongoose.model('Event', eventSchema)

// ─── Timeline ─────────────────────────────────────────────────────────────────
// One document per source Wikipedia article. Powers the browse screen.
// Rebuilt at the end of every normalize run from aggregated event data.

function titleToSlug(title) {
  return title
    .replace(/^Timeline of\s+/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const timelineSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true }, // "Timeline of the French Revolution"
    slug: { type: String, required: true, unique: true },  // "the-french-revolution"
    eventCount: { type: Number, default: 0 },
    yearStart: { type: Number },
    yearEnd: { type: Number },
    categories: { type: [String], default: [] },
    sourceUrl: { type: String, default: '' },
  },
  { timestamps: true }
)

export { titleToSlug }
export const Timeline = mongoose.model('Timeline', timelineSchema)
