import Link from "next/link";
import { ArrowRight, Bolt, Check, Chevron, Doc, Pen, Search } from "./icons";

// One entry in a research run: a status line, or a search / page read / probe.
export type LogEntry = { type: "status"; message?: string; t?: number } | { type: "tool"; name?: string; target?: string; summary?: string; detail?: string[]; t?: number };

const STAGES = ["Research", "Probe", "Write", "Verify"] as const;
const ICON = { search: Search, read: Doc, probe: Bolt } as const;

function stageOf(log: LogEntry[], done: boolean) {
  if (done) return 4;
  const last = [...log].reverse().find((e) => e.type === "status");
  const m = (last?.type === "status" && last.message) || "";
  if (m.startsWith("Checking")) return 3;
  if (m.startsWith("Writing")) return 2;
  if (m.startsWith("Probing")) return 1;
  return 0;
}

export function ResearchHeader({ app, kicker, children }: { app: string; kicker: string; children?: React.ReactNode }) {
  return (
    <section className="border-b border-line px-5 pt-6 pb-8 sm:px-8 sm:pt-8">
      <Link href="/#library" className="label group mb-6 inline-flex items-center gap-1.5 text-muted hover:text-ink">
        <ArrowRight className="h-3.5 w-3.5 rotate-180 transition-transform group-hover:-translate-x-0.5" /> All guides
      </Link>
      <p className="label text-muted">{kicker}</p>
      <h1 className="mt-3 text-4xl font-normal tracking-[-0.03em] text-ink sm:text-5xl">{app}</h1>
      {children}
    </section>
  );
}

export function ResearchProgress({ log, done, failed, seconds }: { log: LogEntry[]; done: boolean; failed?: boolean; seconds?: number }) {
  const stage = stageOf(log, done && !failed);
  const counts: Record<string, number> = { search: 0, read: 0, probe: 0 };
  for (const e of log) if (e.type === "tool" && e.name) counts[e.name] = (counts[e.name] ?? 0) + 1;
  return (
    <>
      <ol className="mt-8 grid grid-cols-4 border border-line">
        {STAGES.map((s, i) => {
          const state = i < stage ? "done" : i === stage && !failed && !done ? "active" : "todo";
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
        {seconds !== undefined && <span className="label tnum ml-auto text-ink">{seconds}s</span>}
      </div>
    </>
  );
}

export function ResearchLog({ log, working }: { log: LogEntry[]; working?: boolean }) {
  return (
    <section className="border-b border-line" aria-live="polite">
      <ol className="font-mono text-xs">
        {log.map((ev, i) => {
          const time = ev.t !== undefined ? <span className="label tnum w-12 shrink-0 text-right text-muted">{ev.t.toFixed(0)}s</span> : null;
          if (ev.type === "status")
            return (
              <li key={i} className="settle flex items-center gap-3 bg-ground px-5 py-2.5 sm:px-8 [&+li]:border-t [&+li]:border-line">
                <Pen className="h-3.5 w-3.5 text-brand" />
                <span className="flex-1 font-sans text-sm text-ink">{ev.message}</span>
                {time}
              </li>
            );
          const Icon = ICON[ev.name as keyof typeof ICON] ?? Doc;
          const bad = /failed|empty|blocked|nothing relevant/.test(ev.summary ?? "");
          const row = (
            <>
              <Icon className="h-3.5 w-3.5 text-muted" />
              <span className="min-w-0 truncate text-ink-2" title={ev.target}>
                {ev.target}
              </span>
              <span className={`col-start-2 inline-flex items-center gap-1.5 sm:col-start-auto ${bad ? "text-red" : "text-muted"}`}>
                {ev.summary}
                {!!ev.detail?.length && <Chevron className="h-3 w-3 transition-transform group-open:rotate-90" />}
              </span>
            </>
          );
          const grid = "grid grid-cols-[16px_1fr] gap-3 px-5 py-2.5 sm:grid-cols-[16px_1fr_auto] sm:px-8";
          return (
            <li key={i} className="settle [&+li]:border-t [&+li]:border-line">
              {ev.detail?.length ? (
                // Drill down: search results, or the facts the reader pulled from the page.
                <details className="group">
                  <summary className={`${grid} cursor-pointer list-none hover:bg-ground`}>{row}</summary>
                  <ul className="space-y-1.5 border-t border-line bg-ground px-5 py-3 pl-12 font-sans text-[13px] leading-relaxed text-ink-2 sm:px-8 sm:pl-[60px]">
                    {ev.detail.map((d, j) => {
                      if (ev.name === "search") {
                        const [title, url = ""] = d.split(" | ");
                        return (
                          <li key={j}>
                            <a href={url} target="_blank" rel="noreferrer" className="hover:text-brand">
                              {title} <span className="text-muted">· {url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 70)}</span>
                            </a>
                          </li>
                        );
                      }
                      return <li key={j}>{d}</li>;
                    })}
                  </ul>
                </details>
              ) : (
                <div className={grid}>{row}</div>
              )}
            </li>
          );
        })}
        {working && (
          <li className="flex items-center gap-3 border-t border-line px-5 py-3 text-muted sm:px-8">
            <span className="h-1.5 w-1.5 animate-pulse bg-brand" /> working
          </li>
        )}
      </ol>
    </section>
  );
}
