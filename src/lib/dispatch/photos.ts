// 납품 사진 파일 저장소. 사진은 장부(JSON)에 넣지 않고 data/photos/dispatch/<배차id>/<사진id>.jpg 로 따로 둡니다.
// 장부에는 경로(/api/dispatch/photo/<배차id>/<사진id>.jpg)만 적습니다.
import { promises as fs } from "node:fs";
import path from "node:path";
import { getStore } from "@/lib/store";
import type { Dispatch } from "@/data/sample";

export const DEFAULT_RETENTION_YEARS = 3;

function photoRoot() {
  return path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "photos", "dispatch");
}
const safe = (s: string) => /^[a-zA-Z0-9_-]+$/.test(s);

export function photoUrl(dispatchId: string, photoId: string) {
  return `/api/dispatch/photo/${dispatchId}/${photoId}.jpg`;
}

export async function savePhotoFile(dispatchId: string, photoId: string, dataUrl: string) {
  if (!safe(dispatchId) || !safe(photoId)) throw new Error("잘못된 id");
  const m = dataUrl.match(/^data:image\/jpeg;base64,(.+)$/);
  if (!m) throw new Error("jpeg 만 저장할 수 있습니다");
  const dir = path.join(photoRoot(), dispatchId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${photoId}.jpg`), Buffer.from(m[1], "base64"));
  return photoUrl(dispatchId, photoId);
}

export async function readPhotoFile(dispatchId: string, photoId: string): Promise<Buffer | null> {
  if (!safe(dispatchId) || !safe(photoId)) return null;
  try { return await fs.readFile(path.join(photoRoot(), dispatchId, `${photoId}.jpg`)); } catch { return null; }
}

export async function deletePhotoFile(dispatchId: string, photoId: string) {
  if (!safe(dispatchId) || !safe(photoId)) return;
  await fs.rm(path.join(photoRoot(), dispatchId, `${photoId}.jpg`), { force: true });
}

export async function deleteDispatchPhotos(dispatchId: string) {
  if (!safe(dispatchId)) return;
  await fs.rm(path.join(photoRoot(), dispatchId), { recursive: true, force: true });
}

/** 예전 방식(장부 안 base64)으로 저장된 사진을 파일로 옮깁니다. 바뀐 것이 있으면 true */
export async function migrateInlinePhotos(list: Dispatch[]): Promise<boolean> {
  let changed = false;
  for (const d of list) {
    for (const p of d.photos) {
      if (p.image.startsWith("data:image/jpeg;base64,")) {
        try { p.image = await savePhotoFile(d.id, p.id, p.image); changed = true; } catch { /* 형식이 다르면 그대로 둠 */ }
      }
    }
  }
  return changed;
}

/** 보관 기간(년)이 지난 사진을 지웁니다. 지운 사진 수를 돌려주고, 장부에 정리 기록을 남깁니다 */
export async function pruneOldPhotos(list: Dispatch[], years: number, today: string): Promise<number> {
  if (!(years > 0)) return 0;
  const cutoff = new Date(today + "T00:00:00");
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cut = cutoff.toISOString().slice(0, 10);
  let removed = 0;
  for (const d of list) {
    if (d.date >= cut || d.photos.length === 0) continue;
    for (const p of d.photos) await deletePhotoFile(d.id, p.id);
    removed += d.photos.length;
    const dd = d as Dispatch & { photosPruned?: number; prunedAt?: string };
    dd.photosPruned = (dd.photosPruned ?? 0) + d.photos.length;
    dd.prunedAt = today;
    d.photos = [];
  }
  return removed;
}

export async function retentionYears(): Promise<number> {
  try {
    const row = await getStore().get<{ photos?: { retentionYears?: number } }>("settings");
    const y = row?.data?.photos?.retentionYears;
    return typeof y === "number" && y > 0 ? y : DEFAULT_RETENTION_YEARS;
  } catch { return DEFAULT_RETENTION_YEARS; }
}
