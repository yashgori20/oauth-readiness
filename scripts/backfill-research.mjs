// Rebuild each guide's research log from its generation log (logs/v5-<slug>.log).
// Those logs truncated each event at 200 characters, so drill-down detail isn't available for these runs.
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
for (const f of readdirSync("guides").filter((f) => f.endsWith(".json"))) {
  const slug = f.slice(0, -5);
  const src = `logs/v5-${slug}.log`;
  if (!existsSync(src)) continue;
  const log = [];
  let seconds = 0;
  for (const line of readFileSync(src, "utf8").split("\n")) {
    const m = /^\[(\d+(?:\.\d+)?)s\] (.*)$/.exec(line.trim());
    if (!m) continue;
    const t = Number(m[1]);
    seconds = Math.max(seconds, Math.round(t));
    const body = m[2];
    const get = (k) => new RegExp(`"${k}":"((?:[^"\\\\]|\\\\.)*)"?`).exec(body)?.[1]?.replace(/\\"/g, '"');
    const type = get("type");
    if (type === "status") log.push({ t, type, message: get("message") });
    else if (type === "tool") log.push({ t, type, name: get("name"), target: get("target"), summary: get("summary") ?? "" });
  }
  const g = JSON.parse(readFileSync(`guides/${f}`, "utf8"));
  g.research = { seconds, log };
  writeFileSync(`guides/${f}`, JSON.stringify(g, null, 2));
  console.log(slug, log.length, "events", seconds + "s");
}
