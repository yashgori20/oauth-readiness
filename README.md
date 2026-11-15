# OAuth Readiness

**Live:** https://oauth-readiness-ten.vercel.app  
**Repo:** https://github.com/yashgori20/oauth-readiness

Before an agent can act in someone's Gmail, Xero or Spotify account, the developer needs an OAuth app registered with that provider, and often the provider's approval. That part is slow and badly documented: some apps take ten minutes, others need a registered business and weeks of review.

Name any app and you get a guide that answers the developer's real questions:

- **Can I launch, and how hard is it?** Difficulty 1 to 5, plus a flag when the provider's terms rule an AI agent out, or when the API doesn't use OAuth at all.
- **How long?** Your hands-on work, and separately, how long you wait for approval, with whether that figure is official or community-reported.
- **What will block me?** The biggest blocker in one sentence, and when it applies.
- **What should I build?** The app type to choose, and the scopes for each thing your agent needs to do, with what each costs you in review.
- **Quick facts:** tokens and refresh, redirect rules, test limits, rate limits, cost, going live, submitting for review, security checks.
- **Try it:** the sign-in link and `curl` commands for the code exchange, refresh and a test call, with placeholders.
- **The steps, and who does each one:** *agent* steps include what the agent drafted (code, manifests, scope justifications); *you* steps need your login, legal entity or payment; *provider* steps are their review.
- **How do we know?** Every claim is tagged *sourced*, *reported*, *inferred* or *unverified*, with the quote it rests on.

Each guide page has an **Ask about this guide** panel. Questions the guide answers jump to and highlight the sections that answer them; anything else is answered from a live web search, with sources.

The library has 10 guides; any other app is researched live in two to three minutes, with an expandable log of every search and page read.

## Why this scope

Composio's managed-auth directory lists 382 OAuth toolkits. Composio runs the OAuth app for 124 of them; for the other 258, developers bring their own. Even where a managed app exists, production usually needs your own (your name on the consent screen, your scopes, your rate limits). So the gap isn't explaining OAuth. It's telling a developer, before they start, what it will cost them to get through.

The library was picked to cover different kinds of blocker:

| App | Difficulty | What makes it hard |
|---|---|---|
| GitHub | 2 | Self-serve; organisations with access restrictions must approve the app |
| Shopify | 3 | Public distribution and protected customer data need Shopify's approval |
| Dropbox | 3 | No production review until the app has 50 linked users, unless an early review is granted |
| Gmail | 4 | Sensitive and restricted scopes need verification; restricted data on your servers needs a security assessment |
| Meta | 4 | Business verification and app review, then Marketing API tier qualification |
| Xero | 4 | App certification for paid tiers |
| Spotify | 5 | Extended access only for registered organisations with 250k monthly active users |
| Calendly | 2 | Self-serve; consent needed before sharing its data with an AI provider |
| Zoom | 4 | Marketplace review for apps other accounts install |
| Strava | 5 | Ineligible: the API terms prohibit use in AI applications |

## How a guide is made

```
app name ─▶ Search ─▶ Read ─▶ Probe ─▶ Write ─▶ Requests ─▶ Verify ─▶ Check ─▶ guide
```

1. **Search.** The research model plans queries; Azure's web search tool returns official docs, policy pages and developer blogs.
2. **Read.** A cheaper model reads each page and returns only the relevant facts, each with a verbatim quote. Pages that block bots go through a rendering reader.
3. **Probe.** Code makes unauthenticated requests: OIDC discovery, the authorize endpoint with a fake client ID, and the developer console URL.
4. **Write.** The research model turns notes and probe results into a structured guide (JSON, validated with zod), written for an agent builder in plain language, and tags every claim's evidence.
5. **Requests.** From the OAuth docs it read, the model writes the sign-in link and curl commands, quoting the line that shows each endpoint.
6. **Verify.** Code reloads every cited page and checks each quote is really on it, word for word. A claim with any quote that isn't found is downgraded to *unverified*, not hidden.
7. **Check.** A second pass reads the finished guide for contradictions (a step that says "minutes" for something the blocker says needs certification) and fixes them.

Code also enforces rules the model is told but can't be trusted with: an *agent* step with nothing drafted becomes a *you* step; probe results never count as evidence for a step; every quick-fact topic is present or marked "not found".

