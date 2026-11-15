// Re-run quote verification on a saved guide against live pages: npx tsx scripts/reverify.mts guides/x.json
import { readFileSync, writeFileSync } from "node:fs";
import { verifyQuotes } from "../src/lib/agent.ts";

const path = process.argv[2];
const g = JSON.parse(readFileSync(path, "utf8"));
const all = (x: typeof g) => [...x.phases.flatMap((p: any) => p.steps.map((s: any) => s.detail)), ...x.gotchas, ...x.whenBlocked];
// Treat previously downgraded quoted claims as candidates again.
for (const c of all(g)) if (c.evidence === "unverified" && c.sources.some((s: any) => s.quote)) c.evidence = "sourced";
const out = await verifyQuotes(g, new Map());
const quotes = all(out).flatMap((c: any) => c.sources.filter((s: any) => s.quote));
console.log(`quotes ${quotes.length}, verified ${quotes.filter((s: any) => s.quoteVerified).length}`);
for (const s of quotes) if (!s.quoteVerified) console.log(" X", s.url, "|", s.quote);
writeFileSync(path, JSON.stringify(out, null, 2));
