# Validation

How much can you trust a guide, and how did we find out? This file covers how every claim is checked, what independent reviewers found, what broke, and what changed because of it. Every number comes from the guide files in `guides/` and the snapshots in `validation/v1` to `validation/v4` (run `node scripts/stats.mjs <folder>` to reproduce).

## How every claim is checked

Every claim in a guide carries one of these tags:

| Tag | Meaning | Who decides |
|---|---|---|
| **sourced** | An official provider page says it, and every quote it cites was found on that page | The model proposes it; **code re-opens the page and checks each quote word for word**. Any miss and the claim becomes *unverified* |
| **reported** | Only community or third-party sources say it (forums, integration vendors), quotes found on the page | Same check |
| **inferred** | The model's own reasoning from sourced facts | The model |
| **unverified** | A cited quote wasn't found on its page, or nothing supports it | Code |
| **tested** | A setup attempt showed it | Not used: see *Limits* |

Quote matching ignores case, punctuation and spacing, and checks quotes with an ellipsis fragment by fragment, in order. A quote made up of two sentences from different places fails, which is intended.

Code also enforces rules the model is told but can't be trusted with: probe results never count as evidence for a step; an *agent* step with nothing drafted becomes a *you* step; every quick-fact topic is present or marked "not found"; difficulty 4 or 5 can't be marked "open"; effort without a number is computed from the step estimates.

## The library now (v5)

| Guide | Difficulty | Access | Claims | Quotes found on page (guide body) |
|---|---|---|---|---|
| GitHub | 2 | open | 31 | 49 / 51 |
| Calendly | 2 | open | 32 | 54 / 55 |
| Dropbox | 3 | gated | 28 | 53 / 53 |
| Gmail | 4 | gated | 34 | 56 / 57 |
| Meta | 4 | gated | 34 | 79 / 83 |
| Shopify | 4 | gated | 35 | 77 / 78 |
| Xero | 4 | gated | 30 | 69 / 70 |
| Zoom | 4 | gated | 36 | 64 / 64 |
| Spotify | 5 | gated | 31 | 70 / 70 |
| Strava | 5 | ineligible | 31 | 56 / 56 |
| **Total** (including request examples) | | | **361** | **712 / 727 (97.9%)** |

Evidence mix: 318 sourced, 8 reported, 19 inferred, 16 unverified. Every guide was generated in 110-210 seconds, inside the 300-second limit of the hosting platform.

## How we tested the guides: independent reviewers

Three reviewer agents were each given the brief and three raw guide files, and nothing about how the guides were made. Each one scored every guide 1-5 on seven criteria taken from the brief, and fact-checked the four highest-stakes claims per guide (review timelines, user caps, eligibility, pricing) against the providers' current docs. Full round-1 results are in [validation/review-round1.md](validation/review-round1.md).

Criteria: (a) difficulty, (b) time and wait, (c) requirements and nuances, (d) agent vs you split, (e) start / next / blocked, (f) evidence honesty, (g) usable without help. Maximum 35.

| Guide | Round 1 (v1) | Round 2 (v2) | Round 3 (v3) |
|---|---|---|---|
| Shopify | 15 | **24** | 17 |
| Gmail | 21 | **25** | 24 |
| Xero | 17 | 17 | **19** |
| GitHub, Spotify, Dropbox, Strava, Meta, Calendly | 22-26 | not re-scored | not re-scored |

Fact checks: round 1 checked 36 claims (28 correct, 6 partly, 2 wrong). Round 2 checked 10 (8 correct, 1 partly, 1 wrong). Round 3 checked 12 (7 correct, 3 partly, 2 wrong).

**What the scores say.** The changes clearly helped Gmail and Shopify between v1 and v2. But Shopify then fell from 24 to 17 on a fresh run, because that run missed development stores and led with a rule first-time developers never hit. Two lessons:

1. **Guides vary from run to run.** The same pipeline can produce a strong guide or a weaker one for the same app. A production library would generate each app several times and keep the best, or have a reviewer agent gate publication.
2. **One reviewer's score is noisy.** Treat the trend as more reliable than any single number.

## What broke, and what changed because of it

### Evidence and verification