The live page streams each step as it happens, so you can watch the agent search, read and probe.

## Models

| Role | Model | Why |
|---|---|---|
| Planning research, writing the guide | GPT-5.6 Terra (Azure OpenAI) | Needs judgment: deciding what to look for, resolving conflicting sources, tagging evidence honestly |
| Web search, reading pages | GPT-5.6 Luna (Azure OpenAI) | High-volume, simple work: reading up to 60k characters per page and extracting quotes. Cheaper and faster |

A first prototype used `gpt-oss-120b` on Groq's free tier. One guide used about 150k tokens against a 200k daily cap, so it was dropped.

## Key decisions

- **Scope: setup and approval, not OAuth tutorials.** Developers know what OAuth is. What they can't find is whether they can launch, how long it takes and what will stop them. Every guide answers that on its first screen.
- **Written for an agent builder.** Every guide assumes many end users connecting their own accounts, so it recommends an app type and maps agent actions to scopes and their review cost. That's where generic docs leave developers to work it out.
- **Evidence is checked by code, not trusted.** Models paraphrase and occasionally invent. Quotes are verified against the page text, and misses stay visible as *unverified*. Being visibly unsure beats being confidently wrong.
- **No setup attempts with real accounts.** The brief asks agents to attempt as much setup as practical. Signing into a developer's console would need their credentials and breaks most providers' terms, so the agent stops at unauthenticated probes and at drafting what it can (code, manifests, justifications, requests). That's also why no claim is tagged *tested*.
- **Live research is the product, the library is a cache.** The library is the same pipeline run ahead of time, so a new app gets the same quality as a curated one.
- **Two models.** The larger model plans and writes; the smaller one does the bulk reading and searching, which keeps a guide to roughly two to three minutes.

## Validation

See [VALIDATION.md](VALIDATION.md). In short: across the 10 guides, 712 of 727 quotes (97.9%) are confirmed word for word on the page they cite, and 16 of 361 claims are visibly marked unverified. Three rounds of independent reviewer agents scored the guides against the brief and fact-checked 58 high-stakes claims; their findings drove five versions of the pipeline, all kept in `validation/`. It also records what broke along the way and the limits that remain, including how much a guide can vary from one run to the next.

## Limits

- The agent never logs into a developer console, so *tested* only covers what an unauthenticated request can show.
- Review times are what providers state. Real waits vary.
- APIs with no user sign-in (Google Maps, for example) are detected and get a short "no OAuth" guide, but this path has had little testing.
- Guides vary from run to run. The same app researched twice can pick a different main blocker; see VALIDATION.md.
- Some providers' docs block automated readers (Meta), so fewer of their quotes can be verified and their guides may lack the request examples.
- Live research and questions are rate-limited on the demo (3 researches and 30 questions per visitor per hour) because they spend real tokens.

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in the Azure endpoint and key
npm run dev                   # http://localhost:3000
```

Generate a guide from the command line:

```bash
node --env-file=.env.local --import tsx scripts/gen.mts "Notion"
```

Guides are saved to `guides/<slug>.json`. `npm run build` bundles that folder into the app.

## Code map

| Path | What it is |
|---|---|
| `src/lib/agent.ts` | The research loop, prompts, request drafting, quote verifier and consistency check |
| `src/lib/ask.ts` | The "Ask about this guide" answers: from the guide's sections, or a live web search |
| `src/lib/web.ts` | Web search and page reading (direct fetch, then a rendering reader) |
| `src/lib/tools.ts` | Unauthenticated probes |
| `src/lib/guide.ts` | Guide schema (zod) |
| `src/lib/store.ts` | Library: bundled guides, plus live guides in Vercel Blob |
| `src/app/api/generate/route.ts` | Streams agent progress to the browser (server-sent events) |
| `guides/` | The library |
| `validation/` | Earlier versions of every guide (v1-v4), reviewer findings and before/after runs, kept as evidence for VALIDATION.md |
| `scripts/stats.mjs` | Evidence stats for a folder of guides, used for the before/after numbers |

## Stack

Next.js 15, TypeScript, Tailwind CSS 4, zod, the OpenAI SDK against Azure OpenAI, Vercel (hosting and Blob storage).

---

Built by Yash Gori for the Composio APM, Integrations take-home. Not affiliated with Composio.
