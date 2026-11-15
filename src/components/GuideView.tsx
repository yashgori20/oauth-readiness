import type { Claim, Guide } from "@/lib/guide";
import { GuideActions } from "./GuideActions";
import { ArrowUpRight, Check, Chevron, Cross } from "./icons";

export const OWNER = {
  agent: { label: "Agent", long: "An agent can do this", cls: "bg-brand-soft text-brand" },
  you: { label: "You", long: "Needs you", cls: "bg-ink text-white" },
  provider: { label: "Provider", long: "Waiting on the provider", cls: "bg-amber-soft text-amber" },
} as const;

const EVIDENCE = {
  tested: { label: "Tested", cls: "text-green", dot: "bg-green", tip: "Confirmed by a live request the agent made" },
  sourced: { label: "Sourced", cls: "text-brand", dot: "bg-brand", tip: "Quote found word-for-word on the cited page" },
  inferred: { label: "Inferred", cls: "text-muted", dot: "bg-muted", tip: "Reasoned from sources, not stated by them" },
  unverified: { label: "Unverified", cls: "text-red", dot: "bg-red", tip: "No page the agent read supports it" },
} as const;

export const DIFFICULTY = ["", "Self-serve", "Easy", "Review required", "Hard", "Gated"];

export function DifficultyMeter({ value }: { value: number }) {
  const on = value >= 4 ? "bg-red" : value === 3 ? "bg-amber" : "bg-green";
  return (
    <span className="inline-flex items-center gap-[3px]" role="img" aria-label={`Difficulty ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-3 w-1.5 ${i <= value ? on : "bg-line"}`} />
      ))}
    </span>
  );
}

export function host(url?: string) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function AppIcon({ guide, size = 28 }: { guide: Pick<Guide, "website" | "developerConsole" | "app">; size?: number }) {
  const domain = host(guide.website || guide.developerConsole).replace(/^(developers?|developer)\./, "");
  if (!domain) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 border border-line bg-surface p-1"
      style={{ width: size, height: size }}
    />
  );
}

