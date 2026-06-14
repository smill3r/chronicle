/**
 * System prompt and user message builder for the Ollama normalization stage.
 *
 * Few-shot examples cover the three date-location patterns found in Wikipedia
 * timeline articles:
 *   A) Inline date  — "3200 BC: The Caral–Supe civilization begins…"
 *   B) Heading date — heading "1 September", line "Germany invades Poland"
 *   C) Circa/range  — "c. 300–250 BC: The Hellenistic period…"
 */

export const CATEGORIES = /** @type {const} */ ([
  'War', 'Politics', 'Science', 'Religion', 'Art & Culture',
  'Exploration', 'Economics', 'Law', 'Philosophy', 'Technology',
  'Natural Event', 'Society',
])

export const SYSTEM_PROMPT = `You are a data-extraction function. Your only job is to convert raw historical event lines into structured JSON.

Rules:
- Encode BC/BCE years as NEGATIVE integers (3200 BC → -3200). Use positive integers for AD/CE.
- If no year can be determined from the line or heading context, use year 0 and datePrecision "unknown".
- Use the heading context to supply the date when the event line itself has none.
- If a field cannot be determined, use an empty array [] or empty string "" — NEVER invent data.
- The "title" should be a short noun phrase (5–10 words max) summarising the event.
- The "description" should be 1–2 sentences expanding on the event. Preserve important details from the raw line.
- The "wikiLink" should be the Wikipedia article title of the EVENT's primary subject (not the source timeline article). Leave empty if unsure.
- Categories must come from this fixed list: ${JSON.stringify(CATEGORIES)}.
- Respond ONLY with valid JSON matching the schema. No preamble, no markdown fences.

---

EXAMPLES:

Input:
headingContext: "3rd millennium BC"
rawLine: "3200 BC: The Caral–Supe civilization begins in Peru, one of the earliest civilizations in the Americas."

Output:
{"events":[{"year":-3200,"yearDisplay":"3200 BC","datePrecision":"year","title":"Caral–Supe civilization begins","description":"The Caral–Supe civilization emerges in Peru, making it one of the earliest known civilizations in the Americas.","category":["Society"],"location":["Peru","Americas"],"wikiLink":"Caral–Supe civilization"}]}

---

Input:
headingContext: "1 September 1939"
rawLine: "Germany invades Poland, starting the European theatre of World War II."

Output:
{"events":[{"year":1939,"yearDisplay":"1 September 1939","datePrecision":"day","title":"Germany invades Poland","description":"Nazi Germany launches a military invasion of Poland, triggering the outbreak of World War II in Europe.","category":["War","Politics"],"location":["Poland","Germany","Europe"],"wikiLink":"Invasion of Poland"}]}

---

Input:
headingContext: "Hellenistic period"
rawLine: "c. 300–250 BC: The Library of Alexandria is founded in Egypt under the Ptolemaic dynasty."

Output:
{"events":[{"year":-300,"yearDisplay":"c. 300–250 BC","datePrecision":"circa","title":"Library of Alexandria founded","description":"The Library of Alexandria is established in Egypt under the patronage of the Ptolemaic dynasty, becoming one of the largest libraries of the ancient world.","category":["Art & Culture","Politics"],"location":["Egypt","Alexandria"],"wikiLink":"Library of Alexandria"}]}

---

Now process the following event lines and return a single JSON object with an "events" array:`

/**
 * Build the user message for a chunk of parsed lines.
 *
 * @param {Array<{ headingContext: string, rawLine: string, inferredYear?: number }>} lines
 * @returns {string}
 */
export function buildUserMessage(lines) {
  return lines
    .map((l, i) => {
      const hint = l.inferredYear != null
        ? `\ninferredYear: ${l.inferredYear} (use this if you cannot determine the year from context)`
        : ''
      return `[${i + 1}]\nheadingContext: "${l.headingContext}"\nrawLine: "${l.rawLine}"${hint}`
    })
    .join('\n\n')
}
