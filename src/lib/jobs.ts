import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { list, put } from "@vercel/blob";
import { generateGuide, type AgentEvent } from "./agent";
import { saveGuide, slugify } from "./store";

// A live research run that outlives the page that started it. Progress is kept in memory and
// persisted (Vercel Blob when deployed, a local folder in dev) so any page can follow it.
export type Job = {
  id: string;
  app: string;
  status: "running" | "done" | "error";
  startedAt: number;
  finishedAt?: number;
  events: AgentEvent[]; // status and tool events only; the guide is saved separately
  slug?: string;
  error?: string;
};

const BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const DIR = path.join(process.cwd(), ".jobs");
const jobs = new Map<string, Job>();

// Saves for one job run one after another: overlapping writes corrupted the file.
const chains = new Map<string, Promise<void>>();
function persist(job: Job): Promise<void> {
  const next = (chains.get(job.id) ?? Promise.resolve()).then(() => write(job));
  chains.set(job.id, next);
  return next;
}

async function write(job: Job) {
  const body = JSON.stringify(job);
  if (BLOB) {
    await put(`jobs/${job.id}.json`, body, { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 }).catch(() => {});
    return;
  }
  try {
    await mkdir(DIR, { recursive: true });
    const file = path.join(DIR, `${job.id}.json`);
    await writeFile(`${file}.tmp`, body);
    await rename(`${file}.tmp`, file); // atomic: a reader never sees a half-written file
  } catch {}
}

export async function getJob(id: string): Promise<Job | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  if (jobs.has(id)) return jobs.get(id)!;
  try {
    if (BLOB) {
      const { blobs } = await list({ prefix: `jobs/${id}.json` });
      const hit = blobs.find((b) => b.pathname === `jobs/${id}.json`);
      // Cache-bust: another instance may have overwritten it since the CDN cached it.
      return hit ? ((await (await fetch(`${hit.url}?v=${Date.now()}`, { cache: "no-store" })).json()) as Job) : null;
    }
    return JSON.parse(await readFile(path.join(DIR, `${id}.json`), "utf8")) as Job;
  } catch {
    return null;
  }
}

export function createJob(app: string): Job {
  const id = `${slugify(app) || "app"}-${Date.now().toString(36)}`;
  const job: Job = { id, app, status: "running", startedAt: Date.now(), events: [] };
  jobs.set(id, job);
  return job;
}

// Runs the pipeline to completion, persisting progress every few events.
export async function runJob(job: Job) {
  let sinceSave = 0;
  await persist(job);
  try {
    for await (const ev of generateGuide(job.app)) {
      if (ev.type === "guide") {
        ev.guide.slug = slugify(ev.guide.slug || ev.guide.app);
        await saveGuide(ev.guide);
        job.slug = ev.guide.slug;
        job.status = "done";
      } else if (ev.type === "error") {
        job.status = "error";
        job.error = ev.message.slice(0, 2000);
      } else {
        job.events.push(ev);
        if (++sinceSave >= 3) {
          sinceSave = 0;
          void persist(job);
        }
      }
    }
    if (job.status === "running") {
      job.status = "error";
      job.error = "The agent stopped without producing a guide.";
    }
  } catch (e) {
    job.status = "error";
    job.error = String(e).slice(0, 2000);
  }
  job.finishedAt = Date.now();
  await persist(job);
}
