// 나라장터 「발주계획」: 각 기관이 올해 무엇을 언제 발주할지 미리 올린 목록입니다.
// 공공데이터포털 「조달청_나라장터 발주계획정보서비스」 활용신청이 필요합니다 (인증키는 입찰공고와 같은 것).
import { isRelated, keywordsOf, regionOf } from "./classify";
import { normalizeKey } from "./g2b";
import type { BidKind } from "./types";

// 요청 주소 후보: 조달청 서비스는 /1230000/두글자/서비스명 꼴인데 두 글자가 서비스마다 달라 차례로 시험합니다.
// 확실한 주소를 알면 환경변수 G2B_PLAN_API_BASE 로 지정할 수 있습니다.
const BASE_CANDIDATES = process.env.G2B_PLAN_API_BASE
  ? [process.env.G2B_PLAN_API_BASE]
  : ["ao", "at", "ap", "ad", "as", "ac", "ab", "aa", ""].map((x) => `${process.env.G2B_API_HOST ?? "https://apis.data.go.kr"}/1230000/${x ? x + "/" : ""}OrderPlanSttusService`);
// 기능(오퍼레이션) 이름 후보: "…ListInfoThng" 형식과 "…ListThng" 형식
const OP_STYLES: Record<string, Record<BidKind, string>> = {
  info: { 공사: "getOrderPlanSttusListInfoCnstwk", 물품: "getOrderPlanSttusListInfoThng", 용역: "getOrderPlanSttusListInfoServc" },
  plain: { 공사: "getOrderPlanSttusListCnstwk", 물품: "getOrderPlanSttusListThng", 용역: "getOrderPlanSttusListServc" },
  info01: { 공사: "getOrderPlanSttusListInfoCnstwk01", 물품: "getOrderPlanSttusListInfoThng01", 용역: "getOrderPlanSttusListInfoServc01" },
};
export interface PlanEndpoint { base: string; opStyle: string }
const DEFAULT_ENDPOINT: PlanEndpoint = { base: BASE_CANDIDATES[0], opStyle: "info" };
const opOf = (ep: PlanEndpoint, kind: BidKind) => (OP_STYLES[ep.opStyle] ?? OP_STYLES.info)[kind];
const HEADERS = { Accept: "application/json, text/xml;q=0.9, */*;q=0.8", "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 HyundamCE/1.0" };

export interface OrderPlan {
  id: string; // 발주계획 통합번호
  kind: BidKind;
  title: string; // 사업명
  agency: string; // 발주기관
  region: string;
  month?: string; // 발주 예정 시기 YYYY-MM
  budget?: number;
  registeredAt?: string; // 등록일 YYYY-MM-DD
  method?: string; // 계약방법(있으면)
  related: boolean;
  keywords: string[];
  raw?: Record<string, string>; // 항목 이름 확인용 (처음 몇 건만)
}

export interface PlansFile { items: OrderPlan[]; variant?: PlanVariant; endpoint?: PlanEndpoint; fetchedAt?: string; fetchedFrom?: string; fetchedTo?: string; error?: string; scanned?: number; sampleRaw?: Record<string, string> | null }

