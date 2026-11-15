"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowRight, Check } from "@/components/icons";
import { ResearchHeader, ResearchLog, ResearchProgress, type LogEntry } from "@/components/ResearchLog";
import type { Job } from "@/lib/jobs";

// Follows a background research job. Safe to leave and reopen: the job runs on the server.
export default function ResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [missing, setMissing] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      const res = await fetch(`/api/research/${id}`, { cache: "no-store" }).catch(() => null);
      if (stop) return;
      if (res?.status === 404) return setMissing(true);
      if (res?.ok) {
        const j = (await res.json()) as Job;
        setJob(j);
        if (j.status !== "running") return;
      }
      setTimeout(poll, 1500);
    };
    poll();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stop = true;
      clearInterval(tick);
    };
  }, [id]);

  if (missing)
    return (
      <ResearchHeader app="Research not found" kicker="Live research">
        <p className="mt-6 text-sm text-ink-2">This run has expired or never existed. Start a new one from the home page.</p>
      </ResearchHeader>
    );
  if (!job)
    return (
      <ResearchHeader app="…" kicker="Live research">
        <p className="mt-8 flex items-center gap-3 text-sm text-muted">
          <span className="h-1.5 w-1.5 animate-pulse bg-brand" /> Loading
        </p>
      </ResearchHeader>
    );

  const running = job.status === "running";
  const seconds = Math.round(((job.finishedAt ?? now) - job.startedAt) / 1000);
  const log: LogEntry[] = job.events.map((e) =>
    e.type === "status" ? { type: "status", message: e.message } : e.type === "tool" ? { type: "tool", name: e.name, target: e.target, summary: e.summary, detail: e.detail } : { type: "status", message: "" },
  );

  return (
    <div>
      <ResearchHeader app={job.app} kicker={running ? "Live research · you can leave this page, it keeps running" : "Live research"}>
        <ResearchProgress log={log} done={!running} failed={job.status === "error"} seconds={seconds} />
      </ResearchHeader>
      {job.status === "done" && job.slug && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-green-soft px-5 py-4 sm:px-8">
          <Check className="h-4 w-4 text-green" />
          <span className="text-sm text-ink">Guide ready in {seconds}s.</span>
          <Link href={`/apps/${job.slug}`} className="label ml-auto inline-flex items-center gap-1.5 border border-ink bg-ink px-3 py-2 text-on-ink hover:bg-ink-2">
            Open the guide <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
      {job.status === "error" && (
        <div className="border-b border-line bg-red-soft px-5 py-5 sm:px-8">
          <p className="label text-red">The agent couldn&apos;t finish this guide</p>
          <p className="mt-2 max-w-[80ch] text-sm whitespace-pre-wrap text-ink-2">{job.error?.slice(0, 600)}</p>
          <Link href="/#research" className="label mt-3 inline-flex items-center gap-1.5 text-ink hover:text-brand">
            Try again <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
      <ResearchLog log={log} working={running} />
    </div>
  );
}
