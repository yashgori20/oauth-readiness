import { allClaims, type Claim, type Guide } from "@/lib/guide";
import { CopyButton } from "./CopyButton";
import { GuideActions } from "./GuideActions";
import { GuideChat } from "./GuideChat";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Chevron, Cross } from "./icons";

export const OWNER = {
  agent: { label: "Agent", long: "An agent can do this", cls: "bg-brand-soft text-brand" },
  you: { label: "You", long: "Needs you", cls: "bg-ink text-on-ink" },
  provider: { label: "Provider", long: "Waiting on the provider", cls: "bg-amber-soft text-amber" },
} as const;

const EVIDENCE = {
  tested: { label: "Tested", cls: "text-green", dot: "bg-green", tip: "Confirmed by a live request the agent made" },
  sourced: { label: "Sourced", cls: "text-brand", dot: "bg-brand", tip: "Official page; every quote found word-for-word on it" },
  reported: { label: "Reported", cls: "text-amber", dot: "bg-amber", tip: "Community or third-party report; quotes found on the page" },
  inferred: { label: "Inferred", cls: "text-muted", dot: "bg-muted", tip: "Reasoned from sources, not stated by them" },
  unverified: { label: "Unverified", cls: "text-red", dot: "bg-red", tip: "A cited quote wasn't found on its page, or nothing supports it" },
} as const;

export const DIFFICULTY = ["", "Self-serve", "Easy", "Review required", "Hard", "Gated"];

export const ACCESS = {
  open: null,
  gated: null,
  ineligible: { label: "Not available for AI agents", cls: "bg-red-soft text-red" },
  "not-oauth": { label: "No OAuth: API key only", cls: "bg-amber-soft text-amber" },
} as const;

