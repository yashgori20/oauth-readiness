import OpenAI from "openai";
import { Guide, type Claim } from "./guide";
import { probeAuthorize, probeOidc, probeUrl } from "./tools";
import { fetchPageText, webSearch, type PageCache } from "./web";

const MAIN = process.env.AZURE_DEPLOYMENT_MAIN ?? "gpt-5.6-terra";
const READER = process.env.AZURE_DEPLOYMENT_READER ?? "gpt-5.6-luna";
const MAX_TOOL_ROUNDS = 14;
const MAX_READER_CHARS = 60_000;

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "tool"; name: string; target: string; summary: string }
  | { type: "guide"; guide: Guide }
  | { type: "error"; message: string };

function client() {
  // Azure OpenAI v1 endpoint: deployment name goes in `model`, no api-version needed.
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/+$/, "");
  return new OpenAI({
    baseURL: `${endpoint}/openai/v1/`,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY ?? "" },
    maxRetries: 4,
    timeout: 180_000,
  });
}

const RESEARCH_PROMPT = `You research how a developer registers an OAuth app with a provider and gets it approved for production, so their AI agent's users can connect accounts.

Cover:
1. Where to register the OAuth app (developer console URL) and prerequisites (account type, paid plan, business entity, partner program).
2. Configuration: redirect URIs, scopes, scope tiers (sensitive / restricted / advanced access).
3. Dev / test mode limits (user caps, test users, connection limits).
4. Review / verification / certification: what triggers it, what is submitted, stated timelines, cost.
5. Recent policy changes (check the provider's developer blog / changelog), common rejection reasons, what to do when blocked.

Prefer official docs over forums and third-party blogs; use community threads only for real-world wait times and rejection reasons, and label them as such.
read_page returns notes with verbatim quotes from the page; carry those quotes and URLs forward unchanged.
Do not guess timelines. Aim for 6-10 page reads, then stop.

Final reply: research notes, one bullet per fact with source URL and verbatim quote, then one line exactly like:
ENDPOINTS: {"authorizeUrl": "...", "oidcDomain": "... or null", "consoleUrl": "...", "website": "..."}`;

const READER_PROMPT = `Extract facts relevant to the research focus from this page. Output bullets only:
- <fact> | quote: "<verbatim text copied exactly from the page, under 200 chars>"
Copy quotes character-for-character. If the page has nothing relevant, reply "NOTHING RELEVANT". Note the page's date if shown.`;

const WRITE_PROMPT = `Turn the research notes into a guide. Output JSON only, matching this shape:

{ app, slug, website?, developerConsole?,
  verdict: { difficulty: 1-5, summary, activeEffort, waitTime, mainGate },
  phases: [{ name, steps: [{ title, owner: "agent"|"you"|"provider", effort?, link?, detail: Claim }] }],
  gotchas: Claim[], whenBlocked: Claim[], uncertain: string[] }
Claim = { text, evidence: "tested"|"sourced"|"inferred"|"unverified", sources: [{ url, quote? }] }

- difficulty: 1 = self-serve in minutes, 3 = review measured in days, 5 = weeks plus paid audit, partner gating, or eligibility the developer may never meet.
- verdict.summary: one or two plain sentences a developer can act on, including "plan around it" advice if approval is unrealistic.
- Phases in order: Register, Configure, Test, Review, Production. Skip a phase that doesn't apply.
- owner "agent": work an agent can do without the developer's login (draft privacy policy, scope justifications, review answers and demo-video script; validate redirect URIs; build and test the OAuth flow once credentials exist). "you": anything needing the developer's logged-in console account, legal entity, payment, or judgment (creating the app in the console is "you"). "provider": waiting on their review.
- evidence "tested" ONLY when the claim's text is exactly what a probe below showed (e.g. "the authorize endpoint is live and redirects to login"). Never tag a step "tested" because a related URL loaded. "sourced" when the claim is stated by quoted pages, including a claim that combines several quoted facts; attach every supporting quote verbatim from the notes. "inferred" only for your own reasoning beyond what any page says. "unverified" when no read page supports it.
- Before writing, compare docs pages against newer blog / changelog posts. If they conflict (e.g. limits changed), state the newer rule, cite both, and add the conflict to uncertain[].
- uncertain[]: only gaps in the evidence (unstated timelines, conflicting sources, things no page confirmed). Don't list facts about the developer's own situation.`;

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web. Target official developer docs, app review / verification policy pages, developer blogs.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_page",
      description: "Read a page. A fast reader model returns relevant facts with verbatim quotes.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" }, focus: { type: "string", description: "What to look for on this page" } },
        required: ["url", "focus"],
      },
    },
  },
];

