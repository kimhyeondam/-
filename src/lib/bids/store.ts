// 가져온 공고를 data/bids.json 에 보관하고, 오래되면 다시 가져옵니다.
import { getStore } from "@/lib/store";
import { fetchAll, fetchKind, hasApiKey } from "./g2b";
import { isDesignService } from "./forecast";
import { isRelated, keywordsOf, regionOf } from "./classify";
import { serverProfile } from "./regions";
import { sampleBids } from "./sample";
import type { BidsFile } from "./types";

const COLLECTION = "bids";
const KEEP_DAYS = 180; // 이보다 오래된 공고는 지웁니다
const KEEP_DESIGN_DAYS = 365 * 3; // 설계용역은 1년 뒤 발주 예측에 쓰므로 3년 보관
const STALE_HOURS = 6; // 이 시간이 지나면 화면을 열 때 자동으로 다시 가져옵니다

/** 분류 규칙이 바뀌어도 예전에 저장한 공고가 새 규칙으로 보이도록 읽을 때마다 다시 분류합니다 */
function reclassify(items: BidsFile["items"]): BidsFile["items"] {
  const out: BidsFile["items"] = [];
  // 같은 공고번호의 변경공고(차수)는 가장 최신 차수만 남깁니다
  const latest = new Map<string, string>();
  for (const n of items) { const cur = latest.get(n.no); if (!cur || n.ord > cur) latest.set(n.no, n.ord); }
  for (const n of items) {
    if (latest.get(n.no) !== n.ord) continue;
    const region = regionOf(n.demand, n.agency, n.regionLimit, n.site);
    if (!region) continue; // 예: 경기도 광주시처럼 이제는 우리 지역이 아닌 것
    const keywords = keywordsOf(n.title);
    out.push({ ...n, region, keywords, related: isRelated(keywords, n.title, n.kind) });
  }
  return out;
}

function prune(items: BidsFile["items"]): BidsFile["items"] {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400_000).toISOString().slice(0, 10);
  const cutoffDesign = new Date(Date.now() - KEEP_DESIGN_DAYS * 86400_000).toISOString().slice(0, 10);
  return items.filter((n) => !n.noticeAt || n.noticeAt.slice(0, 10) >= (isDesignService(n) ? cutoffDesign : cutoff));
}

/** 서버 메모리 캐시: 파일이 바뀔 때(저장 시 invalidate) 까지 다시 읽지 않습니다 */
const gb = globalThis as unknown as { __bidsCache?: { updatedAt?: string; file: BidsFile } | null };
export function invalidateBids() { gb.__bidsCache = null; }

export async function readBids(): Promise<BidsFile> {
  if (gb.__bidsCache) return gb.__bidsCache.file;
  const row = await getStore().get<BidsFile>(COLLECTION);
  const raw = row?.data && Array.isArray(row.data.items) ? row.data : { items: [] };
  // 예시 공고는 광주·전남 기준이라 그 지역일 때만 보여 줍니다
  const file: BidsFile = !raw.items.length && !raw.fetchedAt ? { ...raw, items: serverProfile().key === "gj" ? sampleBids : [], source: "sample" } : { ...raw, items: reclassify(raw.items) };
  gb.__bidsCache = { updatedAt: row?.updatedAt, file };
  return file;
}

/** 화면을 막지 않는 뒤 가져오기: 같은 작업이 이미 돌고 있으면 새로 시작하지 않습니다 */
type BgSync = { promise: Promise<void>; startedAt: string; error?: string; finishedAt?: string };
const bg = globalThis as unknown as { __bidsBgSync?: BgSync | null };
export function startBackgroundSync(days = 7): BgSync {
  if (bg.__bidsBgSync && !bg.__bidsBgSync.finishedAt) return bg.__bidsBgSync;
  const job: BgSync = { startedAt: new Date().toISOString(), promise: Promise.resolve() };
  job.promise = syncBids(days).then(() => { job.finishedAt = new Date().toISOString(); }).catch((e) => { job.error = e instanceof Error ? e.message : String(e); job.finishedAt = new Date().toISOString(); });
  bg.__bidsBgSync = job;
  return job;
}
export function backgroundSyncStatus() { const j = bg.__bidsBgSync; return j ? { running: !j.finishedAt, startedAt: j.startedAt, error: j.error, finishedAt: j.finishedAt } : { running: false }; }

export function isStale(file: BidsFile) {
  if (!file.fetchedAt) return true;
  return Date.now() - new Date(file.fetchedAt).getTime() > STALE_HOURS * 3600_000;
}

/**
 * 나라장터에서 최근 days일치 공고를 가져와 기존 자료와 합칩니다.
 * 같은 공고번호-차수는 새 것으로 바꾸고, 180일 지난 것은 지웁니다.
 */
