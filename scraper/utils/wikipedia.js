import config from '../config.js'
import { sleep, withRetry } from './retry.js'

const { baseUrl, userAgent, delayMs, maxlag } = config.wikipedia

/**
 * Low-level GET to the Wikipedia Action API.
 * Always adds format=json, maxlag, and the required User-Agent.
 */
async function apiGet(params) {
  const url = new URL(baseUrl)
  url.searchParams.set('format', 'json')
  url.searchParams.set('maxlag', String(maxlag))
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': userAgent,
      'Accept-Encoding': 'gzip',
    },
  })

  if (res.status === 429 || res.status === 503) {
    const retryAfter = res.headers.get('Retry-After')
    const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 15_000
    const err = new Error(`HTTP ${res.status} from Wikipedia`)
    err.retryAfterMs = retryAfterMs
    throw err
  }

  if (!res.ok) {
    throw new Error(`Wikipedia API error: HTTP ${res.status} for ${url}`)
  }

  return res.json()
}

/**
 * Search for pages whose titles contain the given query string.
 * Pages through all results automatically.
 *
 * @param {string} query     - e.g. `intitle:"Timeline of"`
 * @param {number} limit     - results per page (max 500)
 * @returns {string[]}       - array of page titles
 */
export async function searchTitles(query, limit = 500) {
  const titles = []
  let sroffset = 0

  while (true) {
    await sleep(delayMs)

    const data = await withRetry(() =>
      apiGet({
        action: 'query',
        list: 'search',
        srsearch: query,
        srnamespace: '0',
        srlimit: String(limit),
        sroffset: String(sroffset),
        srprop: 'title',
      })
    )

    const results = data?.query?.search ?? []
    titles.push(...results.map((r) => r.title))

    if (!data?.continue?.sroffset) break
    sroffset = data.continue.sroffset
  }

  return titles
}

/**
 * Fetch all pages (and subcategories) in a given category.
 * Recurses into subcategories up to `maxDepth` levels deep.
 *
 * @param {string} categoryTitle - e.g. "Category:Timelines_by_topic"
 * @param {number} maxDepth      - recursion depth (default 3)
 * @returns {string[]}           - array of page titles
 */
export async function getCategoryMembers(categoryTitle, maxDepth = 3) {
  const visited = new Set()
  const titles = []

  async function recurse(catTitle, depth) {
    if (depth > maxDepth || visited.has(catTitle)) return
    visited.add(catTitle)

    let cmcontinue = null

    do {
      await sleep(delayMs)

      const params = {
        action: 'query',
        list: 'categorymembers',
        cmtitle: catTitle,
        cmtype: 'subcat|page',
        cmlimit: '500',
        cmprop: 'title|type',
      }
      if (cmcontinue) params.cmcontinue = cmcontinue

      const data = await withRetry(() => apiGet(params))
      const members = data?.query?.categorymembers ?? []

      for (const m of members) {
        if (m.type === 'subcat') {
          await recurse(m.title, depth + 1)
        } else {
          titles.push(m.title)
        }
      }

      cmcontinue = data?.continue?.cmcontinue ?? null
    } while (cmcontinue)
  }

  await recurse(categoryTitle, 0)
  return titles
}

/**
 * Fetch the wikitext and section list for a single page.
 *
 * @param {string} title - Wikipedia page title
 * @returns {{ wikitext: string, sections: Array, html: string|null }}
 */
export async function fetchPage(title) {
  await sleep(delayMs)

  const data = await withRetry(() =>
    apiGet({
      action: 'parse',
      page: title,
      prop: 'wikitext|sections',
      disablelimitreport: '1',
    })
  )

  if (data.error) {
    throw new Error(`Wikipedia parse error for "${title}": ${data.error.info}`)
  }

  return {
    wikitext: data.parse?.wikitext?.['*'] ?? '',
    sections: data.parse?.sections ?? [],
  }
}

/**
 * Fetch the rendered HTML for a single page.
 * Used as the cheerio fallback when wtf_wikipedia yields too few events.
 *
 * @param {string} title - Wikipedia page title
 * @returns {string}     - rendered HTML string
 */
export async function fetchPageHtml(title) {
  await sleep(delayMs)

  const data = await withRetry(() =>
    apiGet({
      action: 'parse',
      page: title,
      prop: 'text',
      disablelimitreport: '1',
    })
  )

  if (data.error) {
    throw new Error(`Wikipedia HTML fetch error for "${title}": ${data.error.info}`)
  }

  return data.parse?.text?.['*'] ?? ''
}

/**
 * Detect whether a page is a hub page that links to per-year sub-articles
 * rather than containing events itself.
 * Heuristic: fewer than 5 list items but more than 8 internal "Timeline of" links.
 *
 * @param {string} wikitext
 * @returns {boolean}
 */
export function isHubPage(wikitext) {
  const listItems = (wikitext.match(/^\*[^*]/gm) ?? []).length
  const timelineLinks = (wikitext.match(/\[\[Timeline of/gi) ?? []).length
  return listItems < 5 && timelineLinks > 8
}

/**
 * Extract internal "Timeline of…" links from a hub page's wikitext,
 * so we can enqueue the actual sub-articles.
 *
 * @param {string} wikitext
 * @returns {string[]} - array of linked page titles
 */
export function extractHubLinks(wikitext) {
  const matches = [...wikitext.matchAll(/\[\[(Timeline of[^\]|#]+)/gi)]
  return [...new Set(matches.map((m) => m[1].trim()))]
}
