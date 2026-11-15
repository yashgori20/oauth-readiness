# Validation

How much can you trust a guide? This file records what was checked, how, and what broke along the way. Every number below comes from the guide JSON in `guides/` and `validation/` or from the generation logs.

## How each guide is checked

Every claim in a guide carries one of four evidence tags:

| Tag | Meaning | Who decides |
|---|---|---|
| **tested** | A live, unauthenticated request showed it (OIDC discovery, the authorize endpoint with a fake client ID, the console URL) | Code runs the probe; the model may only tag a claim "tested" if its text is exactly what the probe showed |
| **sourced** | Stated on a cited page, with a verbatim quote | The model proposes it, then **code reloads the page and checks the quote is on it**. If no quote matches, the claim is downgraded to *unverified* |
| **inferred** | The model's own reasoning from sourced facts | The model |
| **unverified** | A source was cited but the quote couldn't be found on the page | Code |

Quote matching is done on word-normalised text (lowercase, punctuation stripped) so formatting differences don't cause false misses. A quote stitched together from two separate sentences fails, which is intended.

## Results across the library

| Guide | Difficulty | Claims | Tested / Sourced / Inferred / Unverified | Quotes found on page | Run |
|---|---|---|---|---|---|
| GitHub | 2 | 18 | 1 / 16 / 1 / 0 | 34 / 35 | local |
| Shopify | 3 | 19 | 0 / 19 / 0 / 0 | 31 / 33 | local |
| Dropbox | 3 | 22 | 1 / 21 / 0 / 0 | 38 / 38 | local, through the live UI |
| Gmail (Google OAuth) | 4 | 21 | 1 / 18 / 2 / 0 | 38 / 39 | local |
| Meta (Facebook Login + Marketing API) | 4 | 24 | 0 / 20 / 2 / 2 | 41 / 46 | local |
| Xero | 4 | 24 | 0 / 22 / 0 / 2 | 23 / 29 | local |
| Spotify | 5 | 19 | 1 / 17 / 1 / 0 | 38 / 38 | local |
| **Total** | | **147** | **4 / 133 / 6 / 4** | **243 / 258 (94%)** | |

Calendly was generated on the deployed site (Vercel) in 121 seconds to confirm the hosted pipeline runs inside the platform's 300-second limit and that live guides are saved.

## Hand check: Spotify

The hardest guide (difficulty 5) was checked by hand against Spotify's own pages. These claims held up:

- Development mode allows **5 users**, and the app owner needs **Spotify Premium**.
- Extended quota mode requires **250k monthly active users**, and since **15 May 2025** only organisations (not individuals) can apply.
- Review can take **up to 6 weeks**.
- The development-mode changes dated **11 Feb 2026** and **9 Mar 2026** are on the developer blog.
- **Localhost redirect URIs are no longer allowed.**

## What broke, and what changed because of it

### 1. Bot-blocked docs: Meta went from 0 / 16 to 41 / 46 quotes
Meta's developer docs return an empty shell to a plain HTTP fetch. In the first run every quote failed verification and 17 of 20 claims ended up *unverified* (kept in `validation/meta-before-reader-fallback.json`). The verifier was right to refuse them: it couldn't see the page. Fix: a fallback that reads JavaScript-rendered pages through a reader service when the plain fetch returns too little text. Re-run: 41 of 46 quotes found.

### 2. The verifier rejects stitched quotes
In the Spotify run the model quoted *"Tap on the Users Management tab and tap on the Add new user button"*. Both halves exist on the page but not as one sentence. The verifier marked it not found. This is the behaviour we want: a quote is evidence only if it appears as written.

### 3. The model was too cautious, then fixed
An early Spotify run tagged 13 of 20 claims *inferred* even though 37 of 37 of its quotes were verified (`validation/spotify-over-cautious.json`). The writing prompt was changed so that a claim combining several quoted facts counts as *sourced*, and *inferred* is reserved for the model's own reasoning. The next run: 17 sourced, 1 inferred.

### 4. The model over-claimed "tested", then fixed
Early drafts tagged broader claims as *tested* when a probe had only touched a related endpoint. The prompt now allows *tested* only when the claim's text is exactly what a probe showed. Across the library only 4 claims are tested, each tied to a probe result.

### 5. Wrong domain probed (Xero), open
The OIDC discovery probe went to `login.xero.com`, which returns an HTML page. Xero's identity server is `identity.xero.com`. The model picks the probe domain from its research notes and picked the wrong one. The probe correctly reported failure rather than passing. Not yet fixed; a fix would try the discovery path on each OAuth host the notes mention.

### 6. Placeholder URL probed (Shopify), open
Shopify's authorize URL is per-shop (`https://{shop}.myshopify.com/admin/oauth/authorize`). The probe tried the template literally and failed. The guide reports the probe as failed, so nothing false is claimed, but a probe that substitutes a real test shop would be better.

### 7. Pricing tables don't verify (Xero), open
Four of Xero's six unverified quotes come from the pricing page's table (for example *"Connections (maximum) 50"*). Flattening the table to text separates the label from the value, so the quote isn't found. The facts are very likely right; the verifier can't confirm them, so the guide shows them as unverified. Honest, but a table-aware matcher would recover these.

## Known limits

- **Apps that don't use OAuth.** Some APIs (Google Maps, most payment and weather APIs) use a key the developer pays for; there's no end user connecting an account. The agent assumes every app has an OAuth flow and has no rule for this case yet. It needs one before such apps are run.
- **"Tested" is shallow by design.** The agent never logs into a developer console, so nothing that needs an account (creating the app, submitting for review) is tested.
- **Wait times are what providers state.** Real review times vary; when a provider publishes no timeline, the guide says so under *Still uncertain*.
- **One run per guide.** Guides were not regenerated several times to measure how much they vary between runs.
