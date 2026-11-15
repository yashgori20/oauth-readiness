import { after } from "next/server";
import { createJob, runJob } from "@/lib/jobs";
import { checkLimit } from "@/lib/ratelimit";

export const maxDuration = 300;

// Starts a research job and returns its id at once. The job keeps running after the response
// (via after()), so the developer can leave the page and come back to it.
export async function POST(req: Request) {
  const { app } = await req.json().catch(() => ({}));
  if (!app || typeof app !== "string" || !app.trim()) return Response.json({ error: "missing app" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const limit = checkLimit(ip, "research");
  if (!limit.ok) return Response.json({ error: limit.reason }, { status: 429 });
  const job = createJob(app.trim().slice(0, 200));
  after(() => runJob(job));
  return Response.json({ id: job.id, app: job.app });
}
