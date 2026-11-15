// Research runs and questions spend Azure tokens, so cap them. In-memory per server instance: on
// Vercel's fluid compute instances are reused, so this holds well enough for a demo without a database.
type Bucket = { perIp: number; daily: number; hits: Map<string, number[]>; day: string; today: number };

const WINDOW_MS = 60 * 60 * 1000;
const buckets: Record<"research" | "ask", Bucket> = {
  research: { perIp: 3, daily: 40, hits: new Map(), day: "", today: 0 },
  ask: { perIp: 30, daily: 400, hits: new Map(), day: "", today: 0 },
};

export function checkLimit(ip: string, kind: keyof typeof buckets = "research"): { ok: true } | { ok: false; reason: string } {
  const b = buckets[kind];
  const now = Date.now();
  const d = new Date(now).toISOString().slice(0, 10);
  if (d !== b.day) {
    b.day = d;
    b.today = 0;
  }
  const what = kind === "research" ? "live researches" : "questions";
  if (b.today >= b.daily) return { ok: false, reason: `The demo has hit its limit of ${what} for today. The library guides still work.` };
  const recent = (b.hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= b.perIp) {
    const mins = Math.ceil((WINDOW_MS - (now - recent[0])) / 60000);
    return { ok: false, reason: `You've used ${b.perIp} ${what} this hour. Try again in ${mins} min.` };
  }
  recent.push(now);
  b.hits.set(ip, recent);
  b.today++;
  return { ok: true };
}