type Raw = Record<string, unknown>;
const str = (r: Raw, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim(); } return undefined; };
const num = (v?: string) => { if (!v) return undefined; const n = Number(v.replace(/[^0-9.-]/g, "")); return Number.isFinite(n) && n > 0 ? n : undefined; };
/** "202603", "2026-03", "2026년 3월", "2026-03-15 00:00" 등을 YYYY-MM 으로 */
function monthOf(v?: string) {
  if (!v) return undefined;
  const m = v.match(/(20\d{2})[^\d]?(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}` : undefined;
}
function stamp(d: Date) { const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`; }
const ym = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;

/**
 * 검색 조건 형식. 조달청 서비스마다 조금씩 달라 네 가지를 차례로 시험해 되는 것을 씁니다.
 * - dt1/dt2: 등록일시 범위 (YYYYMMDDHHMM), inqryDiv 1 또는 2
 * - ym1/ym2: 발주 예정 년월 범위 (YYYYMM), inqryDiv 1 또는 2
 */
export type PlanVariant = "dt1" | "dt2" | "ym1" | "ym2";
export const PLAN_VARIANTS: PlanVariant[] = ["dt1", "dt2", "ym1", "ym2"];
export function variantParams(v: PlanVariant, from: Date, to: Date): Record<string, string> {
  const div = v.endsWith("1") ? "1" : "2";
  return v.startsWith("dt") ? { inqryDiv: div, inqryBgnDt: stamp(from), inqryEndDt: stamp(to) } : { inqryDiv: div, inqryBgnDt: ym(from), inqryEndDt: ym(to) };
}
export const isMonthVariant = (v: PlanVariant) => v.startsWith("ym");

/** 응답 한 줄 → 발주계획. 항목 이름이 문서마다 달라 여러 이름을 함께 봅니다. 우리 지역이 아니면 null */
export function toPlan(kind: BidKind, r: Raw, keepRaw = false): OrderPlan | null {
  const agency = str(r, "orderInsttNm", "dminsttNm", "ntceInsttNm", "insttNm", "rlDminsttNm") ?? "";
  const title = str(r, "bizNm", "ordrPlanNm", "orderPlanNm", "bidNtceNm", "prdctNm", "cntrctNm", "bsnsNm") ?? "";
  const region = regionOf(agency, "", str(r, "rgnNm", "cnstrtsiteRgnNm"), str(r, "cnstrtsiteRgnNm"));
  if (!region) return null;
  const id = str(r, "orderPlanUntyNo", "ordrPlanUntyNo", "orderPlanNo", "untyNo", "ordrPlanNo") ?? `${kind}-${agency}-${title}`.replace(/\s+/g, "");
  const keywords = keywordsOf(title);
  return {
    id, kind, title, agency, region,
    month: monthOf(str(r, "orderPrearngeMnth", "ordrPrearngeMnth", "orderPlanPrearngeMnth", "prearngeMnth", "orderPlanDate", "orderPrearngeDate", "ordrPlanDt")),
    budget: num(str(r, "budgetAmt", "bdgtAmt", "asignBdgtAmt", "sumOrderAmt", "orderAmt", "prearngeAmt")),
    registeredAt: (str(r, "rgstDt", "orderPlanRgstDt", "ordrPlanRgstDt", "regDt") ?? "").slice(0, 10) || undefined,
    method: str(r, "cntrctMthdNm", "cntrctCnclsMthdNm", "orderMthdNm"),
    related: isRelated(keywords, title, kind), keywords,
    raw: keepRaw ? Object.fromEntries(Object.entries(r).filter(([, v]) => v !== "" && v !== null).slice(0, 40).map(([k, v]) => [k, String(v)])) : undefined,
  };
}

function parse(text: string): { json: unknown; items: Raw[]; total: number; error?: string } {
  let json: unknown; try { json = JSON.parse(text); } catch { json = text; }
  const h = (json as { response?: { header?: { resultCode?: string; resultMsg?: string } } })?.response?.header;
  const g = (json as { OpenAPI_ServiceResponse?: { cmmMsgHeader?: { errMsg?: string; returnAuthMsg?: string; returnReasonCode?: string } } })?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  let error: string | undefined;
  if (h && h.resultCode && h.resultCode !== "00") error = `${h.resultCode} ${h.resultMsg ?? ""}`.trim();
  else if (g && (g.errMsg || g.returnAuthMsg)) error = `${g.returnReasonCode ?? ""} ${g.errMsg ?? ""} ${g.returnAuthMsg ?? ""}`.trim();
  else if (typeof json === "string") { const m = json.match(/<returnAuthMsg>([^<]+)<\/returnAuthMsg>|<errMsg>([^<]+)<\/errMsg>/); if (m) error = m[1] ?? m[2]; }
  const body = (json as { response?: { body?: { items?: unknown; totalCount?: unknown } } })?.response?.body;
  const it = body?.items;
  const items = Array.isArray(it) ? (it as Raw[]) : it && typeof it === "object" && Array.isArray((it as { item?: unknown }).item) ? (it as { item: Raw[] }).item : [];
  return { json, items, total: Number(body?.totalCount ?? 0) || 0, error };
}

/** 한 종류의 발주계획을 기간(등록일 기준) 안에서 모두 가져와 우리 지역 것만 */
export async function fetchPlanKind(kind: BidKind, from: Date, to: Date, variant: PlanVariant = "dt1", endpoint: PlanEndpoint = DEFAULT_ENDPOINT, rawKey = process.env.DATA_GO_KR_KEY ?? "") {
  const key = normalizeKey(rawKey);
  const out: OrderPlan[] = []; let scanned = 0; const rows = 999; let firstRaw: Raw | null = null;
  for (let page = 1; page <= 40; page++) {
    const qs = new URLSearchParams({ pageNo: String(page), numOfRows: String(rows), type: "json", ...variantParams(variant, from, to) });
    const res = await fetch(`${endpoint.base}/${opOf(endpoint, kind)}?ServiceKey=${encodeURIComponent(key)}&${qs}`, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(60_000) });
    const text = await res.text();
    const p = parse(text);
    if (p.error) throw new Error(`발주계획 응답 오류: ${p.error}`);
    if (!res.ok) throw new Error(`발주계획 연결 실패 (${res.status}) ${text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)}`);
    scanned += p.items.length;
    if (!firstRaw && p.items[0]) firstRaw = p.items[0];
    for (const r of p.items) { const n = toPlan(kind, r, out.length < 3); if (n) out.push(n); }
    if (p.items.length < rows || scanned >= p.total) break;
  }
  return { plans: out, scanned, firstRaw };
}

