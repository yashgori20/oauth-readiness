import OpenAI from "openai";
import { allClaims, ESSENTIAL_TOPICS, Guide, type Claim } from "./guide";
import { probeAuthorize, probeOidc, probeUrl } from "./tools";
import { fetchPageText, webSearch, type PageCache } from "./web";

const MAIN = process.env.AZURE_DEPLOYMENT_MAIN ?? "gpt-5.6-terra";
const READER = process.env.AZURE_DEPLOYMENT_READER ?? "gpt-5.6-luna";
const MAX_TOOL_ROUNDS = 12;
const RESEARCH_BUDGET_MS = 150_000; // leaves room to write, verify and check inside a 300s serverless limit
const MAX_READER_CHARS = 60_000;

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "tool"; name: string; target: string; summary: string; detail?: string[] }
  | { type: "guide"; guide: Guide }
  | { type: "error"; message: string };

export function client() {
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

const RESEARCH_PROMPT = `You research what it takes for a developer building a multi-tenant AI agent to let their users connect an app: registering an OAuth app with the provider and getting it approved for production.

First establish how the API authenticates. If it has no end-user OAuth (API keys only, like most maps, payments or weather APIs), say so, research key setup and billing briefly, and stop.

Otherwise cover:
1. App types and distribution options (e.g. GitHub App vs OAuth App, public vs custom distribution), and which fits an agent acting for many users.
2. Where to register (console URL) and prerequisites: account type, paid plan or subscription, business entity, partner program.
3. Scopes an agent typically needs (read, write, send/act) and the review tier each scope triggers.
4. Tokens: access-token lifetime, refresh tokens (how to get them, rotation), offline access.
5. Redirect URI rules, dev/test mode limits (user caps, test users), rate limits, costs and fees. For every paid tier or access level, find what it requires besides payment (certification, review, partner status); read the provider's pricing FAQ, not just the price table.
6. Review/verification/certification: READ the provider's own "submit for review" or launch checklist page. What triggers review, what you submit, prerequisites (install counts, webhooks, assets), stated timelines.
7. Real-world review times, effort and rejection reasons from community threads and integration vendors' guides (e.g. Codat, Apideck, Nango, Merge), labelled as community reports. Use these when official docs give no figure.
8. Policy restrictions on AI or LLM use in the API terms, and recent changes on the developer blog or changelog.
9. Escalation: who to contact or what form to use when stuck.
10. Security requirements of the auth flow: state, PKCE, callback signature or HMAC checks, host or tenant validation, token storage rules.
11. How to test before approval: free development accounts, stores or sandboxes, and test users.
12. Official CLIs or config files that can create or configure the app (e.g. gcloud, Shopify CLI, app manifests).

Prefer official docs. read_page returns notes with verbatim quotes; carry those quotes and URLs forward unchanged. Don't guess numbers. You can request several tools in one turn; they run in parallel. Aim for 8-12 page reads.

Final reply: research notes, one bullet per fact with source URL, verbatim quote, and [official] or [community], then one line exactly like:
ENDPOINTS: {"authModel": "oauth" | "api-key", "authorizeUrl": "...", "oidcHosts": ["host", ...], "consoleUrl": "...", "website": "..."}`;

const READER_PROMPT = `Extract facts relevant to the research focus from this page. Output bullets only:
- <fact> | quote: "<verbatim text copied exactly from the page, under 200 chars>"
Copy quotes character-for-character from one continuous passage; never join text from two places. If the page has nothing relevant, reply "NOTHING RELEVANT". Note the page's date if shown.`;

const WRITE_PROMPT = `Turn the research notes into a guide for a developer building a multi-tenant AI agent (it acts for many end users). Output JSON only:

{ app, slug, website?, developerConsole?,
  verdict: { difficulty: 1-5, access: "open"|"gated"|"ineligible"|"not-oauth", summary, activeEffort, waitTime, mainGate },
  agentPath: { recommendation: Claim, scopeTiers: [ScopeTier] },
  essentials: [ Claim & { topic } ],
  phases: [{ name, steps: [{ title, owner: "agent"|"you"|"provider", effort, link?, output?, detail: Claim }] }],
  gotchas: Claim[], whenBlocked: Claim[], uncertain: string[] }
Claim = { text, evidence: "sourced"|"reported"|"inferred"|"unverified", sources: [{ url, quote? }] }
ScopeTier = Claim & { need, scopes }   // text = what that tier costs you in review

PLAIN LANGUAGE (applies to every text field you write, but NEVER to quotes: quotes are copied character-for-character from the notes, however technical)
- Write for a developer who has never used this provider. Short sentences, under 20 words where possible. Plain words.
- The first time you use a provider-specific term, explain it in a few words, e.g. "certification (Xero's review of your app)".
- Avoid jargon a newcomer wouldn't know ("multi-tenant", "confidential client", "granular scopes", "tenant", "egress") unless you explain it. Say "each customer's account" instead of "tenant".
- One idea per sentence. No semicolon chains.

VERDICT
- access: "open" = self-serve; "gated" = needs provider approval or eligibility; "ineligible" = the provider's terms prohibit this use (e.g. AI applications) or an agent builder can't realistically qualify: say so in the first sentence of summary and frame the steps as what you'd do with written permission; "not-oauth" = no end-user OAuth (API keys only): say so plainly, give key setup and billing steps, no review phase.
- difficulty: 1 = self-serve in minutes, 2 = self-serve with some config, 3 = review measured in days, 4 = weeks of review, verification or audit, 5 = eligibility most developers can't meet. If scope tiers differ a lot, rate the tier a typical agent needs and name the other tier's difficulty in summary.
- activeEffort: always a number range of hands-on work and what dominates it, e.g. "3–6 hours, mostly preparing review materials" or "2–4 days". Never prose without numbers; if unsure, estimate from the steps and say "(estimate)". Don't add up step efforts to the minute.
- waitTime: a range with its basis in brackets: "(official)", "(community-reported)" or "(inferred)". Add up waits that happen in sequence (e.g. brand verification, then scope review, then a security assessment) and include gates that stretch the timeline (e.g. 50 users before review, one app in review at a time, cooldown after rejection). When official docs give no figure, use community or vendor figures labelled "(community-reported)". If the provider has no review for this path: "None: no review required". Only if review exists and no figure exists anywhere: "Unknown: no official or community figure found", and add that to uncertain.
- summary: exactly three short sentences: (1) can you do this, and on what terms; (2) how long it takes overall; (3) the main catch and what to do about it.
- mainGate: one sentence, under 20 words, naming the single thing most likely to stop or delay a first-time developer. Say when it applies (e.g. "only above 50 connections").
- Every gate, anywhere in the guide, says when it applies. If two official pages disagree about a gate, say so and add it to uncertain; don't pick one silently.

AGENT PATH
- recommendation: which app type, distribution model or access level an agent builder should choose, and why.
- scopeTiers: 2-4 rows mapping typical agent needs (e.g. "Read the user's inbox") to the minimal scopes and the review consequence of that tier. Always include the cheapest read-only tier. Each scope must actually allow the need in its row, per the provider's scope description.

ESSENTIALS: exactly one item per topic, in this order: ${ESSENTIAL_TOPICS.join(", ")}. Concrete values (lifetimes, limits, prices, URLs). If the notes don't answer a topic, text "Not found in the sources researched", evidence "unverified", and add it to uncertain.

STEPS
- Phases in order: Register, Configure, Test, Review, Production. Always include Review; if there is no review, one step saying so, with its source.
- title: starts with a verb, under 8 words, e.g. "Create the app in the developer console".
- detail.text is an instruction: what to do, where (console section, field, value), then why. One to three short sentences. Never paste a quote as the instruction.
- effort (required): "5 min", "15 min", "30 min", "1–2 hr", "half day", "1–3 days", or "wait: <range>" for provider steps.
- owner "agent": only work this agent can produce right now without the developer's login or legal judgment: scope justifications, reviewer test instructions, a demo-video storyboard, the auth callback handler (state, PKCE, signature checks), webhook handler stubs, the provider's app config file, draft disclosure text for the developer to review (e.g. a limited-use statement). Hand the agent as much of this as the provider's process allows. Every agent step MUST include output: the actual draft or snippet, ready to paste (under 120 words or 15 lines of code). If you can't write the output, the owner is "you". Where an official CLI can do a console step, give the agent the command as its output.
- owner "you": anything in the logged-in console, legal documents, policy or product decisions, payment, and writing/deploying the developer's own code. owner "provider": waiting on their review.

EVIDENCE
- Quotes must be exact and contiguous, copied from the notes. Never join fragments with "..." or "…"; cite two quotes instead.
- "sourced": an official provider page states it; attach every supporting quote verbatim from the notes. "reported": community or third-party sources only (forums, blogs), with quotes. "inferred": your own reasoning. "unverified": nothing supports it.
- Never use "tested". Probe results are shown in their own table; don't turn them into steps, gotchas or claims.
- Every number, limit, timeline or price needs a quote. If you can't quote it, mark it inferred or move it to uncertain.
- If docs and newer blog or changelog posts conflict, state the newer rule, cite both, and add the conflict to uncertain.

OTHER
- gotchas: non-obvious traps; don't repeat steps. whenBlocked: one concrete action per likely blocker (who to contact, which form, how to appeal or resubmit); don't repeat review steps.
- uncertain: only real evidence gaps. Don't list anything the notes answer.
- The verdict must agree with the steps: if a step needs approval, payment or certification, the verdict and mainGate reflect it. If any tier an agent would need to grow into requires certification or review, access is "gated", not "open".`;

const CHECK_PROMPT = `You check a generated guide for internal consistency before it is published. You get the guide JSON and the research notes.
Return JSON only: { "verdict": {...same fields...}, "uncertain": [...], "stepFixes": [{ "title": "<exact step title>", "text": "<corrected detail text>" }], "issues": ["<what you fixed>"] }
- Every statement in verdict must be supported by the guide's claims or the notes. Remove or correct unsupported statements (e.g. calling something "immutable" when a source says it can be changed).
- Find contradictions between steps and the verdict or mainGate (e.g. a step says "minutes" for something the mainGate says needs certification). Fix the side the quotes don't support.
- For every tier, plan or access level the guide tells the developer to move to, check the notes for what it requires besides payment (certification, review, assessment). If the guide calls it self-serve but the notes say otherwise, fix the step and the verdict.
- Remove uncertain items that the notes or guide already answer.
- Rewrite any verdict sentence that is hard for a newcomer to follow into short, plain sentences, keeping the facts. Explain provider-specific terms in a few words.
- Don't add new facts. Don't change anything that is consistent. If nothing needs fixing, return the verdict and uncertain unchanged with empty stepFixes and issues.`;

const REQUESTS_PROMPT = `From the provider's OAuth documentation below, write the exact requests a developer runs to connect one user. Output JSON only:
{ "requests": [{ "label", "method", "url", "curl"?, "text", "evidence": "sourced"|"inferred", "sources": [{ "url", "quote" }] }] }

In order, include whichever the docs support:
1. "Send the user to sign in": GET, url = the full authorize URL with query parameters (client_id, redirect_uri, response_type, scope, state, and PKCE code_challenge if supported). No curl; this is a browser link.
2. "Exchange the code for tokens": POST to the token endpoint, with a curl command.
3. "Refresh the access token": POST, with a curl command (only if refresh tokens exist).
4. "Check the connection": one simple authenticated API call (e.g. the current user), with a curl command.
5. "Revoke access": only if a revoke endpoint is documented.

- Use placeholders in capitals: YOUR_CLIENT_ID, YOUR_CLIENT_SECRET, YOUR_REDIRECT_URI, AUTH_CODE, ACCESS_TOKEN, REFRESH_TOKEN, CODE_VERIFIER, CODE_CHALLENGE, RANDOM_STATE. Use the scope names from the guide.
- text: one short plain sentence on what the request does or a gotcha (e.g. "Codes expire in 10 minutes").
- Endpoints, parameter names and auth style (Basic auth vs body) must come from the docs. Quote the line that shows the endpoint, verbatim and contiguous. If a detail isn't in the docs, mark the request "inferred".
- Multi-line curl with backslash continuations. Never invent endpoints. If the docs don't show a token endpoint, return { "requests": [] }.`;

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web. Target official developer docs, app review / verification policy pages, developer blogs, community forums for wait times.",
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

type ToolCall = OpenAI.Chat.ChatCompletionMessageToolCall;

// A failed search or read (rate limit, network reset) is reported to the model and the log, never fatal.
async function runTool(ai: OpenAI, call: ToolCall, cache: PageCache): Promise<{ result: string; event: AgentEvent }> {
  try {
    return await runToolUnsafe(ai, call, cache);
  } catch (e) {
    const name = call.type === "function" && call.function.name === "web_search" ? "search" : "read";
    let target = "";
    try {
      const a = JSON.parse(call.type === "function" ? call.function.arguments : "{}");
      target = a.query ?? a.url ?? "";
    } catch {}
    const msg = `failed: ${(e as Error).message?.slice(0, 80) ?? "error"}`;
    return { result: `Tool error (${msg}). Try another source or continue.`, event: { type: "tool", name, target, summary: msg } };
  }
}

async function runToolUnsafe(ai: OpenAI, call: ToolCall, cache: PageCache): Promise<{ result: string; event: AgentEvent }> {
  if (call.type !== "function") return { result: "unsupported", event: { type: "status", message: "" } };
  let args: { query?: string; url?: string; focus?: string } = {};
  try {
    args = JSON.parse(call.function.arguments || "{}");
  } catch {}
  if (call.function.name === "web_search") {
    const r = await webSearch(args.query ?? "");
    return {
      result: JSON.stringify(r),
      event: { type: "tool", name: "search", target: args.query ?? "", summary: r.results ? `${r.results.length} results` : r.error!, detail: r.results?.map((x) => `${x.title} | ${x.url}`) },
    };
  }
  const url = args.url ?? "";
  const page = await fetchPageText(url, cache);
  if (!page.text) return { result: page.error!, event: { type: "tool", name: "read", target: url, summary: page.error! } };
  const read = await ai.chat.completions.create({
    model: READER,
    messages: [
      { role: "system", content: READER_PROMPT },
      { role: "user", content: `Focus: ${args.focus}\nURL: ${url}\n\n${page.text.slice(0, MAX_READER_CHARS)}` },
    ],
  });
  const result = read.choices[0].message.content ?? "";
  const facts = result.split("\n").filter((l) => l.trim().startsWith("-")).length;
  const detail = result.split("\n").filter((l) => l.trim().startsWith("-")).map((l) => l.trim().slice(1).trim()).slice(0, 20);
  return { result, event: { type: "tool", name: "read", target: url, summary: facts ? `${facts} facts` : "nothing relevant", detail } };
}

// Runs the pipeline and records every status and tool event into the guide's research log.
export async function* generateGuide(appQuery: string): AsyncGenerator<AgentEvent> {
  const t0 = Date.now();
  const log: NonNullable<Guide["research"]>["log"] = [];
  for await (const ev of runPipeline(appQuery)) {
    const t = Math.round((Date.now() - t0) / 100) / 10;
    if (ev.type === "status") log.push({ t, type: "status", message: ev.message });
    if (ev.type === "tool") log.push({ t, type: "tool", name: ev.name, target: ev.target, summary: ev.summary, detail: ev.detail });
    if (ev.type === "guide") yield { ...ev, guide: { ...ev.guide, research: { seconds: Math.round((Date.now() - t0) / 1000), log } } };
    else yield ev;
  }
}

async function* runPipeline(appQuery: string): AsyncGenerator<AgentEvent> {
  const ai = client();
  const cache: PageCache = new Map();
  const started = Date.now();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: RESEARCH_PROMPT },
    { role: "user", content: `App: ${appQuery}\nToday: ${new Date().toISOString().slice(0, 10)}` },
  ];

  // 1. Research loop: Terra decides what to search and read; Luna reads pages. Calls in a round run in parallel.
  yield { type: "status", message: `Researching ${appQuery}` };
  let notes = "";
  for (let round = 0; round < MAX_TOOL_ROUNDS && Date.now() - started < RESEARCH_BUDGET_MS; round++) {
    const res = await ai.chat.completions.create({ model: MAIN, messages, tools });
    const msg = res.choices[0].message;
    messages.push(msg);
    if (!msg.tool_calls?.length) {
      notes = msg.content ?? "";
      break;
    }
    const results = await Promise.all(msg.tool_calls.map((c) => runTool(ai, c, cache)));
    for (const [i, call] of msg.tool_calls.entries()) {
      if (results[i].event.type === "tool") yield results[i].event;
      messages.push({ role: "tool", tool_call_id: call.id, content: results[i].result });
    }
  }
  if (!notes) {
    // Hit the round or time cap mid-research: ask for notes from what's gathered so far.
    messages.push({ role: "user", content: "Stop researching. Write the final notes and ENDPOINTS line now." });
    notes = (await ai.chat.completions.create({ model: MAIN, messages })).choices[0].message.content ?? "";
  }

  // 2. Probes: real, unauthenticated requests against the provider.
  const endpoints = parseEndpoints(notes);
  const probes: Guide["probes"] = [];
  if (endpoints.authModel !== "api-key") {
    yield { type: "status", message: "Probing the provider's OAuth endpoints" };
    const authHost = endpoints.authorizeUrl ? safeHost(endpoints.authorizeUrl) : undefined;
    const found = await Promise.all([
      probeOidc([...endpoints.oidcHosts, ...(authHost ? [authHost] : [])]),
      endpoints.authorizeUrl ? probeAuthorize(endpoints.authorizeUrl) : null,
      endpoints.consoleUrl ? probeUrl(endpoints.consoleUrl) : null,
    ]);
    for (const p of found) if (p) probes.push(p);
    for (const p of probes) yield { type: "tool", name: "probe", target: p.target, summary: `${p.ok ? "ok" : "failed"}: ${p.result.slice(0, 80)}` };
  }

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
  const parsed = Guide.safeParse({ ...JSON.parse(raw), generatedAt: new Date().toISOString(), origin: "live", probes });
  if (!parsed.success) {
    yield { type: "error", message: `Guide failed validation: ${parsed.error.message.slice(0, 600)}\n--- raw ---\n${raw.slice(0, 1500)}` };
    return;
  }

  // 4. Ready-to-run requests from the OAuth docs, then verify every quote in code.
  let guide = enforceRules(parsed.data);
  if (guide.verdict.access !== "not-oauth") {
    yield { type: "status", message: "Writing the sign-in link and curl commands" };
    guide = { ...guide, requests: await draftRequests(ai, guide, cache) };
  }
  yield { type: "status", message: "Checking quotes against the pages the agent read" };
  guide = await verifyQuotes(guide, cache);

  yield { type: "status", message: "Checking the guide for contradictions" };
  guide = listUnverified(await consistencyPass(ai, guide, notes));
  yield { type: "guide", guide };
}

