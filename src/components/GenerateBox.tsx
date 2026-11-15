"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Search } from "./icons";

const SUGGESTIONS = ["Strava", "Linear", "Zoom", "Notion", "Pipedrive"];

export function GenerateBox() {
  const router = useRouter();
  const [app, setApp] = useState("");
  const go = (name: string) => name.trim() && router.push(`/generate?app=${encodeURIComponent(name.trim())}`);
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(app);
        }}
        className="flex flex-col border border-ink sm:flex-row"
      >
        <label className="flex flex-1 items-center gap-3 px-4">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <span className="sr-only">App name or website</span>
          <input
            value={app}
            onChange={(e) => setApp(e.target.value)}
            placeholder="Any app name or website, e.g. notion.so"
            className="h-14 w-full bg-transparent text-lg text-ink outline-none"
          />
        </label>
        <button
          disabled={!app.trim()}
          className="label flex h-14 items-center justify-center gap-2 bg-ink px-6 text-white transition-colors hover:bg-brand disabled:cursor-not-allowed disabled:bg-[#b9b8b4]"
        >
          Research it live <ArrowRight className="h-4 w-4" />
        </button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="label text-muted">Not in the library yet:</span>
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => go(s)} className="label border border-line px-2.5 py-1 text-ink-2 hover:border-brand hover:text-brand">
            {s}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">Takes about two to three minutes. You&apos;ll watch the agent search, read, and probe as it goes.</p>
    </div>
  );
}
