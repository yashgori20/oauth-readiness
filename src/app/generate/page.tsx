"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { GuideView } from "@/components/GuideView";
import { ArrowRight, Bolt, Check, Doc, Pen, Search } from "@/components/icons";
import type { AgentEvent } from "@/lib/agent";
import type { Guide } from "@/lib/guide";

const STAGES = ["Research", "Probe", "Write", "Verify"] as const;
const ICON = { search: Search, read: Doc, probe: Bolt } as const;

function stageOf(events: AgentEvent[], done: boolean) {
  if (done) return 4;
  const last = [...events].reverse().find((e) => e.type === "status") as Extract<AgentEvent, { type: "status" }> | undefined;
  const m = last?.message ?? "";
  if (m.startsWith("Checking")) return 3;
  if (m.startsWith("Writing")) return 2;
  if (m.startsWith("Probing")) return 1;
  return 0;
}

function Live() {
  const app = useSearchParams().get("app") ?? "";
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState("");
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const ran = useRef(false);

  const finished = !!guide || !!error;
  useEffect(() => {
    if (finished) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [finished]);

  useEffect(() => {
    if (!app || ran.current) return;
    ran.current = true;
    (async () => {
      const res = await fetch("/api/generate", { method: "POST", body: JSON.stringify({ app }) });
      if (!res.ok || !res.body) return setError(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          if (!p.startsWith("data: ")) continue;
          const ev = JSON.parse(p.slice(6)) as AgentEvent;
          if (ev.type === "guide") setGuide(ev.guide);
          else if (ev.type === "error") setError(ev.message);
          else setEvents((e) => [...e, ev]);
        }
      }
    })().catch((e) => setError(String(e)));
  }, [app]);

  const done = !!guide || !!error;
  const stage = stageOf(events, !!guide);
  const secs = Math.round((now - started) / 1000);
  const tools = events.filter((e) => e.type === "tool");
  const counts = { search: 0, read: 0, probe: 0 } as Record<string, number>;
  for (const t of tools) if (t.type === "tool") counts[t.name] = (counts[t.name] ?? 0) + 1;

  return (
    <div>
      <section className="border-b border-line px-5 pt-10 pb-8 sm:px-8">
        <p className="label text-muted">Live research</p>
        <h1 className="mt-3 text-4xl font-normal tracking-[-0.03em] text-ink sm:text-5xl">{app}</h1>

        <ol className="mt-8 grid grid-cols-4 border border-line">
          {STAGES.map((s, i) => {
            const state = i < stage ? "done" : i === stage && !error ? "active" : "todo";
            return (
              <li
                key={s}
                className={`flex items-center gap-2 px-3 py-3 sm:px-4 [&+li]:border-l [&+li]:border-line ${state === "active" ? "bg-brand text-white" : state === "done" ? "text-ink" : "text-muted"}`}
              >
                {state === "done" ? <Check className="h-3.5 w-3.5 text-green" /> : <span className="label tnum">{String(i + 1).padStart(2, "0")}</span>}
                <span className="label">{s}</span>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
          <span className="label tnum text-muted">
            {counts.search} searches · {counts.read} pages read · {counts.probe} probes
          </span>
          {!done && <span className="label tnum ml-auto text-ink">{secs}s</span>}
        </div>
      </section>

      <section className={`border-b border-line ${guide ? "max-h-72 overflow-y-auto" : ""}`} aria-live="polite">
        <ol className="font-mono text-xs">
          {events.map((ev, i) => {
            if (ev.type === "status")
              return (
                <li key={i} className="settle flex items-center gap-3 bg-ground px-5 py-2.5 sm:px-8 [&+li]:border-t [&+li]:border-line">
                  <Pen className="h-3.5 w-3.5 text-brand" />
                  <span className="font-sans text-sm text-ink">{ev.message}</span>
                </li>
              );
            if (ev.type !== "tool") return null;
            const Icon = ICON[ev.name as keyof typeof ICON] ?? Doc;
            const bad = /failed|empty|blocked|nothing relevant/.test(ev.summary);
            return (
              <li key={i} className="settle grid grid-cols-[16px_1fr] gap-3 px-5 py-2.5 sm:grid-cols-[16px_1fr_auto] sm:px-8 [&+li]:border-t [&+li]:border-line">
                <Icon className="h-3.5 w-3.5 text-muted" />
                <span className="min-w-0 truncate text-ink-2" title={ev.target}>
                  {ev.target}
                </span>
                <span className={`col-start-2 sm:col-start-auto ${bad ? "text-red" : "text-muted"}`}>{ev.summary}</span>
              </li>
            );
          })}
          {!done && (
            <li className="flex items-center gap-3 border-t border-line px-5 py-3 text-muted sm:px-8">
              <span className="h-1.5 w-1.5 animate-pulse bg-brand" /> working
            </li>
          )}
        </ol>
      </section>

      {error && (
        <div className="border-b border-line bg-red-soft px-5 py-5 sm:px-8">
          <p className="label text-red">The agent couldn&apos;t finish this guide</p>
          <p className="mt-2 max-w-[80ch] text-sm whitespace-pre-wrap text-ink-2">{error.slice(0, 600)}</p>
          <Link href="/#research" className="label mt-3 inline-flex items-center gap-1.5 text-ink hover:text-brand">
            Try again <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {guide && (
        <>
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-green-soft px-5 py-3 sm:px-8">
            <Check className="h-4 w-4 text-green" />
            <span className="text-sm text-ink">Saved in {secs}s. Shareable at</span>
            <Link href={`/apps/${guide.slug}`} className="font-mono text-sm text-brand underline">
              /apps/{guide.slug}
            </Link>
          </div>
          <GuideView guide={guide} />
        </>
      )}
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense>
      <Live />
    </Suspense>
  );
}
