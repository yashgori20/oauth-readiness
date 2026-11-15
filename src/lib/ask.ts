import { client } from "./agent";
import type { Claim, Guide } from "./guide";

const MAIN = process.env.AZURE_DEPLOYMENT_MAIN ?? "gpt-5.6-terra";
const READER = process.env.AZURE_DEPLOYMENT_READER ?? "gpt-5.6-luna";

// Every addressable part of a guide. The ids match the element ids GuideView renders,
// so an answer can point at exact sections and the page can scroll to them.
export type Ref = { id: string; label: string; text: string };

const claimText = (c: Claim) => `${c.text} [evidence: ${c.evidence}${c.sources.length ? `; sources: ${c.sources.map((s) => s.url).join(", ")}` : ""}]`;

export function guideRefs(g: Guide): Ref[] {
  const refs: Ref[] = [
    { id: "ref-verdict", label: "Verdict", text: `Difficulty ${g.verdict.difficulty}/5 (${g.verdict.access}). ${g.verdict.summary} Your work: ${g.verdict.activeEffort}. Waiting for approval: ${g.verdict.waitTime}. Biggest blocker: ${g.verdict.mainGate}` },
  ];
  if (g.agentPath) {
    refs.push({ id: "ref-path", label: "What to build", text: claimText(g.agentPath.recommendation) });
    g.agentPath.scopeTiers.forEach((t, i) => refs.push({ id: `ref-tier-${i}`, label: `Scopes: ${t.need}`, text: `${t.scopes}. ${claimText(t)}` }));
  }
  g.essentials.forEach((e, i) => refs.push({ id: `ref-ess-${i}`, label: e.topic, text: claimText(e) }));
  g.requests.forEach((r, i) => refs.push({ id: `ref-req-${i}`, label: r.label, text: `${r.method} ${r.url}${r.curl ? `\n${r.curl}` : ""}. ${claimText(r)}` }));
  g.phases.forEach((p, pi) =>
    p.steps.forEach((s, si) =>
      refs.push({ id: `ref-step-${pi}-${si}`, label: `${p.name}: ${s.title}`, text: `Owner: ${s.owner}. Effort: ${s.effort ?? "?"}. ${claimText(s.detail)}${s.output ? `\nAgent draft: ${s.output}` : ""}` }),
    ),
  );
  g.gotchas.forEach((c, i) => refs.push({ id: `ref-gotcha-${i}`, label: "Gotcha", text: claimText(c) }));
  g.whenBlocked.forEach((c, i) => refs.push({ id: `ref-blocked-${i}`, label: "When you're blocked", text: claimText(c) }));
  if (g.uncertain.length) refs.push({ id: "ref-uncertain", label: "Still uncertain", text: g.uncertain.join(" | ") });
  return refs;
}

const ANSWER_PROMPT = `You help a developer understand a guide about setting up an OAuth app with a provider. You get the guide as numbered sections with ids, and the conversation.

Return JSON only: { "answer": "...", "refs": ["ref-..."], "needsSearch": false, "query": "" }

- If the guide answers the question: answer in 2-5 short, plain sentences, and list the ids of the sections that support it (most relevant first, at most 4). Explain jargon simply. Mention when a supporting claim is marked unverified or inferred.
- If the guide does not answer it: set needsSearch true and write a precise web search query in "query" (include the provider name). Leave answer empty.
- Never invent facts that aren't in the guide.`;

export type AskResult = { answer: string; refs: { id: string; label: string }[]; sources: { title: string; url: string }[]; searched: boolean };

export async function askGuide(g: Guide, question: string, history: { role: "user" | "assistant"; content: string }[]): Promise<AskResult> {
  const ai = client();
  const refs = guideRefs(g);
  const byId = new Map(refs.map((r) => [r.id, r.label]));
  const res = await ai.chat.completions.create({
    model: MAIN,
    messages: [
      { role: "system", content: ANSWER_PROMPT },
      { role: "user", content: `Guide: ${g.app}\n\n${refs.map((r) => `[${r.id}] ${r.label}: ${r.text}`).join("\n")}` },
      ...history.slice(-6),
      { role: "user", content: question },
    ],
    response_format: { type: "json_object" },
  });
  const out = JSON.parse(res.choices[0].message.content ?? "{}");
  if (!out.needsSearch && out.answer) {
    const hits = (Array.isArray(out.refs) ? out.refs : []).filter((r: unknown): r is string => typeof r === "string" && byId.has(r));
    return { answer: String(out.answer), refs: hits.map((id: string) => ({ id, label: byId.get(id)! })), sources: [], searched: false };
  }
  return { ...(await webAnswer(String(out.query || `${g.app} ${question}`), question, g.app)), refs: [], searched: true };
}

// Not in the guide: answer from a live web search, with the cited pages.
async function webAnswer(query: string, question: string, app: string): Promise<Omit<AskResult, "refs" | "searched">> {
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/+$/, "");
  const res = await fetch(`${endpoint}/openai/v1/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": process.env.AZURE_OPENAI_API_KEY ?? "" },
    body: JSON.stringify({
      model: READER,
      tools: [{ type: "web_search" }],
      input: `Search: ${query}\n\nAnswer this developer's question about ${app} in 2-5 short, plain sentences, based on official ${app} documentation where possible. If sources disagree or you can't find it, say so.\n\nQuestion: ${question}`,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) return { answer: `The search failed (HTTP ${res.status}). Try rephrasing.`, sources: [] };
  const data = await res.json();
  let answer = "";
  const sources = new Map<string, { title: string; url: string }>();
  for (const item of data.output ?? [])
    for (const part of item.content ?? []) {
      if (part.type === "output_text") answer += part.text ?? "";
      for (const a of part.annotations ?? []) if (a.type === "url_citation" && a.url) sources.set(a.url, { title: a.title ?? a.url, url: a.url.replace(/[?&]utm_source=openai$/, "") });
    }
  // Strip inline markdown citation links; sources are listed separately.
  answer = answer.replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*|`/g, "").trim();
  return { answer: answer || "I couldn't find an answer to that.", sources: [...sources.values()].slice(0, 5) };
}
