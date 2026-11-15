import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "@/components/icons";
import { ResearchHeader, ResearchLog, ResearchProgress } from "@/components/ResearchLog";
import { getGuide } from "@/lib/store";

export const dynamic = "force-dynamic";

// How a guide was researched: every search, page read and probe the agent made, in order.
export default async function GuideResearch({ params }: { params: Promise<{ slug: string }> }) {
  const guide = await getGuide((await params).slug);
  if (!guide) notFound();
  const log = guide.research?.log ?? [];
  const hasDetail = log.some((e) => e.type === "tool" && e.detail?.length);
  return (
    <div>
      <ResearchHeader app={guide.app} kicker="How this guide was researched">
        <Link href={`/apps/${guide.slug}`} className="label mt-4 inline-flex items-center gap-1.5 text-brand hover:text-brand-hover">
          Back to the guide <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        {log.length ? (
          <>
            <ResearchProgress log={log} done seconds={guide.research?.seconds} />
            {!hasDetail && (
              <p className="mt-4 max-w-[70ch] text-sm text-muted">
                This run was recorded before the log kept each search&apos;s results and each page&apos;s extracted facts, so rows here don&apos;t expand.
                Runs started from the site now keep the full detail.
              </p>
            )}
          </>
        ) : (
          <p className="mt-6 text-sm text-ink-2">No research log was recorded for this guide.</p>
        )}
      </ResearchHeader>
      {log.length > 0 && <ResearchLog log={log} />}
    </div>
  );
}
