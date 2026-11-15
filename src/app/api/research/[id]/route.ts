import { getJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const job = await getJob((await params).id);
  if (!job) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(job, { headers: { "Cache-Control": "no-store" } });
}
