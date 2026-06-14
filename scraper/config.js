export default {
  wikipedia: {
    // IMPORTANT: update this with your email before running
    userAgent: "Chronicle/1.0 (portfolio project; smillerjess@gmail.com)",
    baseUrl: "https://en.wikipedia.org/w/api.php",
    delayMs: 500,
    maxlag: 5,
    cacheMaxAgeDays: 7,
  },
  ollama: {
    model: "llama3.2:3b", // 'llama3.2:3b' for lighter load, 'llama3.1:70b' for quality
    host: "http://127.0.0.1:11434",
    keepAlive: "30m",
    concurrency: 1, // keep at 1 to stay responsive; raise to 2 if idle
    temperature: 0,
    delayBetweenChunksMs: 0, // pause between Ollama calls; set to 0 to run full speed
  },
  mongo: {
    uri: process.env.MONGO_URI || "mongodb://localhost:27017/chronicle",
  },
  // Seed titles to test with before running full discovery.
  // Run: node index.js discover --seed-only
  // Tier 1 — bullet-list format, cheerio handles immediately
  // Tier 2 — wikitable format, requires the table parser in stages/parse.js
  seedTitles: [
    "Timeline of the French Revolution", // Tier 1 — already in DB
    "Timeline of ancient Greece", // Tier 1 — 1,050+ bullets, 800–30 BC
    "Timeline of the Cold War", // Tier 1 — 487 bullets, 1945–1991
    "Timeline of the American Revolution", // Tier 1 — 450+ bullets, 1215–1800
    "Timeline of women's suffrage", // Tier 1 — 450+ bullets, 1689–2021
    "Timeline of Christianity", // Tier 1 — 450+ bullets, 6 AD–1903
    "Timeline of prehistory", // Tier 1 — 180+ bullets, 315,000 ya–3200 BC
    "Timeline of the Napoleonic era", // Tier 1 — 87 bullets, 1769–1821
    "Timeline of Roman history", // Tier 2 — wikitable, 753 BC–476 CE
    "Timeline of the Space Race", // Tier 2 — wikitable, 1955–1990
    "Timeline of the Ottoman Empire", // Tier 2 — wikitable, 1298–1924
  ],
};