// Draft ready-to-run requests from the OAuth doc pages the agent read (or that the guide cites).
export async function draftRequests(ai: OpenAI, guide: Guide, cache: PageCache): Promise<Guide["requests"]> {
  const cited = [...new Set(allClaims(guide).flatMap((c) => c.sources.map((s) => s.url)))];
  await Promise.all(cited.filter((u) => u.startsWith("http") && !cache.has(u)).slice(0, 12).map((u) => fetchPageText(u, cache)));
  // The pages most likely to show endpoints: mention a token endpoint and an authorize step.
  const pages = [...cache.entries()]
    .map(([url, text]) => ({ url, text, score: (/token/i.test(text) ? 2 : 0) + (/authori[sz]e/i.test(text) ? 2 : 0) + (/curl|POST /.test(text) ? 1 : 0) + (/grant_type/.test(text) ? 3 : 0) }))
    .filter((p) => p.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (!pages.length) {
    // None of the pages read so far show the endpoints: look up the provider's OAuth reference directly.
    const found = await webSearch(`${guide.app} OAuth 2.0 authorization code token endpoint grant_type documentation`);
    for (const r of (found.results ?? []).slice(0, 4)) {
      const page = await fetchPageText(r.url, cache);
      if (page.text && /grant_type|token/i.test(page.text)) pages.push({ url: r.url, text: page.text, score: 4 });
      if (pages.length >= 2) break;
    }
  }
  if (!pages.length) return [];
  const scopes = guide.agentPath?.scopeTiers.map((t) => t.scopes).join(" | ") ?? "";
  try {
    const res = await ai.chat.completions.create({
      model: MAIN,
      messages: [
        { role: "system", content: REQUESTS_PROMPT },
        {
          role: "user",
          content: [`App: ${guide.app}`, `Scopes from the guide: ${scopes}`, ...pages.map((p) => `=== ${p.url}\n${p.text.slice(0, 18_000)}`)].join("\n\n"),
        },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = Guide.shape.requests.safeParse(JSON.parse(res.choices[0].message.content ?? "{}").requests ?? []);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function parseEndpoints(notes: string) {
  const m = /ENDPOINTS:\s*(\{.*\})/.exec(notes);
  try {
    const e = m ? JSON.parse(m[1]) : {};
    const url = (v: unknown) => (typeof v === "string" && v.startsWith("http") ? v : undefined);
    const hosts = [...(Array.isArray(e.oidcHosts) ? e.oidcHosts : []), e.oidcDomain].filter((h): h is string => typeof h === "string" && h !== "null");
    return { authModel: e.authModel as string | undefined, authorizeUrl: url(e.authorizeUrl), consoleUrl: url(e.consoleUrl), oidcHosts: hosts };
  } catch {
    return { authModel: undefined, authorizeUrl: undefined, consoleUrl: undefined, oidcHosts: [] as string[] };
  }
}

// Rules the model is told but that code enforces anyway.
export function enforceRules(g: Guide): Guide {
  // "tested" is reserved for setup attempts; probes live in their own table.
  const fix = <C extends Claim>(c: C): C => (c.evidence === "tested" ? { ...c, evidence: c.sources.some((s) => s.quote) ? "sourced" : "inferred" } : c);
  const essentials = ESSENTIAL_TOPICS.map((topic) => {
    const hit = g.essentials.find((e) => e.topic.toLowerCase().startsWith(topic.toLowerCase().slice(0, 8)));
    return hit ? fix({ ...hit, topic }) : { topic, text: "Not found in the sources researched", evidence: "unverified" as const, sources: [] };
  });
  const missing = essentials.filter((e) => e.text.startsWith("Not found")).map((e) => `${e.topic}: not found in the sources researched.`);
  return {
    ...g,
    agentPath: g.agentPath && { recommendation: fix(g.agentPath.recommendation), scopeTiers: g.agentPath.scopeTiers.map(fix) },
    essentials,
    // An "agent" step with nothing produced is just the developer's work with a different label.
    phases: g.phases.map((p) => ({
      ...p,
      steps: p.steps.map((s) => ({ ...s, owner: s.owner === "agent" && !s.output?.trim() ? "you" : s.owner, detail: fix(s.detail) })),
    })),
    gotchas: g.gotchas.map(fix),
    whenBlocked: g.whenBlocked.map(fix),
    uncertain: [...new Set([...g.uncertain, ...missing.filter((m) => !g.uncertain.some((u) => u.toLowerCase().includes(m.split(":")[0].toLowerCase())))])],
  };
}

// Models paraphrase. Check each quote against the full text of the cited page (fetching any the
// agent cited but didn't read). A sourced or reported claim keeps its tag only if every quote it
// cites is found on its page; otherwise it is downgraded to unverified.
export async function verifyQuotes(guide: Guide, cache: PageCache): Promise<Guide> {
  const cited = new Set(allClaims(guide).flatMap((c) => c.sources.filter((s) => s.quote).map((s) => s.url)));
  await Promise.all([...cited].filter((u) => u.startsWith("http") && !cache.has(u)).map((u) => fetchPageText(u, cache)));

  // Compare words only: quotes legitimately differ from page text in punctuation and spacing.
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const pages = [...cache.entries()].map(([url, text]) => [url.replace(/\/$/, ""), norm(text)] as const);
  const check = <C extends Claim>(c: C): C => {
    const sources = c.sources.map((s) => {
      if (!s.quote) return s;
      const page = pages.find(([u]) => u === s.url.replace(/\/$/, ""))?.[1];
      // A quote with an ellipsis is checked fragment by fragment: each piece must appear on the page, in order.
      const parts = s.quote.split(/\s*(?:\.{3}|…)\s*/).map(norm).filter((f) => f.split(" ").length >= 3);
      let at = 0;
      const found = !!page && parts.length > 0 && parts.every((f) => ((at = page.indexOf(f, at)), at >= 0 && (at += f.length) > 0));
      return { ...s, quoteVerified: found };
    });
    if (c.evidence !== "sourced" && c.evidence !== "reported") return { ...c, sources };
    const quoted = sources.filter((s) => s.quote);
    const ok = quoted.length > 0 && quoted.every((s) => s.quoteVerified);
    return { ...c, sources, evidence: ok ? c.evidence : "unverified" };
  };
  const out: Guide = {
    ...guide,
    agentPath: guide.agentPath && { recommendation: check(guide.agentPath.recommendation), scopeTiers: guide.agentPath.scopeTiers.map(check) },
    essentials: guide.essentials.map(check),
    requests: guide.requests.map(check),
    phases: guide.phases.map((p) => ({ ...p, steps: p.steps.map((s) => ({ ...s, detail: check(s.detail) })) })),
    gotchas: guide.gotchas.map(check),
    whenBlocked: guide.whenBlocked.map(check),
  };
  return listUnverified(out);
}

// Hours for the fixed step-effort vocabulary; provider waits ("wait: ...") are not hands-on time.
const EFFORT_HOURS: [RegExp, number, number][] = [
  [/^5 min/i, 0.08, 0.08],
  [/^15 min/i, 0.25, 0.25],
  [/^30 min/i, 0.5, 0.5],
  [/^1.2 hr/i, 1, 2],
  [/^half day/i, 3, 4],
  [/^1.3 days/i, 8, 24],
];

// If the model gave hands-on effort without a number, derive the range from the step estimates.
function numericEffort(g: Guide): Guide {
  if (/\d/.test(g.verdict.activeEffort)) return g;
  let lo = 0, hi = 0;
  for (const s of g.phases.flatMap((p) => p.steps)) {
    const m = EFFORT_HOURS.find(([re]) => re.test(s.effort ?? ""));
    if (m) (lo += m[1]), (hi += m[2]);
  }
  if (!hi) return g;
  const fmt = (h: number) => (h >= 16 ? `${Math.round(h / 8)} days` : `${Math.max(1, Math.round(h))} hours`);
  const [a, b] = [fmt(lo), fmt(hi)];
  const range = a === b ? b : a.split(" ")[1] === b.split(" ")[1] ? `${a.split(" ")[0]}–${b}` : `${a}–${b}`;
  return { ...g, verdict: { ...g.verdict, activeEffort: `${range} (sum of the step estimates below). ${g.verdict.activeEffort}` } };
}

// Final, code-enforced pass: numeric effort, and anything the verifier couldn't confirm listed as uncertain.
export function listUnverified(g: Guide): Guide {
  g = numericEffort(g);
  // Difficulty 4-5 means review, verification or eligibility: never "open".
  if (g.verdict.difficulty >= 4 && g.verdict.access === "open") g = { ...g, verdict: { ...g.verdict, access: "gated" } };
  // One summary line, so verification misses don't bury the real open questions.
  const n = allClaims(g).filter((c) => c.evidence === "unverified" && c.sources.length && !c.text.startsWith("Not found")).length;
  const line = `${n} claim${n === 1 ? "" : "s"} couldn't be matched word-for-word to ${n === 1 ? "its" : "their"} cited page and ${n === 1 ? "is" : "are"} marked Unverified. Check those sources before relying on them.`;
  return { ...g, uncertain: [...g.uncertain.filter((u) => !u.startsWith("Couldn't confirm") && !/couldn't be matched word-for-word/.test(u)), ...(n ? [line] : [])] };
}

// A second read of the finished guide: verdict vs steps, contradictions, uncertain items the notes answer.
async function consistencyPass(ai: OpenAI, guide: Guide, notes: string): Promise<Guide> {
  try {
    const res = await ai.chat.completions.create({
      model: MAIN,
      messages: [
        { role: "system", content: CHECK_PROMPT },
        { role: "user", content: `Guide:\n${JSON.stringify({ ...guide, probes: undefined })}\n\nResearch notes:\n${notes}` },
      ],
      response_format: { type: "json_object" },
    });
    const r = JSON.parse(res.choices[0].message.content ?? "{}");
    const verdict = Guide.shape.verdict.safeParse({ ...guide.verdict, ...(r.verdict ?? {}) });
    const fixes = new Map<string, string>(
      (Array.isArray(r.stepFixes) ? r.stepFixes : []).filter((f: { title?: unknown; text?: unknown }) => typeof f?.title === "string" && typeof f?.text === "string").map((f: { title: string; text: string }) => [f.title, f.text]),
    );
    return {
      ...guide,
      verdict: verdict.success ? verdict.data : guide.verdict,
      uncertain: Array.isArray(r.uncertain) ? r.uncertain.filter((u: unknown) => typeof u === "string") : guide.uncertain,
      phases: guide.phases.map((p) => ({ ...p, steps: p.steps.map((s) => (fixes.has(s.title) ? { ...s, detail: { ...s.detail, text: fixes.get(s.title)! } } : s)) })),
    };
  } catch {
    return guide; // the check is a refinement; never lose a guide because of it
  }
}
