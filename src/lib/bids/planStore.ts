// 발주계획을 data/orderPlans.json 에 보관합니다.
import { getStore } from "@/lib/store";
import { hasApiKey } from "./g2b";
import { isRelated, keywordsOf, regionOf } from "./classify";
import { fetchPlansAll, isMonthVariant, probePlans, type PlanEndpoint, type PlanVariant, type PlansFile } from "./plans";

const COLLECTION = "orderPlans";

export async function readPlans(): Promise<PlansFile> {
  const row = await getStore().get<PlansFile>(COLLECTION);
  const file = row?.data && Array.isArray(row.data.items) ? row.data : { items: [] };
  // 분류 규칙이 바뀌어도 새 규칙으로 보이도록 읽을 때 다시 분류
  const items = file.items.flatMap((p) => { const region = regionOf(p.agency, "", undefined, undefined); if (!region) return []; const keywords = keywordsOf(p.title); return [{ ...p, region, keywords, related: isRelated(keywords, p.title, p.kind) }]; });
  return { ...file, items };
}

/**
 * 기간(등록일 기준)을 31일씩 잘라 발주계획을 가져와 합칩니다. 같은 번호는 새 것으로 바꿉니다.
 * 기본은 올해 1월 1일부터 오늘까지 (지자체가 연초에 올리는 계획을 모두 받기 위해)
 */
export async function syncPlans(fromYmd?: string, toYmd?: string): Promise<PlansFile> {
  if (!hasApiKey()) throw new Error("공공데이터포털 인증키(DATA_GO_KR_KEY)가 설정되지 않았습니다.");
  const store = getStore();
  const prev = await readPlans();
  // 검색 형식: 예전에 찾아 둔 것이 있으면 그대로, 없으면 지금 찾습니다
  let variant: PlanVariant | undefined = prev.variant;
  let endpoint: PlanEndpoint | undefined = prev.endpoint;
  if (!variant || !endpoint) {
    const p = await probePlans(undefined, endpoint);
    if (!p.variant || !p.endpoint) throw new Error(p.headerError ? `발주계획 응답 오류: ${p.headerError}` : `발주계획 요청 주소·검색 형식을 찾지 못했습니다: ${p.tried.map((t) => `${t.variant}=${t.result}`).join(", ")}`);
    variant = p.variant; endpoint = p.endpoint;
  }
  const now = new Date();
  const errors: string[] = []; const fetched = [] as PlansFile["items"];
  let scanned = 0; let sampleRaw: Record<string, string> | null = null;
  const take = (r: { scanned: number; firstRaw: Record<string, unknown> | null }) => { scanned += r.scanned; if (!sampleRaw && r.firstRaw) sampleRaw = Object.fromEntries(Object.entries(r.firstRaw).filter(([, v]) => v !== "" && v !== null).slice(0, 60).map(([k, v]) => [k, String(v)])); };
  let from: Date; let to: Date;
  if (isMonthVariant(variant)) {
    // 발주 예정 년월 기준: 올해 1월 ~ 내년 12월을 한 번에
    from = new Date(now.getFullYear(), 0, 1); to = new Date(now.getFullYear() + 1, 11, 31);
    const r = await fetchPlansAll(from, to, variant, endpoint); fetched.push(...r.plans); errors.push(...r.errors); take(r);
  } else {
    // 등록일 기준: 31일씩 잘라서
    to = toYmd ? new Date(`${toYmd}T23:59:00`) : now;
    from = fromYmd ? new Date(`${fromYmd}T00:00:00`) : new Date(to.getFullYear(), 0, 1);
    let cur = from;
    while (cur < to) {
      const end = new Date(Math.min(cur.getTime() + 31 * 86400_000 - 60_000, to.getTime()));
      const r = await fetchPlansAll(cur, end, variant, endpoint);
      fetched.push(...r.plans); take(r);
      if (r.errors.length) { errors.push(...r.errors); if (r.errors.length === 3) break; }
      cur = new Date(end.getTime() + 60_000);
    }
  }
  const map = new Map(prev.items.map((p) => [p.id, p]));
  for (const p of fetched) map.set(p.id, p);
  const items = [...map.values()].sort((a, b) => (a.month ?? "9999").localeCompare(b.month ?? "9999") || a.region.localeCompare(b.region));
  const allFailed = errors.length > 0 && fetched.length === 0;
  const file: PlansFile = { items, variant, endpoint, scanned, sampleRaw, fetchedAt: allFailed ? prev.fetchedAt : new Date().toISOString(), fetchedFrom: from.toISOString().slice(0, 10), fetchedTo: to.toISOString().slice(0, 10), error: errors.length ? [...new Set(errors)].join(" / ") : undefined };
  await store.set(COLLECTION, file);
  if (allFailed) throw new Error(file.error);
  return file;
}
