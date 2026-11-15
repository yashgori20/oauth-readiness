// Add ready-to-run requests (sign-in link, curl commands) to saved guides, then re-verify quotes.
// npx tsx scripts/add-requests.mts guides/x.json [...]
import { readFileSync, writeFileSync } from "node:fs";
import { client, draftRequests, listUnverified, verifyQuotes } from "../src/lib/agent.ts";
import { Guide } from "../src/lib/guide.ts";

const ai = client();
for (const p of process.argv.slice(2)) {
  const g = Guide.parse(JSON.parse(readFileSync(p, "utf8")));
  const cache = new Map<string, string>();
  const requests = g.verdict.access === "not-oauth" ? [] : await draftRequests(ai, g, cache);
  const out = listUnverified(await verifyQuotes({ ...g, requests }, cache));
  writeFileSync(p, JSON.stringify(out, null, 2));
  console.log(p, "requests", out.requests.length, out.requests.map((r) => `${r.method} ${r.evidence}`).join(", "));
}
