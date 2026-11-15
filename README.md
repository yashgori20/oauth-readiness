# OAuth Readiness

**Live:** https://oauth-readiness-ten.vercel.app

Before an agent can act in someone's Gmail, Xero or Spotify account, the developer needs an OAuth app registered with that provider, and often the provider's approval. That part is slow and badly documented: some apps take ten minutes, others need a registered business and weeks of review.

This app answers the developer's real questions for any app:

- **Can I launch, and how hard is it?** Difficulty 1 to 5.
- **How long?** Hands-on effort, and separately, time spent waiting on the provider.
- **What will block me?** The main gate, in one line.
- **What are the steps, and who does each one?** Each step is marked *agent* (could be automated), *you* (needs your login, legal entity or payment) or *provider* (their review).
- **How do we know?** Every claim is tagged *tested*, *sourced*, *inferred* or *unverified*, with the quote it rests on.

It has a library of 8 guides and researches any other app live in two to five minutes.

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
| Calendly | n/a | Generated live on the deployed site as a test |

## How a guide is made

```
app name ─▶ Search ─▶ Read ─▶ Probe ─▶ Write ─▶ Verify ─▶ guide
```

1. **Search.** The research model plans queries; Azure's web search tool returns official docs, policy pages and developer blogs.
2. **Read.** A cheaper model reads each page and returns only the relevant facts, each with a verbatim quote. Pages that block bots go through a rendering reader.
3. **Probe.** Code makes unauthenticated requests: OIDC discovery, the authorize endpoint with a fake client ID, and the developer console URL.
4. **Write.** The research model turns notes and probe results into a structured guide (JSON, validated with zod) and tags every claim's evidence.
5. **Verify.** Code reloads every cited page and checks each quote is really on it. Claims whose quotes aren't found are downgraded to *unverified*, not hidden.

The live page streams each step as it happens, so you can watch the agent search, read and probe.

## Models

| Role | Model | Why |
|---|---|---|
| Planning research, writing the guide | GPT-5.6 Terra (Azure OpenAI) | Needs judgment: deciding what to look for, resolving conflicting sources, tagging evidence honestly |
| Web search, reading pages | GPT-5.6 Luna (Azure OpenAI) | High-volume, simple work: reading up to 60k characters per page and extracting quotes. Cheaper and faster |

A first prototype used `gpt-oss-120b` on Groq's free tier. One guide used about 150k tokens against a 200k daily cap, so it was dropped.

## Validation

See [VALIDATION.md](VALIDATION.md). In short: across the library, 243 of 258 quotes (94%) were found on the cited page, and only 4 of 147 claims are tagged *tested*. It also records what broke and what changed because of it: bot-blocked docs, stitched quotes, an over-cautious model, wrong probe domains, and apps that don't use OAuth at all.

## Limits

- The agent never logs into a developer console, so *tested* only covers what an unauthenticated request can show.
- Review times are what providers state. Real waits vary.
- APIs that use a paid API key and no user login (Google Maps, for example) aren't handled yet; the agent assumes an OAuth flow exists.
- Live research on the demo is rate-limited (3 runs per visitor per hour, 40 per day) because it spends real tokens.

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
| `src/lib/agent.ts` | The research loop, prompts, and quote verifier |
| `src/lib/web.ts` | Web search and page reading (direct fetch, then a rendering reader) |
| `src/lib/tools.ts` | Unauthenticated probes |
| `src/lib/guide.ts` | Guide schema (zod) |
| `src/lib/store.ts` | Library: bundled guides, plus live guides in Vercel Blob |
| `src/app/api/generate/route.ts` | Streams agent progress to the browser (server-sent events) |
| `guides/` | The library |
| `validation/` | Earlier runs kept as evidence for VALIDATION.md |

## Stack

Next.js 15, TypeScript, Tailwind CSS 4, zod, the OpenAI SDK against Azure OpenAI, Vercel (hosting and Blob storage).

---

Built by Yash Gori for the Composio APM, Integrations take-home. Not affiliated with Composio.
