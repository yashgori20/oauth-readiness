"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ArrowRight } from "@/components/icons";
import { ResearchHeader } from "@/components/ResearchLog";
import { addToTray } from "@/lib/tray";

// Starts a background research job, then hands over to /research/<id>, which can be left and reopened.
function Start() {
  const app = useSearchParams().get("app") ?? "";
  const router = useRouter();
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (!app || ran.current) return;
    ran.current = true;
    (async () => {
      const res = await fetch("/api/research", { method: "POST", body: JSON.stringify({ app }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? `HTTP ${res.status}`);
      addToTray({ id: data.id, app: data.app, startedAt: Date.now() });
      router.replace(`/research/${data.id}`);
    })().catch((e) => setError(String(e)));
  }, [app, router]);

  return (
    <ResearchHeader app={app} kicker="Live research">
      {error ? (
        <div className="mt-8 border border-line bg-red-soft px-5 py-4">
          <p className="label text-red">Couldn&apos;t start the research</p>
          <p className="mt-2 text-sm text-ink-2">{error}</p>
          <Link href="/#research" className="label mt-3 inline-flex items-center gap-1.5 text-ink hover:text-brand">
            Back <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <p className="mt-8 flex items-center gap-3 text-sm text-muted">
          <span className="h-1.5 w-1.5 animate-pulse bg-brand" /> Starting the agent…
        </p>
      )}
    </ResearchHeader>
  );
}

export default function GeneratePage() {
  return (
    <Suspense>
      <Start />
    </Suspense>
  );
}
