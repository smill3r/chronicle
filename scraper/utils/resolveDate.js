/**
 * Deterministic date resolver.
 *
 * llama3.2:3b is unreliable at the *mechanical* parts of dates — applying a
 * "BC" that lives in the section heading, propagating the year from a heading
 * down to a line that only has a month/day, and getting the sign right. So we
 * don't trust the model for dates at all: we extract them with regex from the
 * same `rawLine` + `headingContext` the model saw, and override its guess.
 *
 * Returns { year, yearDisplay, datePrecision, resolved }.
 *   year         signed int — negative = BC, 0 = could not resolve
 *   yearDisplay  clean human string, e.g. "c. 300 BC", "27 April 1789"
 *   datePrecision  one of: year | month | day | circa | range | unknown
 *   resolved     false when no year could be found anywhere
 */

const CIRCA_RE = /^\s*(c\.|ca\.|circa|approx\.?|around|about)\s*/i

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]
const MONTH_RE = new RegExp(
  `\\b(${MONTHS.join('|')}|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\\b`,
  'i',
)

/** 'BC' | 'AD' | null — does this text carry an unambiguous era marker? */
export function detectEra(text) {
  if (!text) return null
  const hasBc = /\b(b\.?\s?c\.?(?:e\.?)?)\b/i.test(text)
  const hasAd = /\b(a\.?\s?d\.?|c\.?\s?e\.?)\b/i.test(text)
  if (hasBc && !hasAd) return 'BC'
  if (hasAd && !hasBc) return 'AD'
  return null
}

const MONTH_INDEX = Object.fromEntries(
  MONTHS.flatMap((m, i) => [
    [m, i + 1],
    [m.slice(0, 3), i + 1],
  ]),
)

/** Extract a "Month [day]" from anywhere near the start of a line. */
function extractMonthDay(text) {
  const m = text.match(MONTH_RE)
  if (!m) return null
  const monthName = m[1].toLowerCase()
  const month = MONTH_INDEX[monthName] ?? MONTH_INDEX[monthName.slice(0, 3)]
  // look for a day number adjacent to the month (either side)
  const dayMatch = text.match(
    new RegExp(`(?:(\\d{1,2})\\s+)?${m[1]}(?:\\s+(\\d{1,2}))?`, 'i'),
  )
  const day = dayMatch ? Number(dayMatch[2] ?? dayMatch[1]) : null
  return {
    month,
    monthName: m[1],
    day: day && day >= 1 && day <= 31 ? day : null,
    precision: day && day >= 1 && day <= 31 ? 'day' : 'month',
  }
}

/**
 * Parse a leading date token out of a string.
 * Returns { magnitude, bc, circa, rangeEnd, precision } or null when there is
 * no number at the start. `bc` is true/false when the token itself carries an
 * era marker, otherwise null (caller decides from heading context).
 */
function parseLeadingNumber(text) {
  let t = text.trim()
  let circa = false
  if (CIRCA_RE.test(t)) {
    circa = true
    t = t.replace(CIRCA_RE, '')
  }

  // "80 kya", "1.8 mya", "12 ka" — thousand/million years ago, always BC
  const kya = t.match(/^(\d+(?:[.,]\d+)?)\s*(kya|ka|mya|ma)\b(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?)\s*(?:kya|ka|mya|ma)\b)?/i)
  if (kya) {
    const unit = kya[2].toLowerCase()
    const mult = unit.startsWith('m') ? 1_000_000 : 1_000
    const magnitude = Math.round(parseFloat(kya[1].replace(',', '.')) * mult)
    return {
      magnitude,
      bc: true,
      circa: true,
      rangeEnd: kya[3] ? Math.round(parseFloat(kya[3].replace(',', '.')) * mult) : null,
      unit,
      kyaText: kya[0].trim(),
      precision: kya[3] ? 'range' : 'circa',
    }
  }

  // "785–481 BC", "300-250 BC", "1914–1918" — a year range
  const range = t.match(/^(\d{1,5})\s*[–—-]\s*(\d{1,5})\s*(bce?|ce|ad)?\b/i)
  if (range) {
    return {
      magnitude: Number(range[1]),
      bc: range[3] ? /^b/i.test(range[3]) : null,
      circa,
      rangeEnd: Number(range[2]),
      precision: 'range',
    }
  }

  // "3200 BC", "777", "1789", "1930s" — a single year, optional decade "s",
  // optional era suffix.
  const single = t.match(/^(\d{1,5})s?\s*(bce?|ce|ad)?\b/i)
  if (single) {
    return {
      magnitude: Number(single[1]),
      bc: single[2] ? /^b/i.test(single[2]) : null,
      circa,
      rangeEnd: null,
      precision: circa ? 'circa' : 'year',
    }
  }

  return null
}

