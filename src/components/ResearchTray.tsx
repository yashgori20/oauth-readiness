"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { readTray, removeFromTray, type TrayJob } from "@/lib/tray";
import { ArrowRight, Check, Cross } from "./icons";

type Status = { status: "running" | "done" | "error"; slug?: string; finishedAt?: number };

// Header indicator for research runs started in this browser: running, ready, or failed, on every page.
export function ResearchTray() {
  const [jobs, setJobs] = useState<TrayJob[]>([]);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => setJobs(readTray());
    load();
    window.addEventListener("tray-changed", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("tray-changed", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  // Poll jobs that aren't finished yet.
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      const pending = jobs.filter((j) => !status[j.id] || status[j.id].status === "running");
      for (const j of pending) {
        const res = await fetch(`/api/research/${j.id}`, { cache: "no-store" }).catch(() => null);
        if (stop) return;
        if (res?.status === 404) removeFromTray(j.id);
        else if (res?.ok) {
          const d = await res.json();
          setStatus((s) => ({ ...s, [j.id]: { status: d.status, slug: d.slug, finishedAt: d.finishedAt } }));
        }
      }
    };
    poll();
    const t = setInterval(poll, 3000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stop = true;
      clearInterval(t);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  if (!jobs.length) return null;
  const running = jobs.filter((j) => (status[j.id]?.status ?? "running") === "running");
  const lead = running[0] ?? jobs[0];
  const leadStatus = status[lead.id]?.status ?? "running";

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="label inline-flex h-9 items-center gap-2 border border-line px-2.5 text-ink-2 hover:border-ink hover:text-ink"
        aria-expanded={open}
      >
        {leadStatus === "running" ? (
          <span className="h-1.5 w-1.5 animate-pulse bg-brand" />
        ) : leadStatus === "done" ? (
          <Check className="h-3.5 w-3.5 text-green" />
        ) : (
          <Cross className="h-3.5 w-3.5 text-red" />
        )}
        <span className="hidden max-w-[16ch] truncate md:inline">
          {running.length ? `Researching ${lead.app}` : leadStatus === "done" ? `${lead.app} ready` : `${lead.app} failed`}
        </span>
        {running.length > 1 && <span className="tnum text-muted">+{running.length - 1}</span>}
      </button>

      {open && (
        <div className="absolute top-11 right-0 z-50 w-[320px] border border-line bg-surface shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
          <p className="label border-b border-line px-4 py-2.5 text-muted">Your research</p>
          <ul>
            {jobs.map((j) => {
              const s = status[j.id]?.status ?? "running";
              const secs = Math.round(((status[j.id]?.finishedAt ?? now) - j.startedAt) / 1000);
              return (
                <li key={j.id} className="flex items-center gap-3 px-4 py-3 [&+li]:border-t [&+li]:border-line">
                  {s === "running" ? <span className="h-1.5 w-1.5 shrink-0 animate-pulse bg-brand" /> : s === "done" ? <Check className="h-3.5 w-3.5 shrink-0 text-green" /> : <Cross className="h-3.5 w-3.5 shrink-0 text-red" />}
                  <div className="min-w-0 flex-1">
                    <Link href={`/research/${j.id}`} onClick={() => setOpen(false)} className="block truncate text-sm text-ink hover:text-brand">
                      {j.app}
                    </Link>
                    <p className="label tnum text-muted">
                      {s === "running" ? `Running · ${secs}s` : s === "done" ? `Ready · ${secs}s` : "Failed"}
                    </p>
                  </div>
                  {s === "done" && status[j.id]?.slug && (
                    <Link href={`/apps/${status[j.id].slug}`} onClick={() => setOpen(false)} className="label inline-flex items-center gap-1 text-brand hover:text-brand-hover">
                      Guide <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                  {s !== "running" && (
                    <button onClick={() => removeFromTray(j.id)} className="p-1 text-muted hover:text-ink" aria-label={`Remove ${j.app}`}>
                      <Cross className="h-3 w-3" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
