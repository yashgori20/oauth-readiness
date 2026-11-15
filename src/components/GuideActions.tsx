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
    `- **Hands-on effort:** ${g.verdict.activeEffort}`,
    `- **Waiting on provider:** ${g.verdict.waitTime}`,
    `- **What will block you:** ${g.verdict.mainGate}`,
    "",
    ...g.phases.flatMap((p, i) => [
      `## ${i + 1}. ${p.name}`,
      "",
      ...p.steps.flatMap((s) => [`### [${s.owner}] ${s.title}${s.effort ? ` (${s.effort})` : ""}`, "", s.detail.text, "", cite(s.detail), ""]),
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
    `_Researched ${g.generatedAt.slice(0, 10)}. Evidence: tested = live request, sourced = quote verified on page._`,
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
        <a href={guide.developerConsole} target="_blank" rel="noreferrer" className={`${btn} border-ink bg-ink text-white hover:bg-ink-2 hover:text-white`}>
          Developer console <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
