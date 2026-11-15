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
export const Evidence = z.enum(["tested", "sourced", "inferred", "unverified"]);

export const Source = z.object({
  url: z.string(),
  quote: z.string().optional(), // verbatim snippet from the page backing the claim
  quoteVerified: z.boolean().optional(), // set by verifyQuotes(), never by the model
});

export const Claim = z.object({
  text: z.string(),
  evidence: Evidence,
  sources: z.array(Source).default([]),
});

export const Owner = z.enum(["agent", "you", "provider"]); // provider = waiting on them

export const Step = z.object({
  title: z.string(),
  owner: Owner,
  detail: Claim,
  effort: Text.optional(), // e.g. "10 min", "2-4 weeks wait"
  link: z.string().optional(),
});

export const Phase = z.object({
  name: z.string(), // Register, Configure, Test, Review, Production
  steps: z.array(Step),
});

export const Guide = z.object({
  app: z.string(),
  slug: z.string(),
  website: z.string().optional(),
  developerConsole: z.string().optional(),
  generatedAt: z.string(),
  origin: z.enum(["curated", "live"]),
  verdict: z.object({
    difficulty: z.coerce.number().min(1).max(5),
    summary: Text,
    activeEffort: Text, // hands-on time
    waitTime: Text, // provider review / approval wait
    mainGate: Text, // the single thing most likely to block launch
  }),
  phases: z.array(Phase),
  gotchas: z.array(Claim),
  whenBlocked: z.array(Claim),
  probes: z
    .array(z.object({ name: z.string(), target: z.string(), result: z.string(), ok: z.boolean() }))
    .default([]),
  uncertain: z.array(z.string()).default([]),
});

export type Guide = z.infer<typeof Guide>;
export type Claim = z.infer<typeof Claim>;
