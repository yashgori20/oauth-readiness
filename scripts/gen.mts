// CLI: npx tsx scripts/gen.mts "Spotify" -> prints events, writes guides/<slug>.json
import { writeFileSync, mkdirSync } from "node:fs";
import { generateGuide } from "../src/lib/agent.ts";

const app = process.argv[2];
const slug = process.argv[3]; // optional: keep an existing guide's URL stable
const t0 = Date.now();
for await (const ev of generateGuide(app)) {
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  if (ev.type === "guide") {
    if (slug) ev.guide.slug = slug;
    mkdirSync("guides", { recursive: true });
    writeFileSync(`guides/${ev.guide.slug}.json`, JSON.stringify(ev.guide, null, 2));
    console.log(`[${s}s] guide -> guides/${ev.guide.slug}.json`);
  } else console.log(`[${s}s]`, ev.type === "error" ? ev.message : JSON.stringify(ev).slice(0, 200));
}
