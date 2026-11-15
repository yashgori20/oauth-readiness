import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { list, put } from "@vercel/blob";
import curatedRaw from "./curated.generated.json";
import { Guide } from "./guide";

// Library guides, bundled at build time (scripts/bundle-guides.mjs) so they ship on any host.
const CURATED = new Map<string, Guide>();
for (const raw of curatedRaw as unknown[]) {
  const r = Guide.safeParse(raw);
  if (r.success) CURATED.set(r.data.slug, r.data);
}

// Curated guides are committed JSON in guides/. Live guides go to Vercel Blob when a token is
// configured (deployed), otherwise to the local guides/ folder (dev). Memory is a fast cache on top.
const DIR = path.join(process.cwd(), "guides");
const BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const PREFIX = "guides/";
const memory = new Map<string, Guide>();

async function fromBlob(): Promise<Guide[]> {
  if (!BLOB) return [];
  try {
    const { blobs } = await list({ prefix: PREFIX });
    const guides = await Promise.all(
      blobs.map(async (b) => {
        try {
          return Guide.parse(await (await fetch(b.url, { cache: "no-store" })).json());
        } catch {
          return null;
        }
      }),
    );
    return guides.filter((g): g is Guide => !!g);
  } catch {
    return [];
  }
}

async function fromDisk(slug: string): Promise<Guide | null> {
  try {
    return Guide.parse(JSON.parse(await readFile(path.join(DIR, `${slug}.json`), "utf8")));
  } catch {
    return null;
  }
}

export async function listGuides(): Promise<Guide[]> {
  const files = await readdir(DIR).catch(() => [] as string[]);
  const disk = await Promise.all(files.filter((f) => f.endsWith(".json")).map((f) => fromDisk(f.slice(0, -5))));
  const all = new Map<string, Guide>();
  // Curated disk guides win over live ones with the same slug.
  for (const g of [...(await fromBlob()), ...memory.values(), ...disk, ...CURATED.values()]) if (g) all.set(g.slug, g);
  return [...all.values()].sort((a, b) => a.verdict.difficulty - b.verdict.difficulty || a.app.localeCompare(b.app));
}

export async function getGuide(slug: string): Promise<Guide | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  if (CURATED.has(slug)) return CURATED.get(slug)!;
  const disk = await fromDisk(slug);
  if (disk) return disk;
  if (memory.has(slug)) return memory.get(slug)!;
  if (BLOB) {
    try {
      const { blobs } = await list({ prefix: `${PREFIX}${slug}.json` });
      const hit = blobs.find((b) => b.pathname === `${PREFIX}${slug}.json`);
      if (hit) {
        const g = Guide.parse(await (await fetch(hit.url, { cache: "no-store" })).json());
        memory.set(slug, g);
        return g;
      }
    } catch {}
  }
  return null;
}

export async function saveGuide(g: Guide) {
  memory.set(g.slug, g);
  const body = JSON.stringify(g, null, 2);
  if (BLOB) {
    await put(`${PREFIX}${g.slug}.json`, body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    }).catch((e) => console.error("blob save failed", e));
    return;
  }
  try {
    await mkdir(DIR, { recursive: true });
    await writeFile(path.join(DIR, `${g.slug}.json`), body);
  } catch {}
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\.[a-z]+(\/.*)?$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
