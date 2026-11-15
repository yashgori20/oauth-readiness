import { askGuide } from "@/lib/ask";
import { checkLimit } from "@/lib/ratelimit";
import { getGuide } from "@/lib/store";

export const maxDuration = 120;

// Answers a question about one guide: from the guide itself (with section ids to highlight), or from a live web search.
export async function POST(req: Request) {
  const { slug, question, history } = await req.json().catch(() => ({}));
  if (typeof slug !== "string" || typeof question !== "string" || !question.trim()) return Response.json({ error: "missing question" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const limit = checkLimit(ip, "ask");
  if (!limit.ok) return Response.json({ error: limit.reason }, { status: 429 });
  const guide = await getGuide(slug);
  if (!guide) return Response.json({ error: "guide not found" }, { status: 404 });
  try {
    const clean = (Array.isArray(history) ? history : [])
      .filter((m: { role?: unknown; content?: unknown }) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
      .map((m: { role: "user" | "assistant"; content: string }) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    return Response.json(await askGuide(guide, question.slice(0, 500), clean));
  } catch (e) {
    return Response.json({ error: `Couldn't answer: ${String(e).slice(0, 160)}` }, { status: 500 });
  }
}
