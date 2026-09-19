// 납품요구 자료를 서버에서 집계해 화면에 필요한 만큼만 돌려줍니다 (전체를 브라우저로 보내지 않음)
import { regionOrderOf, serverProfile } from "./regions";
import { normCompany, type Delivery } from "./deliveries";

export interface Filters { year?: string; related?: boolean; region?: string; company?: string; q?: string }
export interface TopCompany { key: string; name: string; amount: number; count: number }
export interface AgencySummary { name: string; count: number; amount: number; top: TopCompany[]; items: string[] }
export interface RegionSummary { region: string; count: number; amount: number; top: TopCompany[]; agencies: AgencySummary[]; agencyCount: number }
export interface CompanySummary { key: string; name: string; amount: number; count: number; agencies: number; items: string[]; regions: string[] }
export interface ItemNameSummary { name: string; detail?: string; n: number; amount: number }
export interface Summary {
  unrelated: number; // 저장돼 있지만 우리 품목이 아닌 건수 (정리 안내용)
  total: number; count: number; mine: number; companies: number; agencies: number;
  years: string[]; byRegion: RegionSummary[]; byCompany: CompanySummary[]; itemNames: ItemNameSummary[];
}

const sum = (l: Delivery[]) => l.reduce((s, d) => s + (d.amount ?? 0), 0);

export function applyFilters(items: Delivery[], f: Filters): Delivery[] {
  const ql = (f.q ?? "").trim().toLowerCase();
  return items.filter((d) => (!f.related || d.related) && (!f.year || d.date.startsWith(f.year)) && (!f.region || d.region === f.region) && (!f.company || normCompany(d.company) === f.company) && (!ql || `${d.agency} ${d.company} ${d.item} ${d.spec ?? ""} ${d.reqName ?? ""}`.toLowerCase().includes(ql)));
}

function topCompanies(list: Delivery[], n: number): TopCompany[] {
  const m = new Map<string, TopCompany>();
  for (const d of list) { const key = normCompany(d.company); const e = m.get(key) ?? { key, name: d.company, amount: 0, count: 0 }; e.amount += d.amount ?? 0; e.count++; m.set(key, e); }
  return [...m.values()].sort((a, b) => b.amount - a.amount).slice(0, n);
}

/** 화면 첫 장에 필요한 집계. isMe: 우리 회사 판별 */
export function summarize(all: Delivery[], f: Filters, isMe: (company: string) => boolean): Summary {
  const years = [...new Set(all.map((d) => d.date.slice(0, 4)).filter(Boolean))].sort().reverse();
  const base = applyFilters(all, { year: f.year, related: f.related });
  const filtered = applyFilters(base, { region: f.region, company: f.company });
  // 지역별 (업체 필터만 적용, 지역 필터는 카드 클릭용이라 적용 안 함)
  const byRegionMap = new Map<string, Delivery[]>();
  for (const d of applyFilters(base, { company: f.company })) { const l = byRegionMap.get(d.region) ?? []; l.push(d); byRegionMap.set(d.region, l); }
  const byRegion: RegionSummary[] = regionOrderOf(serverProfile()).filter((r) => byRegionMap.has(r)).map((region) => {
    const list = byRegionMap.get(region)!;
    const ag = new Map<string, Delivery[]>(); for (const d of list) { const l = ag.get(d.agency) ?? []; l.push(d); ag.set(d.agency, l); }
    const agencies = [...ag.entries()].map(([name, l]) => ({ name, count: l.length, amount: sum(l), top: topCompanies(l, 3), items: [...new Set(l.map((d) => d.item))].slice(0, 5) })).sort((a, b) => b.amount - a.amount).slice(0, 6);
    return { region, count: list.length, amount: sum(list), top: topCompanies(list, 5), agencies, agencyCount: ag.size };
  });
  // 업체별
  const cm = new Map<string, { name: string; list: Delivery[] }>();
  for (const d of filtered) { const key = normCompany(d.company); const e = cm.get(key) ?? { name: d.company, list: [] }; e.list.push(d); cm.set(key, e); }
  const byCompany: CompanySummary[] = [...cm.entries()].map(([key, e]) => ({ key, name: e.name, amount: sum(e.list), count: e.list.length, agencies: new Set(e.list.map((d) => d.agency)).size, items: [...new Set(e.list.map((d) => d.item))].slice(0, 4), regions: [...new Set(e.list.map((d) => d.region))].slice(0, 4) })).sort((a, b) => b.amount - a.amount).slice(0, 300);
  // 품명별 (규칙 편집용: 필터와 상관없이 전체)
  const im = new Map<string, ItemNameSummary>();
  for (const d of all) { const e = im.get(d.item) ?? { name: d.item, detail: d.detail, n: 0, amount: 0 }; e.n++; e.amount += d.amount ?? 0; im.set(d.item, e); }
  const itemNames = [...im.values()].sort((a, b) => b.amount - a.amount).slice(0, 500);
  return { unrelated: all.filter((d) => !d.related).length, total: sum(base), count: base.length, mine: sum(base.filter((d) => isMe(d.company))), companies: byCompany.length, agencies: new Set(base.map((d) => d.agency)).size, years, byRegion, byCompany, itemNames };
}

export function listItems(all: Delivery[], f: Filters, page = 1, size = 200) {
  const filtered = applyFilters(all, f);
  const start = Math.max(0, (page - 1) * size);
  return { items: filtered.slice(start, start + size), total: filtered.length, amount: sum(filtered), page, size };
}

/** 리드 만들기용: 한 기관의 납품 요약 */
export function agencyDigest(all: Delivery[], agency: string, f: Filters) {
  const list = applyFilters(all, { year: f.year, related: f.related }).filter((d) => d.agency === agency);
  return { name: agency, count: list.length, amount: sum(list), top: topCompanies(list, 3), items: [...new Set(list.map((d) => d.item))].slice(0, 5) };
}
