// Search + page fetch. Every fetched page's full text goes into the cache so quotes
// can later be checked against what the agent actually read.

export type PageCache = Map<string, string>;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const LANG = "en-US,en;q=0.9";

// Some docs (Google's especially) localise by IP or headers; a quote in Turkish is useless evidence.
// Ask for English explicitly. The cache key stays the URL the model cited, so quote checks still line up.
function english(url: string) {
  try {
    const u = new URL(url);
    if (/(^|\.)google\.com$/.test(u.hostname) && !u.searchParams.has("hl")) u.searchParams.set("hl", "en");
    return u.toString();
  } catch {
    return url;
  }
}

type SearchResult = { title: string; url: string; snippet: string };

// Azure OpenAI's built-in web_search tool, run on the cheap reader model. URLs come from
// the response's url_citation annotations (real search hits), not from model-written text.
export async function webSearch(query: string): Promise<{ results?: SearchResult[]; error?: string }> {
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/+$/, "");
  const res = await fetch(`${endpoint}/openai/v1/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": process.env.AZURE_OPENAI_API_KEY ?? "" },
    body: JSON.stringify({
      model: process.env.AZURE_DEPLOYMENT_READER ?? "gpt-5.6-luna",
      tools: [{ type: "web_search" }],
      input: `Web search: ${query}\nList the most relevant results, one line each: title — one-sentence summary. Prefer official sources.`,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) return { error: `search failed: HTTP ${res.status}` };
  const data = await res.json();
  const seen = new Map<string, SearchResult>();
  for (const item of data.output ?? []) {
    for (const part of item.content ?? []) {
      for (const a of part.annotations ?? []) {
        if (a.type !== "url_citation" || !a.url) continue;
        const url = a.url.replace(/[?&]utm_source=openai$/, "");
        if (!seen.has(url)) {
          const line = (part.text ?? "").slice(Math.max(0, a.start_index - 250), a.start_index).split("\n").pop() ?? "";
          seen.set(url, { title: a.title ?? url, url, snippet: line.trim().slice(0, 250) });
        }
      }
    }
  }
  return { results: [...seen.values()].slice(0, 8) };
}

function htmlToText(html: string) {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

// Jina's reader renders JS-heavy and bot-blocked docs (e.g. developers.facebook.com) to markdown. Free, no key.
async function readerFetch(url: string) {
  try {
    const res = await fetch(`https://r.jina.ai/${english(url)}`, { headers: { Accept: "text/plain", "Accept-Language": LANG, "X-Locale": "en-US" }, signal: AbortSignal.timeout(45000) });
    if (!res.ok) return "";
    const body = await res.text();
    const i = body.indexOf("Markdown Content:");
    const md = i >= 0 ? body.slice(i + 17).trim() : body;
    // Markdown link and image syntax would put URLs mid-sentence and break word-for-word quote checks.
    return md.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\*\*|__/g, "");
  } catch {
    return "";
  }
}

// Direct fetch first (free, fast); fall back to a rendering reader for JS-rendered or blocked pages.
export async function fetchPageText(url: string, cache: PageCache): Promise<{ text?: string; error?: string }> {
  if (cache.has(url)) return { text: cache.get(url) };
  let text = "";
  try {
    const res = await fetch(english(url), { headers: { "User-Agent": UA, "Accept-Language": LANG }, signal: AbortSignal.timeout(12000) });
    if (res.ok && (res.headers.get("content-type") ?? "").includes("html")) text = htmlToText(await res.text());
  } catch {}
  // Thin pages are often JS-rendered (only the title survives a plain fetch): try the rendering reader and keep the longer text.
  if (text.length < 3000) {
    const rendered = await readerFetch(url);
    if (rendered.length > text.length) text = rendered;
  }
  if (text.length < 800 && process.env.TAVILY_API_KEY) {
    const res = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({ urls: [english(url)] }),
    });
    if (res.ok) text = (await res.json()).results?.[0]?.raw_content ?? text;
  }
  if (text.length < 200) return { error: "page empty or blocked (may need login or JS)" };
  cache.set(url, text);
  return { text };
}