export async function fetchPlansAll(from: Date, to: Date, variant: PlanVariant = "dt1", endpoint: PlanEndpoint = DEFAULT_ENDPOINT) {
  const result: { plans: OrderPlan[]; scanned: number; errors: string[]; firstRaw: Raw | null } = { plans: [], scanned: 0, errors: [], firstRaw: null };
  for (const kind of ["물품", "공사", "용역"] as BidKind[]) {
    try { const r = await fetchPlanKind(kind, from, to, variant, endpoint); result.plans.push(...r.plans); result.scanned += r.scanned; if (!result.firstRaw) result.firstRaw = r.firstRaw; }
    catch (e) { result.errors.push(`${kind}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  return result;
}

export interface PlanProbe { ok: boolean; status: number; variant?: PlanVariant; endpoint?: PlanEndpoint; headerError?: string; total?: number; sample?: Raw | null; body?: string; url?: string; tried: { variant: string; status: number; result: string; total?: number }[] }

/** 한 형식으로 물품 발주계획 1건 요청 */
async function tryVariant(v: PlanVariant, key: string, ep: PlanEndpoint) {
  const now = new Date();
  // 등록일 형식은 최근 31일, 년월 형식은 올해 1월 ~ 내년 12월
  const from = isMonthVariant(v) ? new Date(now.getFullYear(), 0, 1) : new Date(now.getTime() - 31 * 86400_000);
  const to = isMonthVariant(v) ? new Date(now.getFullYear() + 1, 11, 31) : now;
  const qs = new URLSearchParams({ pageNo: "1", numOfRows: "1", type: "json", ...variantParams(v, from, to) });
  const url = `${ep.base}/${opOf(ep, "물품")}?ServiceKey=${encodeURIComponent(key)}&${qs}`;
  const safeUrl = url.replace(/ServiceKey=[^&]*/, "ServiceKey=(숨김)");
  try {
    const res = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    const text = await res.text(); const p = parse(text);
    return { ok: res.ok && !p.error, status: res.status, headerError: p.error, total: p.total, sample: p.items[0] ?? null, body: text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300), url: safeUrl };
  } catch (e) { return { ok: false, status: 0, body: e instanceof Error ? e.message : String(e), url: safeUrl, total: 0, sample: null as Raw | null, headerError: undefined as string | undefined }; }
}

/**
 * 연결 확인 겸 형식 찾기: 네 가지 검색 형식을 차례로 시험해 자료가 오는 첫 형식을 돌려줍니다.
 * 키가 등록되지 않았거나 주소가 틀린 경우는 첫 시도에서 바로 멈춥니다.
 */
export async function probePlans(rawKey = process.env.DATA_GO_KR_KEY ?? "", known?: PlanEndpoint): Promise<PlanProbe> {
  const key = normalizeKey(rawKey);
  const tried: PlanProbe["tried"] = [];
  const noService = (e?: string) => Boolean(e && /NO_OPENAPI|없거나 폐기/.test(e));
  // 1) 요청 주소·기능 이름 찾기: 「서비스가 없음」이 아닌 첫 조합
  let endpoint: PlanEndpoint | undefined = known;
  let last: Awaited<ReturnType<typeof tryVariant>> | null = null;
  if (!endpoint) {
    outer: for (const base of BASE_CANDIDATES) {
      for (const opStyle of Object.keys(OP_STYLES)) {
        const ep = { base, opStyle };
        const r = await tryVariant("dt1", key, ep); last = r;
        const short = `${base.replace("https://apis.data.go.kr", "")}/${opOf(ep, "물품")}`;
        if (noService(r.headerError)) { tried.push({ variant: short, status: r.status, result: "서비스 없음" }); continue; }
        tried.push({ variant: short, status: r.status, result: r.ok ? "주소 맞음" : (r.headerError ?? r.body ?? "").slice(0, 80) });
        endpoint = ep;
        if (r.headerError && /NOT_REGISTERED|등록되지 않은|LIMITED|EXCEED/i.test(r.headerError)) return { ok: false, status: r.status, endpoint, headerError: r.headerError, body: r.body, url: r.url, tried };
        break outer;
      }
    }
    if (!endpoint) return { ok: false, status: last?.status ?? 0, headerError: last?.headerError, body: last?.body, url: last?.url, tried };
  }
  // 2) 검색 조건 형식 찾기
  for (const v of PLAN_VARIANTS) {
    const r = await tryVariant(v, key, endpoint); last = r;
    tried.push({ variant: v, status: r.status, result: r.ok ? (r.total ? `성공 (${r.total}건)` : "성공이지만 0건") : (r.headerError ?? r.body ?? "").slice(0, 120), total: r.total });
    if (r.ok && (r.total ?? 0) > 0) return { ok: true, status: r.status, variant: v, endpoint, total: r.total, sample: r.sample, url: r.url, tried };
    if (r.headerError && /NOT_REGISTERED|등록되지 않은|NO_OPENAPI|없거나 폐기|LIMITED|EXCEED/i.test(r.headerError)) break;
  }
  // 성공했지만 0건인 형식이 있으면 그것이라도 씁니다
  const zero = tried.find((t) => t.result.startsWith("성공"));
  return { ok: Boolean(zero), status: last?.status ?? 0, variant: zero?.variant as PlanVariant | undefined, endpoint, headerError: last?.headerError, total: 0, sample: null, body: last?.body, url: last?.url, tried };
}