1. **Bot-blocked docs: Meta went from 0/16 to 41/46 quotes.** Meta's docs return an empty shell to a plain fetch, so every quote failed (kept in `validation/meta-before-reader-fallback.json`). Fix: fall back to a reader that renders JavaScript.
2. **Localised pages: Gmail's evidence was in Turkish, Chinese and Persian.** Google served our fetcher localised pages, and the quotes really were on them. Fix: request English explicitly.
3. **Claims stayed "sourced" when one of several quotes failed.** Fix: every quote must verify.
4. **Probe results were counted as "tested" evidence for steps.** A login redirect doesn't prove a setup step works. Fix: probes are shown only in their own table.
5. **The plain-language rule made the model reword quotes (v4: 86%).** Asked to write simply, the model also "simplified" quotes, which the verifier rightly rejected: 79 claims became unverified. Fix: quotes are exempt from style rules and copied exactly. v5: 97.9%.
6. **Markdown from the rendering reader put URLs mid-sentence**, breaking word-for-word matches. Fix: strip link syntax before checking.
7. **Thin JavaScript-rendered pages (Xero)** returned only a title to a plain fetch. Fix: use the rendering reader whenever a page comes back short.

### Content

8. **Not written for an agent builder (all v1 guides).** No recommended app type, no scopes mapped to agent actions. Fix: a *What to build* section and scope tiers, each with what it costs in review, always including the cheapest read-only tier.
9. **Essentials were often missing:** token lifetimes, rate limits, cost, how to go live, where to submit for review, security checks. Fix: eight required quick facts, each answered or marked "not found".
10. **Wait times reported as an absence ("no SLA stated").** Fix: a range with its basis (official, community-reported or inferred), using integration vendors' write-ups when the provider publishes nothing.
11. **"Agent" steps were just the developer's work relabelled.** Fix: an agent step must include what the agent drafted (code, an app manifest, scope justifications, a CLI command), or it becomes a *you* step.
12. **No way to say "you can't do this".** Strava's API terms ban AI applications. Fix: an *ineligible* verdict, and a *not-oauth* verdict for API-key-only services such as Google Maps.
13. **Calendly's verdict called the redirect URI "immutable"**, but its own cited page says it can be changed. **Xero said "move to Core in minutes"** while its blocker said Core needs certification. Fix: a final consistency pass over the finished guide.
14. **Xero's certification gate depends on which official page you read.** Xero's FAQ refers to "the 'App certification' requirement for the Core, Plus, Advanced, and Enterprise tiers"; its pricing page lists certification from Plus up. v2 missed certification entirely; v3 and v5 name it. The guide now has to flag conflicts between official pages rather than pick one.
15. **The copy was hard to read.** Fix: plain-language rules (short sentences, explain provider terms, a fixed three-sentence summary), plus simpler section names.

### Pipeline robustness

16. **One failed search or page read killed the whole run** (an Azure rate limit, a network reset). Fix: a failed tool is logged and the research continues. Since then, runs survived up to 5 failed tools.
17. **Probes tried a placeholder URL literally (Shopify's `{shop}.myshopify.com`)** and **the wrong OIDC host (Xero)**. Fix: skip templated URLs; try every candidate host.

## Hand check: Spotify

Checked by hand against Spotify's own pages:
- Development mode allows **5 users**, and the app owner needs **Premium**.
- Extended quota needs **250,000 monthly active users**, and since **15 May 2025** only organisations can apply.
- Review can take **up to 6 weeks**.
- Dev-mode changes dated **11 February 2026** and **9 March 2026** are on the developer blog.
- **Localhost redirect URIs are no longer allowed.**

## Limits

- **Nothing is "tested".** The brief asks agents to attempt as much setup as practical. The agent never signs in to a developer console: that needs the developer's credentials and breaks most providers' terms. It stops at unauthenticated probes and at drafting what it can.
- **Run-to-run variation** (see the reviewer scores above). Not yet controlled.
- **Wait times are what providers or communities state.** Real waits vary.
- **The "not OAuth" path** (Google Maps and similar) exists, but has had little testing.
- **Meta's docs still resist automated reading**, so Meta has the most unverified claims and its guide has no request examples.