function formatYearLabel(magnitude, bc) {
  // Years are written without thousands separators ("3000 BC", not "3,000 BC").
  if (bc) return `${magnitude} BC`
  // Only tag "AD" for early years where it disambiguates from BC; modern years
  // stand alone ("1789", not "1789 AD").
  return magnitude < 1000 ? `${magnitude} AD` : String(magnitude)
}

export function resolveDate({ rawLine = '', headingContext = '' } = {}) {
  const headingEra = detectEra(headingContext)

  const lineToken = parseLeadingNumber(rawLine)
  let token = lineToken
  let monthDay = null

  if (!token) {
    // No number at the start of the line — the year must come from the heading.
    // Prefer a real year (3–5 digits / era-marked) over a stray leading day
    // number like the "1" in "1 September 1939".
    const headToken = parseHeadingDate(headingContext)
    if (headToken) {
      token = headToken
      // a "April 27"-style line supplies month/day onto the heading's year
      monthDay = extractMonthDay(rawLine)
    }
  } else if (token.precision === 'year' || token.precision === 'circa') {
    // Line had a bare year but might also name a month/day after it
    monthDay = extractMonthDay(rawLine.replace(/^\s*\d{1,5}\s*/, ''))
  }

  if (!token) {
    return { year: 0, yearDisplay: '', datePrecision: 'unknown', resolved: false }
  }

  // Resolve sign: prefer the token's own marker, else the heading's era.
  const bc = token.bc != null ? token.bc : headingEra === 'BC'
  const year = bc ? -Math.abs(token.magnitude) : Math.abs(token.magnitude)

  // Build display + precision.
  let yearDisplay
  let datePrecision

  if (token.kyaText) {
    // "kya"/"mya" already implies approximate — no redundant "c." prefix.
    yearDisplay = token.kyaText.replace(CIRCA_RE, '')
    datePrecision = token.precision
  } else if (token.rangeEnd != null) {
    yearDisplay = `${token.circa ? 'c. ' : ''}${token.magnitude}–${token.rangeEnd}${bc ? ' BC' : ''}`
    datePrecision = 'range'
  } else if (monthDay) {
    const dayPart = monthDay.day ? `${monthDay.day} ` : ''
    yearDisplay = `${dayPart}${monthDay.monthName} ${formatYearLabel(Math.abs(year), bc)}`
    datePrecision = monthDay.precision
  } else {
    yearDisplay = `${token.circa ? 'c. ' : ''}${formatYearLabel(Math.abs(year), bc)}`
    datePrecision = token.circa ? 'circa' : 'year'
  }

  return { year, yearDisplay, datePrecision, resolved: true }
}

/**
 * Re-parse a stored `yearDisplay` string back into a signed year.
 *
 * Unlike resolveDate (which reads raw event lines where the date leads), a
 * yearDisplay can be day-leading ("27 April 1789") so we must pick the real
 * year token, not the first number. Returns { year, yearDisplay, datePrecision }
 * or null when the display carries no usable year (month-only like "May 6", or
 * "4th millennium BC" where the digit isn't a year) — in which case the caller
 * should leave the event's stored year untouched.
 *
 * `era` ('BC' | 'AD' | null) supplies the sign for bare numbers with no marker.
 */
