// Re-apply the "unverified claims go to uncertain" rule to saved guides: npx tsx scripts/list-unverified.mts guides/*.json
import { readFileSync, writeFileSync } from "node:fs";
import { listUnverified } from "../src/lib/agent.ts";
import { Guide } from "../src/lib/guide.ts";
for (const p of process.argv.slice(2)) {
  const g = listUnverified(Guide.parse(JSON.parse(readFileSync(p, "utf8"))));
  writeFileSync(p, JSON.stringify(g, null, 2));
  console.log(p, "uncertain", g.uncertain.length);
}