export async function syncBids(days = 7): Promise<BidsFile> {
  if (!hasApiKey()) throw new Error("공공데이터포털 인증키(DATA_GO_KR_KEY)가 설정되지 않았습니다.");
  const to = new Date();
  const from = new Date(to.getTime() - Math.min(Math.max(days, 1), 31) * 86400_000);
  const r = await fetchAll(from, to);
  const store = getStore();
  const prev = await store.get<BidsFile>(COLLECTION);
  const base = prev?.data && Array.isArray(prev.data.items) ? prev.data.items : [];
  const map = new Map(base.map((n) => [n.id, n]));
  for (const n of r.notices) map.set(n.id, n);
  const items = prune([...map.values()]).sort((a, b) => b.noticeAt.localeCompare(a.noticeAt));
  const allFailed = r.errors.length === 3;
  const file: BidsFile = {
    items, source: "api",
    fetchedAt: allFailed ? prev?.data?.fetchedAt : new Date().toISOString(),
    fetchedFrom: from.toISOString().slice(0, 10), fetchedTo: to.toISOString().slice(0, 10),
    error: r.errors.length ? r.errors.join(" / ") : undefined,
  };
  await store.set(COLLECTION, file);
  invalidateBids();
  if (allFailed) throw new Error(file.error);
  return file;
}

/**
 * 지난 설계용역 가져오기: 약 1년 전 설계용역이 지금쯤 발주로 이어지므로,
 * (오늘 − monthsBack개월) ~ (오늘 − monthsMin개월) 사이의 용역 공고를 「설계」로 검색해 설계용역만 보관합니다.
 */
/** 지난 설계용역 가져오기 진행 상황 (서버가 뒤에서 처리하는 동안 화면에 보여 줍니다) */
export interface DesignJob { running: boolean; startedAt?: string; finishedAt?: string; total: number; done: number; current?: string; found: number; added?: number; scanned: number; error?: string; monthsBack?: number }
const g = globalThis as unknown as { __designJob?: DesignJob };
export function designJobStatus(): DesignJob { return g.__designJob ?? { running: false, total: 0, done: 0, found: 0, scanned: 0 }; }

/** 뒤에서 실행 시작. 이미 돌고 있으면 그대로 둡니다 */
export function startDesignHistory(monthsBack = 16): DesignJob {
  const cur = designJobStatus();
  if (cur.running) return cur;
  const job: DesignJob = { running: true, startedAt: new Date().toISOString(), total: 0, done: 0, found: 0, scanned: 0, monthsBack };
  g.__designJob = job;
  syncDesignHistory(monthsBack, 3, job).then((r) => { job.added = r.added; }).catch((e) => { job.error = e instanceof Error ? e.message : String(e); }).finally(() => { job.running = false; job.finishedAt = new Date().toISOString(); });
  return job;
}

export async function syncDesignHistory(monthsBack = 16, monthsMin = 3, job?: DesignJob): Promise<BidsFile & { added: number; scanned: number }> {
  if (!hasApiKey()) throw new Error("공공데이터포털 인증키(DATA_GO_KR_KEY)가 설정되지 않았습니다.");
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsMin + 1, 0, 23, 59);
  const windows: [Date, Date][] = [];
  for (let cur = start; cur < end; ) { const wEnd = new Date(Math.min(cur.getTime() + 31 * 86400_000 - 60_000, end.getTime())); windows.push([cur, wEnd]); cur = new Date(wEnd.getTime() + 60_000); }
  if (job) job.total = windows.length;
  const found: BidsFile["items"] = []; const errors: string[] = []; let scanned = 0;
  for (const [ws, we] of windows) {
    if (job) job.current = `${ws.toISOString().slice(0, 10)} ~ ${we.toISOString().slice(0, 10)}`;
    try { const r = await fetchKind("용역", ws, we, undefined, { keyword: "설계" }); scanned += r.scanned; found.push(...r.notices.filter(isDesignService)); }
    catch (e) { errors.push(`${ws.toISOString().slice(0, 10)}: ${e instanceof Error ? e.message : String(e)}`); if (errors.length >= 3) break; }
    if (job) { job.done++; job.found = found.length; job.scanned = scanned; }
  }
  const store = getStore();
  const prev = await store.get<BidsFile>(COLLECTION);
  const base = prev?.data && Array.isArray(prev.data.items) ? prev.data.items : [];
  const map = new Map(base.map((n) => [n.id, n]));
  let added = 0;
  for (const n of found) { if (!map.has(n.id)) added++; map.set(n.id, n); }
  const items = prune([...map.values()]).sort((a, b) => b.noticeAt.localeCompare(a.noticeAt));
  const file: BidsFile = { ...(prev?.data ?? { items: [] }), items, source: "api", error: errors.length ? errors.join(" / ") : prev?.data?.error };
  await store.set(COLLECTION, file);
  invalidateBids();
  if (errors.length && found.length === 0) throw new Error(errors.join(" / "));
  return { ...file, added, scanned };
}
