import { getStore } from "@/lib/store";
import { isOurItem, type DeliveryRules } from "./deliveryRules";
import { slimDelivery, type DeliveriesFile, type Delivery } from "./deliveries";

const COLLECTION = "deliveries";
const KEEP_YEARS = 5;

export async function readRules(): Promise<Partial<DeliveryRules>> {
  const row = await getStore().get<{ deliveryRules?: Partial<DeliveryRules> }>("settings");
  return row?.data?.deliveryRules ?? {};
}

/** 서버 메모리에 한 번 읽어 둔 자료. 파일이 바뀌거나 규칙이 바뀌면 다시 읽습니다 */
interface Cache { file: DeliveriesFile; updatedAt?: string; rulesKey: string }
const gc = globalThis as unknown as { __deliveryCache?: Cache | null };
export function invalidateDeliveries() { gc.__deliveryCache = null; }

export async function readDeliveries(): Promise<DeliveriesFile> {
  const rules = await readRules();
  const rulesKey = JSON.stringify(rules);
  const store = getStore();
  // 파일이 바뀌었는지는 updatedAt 으로 (파일 전체를 읽지 않고 알 수 없어, 저장·정리·비우기 때 invalidate 도 함께 씁니다)
  const cached = gc.__deliveryCache;
  if (cached && cached.rulesKey === rulesKey) return cached.file;
  const row = await store.get<DeliveriesFile>(COLLECTION);
  const raw = row?.data && Array.isArray(row.data.items) ? row.data : { items: [] };
  // 「우리 품목」 판정은 품명 규칙(기본 + 설정에서 고친 것)으로 읽을 때 다시 합니다
  const file: DeliveriesFile = { ...raw, items: raw.items.map((d) => ({ ...d, related: isOurItem(d.item, d.detail, rules) })) };
  gc.__deliveryCache = { file, updatedAt: row?.updatedAt, rulesKey };
  return file;
}

/** 우리 품목이 아닌 것을 저장소에서 지웁니다 (자료를 가볍게) */
export async function pruneUnrelated(): Promise<{ removed: number; kept: number }> {
  const rules = await readRules();
  const store = getStore();
  let removed = 0; let kept = 0;
  const apply = (prev: DeliveriesFile | null) => {
    const items = (prev?.items ?? []).filter((d) => { const ok = isOurItem(d.item, d.detail, rules); if (ok) kept++; else removed++; return ok; });
    return { ...(prev ?? { items: [] }), items, updatedAt: new Date().toISOString() } as DeliveriesFile;
  };
  if (store.update) await store.update<DeliveriesFile>(COLLECTION, apply);
  else { const prev = await store.get<DeliveriesFile>(COLLECTION); await store.set(COLLECTION, apply(prev?.data ?? null)); }
  invalidateDeliveries();
  return { removed, kept };
}

/**
 * 새로 읽은 납품요구를 기존 것과 합칩니다 (같은 번호는 새 것으로).
 * 조각으로 나눠 올릴 때는 partial=true 로 여러 번 부르고, 같은 파일 이름의 이력에 건수를 더해 갑니다.
 */
export async function mergeDeliveries(items: Delivery[], fileName: string, rows: number, partial = false): Promise<DeliveriesFile & { added: number; addedTotal: number }> {
  const store = getStore();
  const apply = (prev: DeliveriesFile | null) => {
    const base = prev && Array.isArray(prev.items) ? prev.items : [];
    const map = new Map(base.map((d) => [d.id, d]));
    let added = 0;
    for (const raw of items) { const d = slimDelivery(raw); const old = map.get(d.id); if (!old) added++; if (!old || (d.ord ?? "") >= (old.ord ?? "")) map.set(d.id, d); }
    const cutoff = `${new Date().getFullYear() - KEEP_YEARS}-01-01`;
    const all = [...map.values()].filter((d) => !d.date || d.date >= cutoff).sort((a, b) => b.date.localeCompare(a.date));
    const files = [...(prev?.files ?? [])];
    // 같은 파일을 조각으로 올리는 중이면(10분 안) 이력 한 줄에 합칩니다
    const recent = files[0] && files[0].name === fileName && Date.now() - new Date(files[0].at).getTime() < 10 * 60_000 ? files[0] : null;
    if (recent) { recent.rows = rows; recent.added += added; recent.at = new Date().toISOString(); }
    else files.unshift({ name: fileName, at: new Date().toISOString(), rows, added });
    return { file: { items: all, updatedAt: new Date().toISOString(), files: files.slice(0, 20) } as DeliveriesFile, added, addedTotal: recent ? recent.added : added };
  };
  let result: ReturnType<typeof apply> | null = null;
  if (store.update) await store.update<DeliveriesFile>(COLLECTION, (prev) => { result = apply(prev); return result.file; });
  else { const prev = await store.get<DeliveriesFile>(COLLECTION); result = apply(prev?.data ?? null); await store.set(COLLECTION, result.file); }
  const r = result!;
  void partial;
  invalidateDeliveries();
  return { ...r.file, added: r.added, addedTotal: r.addedTotal };
}

export async function clearDeliveries() { await getStore().set(COLLECTION, { items: [], updatedAt: new Date().toISOString(), files: [] } satisfies DeliveriesFile); invalidateDeliveries(); }

/** 조각으로 올라오는 자료를 잠시 모아 두었다가 마지막에 한 번만 합칩니다 (파일을 여러 번 다시 쓰지 않아 메모리 절약) */
interface Staging { chunks: Map<number, Delivery[]>; fileName: string; rows: number; at: number }
const g = globalThis as unknown as { __deliveryStaging?: Map<string, Staging> };
const staging = () => (g.__deliveryStaging ??= new Map());
const STAGING_TTL = 30 * 60_000;

export function stageChunk(uploadId: string, index: number, items: Delivery[], fileName: string, rows: number) {
  const st = staging();
  for (const [k, v] of st) if (Date.now() - v.at > STAGING_TTL) st.delete(k);
  const cur = st.get(uploadId) ?? { chunks: new Map(), fileName, rows, at: Date.now() };
  cur.chunks.set(index, items.map(slimDelivery)); cur.at = Date.now(); cur.rows = rows;
  st.set(uploadId, cur);
  return cur.chunks.size;
}

/** 마지막 조각: 모아 둔 것을 한 번에 합칩니다. 조각 수가 안 맞으면(서버 재시작 등) null */
export async function finishUpload(uploadId: string, expectedChunks: number) {
  const st = staging(); const cur = st.get(uploadId);
  if (!cur || cur.chunks.size !== expectedChunks) return null;
  st.delete(uploadId);
  const all = [...cur.chunks.keys()].sort((a, b) => a - b).flatMap((k) => cur.chunks.get(k)!);
  return mergeDeliveries(all, cur.fileName, cur.rows);
}