export function parseDisplayDate(display, era = null) {
  if (!display) return null
  if (/millennium|century/i.test(display)) return null // digit isn't the year
  const circa = /(^|\s)(c\.|ca\.|circa)/i.test(display.trim())
  const marker = detectEra(display)

  const kya = display.match(/(\d+(?:[.,]\d+)?)\s*(kya|ka|mya|ma)\b(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?)\s*(?:kya|ka|mya|ma)\b)?/i)
  if (kya) {
    const mult = /^m/i.test(kya[2]) ? 1_000_000 : 1_000
    const mag = Math.round(parseFloat(kya[1].replace(',', '.')) * mult)
    return { year: -mag, yearDisplay: kya[0].trim(), datePrecision: kya[3] ? 'range' : 'circa' }
  }

  const nums = [...display.matchAll(/\d+/g)].map((m) => ({ n: Number(m[0]), len: m[0].length }))
  if (!nums.length) return null
  // The year is a 3–5 digit token; only fall back to a small leading number when
  // there's an explicit era marker (e.g. "c. 1 – 50 AD").
  let yearTok = nums.find((x) => x.len >= 3 && x.len <= 5)
  if (!yearTok) {
    if (!marker) return null
    yearTok = nums[0]
  }
  const mag = yearTok.n
  const bc = marker ? marker === 'BC' : era === 'BC'
  const year = bc ? -mag : mag

  const month = (display.match(MONTH_RE) || [])[1]
  if (month) {
    const dayM = display.match(new RegExp(`(\\d{1,2})\\s+${month}|${month}\\s+(\\d{1,2})`, 'i'))
    const day = dayM ? Number(dayM[1] ?? dayM[2]) : null
    const monthName = month.charAt(0).toUpperCase() + month.slice(1).toLowerCase()
    return {
      year,
      yearDisplay: `${day ? day + ' ' : ''}${monthName} ${formatYearLabel(mag, bc)}`,
      datePrecision: day ? 'day' : 'month',
    }
  }

  const second = nums.find((x) => x !== yearTok && x.len >= 2 && x.len <= 5)
  if (second && /[–—-]/.test(display)) {
    return {
      year,
      yearDisplay: `${circa ? 'c. ' : ''}${mag}–${second.n}${bc ? ' BC' : ''}`,
      datePrecision: 'range',
    }
  }

  return {
    year,
    yearDisplay: `${circa ? 'c. ' : ''}${formatYearLabel(mag, bc)}`,
    datePrecision: circa ? 'circa' : 'year',
  }
}

/**
 * Extract a year from a section heading.
 *
 * Headings come in two shapes: a leading-year section like "1789 – The
 * Revolution Begins" / "Archaic Period (785–481 BC)" (handled by the leading
 * parser, which also gives us circa/range), and a full-date heading like
 * "1 September 1939" where the leading number is actually a day. For the
 * latter we scan for the first 3–5 digit number (a real year) and skip stray
 * 1–2 digit day numbers.
 */
function parseHeadingDate(text) {
  if (!text) return null

  const leading = parseLeadingNumber(text)
  // Trust the leading token only when it looks like a year, not a day.
  if (leading && (leading.magnitude >= 100 || leading.bc != null || leading.kyaText)) {
    return leading
  }

  const m = text.match(/\b(\d{3,5})s?\s*(bce?|ce|ad)?\b/i)
  if (!m) return leading // may be a low leading number we still accept as last resort
  return {
    magnitude: Number(m[1]),
    bc: m[2] ? /^b/i.test(m[2]) : null,
    circa: false,
    rangeEnd: null,
    precision: 'year',
  }
}
