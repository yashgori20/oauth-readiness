# Independent review, round 1 (v1 guides)

Three reviewer agents, each given the brief and three raw guide files (and nothing about how the guides were made), scored every guide 1-5 on seven criteria taken from the brief, fact-checked the four highest-stakes claims per guide against current official docs, and listed systemic problems.

Criteria: (a) difficulty, (b) time and wait, (c) requirements and nuances, (d) agent vs you split, (e) start / next / blocked, (f) evidence honesty, (g) usable without help.

## Scores

| Guide | a | b | c | d | e | f | g | Total /35 |
|---|---|---|---|---|---|---|---|---|
| Spotify | 4 | 4 | 3 | 4 | 4 | 3 | 4 | 26 |
| Dropbox | 4 | 3 | 3 | 3 | 4 | 3 | 4 | 24 |
| Strava | 3 | 4 | 4 | 2 | 4 | 4 | 3 | 24 |
| GitHub | 4 | 4 | 3 | 2 | 3 | 3 | 4 | 23 |
| Meta | 4 | 2 | 4 | 3 | 3 | 3 | 3 | 22 |
| Calendly | 4 | 3 | 3 | 3 | 3 | 2 | 4 | 22 |
| Gmail | 3 | 4 | 4 | 2 | 3 | 3 | 2 | 21 |
| Xero | 3 | 2 | 3 | 2 | 3 | 2 | 2 | 17 |
| Shopify | 3 | 1 | 2 | 2 | 3 | 2 | 2 | 15 |

Weakest criteria across the library: **(d) agent vs you split** (average 2.6) and **(f) evidence honesty** (2.8).

## Fact checks

36 high-stakes claims checked: **28 correct, 6 partly correct, 2 wrong.**

- Wrong: Calendly's verdict called the redirect URI "immutable"; its own cited page says it can be changed.
- Wrong: Xero's OIDC probe used `login.xero.com`; discovery lives on `identity.xero.com`.
- Partly: GitHub treated refresh tokens as opt-in (new apps get short-lived tokens by default); Gmail's timelines are right per the help centre but other Google pages give different figures; Meta said no review timeline is published (Meta's games App Review page gives 1-5 business days); Shopify said no SLA (true officially, but community moderators cite 5-10 business days); Dropbox's HTTPS redirect rule wasn't on the cited page.

## Pipeline bugs found

1. Google served localised pages: Gmail's quotes were in Turkish, Chinese and Persian, and verified (they were on the fetched page).
2. A claim stayed "sourced" when one of several quotes failed verification.
3. Probe results were copied into steps and gotchas as "tested".
4. A templated URL (`https://{shop}.myshopify.com/...`) was probed literally.
5. No consistency check: Xero said "move to Core in minutes" while its main gate said Core needs certification; some uncertain items were answered by pages already read.

## Content gaps found (all guides)

- Not framed for an agent builder: no recommended app type or distribution model, no scope tiers mapped to agent actions.
- Token lifetimes and refresh, rate limits, cost, the go-live switch, and the exact review submission page were often missing.
- Wait time reported as an absence ("no SLA stated") instead of a range with a basis.
- "agent" owner applied to legal judgements, console clicks and the developer's own code; no agent step showed anything the agent produced.
- No distinct verdict when the provider's terms rule the use case out (Strava's AI-application ban).

All of these drove the v2 changes described in [VALIDATION.md](../VALIDATION.md).
