// 인수증 사진(서명 받은 거래명세표) 저장소. 사진은 data/photos/receipts/<매출id>/<사진id>.jpg 로 두고,
// 장부(receipts 컬렉션)에는 어느 매출의 것인지·주소·올린 사람만 적습니다.
import { promises as fs } from "node:fs";
import path from "node:path";
import { getStore } from "@/lib/store";
import { newId, nowIso } from "@/lib/ids";

export interface Receipt {
  id: string;
  revenueId: string;
  url: string; // /api/revenues/receipt/<매출id>/<사진id>.jpg
  at: string; // ISO
  by?: string;
  note?: string; // 예) 서명 확인, 인수자 이름
}

const COLLECTION = "receipts";
const root = () => path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "photos", "receipts");
const safe = (s: string) => /^[a-zA-Z0-9_-]+$/.test(s);
export const receiptUrl = (revenueId: string, id: string) => `/api/revenues/receipt/${revenueId}/${id}.jpg`;

export async function listReceipts(): Promise<Receipt[]> {
  const row = await getStore().get<Receipt[]>(COLLECTION);
  return Array.isArray(row?.data) ? row!.data : [];
}

export async function addReceipt(revenueId: string, dataUrl: string, by?: string, note?: string): Promise<Receipt> {
  if (!safe(revenueId)) throw new Error("잘못된 매출 id 입니다.");
  const m = dataUrl.match(/^data:image\/jpeg;base64,(.+)$/);
  if (!m) throw new Error("JPEG 사진만 저장할 수 있습니다.");
  const buf = Buffer.from(m[1], "base64");
  if (buf.length > 6 * 1024 * 1024) throw new Error("사진이 너무 큽니다 (6MB 이하).");
  const id = newId("rc");
  await fs.mkdir(path.join(root(), revenueId), { recursive: true });
  await fs.writeFile(path.join(root(), revenueId, `${id}.jpg`), buf);
  const rec: Receipt = { id, revenueId, url: receiptUrl(revenueId, id), at: nowIso(), by, note: note?.trim() || undefined };
  const store = getStore();
  const apply = (prev: Receipt[] | null) => [rec, ...(Array.isArray(prev) ? prev : [])];
  if (store.update) await store.update<Receipt[]>(COLLECTION, apply); else await store.set(COLLECTION, apply((await store.get<Receipt[]>(COLLECTION))?.data ?? null));
  return rec;
}

export async function removeReceipt(revenueId: string, id: string) {
  if (!safe(revenueId) || !safe(id)) throw new Error("잘못된 id 입니다.");
  const store = getStore();
  const apply = (prev: Receipt[] | null) => (Array.isArray(prev) ? prev : []).filter((r) => r.id !== id);
  if (store.update) await store.update<Receipt[]>(COLLECTION, apply); else await store.set(COLLECTION, apply((await store.get<Receipt[]>(COLLECTION))?.data ?? null));
  await fs.rm(path.join(root(), revenueId, `${id}.jpg`), { force: true });
}

export async function readReceiptFile(revenueId: string, id: string): Promise<Buffer | null> {
  if (!safe(revenueId) || !safe(id)) return null;
  try { return await fs.readFile(path.join(root(), revenueId, `${id}.jpg`)); } catch { return null; }
}
