import { z } from "zod";

// Models sometimes return a cited claim, {min,max} or a number where we want prose; flatten to a string.
const flatten = (v: unknown): string =>
  typeof v === "string"
    ? v
    : Array.isArray(v)
      ? v.map(flatten).join("; ")
      : v && typeof v === "object"
        ? "text" in v
          ? flatten((v as { text: unknown }).text)
          : Object.values(v).map(flatten).join(" – ")
        : String(v);
const Text = z.preprocess((v) => (v == null ? v : flatten(v)), z.string());

// How we know a claim is true. Shown on every claim in the UI.
// tested = a setup attempt or live request showed it; sourced = official page, quote verified;
// reported = community / third-party report (forums, blogs), quote verified; inferred = model reasoning;
// unverified = a cited quote wasn't found on its page, or nothing supports it.
export const Evidence = z.enum(["tested", "sourced", "reported", "inferred", "unverified"]);

export const Source = z.object({
  url: z.string(),
  quote: z.string().optional(), // verbatim snippet from the page backing the claim
  quoteVerified: z.boolean().optional(), // set by verifyQuotes(), never by the model
});

export const Claim = z.object({
  text: Text,
  evidence: z.preprocess((v) => (Evidence.options.includes(v as never) ? v : "inferred"), Evidence),
  sources: z.array(Source).default([]),
});

export const Owner = z.enum(["agent", "you", "provider"]); // provider = waiting on them

export const Step = z.object({
  title: z.string(),
  owner: Owner,
  detail: Claim,
  effort: Text.optional(), // e.g. "10 min", "1-2 hr", "wait: 3-5 business days"
  link: z.string().optional(),
  output: Text.optional(), // what the agent produced for an agent-owned step (draft, snippet, checklist)
});

export const Phase = z.object({
  name: z.string(), // Register, Configure, Test, Review, Production
  steps: z.array(Step),
});

// Scope tiers mapped to what an agent needs to do, and what each tier costs you in review.
export const ScopeTier = Claim.extend({
  need: Text, // e.g. "Read the user's inbox"
  scopes: Text, // e.g. "gmail.readonly"
});

// Checklist items every guide must answer or explicitly mark unknown.
export const ESSENTIAL_TOPICS = [
  "Tokens and refresh",
  "Redirect URIs",
  "Test users and dev limits",
  "Rate limits",
  "Cost",
  "Going live",
  "Submitting for review",
  "Security checks",
] as const;
export const Essential = Claim.extend({ topic: Text });

// Ready-to-run requests: the sign-in link and curl commands, with placeholders like YOUR_CLIENT_ID.
export const Request = Claim.extend({
  label: Text, // e.g. "Send the user to sign in"
  method: z.preprocess((v) => (typeof v === "string" ? v.toUpperCase() : v), z.enum(["GET", "POST", "DELETE", "PUT", "PATCH"])).default("GET"),
  url: Text,
  curl: Text.optional(), // omitted for the browser sign-in link
});

export const Access = z.enum(["open", "gated", "ineligible", "not-oauth"]);

export const Guide = z.object({
  app: z.string(),
  slug: z.string(),
  website: z.string().optional(),
  developerConsole: z.string().optional(),
  generatedAt: z.string(),
  origin: z.enum(["curated", "live"]),
  verdict: z.object({
    difficulty: z.coerce.number().min(1).max(5),
    access: z.preprocess((v) => (Access.options.includes(v as never) ? v : "open"), Access).default("open"),
    summary: Text,
    activeEffort: Text, // hands-on time, as an hours range
    waitTime: Text, // provider review / approval wait, as a range with its basis
    mainGate: Text, // the single thing most likely to block launch
  }),
  agentPath: z
    .object({
      recommendation: Claim, // which app type / distribution model an agent builder should pick, and why
      scopeTiers: z.array(ScopeTier).default([]),
    })
    .optional(),
  essentials: z.array(Essential).default([]),
  requests: z.array(Request).default([]),
  phases: z.array(Phase),
  gotchas: z.array(Claim),
  whenBlocked: z.array(Claim),
  probes: z
    .array(z.object({ name: z.string(), target: z.string(), result: z.string(), ok: z.boolean() }))
    .default([]),
  uncertain: z.array(Text).default([]),
  // How the guide was researched: every status line, search, page read and probe, with seconds from start.
  research: z
    .object({
      seconds: z.number(),
      log: z.array(
        z.object({
          t: z.number(),
          type: z.enum(["status", "tool"]),
          message: z.string().optional(),
          name: z.string().optional(),
          target: z.string().optional(),
          summary: z.string().optional(),
          detail: z.array(z.string()).optional(),
        }),
      ),
    })
    .optional(),
});

export type Guide = z.infer<typeof Guide>;
export type Claim = z.infer<typeof Claim>;

// Every claim in a guide, for stats and verification.
export function allClaims(g: Guide): Claim[] {
  return [
    ...(g.agentPath ? [g.agentPath.recommendation, ...g.agentPath.scopeTiers] : []),
    ...g.essentials,
    ...g.requests,
    ...g.phases.flatMap((p) => p.steps.map((s) => s.detail)),
    ...g.gotchas,
    ...g.whenBlocked,
  ];
}
