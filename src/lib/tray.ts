// Research runs this browser started, so the header can show them on every page.
export type TrayJob = { id: string; app: string; startedAt: number };
const KEY = "research-jobs";

export function readTray(): TrayJob[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addToTray(job: TrayJob) {
  try {
    const next = [job, ...readTray().filter((j) => j.id !== job.id)].slice(0, 6);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new Event("tray-changed"));
}

export function removeFromTray(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(readTray().filter((j) => j.id !== id)));
  } catch {}
  window.dispatchEvent(new Event("tray-changed"));
}