function Evidence({ claim }: { claim: Claim }) {
  const e = EVIDENCE[claim.evidence];
  const hosts = claim.sources.map((s) => host(s.url)).filter((v, i, a) => v && a.indexOf(v) === i);
  if (!claim.sources.length)
    return (
      <span className={`label mt-2 inline-flex items-center gap-1.5 ${e.cls}`} title={e.tip}>
        <span className={`h-1.5 w-1.5 ${e.dot}`} /> {e.label}
      </span>
    );
  return (
    <details className="group mt-2">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 select-none" title={e.tip}>
        <span className={`label inline-flex items-center gap-1.5 ${e.cls}`}>
          <span className={`h-1.5 w-1.5 ${e.dot}`} /> {e.label}
        </span>
        <span className="text-xs text-muted">· {hosts.join(", ")}</span>
        <Chevron className="h-3 w-3 text-muted transition-transform group-open:rotate-90" />
      </summary>
      <ul className="mt-3 space-y-3 border-l border-line pl-4">
        {claim.sources.map((s, i) => (
          <li key={i} className="text-sm">
            {s.quote && (
              <p className="text-ink-2">
                <span className="text-muted">“</span>
                {s.quote}
                <span className="text-muted">”</span>
                {s.quoteVerified === true && <span className="label ml-2 text-green">found on page</span>}
                {s.quoteVerified === false && <span className="label ml-2 text-red">not found on page</span>}
              </p>
            )}
            <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-muted underline decoration-line hover:text-brand">
              {s.url}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function GuideView({ guide }: { guide: Guide }) {
  const v = guide.verdict;
  const steps = guide.phases.flatMap((p) => p.steps);
  const count = (o: keyof typeof OWNER) => steps.filter((s) => s.owner === o).length;

  return (
    <article>
      {/* Verdict */}
      <header className="border-b border-line px-5 pt-8 pb-10 sm:px-8 sm:pt-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="label text-muted">
            {guide.origin === "live" ? "Researched live" : "Curated"} ·{" "}
            {new Date(guide.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <GuideActions guide={guide} />
        </div>
        <div className="mt-6 flex items-center gap-4">
          <AppIcon guide={guide} size={44} />
          <h1 className="text-4xl font-normal tracking-[-0.03em] text-ink sm:text-5xl">{guide.app}</h1>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <DifficultyMeter value={v.difficulty} />
          <span className="label text-ink">
            {v.difficulty}/5 · {DIFFICULTY[v.difficulty]}
          </span>
        </div>
        <p className="mt-5 max-w-[68ch] text-xl leading-relaxed text-ink-2 [text-wrap:pretty]">{v.summary}</p>
      </header>

      <dl className="grid border-b border-line sm:grid-cols-3">
        {[
          ["Hands-on effort", v.activeEffort],
          ["Waiting on provider", v.waitTime],
          ["What will block you", v.mainGate],
        ].map(([k, val], i) => (
          <div key={k} className={`px-5 py-6 sm:px-8 ${i ? "border-t border-line sm:border-t-0 sm:border-l" : ""} ${i === 2 ? "bg-brand-soft/60" : ""}`}>
            <dt className={`label ${i === 2 ? "text-brand" : "text-muted"}`}>{k}</dt>
            <dd className="mt-2 text-[15px] leading-relaxed text-ink">{val}</dd>
          </div>
        ))}
      </dl>

      {/* Path */}
      <section className="grid border-b border-line lg:grid-cols-[240px_1fr]">
        <aside className="border-b border-line px-5 py-6 sm:px-8 lg:border-r lg:border-b-0">
          <div className="lg:sticky lg:top-20">
            <h2 className="label text-muted">The path</h2>
            <ol className="mt-4 space-y-2.5">
              {guide.phases.map((p, i) => (
                <li key={i}>
                  <a href={`#phase-${i}`} className="flex items-baseline gap-3 text-sm text-ink-2 hover:text-brand">
                    <span className="label tnum text-muted">{String(i + 1).padStart(2, "0")}</span>
                    {p.name}
                  </a>
                </li>
              ))}
            </ol>
            <h2 className="label mt-8 text-muted">Who does what</h2>
            <ul className="mt-3 space-y-2">
              {(Object.keys(OWNER) as (keyof typeof OWNER)[]).map((o) => (
                <li key={o} className="flex items-center justify-between gap-3 text-sm text-ink-2">
                  <span className="flex items-center gap-2">
                    <span className={`label px-1.5 py-0.5 ${OWNER[o].cls}`}>{OWNER[o].label}</span>
                  </span>
                  <span className="tnum text-muted">{count(o)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div>
          {guide.phases.map((p, pi) => (
            <section key={pi} id={`phase-${pi}`} className="scroll-mt-16 border-b border-line last:border-b-0">
              <h3 className="flex items-baseline gap-3 px-5 pt-7 pb-2 sm:px-8">
                <span className="label tnum text-muted">{String(pi + 1).padStart(2, "0")}</span>
                <span className="text-lg font-medium tracking-tight text-ink">{p.name}</span>
              </h3>
              <ul>
                {p.steps.map((s, si) => (
                  <li key={si} className="grid gap-x-6 gap-y-2 px-5 py-5 sm:grid-cols-[96px_1fr_auto] sm:px-8 [&+li]:border-t [&+li]:border-line">
                    <span className={`label h-fit w-fit px-1.5 py-0.5 ${OWNER[s.owner].cls}`} title={OWNER[s.owner].long}>
                      {OWNER[s.owner].label}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {s.link ? (
                          <a href={s.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand">
                            {s.title} <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          s.title
                        )}
                      </p>
                      <p className="mt-1.5 max-w-[72ch] text-[15px] leading-relaxed text-ink-2">{s.detail.text}</p>
                      <Evidence claim={s.detail} />
                    </div>
                    {s.effort && <span className="label tnum h-fit text-muted sm:max-w-[160px] sm:text-right">{s.effort}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <div className="grid border-b border-line md:grid-cols-2">
        <ClaimList title="Gotchas" claims={guide.gotchas} />
        <ClaimList title="When you're blocked" claims={guide.whenBlocked} className="border-t border-line md:border-t-0 md:border-l" />
      </div>

      {/* Evidence */}
      <section className="px-5 py-10 sm:px-8">
        <h2 className="text-2xl font-normal tracking-[-0.02em] text-ink">How we know</h2>
        <p className="mt-2 max-w-[68ch] text-ink-2">
          Every claim carries its evidence. Quotes are checked word-for-word against the page they cite; a claim whose quote
          isn&apos;t on the page is marked unverified instead of hidden.
        </p>
        <EvidenceSummary guide={guide} />
        {guide.probes.length > 0 && (
          <div className="mt-8">
            <h3 className="label text-muted">Live checks the agent ran</h3>
            <ul className="mt-3 border border-line">
              {guide.probes.map((p, i) => (
                <li key={i} className="grid gap-1 px-4 py-3 font-mono text-xs sm:grid-cols-[20px_160px_1fr] [&+li]:border-t [&+li]:border-line">
                  {p.ok ? <Check className="h-4 w-4 text-green" /> : <Cross className="h-4 w-4 text-red" />}
                  <span className="text-ink">{p.name}</span>
                  <span className="break-all text-muted">
                    {p.target} <span className="text-ink-2">→ {p.result}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {guide.uncertain.length > 0 && (
          <div className="mt-8">
            <h3 className="label text-muted">Still uncertain</h3>
            <ul className="mt-3 max-w-[76ch] space-y-2 text-[15px] leading-relaxed text-ink-2">
              {guide.uncertain.map((u, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-2.5 h-1 w-1 shrink-0 bg-muted" />
                  {u}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </article>
  );
}

function ClaimList({ title, claims, className = "" }: { title: string; claims: Claim[]; className?: string }) {
  if (!claims.length) return null;
  return (
    <section className={`px-5 py-8 sm:px-8 ${className}`}>
      <h2 className="text-lg font-medium tracking-tight text-ink">{title}</h2>
      <ul className="mt-2">
        {claims.map((c, i) => (
          <li key={i} className="py-4 text-[15px] leading-relaxed text-ink-2 [&+li]:border-t [&+li]:border-line">
            {c.text}
            <div>
              <Evidence claim={c} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function evidenceStats(guide: Guide) {
  const claims = [...guide.phases.flatMap((p) => p.steps.map((s) => s.detail)), ...guide.gotchas, ...guide.whenBlocked];
  const quotes = claims.flatMap((c) => c.sources.filter((s) => s.quote));
  return { claims, quotes, verified: quotes.filter((q) => q.quoteVerified).length };
}

function EvidenceSummary({ guide }: { guide: Guide }) {
  const { claims, quotes, verified } = evidenceStats(guide);
  return (
    <dl className="mt-6 grid grid-cols-2 border border-line sm:grid-cols-5">
      {(Object.keys(EVIDENCE) as (keyof typeof EVIDENCE)[]).map((k, i) => (
        <div key={k} className={`px-4 py-3 ${i ? "border-l border-line" : ""} ${i === 2 ? "max-sm:border-l-0 max-sm:border-t" : ""} ${i === 3 ? "max-sm:border-t" : ""}`}>
          <dt className={`label inline-flex items-center gap-1.5 ${EVIDENCE[k].cls}`}>
            <span className={`h-1.5 w-1.5 ${EVIDENCE[k].dot}`} />
            {EVIDENCE[k].label}
          </dt>
          <dd className="tnum mt-1 text-2xl font-light text-ink">{claims.filter((c) => c.evidence === k).length}</dd>
        </div>
      ))}
      <div className="col-span-2 border-t border-line px-4 py-3 sm:col-span-1 sm:border-t-0 sm:border-l">
        <dt className="label text-muted">Quotes found on page</dt>
        <dd className="tnum mt-1 text-2xl font-light text-ink">
          {verified}
          <span className="text-muted">/{quotes.length}</span>
        </dd>
      </div>
    </dl>
  );
}
