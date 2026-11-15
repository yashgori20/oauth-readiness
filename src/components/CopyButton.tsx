"use client";

import { useState } from "react";
import { Copy } from "./icons";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="label inline-flex items-center gap-1.5 border border-line bg-surface px-2 py-1 text-ink-2 hover:border-ink hover:text-ink"
    >
      <Copy className="h-3 w-3" /> {done ? "Copied" : label}
    </button>
  );
}
