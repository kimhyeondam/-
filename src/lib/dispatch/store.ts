// 배차 서버 저장소 (기사님 공개 링크·사진 정리에서 사용)
import { getStore } from "@/lib/store";
import { dispatches as sample, type Dispatch } from "@/data/sample";
import { migrateInlinePhotos, pruneOldPhotos, retentionYears } from "./photos";

const g = globalThis as unknown as { __jeilPhotoPruneAt?: number };

/** 배차 목록을 읽으면서, 장부 안에 남아 있는 옛 방식 사진은 파일로 옮기고, 하루 한 번 오래된 사진을 정리합니다 */
export async function getDispatches(): Promise<Dispatch[]> {
  const row = await getStore().get<Dispatch[]>("dispatches");
  const list = row && Array.isArray(row.data) ? row.data : sample;
  let changed = await migrateInlinePhotos(list);
  const now = Date.now();
  if (!g.__jeilPhotoPruneAt || now - g.__jeilPhotoPruneAt > 24 * 3600 * 1000) {
    g.__jeilPhotoPruneAt = now;
    const today = new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const n = await pruneOldPhotos(list, await retentionYears(), today);
    if (n > 0) changed = true;
  }
  if (changed) await getStore().set("dispatches", list);
  return list;
}

export async function updateDispatch(id: string, patch: (d: Dispatch) => Dispatch): Promise<Dispatch | null> {
  const list = await getDispatches();
  const idx = list.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  const next = patch(list[idx]);
  const copy = [...list];
  copy[idx] = next;
  await getStore().set("dispatches", copy);
  return next;
}
