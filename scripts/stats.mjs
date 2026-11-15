// Evidence stats for a folder of guides: node scripts/stats.mjs guides [validation/v1]
import { readdirSync, readFileSync } from "node:fs";
const claimsOf = (g) => [
  ...(g.agentPath ? [g.agentPath.recommendation, ...g.agentPath.scopeTiers] : []),
  ...(g.essentials ?? []),
  ...g.phases.flatMap((p) => p.steps.map((s) => s.detail)),
  ...g.gotchas,
  ...g.whenBlocked,
];
for (const dir of process.argv.slice(2)) {
  console.log(`\n== ${dir}`);
  const tot = { claims: 0, q: 0, qv: 0, ev: {} };
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const g = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
    const c = claimsOf(g);
    const q = c.flatMap((x) => x.sources).filter((s) => s.quote);
    const ev = {};
    for (const x of c) ev[x.evidence] = (ev[x.evidence] ?? 0) + 1;
    const steps = g.phases.flatMap((p) => p.steps);
    const ess = (g.essentials ?? []).filter((e) => !e.text.startsWith("Not found")).length;
    console.log(
      f.padEnd(42),
      `d${g.verdict.difficulty} ${(g.verdict.access ?? "-").padEnd(10)}`,
      `claims ${String(c.length).padStart(3)}`,
      `quotes ${q.filter((s) => s.quoteVerified).length}/${q.length}`.padEnd(14),
      Object.entries(ev).map(([k, v]) => `${k[0]}${v}`).join(" ").padEnd(18),
      `agent ${steps.filter((s) => s.owner === "agent").length}(out ${steps.filter((s) => s.output).length})`,
      `effort ${steps.filter((s) => s.effort).length}/${steps.length}`,
      `ess ${ess}/${(g.essentials ?? []).length || 7}`,
      `tiers ${g.agentPath?.scopeTiers.length ?? 0}`,
    );
    tot.claims += c.length; tot.q += q.length; tot.qv += q.filter((s) => s.quoteVerified).length;
    for (const [k, v] of Object.entries(ev)) tot.ev[k] = (tot.ev[k] ?? 0) + v;
  }
  console.log("TOTAL claims", tot.claims, "quotes", `${tot.qv}/${tot.q}`, JSON.stringify(tot.ev));
}
