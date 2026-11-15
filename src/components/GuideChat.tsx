"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Cross, Search } from "./icons";

type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; refs?: { id: string; label: string }[]; sources?: { title: string; url: string }[]; searched?: boolean; error?: boolean };

const PANEL = 400;
const DOCK_MIN = 1100; // from this width the panel is always open on the right and the page shifts left

const STARTERS = ["How long will this really take?", "Which scopes does my agent need?", "What happens if I get rejected?"];

// Scroll to the sections an answer is based on and flash them.
function jumpTo(ids: string[]) {
  const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
  if (!els.length) return;
  // Sections and steps are collapsed by default: open every fold around the target, and the step itself.
  for (const el of els) {
    for (let p: HTMLElement | null = el.parentElement; p; p = p.parentElement) if (p instanceof HTMLDetailsElement) p.open = true;
    const own = el.querySelector(":scope > details");
    if (own instanceof HTMLDetailsElement) own.open = true;
  }
  els[0].scrollIntoView({ behavior: "smooth", block: "center" });
  for (const el of els) {
    el.classList.add("ask-hit");
    setTimeout(() => el.classList.remove("ask-hit"), 4000);
  }
}

export function GuideChat({ slug, app }: { slug: string; app: string }) {
  const [open, setOpen] = useState(false);
  const [docked, setDocked] = useState(false); // wide screens: panel sits beside the page, open by default
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);

  // Laptop and desktop widths: the panel is always open on the right.
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DOCK_MIN}px)`);
    const apply = () => {
      setDocked(mq.matches);
      setOpen(mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Reserve the space on the right: the page moves left and the panel never covers the section it points to.
  useEffect(() => {
    document.body.style.paddingRight = docked ? `${PANEL}px` : "";
    return () => {
      document.body.style.paddingRight = "";
    };
  }, [docked]);

  const toggle = (next: boolean) => setOpen(next);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setQ("");
    setBusy(true);
    try {
      const res = await fetch("/api/ask", { method: "POST", body: JSON.stringify({ slug, question: text, history }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setMsgs((m) => [...m, { role: "assistant", content: data.answer, refs: data.refs, sources: data.sources, searched: data.searched }]);
      if (data.refs?.length) jumpTo(data.refs.map((r: { id: string }) => r.id));
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open && !docked)
    return (
      <button
        onClick={() => toggle(true)}
        className="label fixed right-5 bottom-5 z-40 inline-flex items-center gap-2 border border-ink bg-ink px-4 py-3 text-on-ink shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:border-brand hover:bg-brand hover:text-white"
      >
        <Search className="h-4 w-4" /> Ask about this guide
      </button>
    );

  return (
    <aside
      className={`fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface sm:w-[400px] ${docked ? "" : "shadow-[-8px_0_32px_rgba(0,0,0,0.12)]"}`}
      aria-label="Ask about this guide"
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
        <span className="font-medium tracking-tight text-ink">Ask about {app}</span>
        {!docked && (
          <button onClick={() => toggle(false)} className="p-1 text-muted hover:text-ink" aria-label="Close" title="Close">
            <Cross className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {msgs.length === 0 && (
          <div>
            <p className="text-sm leading-relaxed text-ink-2">
              Ask anything about this guide. If the answer is in it, I&apos;ll point you to the exact section. If it isn&apos;t, I&apos;ll search
              the web and show the sources.
            </p>
            <div className="mt-4 flex flex-col items-start gap-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="border border-line px-3 py-2 text-left text-sm text-ink-2 hover:border-brand hover:text-brand">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <ol className="space-y-5">
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <li key={i} className="ml-8 bg-ground px-3.5 py-2.5 text-sm text-ink">
                {m.content}
              </li>
            ) : (
              <li key={i} className={`text-sm leading-relaxed ${m.error ? "text-red" : "text-ink"}`}>
                {m.searched && <p className="label mb-1.5 text-amber">Not in the guide · searched the web</p>}
                <p className="whitespace-pre-wrap">{m.content}</p>
                {!!m.refs?.length && (
                  <div className="mt-3">
                    <p className="label text-muted">From this guide</p>
                    <ul className="mt-1.5 space-y-1">
                      {m.refs.map((r) => (
                        <li key={r.id}>
                          <button onClick={() => jumpTo([r.id])} className="inline-flex items-center gap-1.5 text-left text-brand hover:text-brand-hover">
                            <ArrowRight className="h-3 w-3 shrink-0" /> {r.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!!m.sources?.length && (
                  <div className="mt-3">
                    <p className="label text-muted">Sources</p>
                    <ul className="mt-1.5 space-y-1">
                      {m.sources.map((s) => (
                        <li key={s.url}>
                          <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1.5 break-all text-brand hover:text-brand-hover">
                            <ArrowUpRight className="mt-1 h-3 w-3 shrink-0" /> {s.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ),
          )}
          {busy && (
            <li className="flex items-center gap-2 text-sm text-muted">
              <span className="h-1.5 w-1.5 animate-pulse bg-brand" /> Reading the guide…
            </li>
          )}
        </ol>
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="flex shrink-0 border-t border-line"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask a question"
          className="h-14 flex-1 bg-transparent px-5 text-sm text-ink outline-none"
          aria-label="Your question"
        />
        <button disabled={!q.trim() || busy} className="label bg-ink px-5 text-on-ink hover:bg-brand hover:text-white disabled:bg-disabled disabled:text-muted">
          Ask
        </button>
      </form>
    </aside>
  );
}