export async function* generateGuide(appQuery: string): AsyncGenerator<AgentEvent> {
  const ai = client();
  const cache: PageCache = new Map();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: RESEARCH_PROMPT },
    { role: "user", content: `App: ${appQuery}` },
  ];

  // 1. Research loop: Terra decides what to search and read; Luna reads pages.
  yield { type: "status", message: `Researching ${appQuery}` };
  let notes = "";
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await ai.chat.completions.create({ model: MAIN, messages, tools });
    const msg = res.choices[0].message;
    messages.push(msg);
    if (!msg.tool_calls?.length) {
      notes = msg.content ?? "";
      break;
    }
    for (const call of msg.tool_calls) {
      if (call.type !== "function") continue;
      const args = JSON.parse(call.function.arguments || "{}");
      let result: string;
      if (call.function.name === "web_search") {
        const r = await webSearch(args.query);
        result = JSON.stringify(r);
        yield { type: "tool", name: "search", target: args.query, summary: r.results ? `${r.results.length} results` : r.error! };
      } else {
        const page = await fetchPageText(args.url, cache);
        if (!page.text) {
          result = page.error!;
          yield { type: "tool", name: "read", target: args.url, summary: page.error! };
        } else {
          const read = await ai.chat.completions.create({
            model: READER,
            messages: [
              { role: "system", content: READER_PROMPT },
              { role: "user", content: `Focus: ${args.focus}\nURL: ${args.url}\n\n${page.text.slice(0, MAX_READER_CHARS)}` },
            ],
          });
          result = read.choices[0].message.content ?? "";
          const facts = result.split("\n").filter((l) => l.trim().startsWith("-")).length;
          yield { type: "tool", name: "read", target: args.url, summary: facts ? `${facts} facts` : "nothing relevant" };
        }
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  if (!notes) {
    // Hit the round cap mid-research: ask for notes from what's gathered so far.
    messages.push({ role: "user", content: "Stop researching. Write the final notes and ENDPOINTS line now." });
    notes = (await ai.chat.completions.create({ model: MAIN, messages })).choices[0].message.content ?? "";
  }

  // 2. Probes: real, unauthenticated requests against the provider.
  yield { type: "status", message: "Probing the provider's OAuth endpoints" };
  const endpoints = parseEndpoints(notes);
  const probes: Guide["probes"] = [];
  if (endpoints.oidcDomain) probes.push(await probeOidc(endpoints.oidcDomain));
  if (endpoints.authorizeUrl) probes.push(await probeAuthorize(endpoints.authorizeUrl));
  if (endpoints.consoleUrl) probes.push(await probeUrl(endpoints.consoleUrl));
  for (const p of probes) yield { type: "tool", name: "probe", target: p.target, summary: `${p.ok ? "ok" : "failed"}: ${p.result.slice(0, 80)}` };

  // 3. Write the structured guide from notes + probe results only.
  yield { type: "status", message: "Writing guide" };
  const out = await ai.chat.completions.create({
    model: MAIN,
    messages: [
      { role: "system", content: WRITE_PROMPT },
      { role: "user", content: `App: ${appQuery}\nToday: ${new Date().toISOString().slice(0, 10)}\n\nResearch notes:\n${notes}\n\nProbe results:\n${JSON.stringify(probes)}` },
    ],
    response_format: { type: "json_object" },
  });

  const raw = out.choices[0].message.content ?? "{}";
  const parsed = Guide.safeParse({
    ...JSON.parse(raw),
    generatedAt: new Date().toISOString(),
    origin: "live",
    probes,
  });
  if (!parsed.success) {
    yield { type: "error", message: `Guide failed validation: ${parsed.error.message.slice(0, 600)}
--- raw ---
${raw.slice(0, 1500)}` };
    return;
  }

  yield { type: "status", message: "Checking quotes against the pages the agent read" };
  yield { type: "guide", guide: await verifyQuotes(parsed.data, cache) };
}

function parseEndpoints(notes: string) {
  const m = /ENDPOINTS:\s*(\{.*\})/.exec(notes);
  try {
    const e = m ? JSON.parse(m[1]) : {};
    const url = (v: unknown) => (typeof v === "string" && v.startsWith("http") ? v : undefined);
    return {
      authorizeUrl: url(e.authorizeUrl),
      consoleUrl: url(e.consoleUrl),
      oidcDomain: typeof e.oidcDomain === "string" && e.oidcDomain !== "null" ? e.oidcDomain : undefined,
    };
  } catch {
    return {};
  }
}

// Models paraphrase. Check each quote against the full text of the cited page (fetching any the
// agent cited but didn't read); downgrade claims whose quotes don't appear rather than trusting the model.
export async function verifyQuotes(guide: Guide, cache: PageCache): Promise<Guide> {
  const all = [...guide.phases.flatMap((p) => p.steps.map((s) => s.detail)), ...guide.gotchas, ...guide.whenBlocked];
  const cited = new Set(all.flatMap((c) => c.sources.filter((s) => s.quote).map((s) => s.url)));
  await Promise.all([...cited].filter((u) => u.startsWith("http") && !cache.has(u)).map((u) => fetchPageText(u, cache)));

  // Compare words only: quotes legitimately differ from page text in punctuation and spacing.
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const pages = [...cache.entries()].map(([url, text]) => [url.replace(/\/$/, ""), norm(text)] as const);
  const check = (c: Claim): Claim => {
    // Every quote gets checked, but only a "sourced" claim depends on one for its evidence tag.
    const sources = c.sources.map((s) => {
      if (!s.quote) return s;
      const page = pages.find(([u]) => u === s.url.replace(/\/$/, ""))?.[1];
      return { ...s, quoteVerified: !!(page && page.includes(norm(s.quote))) };
    });
    if (c.evidence !== "sourced") return { ...c, sources };
    return { ...c, sources, evidence: sources.some((s) => s.quoteVerified) ? "sourced" : "unverified" };
  };
  return {
    ...guide,
    phases: guide.phases.map((p) => ({ ...p, steps: p.steps.map((s) => ({ ...s, detail: check(s.detail) })) })),
    gotchas: guide.gotchas.map(check),
    whenBlocked: guide.whenBlocked.map(check),
  };
}
