// Research runs spend Azure tokens, so cap them. In-memory per server instance: on Vercel's
// fluid compute instances are reused, so this holds well enough for a demo without a database.
const PER_IP = 3;
const WINDOW_MS = 60 * 60 * 1000;
const DAILY_TOTAL = 40;

const hits = new Map<string, number[]>();
let day = "";
let today = 0;

export function checkLimit(ip: string): { ok: true } | { ok: false; reason: string } {
  const now = Date.now();
  const d = new Date(now).toISOString().slice(0, 10);
  if (d !== day) {
    day = d;
    today = 0;
  }
  if (today >= DAILY_TOTAL) return { ok: false, reason: "The demo has hit its research limit for today. The library guides still work." };
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_IP) {
    const mins = Math.ceil((WINDOW_MS - (now - recent[0])) / 60000);
    return { ok: false, reason: `You've run ${PER_IP} live researches this hour. Try again in ${mins} min, or browse the library.` };
  }
  recent.push(now);
  hits.set(ip, recent);
  today++;
  return { ok: true };
}