export function AccessBadge({ access }: { access: Guide["verdict"]["access"] }) {
  const a = ACCESS[access];
  return a ? <span className={`label px-1.5 py-0.5 ${a.cls}`}>{a.label}</span> : null;
}

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
      className="shrink-0 border border-line bg-white p-1" // favicons are drawn for light backgrounds
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
    <details className="group/ev mt-2">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 select-none" title={e.tip}>
        <span className={`label inline-flex items-center gap-1.5 ${e.cls}`}>
          <span className={`h-1.5 w-1.5 ${e.dot}`} /> {e.label}
        </span>
        <span className="text-xs text-muted">· {hosts.join(", ")}</span>
        <Chevron className="h-3 w-3 text-muted transition-transform group-open/ev:rotate-90" />
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
  const { quotes, verified, claims } = evidenceStats(guide);
  const unverified = claims.filter((c) => c.evidence === "unverified").length;
  const pct = quotes.length ? Math.round((verified / quotes.length) * 100) : 0;

  return (
    <article>
      {/* 1. Verdict: always visible, the answer in one screen */}
      <header id="ref-verdict" className="scroll-mt-16 border-b border-line px-5 pt-6 pb-10 sm:px-8 sm:pt-8">
        <Link href="/#library" className="label group mb-6 inline-flex items-center gap-1.5 text-muted hover:text-ink">
          <ArrowRight className="h-3.5 w-3.5 rotate-180 transition-transform group-hover:-translate-x-0.5" /> All guides
        </Link>
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
          <AccessBadge access={v.access} />
        </div>
        <p className="mt-5 max-w-[68ch] text-xl leading-relaxed text-ink-2 [text-wrap:pretty]">{v.summary}</p>
      </header>

      <dl className="grid border-b border-line sm:grid-cols-3">
        {[
          ["Your work", v.activeEffort],
          ["Waiting for approval", v.waitTime],
          ["Biggest blocker", v.mainGate],
        ].map(([k, val], i) => (
          <div key={k} className={`px-5 py-6 sm:px-8 ${i ? "border-t border-line sm:border-t-0 sm:border-l" : ""} ${i === 2 ? "bg-brand-soft/60" : ""}`}>
            <dt className={`label ${i === 2 ? "text-brand" : "text-muted"}`}>{k}</dt>
            <dd className="mt-2 text-[15px] leading-relaxed text-ink">{val}</dd>
          </div>
        ))}
      </dl>

      {/* 2. What to build: the recommendation is visible, the scope table is one click away */}
      {guide.agentPath && (
        <section id="ref-path" className="ask-target scroll-mt-16 border-b border-line px-5 py-7 sm:px-8">
          <h2 className="label text-muted">What to build</h2>
          <p className="mt-3 max-w-[72ch] text-[17px] leading-relaxed text-ink">{guide.agentPath.recommendation.text}</p>
          <Evidence claim={guide.agentPath.recommendation} />
          {guide.agentPath.scopeTiers.length > 0 && (
            <details className="group/tiers mt-5">
              <summary className="label inline-flex cursor-pointer list-none items-center gap-2 border border-line px-3 py-2 text-ink-2 select-none hover:border-ink hover:text-ink">
                Which scopes to ask for · {guide.agentPath.scopeTiers.length} options
                <Chevron className="h-3 w-3 transition-transform group-open/tiers:rotate-90" />
              </summary>
              <ScopeTable tiers={guide.agentPath.scopeTiers} />
            </details>
          )}
        </section>
      )}

      {/* 3. Steps: a one-line checklist; each step expands to the how, the agent's draft and the evidence */}
      <section className="grid border-b border-line lg:grid-cols-[220px_1fr]">
        <aside className="border-b border-line px-5 py-6 sm:px-8 lg:border-r lg:border-b-0">
          <div className="lg:sticky lg:top-20">
            <h2 className="label text-muted">
              {guide.phases.length} phases · {steps.length} steps
            </h2>
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
            <h2 className="label mt-8 text-muted">Who does the {steps.length} steps</h2>
            <ul className="mt-3 space-y-2">
              {(Object.keys(OWNER) as (keyof typeof OWNER)[]).map((o) => (
                <li key={o} className="flex items-center justify-between gap-3 text-sm text-ink-2">
                  <span className={`label px-1.5 py-0.5 ${OWNER[o].cls}`}>{OWNER[o].label}</span>
                  <span className="tnum text-muted">{count(o)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div>
          <p className="border-b border-line px-5 py-3 text-sm text-muted sm:px-8">Click a step to see how to do it and where it comes from.</p>
          {guide.phases.map((p, pi) => (
            <section key={pi} id={`phase-${pi}`} className="scroll-mt-16 border-b border-line last:border-b-0">
              <h3 className="flex items-baseline gap-3 px-5 pt-5 pb-1 sm:px-8">
                <span className="label tnum text-muted">{String(pi + 1).padStart(2, "0")}</span>
                <span className="font-medium tracking-tight text-ink">{p.name}</span>
              </h3>
              <ul className="pb-2">
                {p.steps.map((s, si) => (
                  <li key={si} id={`ref-step-${pi}-${si}`} className="ask-target scroll-mt-16">
                    <details className="group/step">
                      <summary className="grid cursor-pointer list-none grid-cols-[80px_1fr_auto] items-center gap-x-4 px-5 py-3 select-none hover:bg-ground sm:grid-cols-[88px_1fr_auto_16px] sm:px-8">
                        <span className={`label w-fit px-1.5 py-0.5 ${OWNER[s.owner].cls}`} title={OWNER[s.owner].long}>
                          {OWNER[s.owner].label}
                        </span>
                        <span className="min-w-0 text-[15px] text-ink">
                          {s.title}
                          {s.output && s.owner === "agent" && <span className="label ml-2 text-brand">· draft included</span>}
                        </span>
                        <span className="label tnum text-right text-muted">{s.effort}</span>
                        <Chevron className="hidden h-3.5 w-3.5 text-muted transition-transform group-open/step:rotate-90 sm:block" />
                      </summary>
                      <div className="px-5 pt-1 pb-5 sm:pr-8 sm:pl-[136px]">
                        <p className="max-w-[72ch] text-[15px] leading-relaxed text-ink-2">{s.detail.text}</p>
                        {s.link && (
                          <a href={s.link} target="_blank" rel="noreferrer" className="label mt-2 inline-flex items-center gap-1 text-brand hover:text-brand-hover">
                            Open <ArrowUpRight className="h-3 w-3" />
                          </a>
                        )}
                        {s.output && (
                          <div className="mt-3 max-w-[72ch] border border-line bg-ground">
                            <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
                              <p className="label text-brand">Drafted by the agent</p>
                              <CopyButton text={s.output} />
                            </div>
                            <pre className="overflow-x-auto px-3 py-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink-2">{s.output}</pre>
                          </div>
                        )}
                        <Evidence claim={s.detail} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      {/* 4. Detail on demand */}
      {guide.essentials.length > 0 && (
        <Fold title="Quick facts" meta={`${guide.essentials.length} topics · tokens, limits, cost, review, security`}>
          <Essentials items={guide.essentials} />
        </Fold>
      )}
      {guide.requests.length > 0 && (
        <Fold title="Try it: the sign-in link and requests" meta={`${guide.requests.length} ready-to-run ${guide.requests.length === 1 ? "request" : "requests"}`}>
          <Requests items={guide.requests} />
        </Fold>
      )}
      {(guide.gotchas.length > 0 || guide.whenBlocked.length > 0) && (
        <Fold title="Gotchas and what to do when blocked" meta={`${guide.gotchas.length} gotchas · ${guide.whenBlocked.length} ways forward`}>
          <div className="grid border-t border-line md:grid-cols-2">
            <ClaimList title="Gotchas" claims={guide.gotchas} idPrefix="ref-gotcha" />
            <ClaimList title="When you're blocked" claims={guide.whenBlocked} idPrefix="ref-blocked" className="border-t border-line md:border-t-0 md:border-l" />
          </div>
        </Fold>
      )}
      <Fold
        title="How we know"
        meta={`${pct}% of quotes confirmed on their page${unverified ? ` · ${unverified} unverified` : ""}${guide.uncertain.length ? ` · ${guide.uncertain.length} open ${guide.uncertain.length === 1 ? "question" : "questions"}` : ""}`}
      >
        <div className="border-t border-line px-5 py-8 sm:px-8">
          <p className="max-w-[68ch] text-ink-2">
            Every claim shows where it came from. After the guide is written, code re-opens each cited page and checks the quote is
            really there, word for word. If it isn&apos;t, the claim is marked Unverified instead of hidden.
          </p>
          <EvidenceSummary guide={guide} />
          {guide.probes.length > 0 && (
            <div className="mt-8">
              <h3 className="label text-muted">Endpoint checks (unauthenticated requests the agent made)</h3>
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
            <div id="ref-uncertain" className="ask-target mt-8 scroll-mt-16">
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
          {guide.research && (
            <Link href={`/apps/${guide.slug}/research`} className="label mt-8 inline-flex items-center gap-1.5 text-brand hover:text-brand-hover">
              See every search and page the agent read <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </Fold>
      <GuideChat slug={guide.slug} app={guide.app} />
    </article>
  );
}

// A collapsed section: title and a one-line summary, the detail one click away.
function Fold({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <details className="group/fold border-b border-line">
      <summary className="flex cursor-pointer list-none items-center gap-x-4 gap-y-1 px-5 py-5 select-none hover:bg-ground max-sm:flex-wrap sm:px-8">
        <h2 className="text-lg font-medium tracking-tight text-ink">{title}</h2>
        <span className="label text-muted">{meta}</span>
        <Chevron className="ml-auto h-4 w-4 text-muted transition-transform group-open/fold:rotate-90" />
      </summary>
      {children}
    </details>
  );
}

function ClaimList({ title, claims, idPrefix, className = "" }: { title: string; claims: Claim[]; idPrefix: string; className?: string }) {
  if (!claims.length) return null;
  return (
    <section className={`px-5 py-6 sm:px-8 ${className}`}>
      <h3 className="label text-muted">{title}</h3>
      <ul className="mt-2">
        {claims.map((c, i) => (
          <li key={i} id={`${idPrefix}-${i}`} className="ask-target scroll-mt-16 py-4 text-[15px] leading-relaxed text-ink-2 [&+li]:border-t [&+li]:border-line">
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
  const claims = allClaims(guide);
  const quotes = claims.flatMap((c) => c.sources.filter((s) => s.quote));
  return { claims, quotes, verified: quotes.filter((q) => q.quoteVerified).length };
}

function EvidenceSummary({ guide }: { guide: Guide }) {
  const { claims, quotes, verified } = evidenceStats(guide);
  // "Tested" is only shown when a setup attempt produced it.
  const keys = (Object.keys(EVIDENCE) as (keyof typeof EVIDENCE)[]).filter((k) => k !== "tested" || claims.some((c) => c.evidence === k));
  return (
    <dl className="mt-6 grid grid-cols-2 gap-px border border-line bg-line sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none">
      {keys.map((k) => (
        <div key={k} className="bg-surface px-4 py-3">
          <dt className={`label inline-flex items-center gap-1.5 ${EVIDENCE[k].cls}`}>
            <span className={`h-1.5 w-1.5 ${EVIDENCE[k].dot}`} />
            {EVIDENCE[k].label}
          </dt>
          <dd className="tnum mt-1 text-2xl font-light text-ink">{claims.filter((c) => c.evidence === k).length}</dd>
        </div>
      ))}
      <div className="bg-surface px-4 py-3">
        <dt className="label text-muted">Quotes found on page</dt>
        <dd className="tnum mt-1 text-2xl font-light text-ink">
          {verified}
          <span className="text-muted">/{quotes.length}</span>
        </dd>
      </div>
    </dl>
  );
}

function ScopeTable({ tiers }: { tiers: NonNullable<Guide["agentPath"]>["scopeTiers"] }) {
  return (
    <div className="mt-4 overflow-x-auto border border-line">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-ground">
          <tr className="label text-muted">
            <th className="px-4 py-2.5 font-normal">If your agent needs to</th>
            <th className="px-4 py-2.5 font-normal">Ask for these scopes</th>
            <th className="px-4 py-2.5 font-normal">What that means for approval</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t, i) => (
            <tr key={i} id={`ref-tier-${i}`} className="ask-target scroll-mt-16 border-t border-line align-top">
              <td className="px-4 py-3 text-ink">{t.need}</td>
              <td className="px-4 py-3 font-mono text-xs break-words text-ink-2">{t.scopes}</td>
              <td className="px-4 py-3 text-ink-2">
                {t.text}
                <div>
                  <Evidence claim={t} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Essentials({ items }: { items: Guide["essentials"] }) {
  return (
    <dl className="grid gap-px border-t border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
      {items.map((e, i) => (
        <div key={i} id={`ref-ess-${i}`} className="ask-target scroll-mt-16 bg-surface px-5 py-5 sm:px-8">
          <dt className="text-sm font-medium text-ink">{e.topic}</dt>
          <dd className={`mt-1.5 text-sm leading-relaxed ${e.text.startsWith("Not found") ? "text-muted italic" : "text-ink-2"}`}>
            {e.text}
            <div>
              <Evidence claim={e} />
            </div>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Requests({ items }: { items: Guide["requests"] }) {
  return (
    <div className="border-t border-line px-5 py-6 sm:px-8">
      <p className="max-w-[72ch] text-sm leading-relaxed text-ink-2">
        Replace the capitalised placeholders with your app&apos;s values. These come from the provider&apos;s docs; check the evidence under
        each one before relying on it.
      </p>
      <ol className="mt-5 space-y-4">
        {items.map((r, i) => {
          const code = r.curl ?? r.url;
          return (
            <li key={i} id={`ref-req-${i}`} className="ask-target scroll-mt-16 border border-line">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-ground px-4 py-2.5">
                <span className="label tnum text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm font-medium text-ink">{r.label}</span>
                <span className="label bg-surface px-1.5 py-0.5 text-brand">{r.method}</span>
                <span className="ml-auto">
                  <CopyButton text={code} label={r.curl ? "Copy curl" : "Copy link"} />
                </span>
              </div>
              <pre className="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-ink">{code}</pre>
              <div className="border-t border-line px-4 py-3 text-sm text-ink-2">
                {r.text}
                <div>
                  <Evidence claim={r} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
