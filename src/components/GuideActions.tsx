"use client";

import { useState } from "react";
import type { Claim, Guide } from "@/lib/guide";
import { ArrowUpRight, Copy, Download } from "./icons";

// Markdown export so a guide can travel into a ticket, a PR, or a Slack thread.
function toMarkdown(g: Guide) {
  const cite = (c: Claim) => {
    const src = c.sources.map((s) => (s.quote ? `> "${s.quote}" (${s.url})` : `> ${s.url}`)).join("\n");
    return `_${c.evidence}_${src ? `\n${src}` : ""}`;
  };
  const lines = [
    `# ${g.app}: OAuth app setup and approval`,
    "",
    `**Difficulty ${g.verdict.difficulty}/5.** ${g.verdict.summary}`,
    "",
    `- **Your work:** ${g.verdict.activeEffort}`,
    `- **Waiting for approval:** ${g.verdict.waitTime}`,
    `- **Biggest blocker:** ${g.verdict.mainGate}`,
    "",
    ...(g.agentPath
      ? [
          "## What to build",
          "",
          g.agentPath.recommendation.text,
          "",
          ...(g.agentPath.scopeTiers.length
            ? ["| If your agent needs to | Ask for these scopes | What that means for approval |", "|---|---|---|", ...g.agentPath.scopeTiers.map((t) => `| ${t.need} | \`${t.scopes}\` | ${t.text} |`), ""]
            : []),
        ]
      : []),
    ...(g.essentials.length ? ["## Quick facts", "", ...g.essentials.flatMap((e) => [`- **${e.topic}:** ${e.text}`]), ""] : []),
    ...g.phases.flatMap((p, i) => [
      `## ${i + 1}. ${p.name}`,
      "",
      ...p.steps.flatMap((s) => [
        `### [${s.owner}] ${s.title}${s.effort ? ` (${s.effort})` : ""}`,
        "",
        s.detail.text,
        "",
        ...(s.output ? ["Drafted by the agent:", "", "```", s.output, "```", ""] : []),
        cite(s.detail),
        "",
      ]),
    ]),
    "## Gotchas",
    "",
    ...g.gotchas.flatMap((c) => [`- ${c.text}`, "", cite(c), ""]),
    "## When you're blocked",
    "",
    ...g.whenBlocked.flatMap((c) => [`- ${c.text}`, "", cite(c), ""]),
    "## Still uncertain",
    "",
    ...g.uncertain.map((u) => `- ${u}`),
    "",
    `_Researched ${g.generatedAt.slice(0, 10)}. Evidence: sourced = official page, quote verified; reported = community source, quote verified; inferred = reasoning; unverified = quote not found or unsupported._`,
  ];
  return lines.join("\n");
}

export function GuideActions({ guide }: { guide: Guide }) {
  const [copied, setCopied] = useState(false);
  const btn = "label inline-flex items-center gap-1.5 border border-line px-2.5 py-1.5 text-ink-2 hover:border-ink hover:text-ink";
  return (
    <div className="flex flex-wrap gap-2 sm:ml-auto">
      <button
        className={btn}
        onClick={async () => {
          await navigator.clipboard.writeText(`${location.origin}/apps/${guide.slug}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
      >
        <Copy className="h-3.5 w-3.5" /> {copied ? "Link copied" : "Copy link"}
      </button>
      <button
        className={btn}
        onClick={() => {
          const url = URL.createObjectURL(new Blob([toMarkdown(guide)], { type: "text/markdown" }));
          const a = Object.assign(document.createElement("a"), { href: url, download: `${guide.slug}-oauth-guide.md` });
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        <Download className="h-3.5 w-3.5" /> Markdown
      </button>
      {guide.developerConsole && (
        <a href={guide.developerConsole} target="_blank" rel="noreferrer" className={`${btn} border-ink bg-ink text-on-ink hover:bg-ink-2 hover:text-on-ink`}>
          Developer console <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
