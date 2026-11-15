import Link from "next/link";
import { AppIcon, DIFFICULTY, DifficultyMeter, evidenceStats } from "@/components/GuideView";
import { GenerateBox } from "@/components/GenerateBox";
import { ArrowRight, ArrowUpRight } from "@/components/icons";
import { listGuides } from "@/lib/store";

export const dynamic = "force-dynamic";

const PIPELINE = [
  ["Search", "Terra plans queries; Azure web search returns official docs, policy pages, developer blogs."],
  ["Read", "Luna reads each page and returns only relevant facts, each with a verbatim quote."],
  ["Probe", "Unauthenticated requests: OIDC discovery, the authorize endpoint with a fake client, the console URL."],
  ["Write", "Terra turns notes and probe results into the guide, tagging every claim's evidence."],
  ["Verify", "Code checks every quote against the cited page's text. Misses are marked unverified, not hidden."],
];

export default async function Home() {
  const guides = await listGuides();
  const stats = guides.map(evidenceStats);
  const claims = stats.reduce((n, s) => n + s.claims.length, 0);
  const quotes = stats.reduce((n, s) => n + s.quotes.length, 0);
  const verified = stats.reduce((n, s) => n + s.verified, 0);

  return (
    <div>
      {/* Research */}
      <section id="research" className="scroll-mt-14 border-b border-line px-5 pt-16 pb-14 sm:px-8 sm:pt-24 sm:pb-20">
        <h1 className="max-w-[16ch] text-5xl leading-[1.1] font-normal tracking-[-0.035em] text-ink [text-wrap:balance] sm:text-[4.25rem]">
          How long until your users can <span className="bg-brand px-2 text-white [box-decoration-break:clone]">connect it?</span>
        </h1>
        <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-ink-2">
          Before your agent can act in someone&apos;s account, you need an OAuth app with that provider, and often their approval.
          Each guide gives you the effort, the wait, what will block you, and which steps an agent can take off your plate.
          Every claim shows its evidence.
        </p>
        <div className="mt-9 max-w-[760px]">
          <GenerateBox />
        </div>
        {guides.length > 0 && (
          <p className="label tnum mt-10 text-muted">
            {guides.length} guides · {claims} claims · {verified}/{quotes} quotes found on the cited page
          </p>
        )}
      </section>

      {/* Library */}
      <section id="library" className="scroll-mt-14 border-b border-line">
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-12 pb-6 sm:px-8">
          <div>
            <h2 className="text-3xl font-normal tracking-[-0.025em] text-ink">Library</h2>
            <p className="mt-2 max-w-[60ch] text-ink-2">Chosen to cover different kinds of blocker, from self-serve to gated by business eligibility.</p>
          </div>
          <p className="label text-muted">Easiest first</p>
        </div>
        <ul className="grid gap-px border-t border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <li key={g.slug} className="bg-surface">
              <Link href={`/apps/${g.slug}`} className="group flex h-full flex-col px-5 py-6 transition-colors hover:bg-ground sm:px-7">
                <div className="flex items-center gap-3">
                  <AppIcon guide={g} size={32} />
                  <span className="truncate text-lg font-medium tracking-tight text-ink">{g.app}</span>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                </div>
                <div className="mt-4 flex items-center gap-2.5">
                  <DifficultyMeter value={g.verdict.difficulty} />
                  <span className="label text-ink">{DIFFICULTY[g.verdict.difficulty]}</span>
                </div>
                <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-ink-2">{g.verdict.mainGate}</p>
                <p className="mt-auto pt-4 text-xs leading-relaxed text-muted">
                  <span className="label">Wait</span> {g.verdict.waitTime.split(/(?<=[a-z0-9)])[.;](\s|$)/)[0]}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Method */}
      <section id="method" className="scroll-mt-14">
        <div className="grid border-b border-line lg:grid-cols-[1fr_1.2fr]">
          <div className="px-5 py-12 sm:px-8">
            <h2 className="text-3xl font-normal tracking-[-0.025em] text-ink">Why this scope</h2>
            <p className="mt-4 max-w-[58ch] text-ink-2 leading-relaxed">
              Composio&apos;s managed-auth directory lists 382 OAuth toolkits. Composio runs the OAuth app for 124 of them; for the
              other <span className="bg-brand-soft px-1 text-brand">258, developers must bring their own</span>. Even with a managed app,
              production usually needs your own: your name on the consent screen, your scopes, your quota.
            </p>
            <p className="mt-4 max-w-[58ch] text-ink-2 leading-relaxed">
              So the developer&apos;s real question isn&apos;t how OAuth works. It&apos;s whether they can launch, how long it takes, and
              what will stop them. Every guide answers that in its first screen, then gives the path.
            </p>
            <a
              href="https://docs.composio.dev/toolkits/managed-auth"
              target="_blank"
              rel="noreferrer"
              className="label mt-6 inline-flex items-center gap-1.5 text-brand hover:text-brand-hover"
            >
              Managed-auth directory <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="border-t border-line px-5 py-12 sm:px-8 lg:border-t-0 lg:border-l">
            <h2 className="text-3xl font-normal tracking-[-0.025em] text-ink">How a guide is made</h2>
            <ol className="mt-6 border border-line">
              {PIPELINE.map(([name, text], i) => (
                <li key={name} className="grid grid-cols-[44px_88px_1fr] items-baseline gap-2 px-4 py-4 [&+li]:border-t [&+li]:border-line">
                  <span className="label tnum text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className="label text-ink">{name}</span>
                  <span className="text-sm leading-relaxed text-ink-2">{text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="px-5 py-12 sm:px-8">
          <h2 className="text-3xl font-normal tracking-[-0.025em] text-ink">What the agent can&apos;t do</h2>
          <ul className="mt-5 grid max-w-[980px] gap-x-10 gap-y-3 text-[15px] leading-relaxed text-ink-2 md:grid-cols-2">
            <li>It never logs into a developer console, so &quot;tested&quot; only covers what an unauthenticated request can show.</li>
            <li>Review timelines are what providers state; real waits vary, and guides say so when no timeline is published.</li>
            <li>Docs change. Each guide carries its research date, and live research re-checks current pages.</li>
            <li>Some docs block bots; those pages go through a rendering reader, and anything still unread stays unverified.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
