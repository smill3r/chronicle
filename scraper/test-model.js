/**
 * Model quality comparison — run before switching Ollama models.
 *
 * Grabs 5 real ParsedLine documents from MongoDB and sends them to two
 * models in parallel, then prints both outputs so you can compare quality.
 *
 * Usage:
 *   node test-model.js                       # compares llama3.1 vs llama3.2:3b
 *   node test-model.js llama3.1 llama3.2:3b  # explicit model names
 */

import mongoose from 'mongoose'
import { Ollama } from 'ollama'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { z } from 'zod'
import config from './config.js'
import { ParsedLine } from './models/index.js'
import { SYSTEM_PROMPT, buildUserMessage, CATEGORIES } from './prompts/extractEvents.js'

const [modelA, modelB] = process.argv.slice(2).length === 2
  ? process.argv.slice(2)
  : ['llama3.1', 'llama3.2:3b']

const EventSchema = z.object({
  year: z.number().int(),
  yearDisplay: z.string(),
  datePrecision: z.enum(['year', 'month', 'day', 'circa', 'range', 'unknown']),
  title: z.string(),
  description: z.string().default(''),
  category: z.array(z.enum(CATEGORIES)).default([]),
  location: z.array(z.string()).default([]),
  wikiLink: z.string().default(''),
})

const BatchSchema = z.object({ events: z.array(EventSchema) })

async function callModel(modelName, lines) {
  const ollama = new Ollama({ host: config.ollama.host })
  const start = Date.now()
  const response = await ollama.chat({
    model: modelName,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserMessage(lines) },
    ],
    format: zodToJsonSchema(BatchSchema),
    options: { temperature: 0 },
    keep_alive: '5m',
  })
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const raw = response.message?.content ?? ''
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const parsed = BatchSchema.parse(JSON.parse(cleaned))
  return { events: parsed.events, elapsed }
}

function printEvent(ev, i) {
  console.log(`  [${i + 1}] ${ev.yearDisplay ?? '?'} — ${ev.title}`)
  console.log(`       cat: ${ev.category.join(', ') || '—'}  loc: ${ev.location.join(', ') || '—'}`)
  console.log(`       wiki: ${ev.wikiLink || '(empty)'}`)
  console.log(`       desc: ${ev.description?.slice(0, 100)}${ev.description?.length > 100 ? '…' : ''}`)
}

async function main() {
  await mongoose.connect(config.mongo.uri)

  // Grab 5 lines that look like real events: skip nav sections, prefer ones
  // with an inferred year (meaning the date pre-pass found a date in the line).
  const NAV_HEADINGS = /^(see also|references|notes|further reading|external links|bibliography)$/i
  const lines = await ParsedLine.find({
    status: { $in: ['pending_normalization', 'normalized'] },
    headingContext: { $not: NAV_HEADINGS },
    inferredYear: { $ne: null },
  })
    .sort({ _id: -1 })
    .limit(5)
    .lean()

  if (lines.length === 0) {
    console.error('No ParsedLine documents found. Run the parse stage first.')
    process.exit(1)
  }

  console.log(`\nComparing ${modelA}  vs  ${modelB}`)
  console.log(`Using ${lines.length} real lines from MongoDB:\n`)
  lines.forEach((l, i) => {
    console.log(`  [${i + 1}] heading: "${l.headingContext}" | line: "${l.rawLine.slice(0, 80)}…"`)
  })

  console.log(`\n── ${modelA} ──────────────────────────────────────────`)
  let resA
  try {
    resA = await callModel(modelA, lines)
    console.log(`  Time: ${resA.elapsed}s | Events returned: ${resA.events.length}`)
    resA.events.forEach(printEvent)
  } catch (err) {
    console.error(`  FAILED: ${err.message}`)
  }

  console.log(`\n── ${modelB} ──────────────────────────────────────────`)
  let resB
  try {
    resB = await callModel(modelB, lines)
    console.log(`  Time: ${resB.elapsed}s | Events returned: ${resB.events.length}`)
    resB.events.forEach(printEvent)
  } catch (err) {
    console.error(`  FAILED: ${err.message} (model may not be pulled yet — run: ollama pull ${modelB})`)
  }

  await mongoose.disconnect()
}

main().catch((err) => { console.error(err); process.exit(1) })
