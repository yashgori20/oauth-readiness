import { generateGuide } from "@/lib/agent";
import { checkLimit } from "@/lib/ratelimit";
import { saveGuide, slugify } from "@/lib/store";

export const maxDuration = 300;

// Streams agent progress as server-sent events so the UI can show the agent working live.
export async function POST(req: Request) {
  const { app } = await req.json();
  if (!app || typeof app !== "string") return new Response("missing app", { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const limit = checkLimit(ip);
  if (!limit.ok) return new Response(limit.reason, { status: 429 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of generateGuide(app.slice(0, 200))) {
          if (ev.type === "guide") {
            ev.guide.slug = slugify(ev.guide.slug || ev.guide.app);
            await saveGuide(ev.guide);
          }
          controller.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
        }
      } catch (e) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "error", message: String(e) })}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
