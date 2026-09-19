// 나라장터(조달청) 「입찰공고정보서비스」에서 공고를 가져옵니다.
// 공공데이터포털(data.go.kr)에서 발급받은 인증키를 DATA_GO_KR_KEY 환경변수에 넣어야 동작합니다.
import { isRelated, keywordsOf, methodOf, regionOf } from "./classify";
import type { BidKind, BidNotice } from "./types";

const BASE = process.env.G2B_API_BASE ?? "https://apis.data.go.kr/1230000/ad/BidPublicInfoService";
const OPS: Record<BidKind, string> = { 공사: "getBidPblancListInfoCnstwk", 물품: "getBidPblancListInfoThng", 용역: "getBidPblancListInfoServc" };

/** 나라장터 응답 한 줄 (필요한 항목만) */
interface RawItem {
  bidNtceNo?: string; bidNtceOrd?: string; bidNtceNm?: string;
  ntceInsttNm?: string; dminsttNm?: string;
  bidNtceDt?: string; bidClseDt?: string; opengDt?: string;
  presmptPrce?: string | number; asignBdgtAmt?: string | number; bdgtAmt?: string | number;
  bidMethdNm?: string; cntrctCnclsMthdNm?: string; sucsfbidMthdNm?: string; ntceKindNm?: string;
  bidNtceDtlUrl?: string; bidNtceUrl?: string;
  prtcptLmtRgnNm?: string; rgnLmtYn?: string; rgnLmtBidLocplcJdgmBssNm?: string;
  cnstrtsiteRgnNm?: string; // 공사현장 지역 (예: "전라남도 나주시")
  ntceInsttOfclNm?: string; ntceInsttOfclTelNo?: string; ntceInsttOfclEmailAdrs?: string; // 공고기관 담당자
  orderPlanUntyNo?: string; // 발주계획 통합번호
}

export function hasApiKey() { return Boolean(process.env.DATA_GO_KR_KEY?.trim()); }
/** 키가 URL 인코딩된(Encoding) 키처럼 보이면 안내 */
export function keyLooksEncoded(key = process.env.DATA_GO_KR_KEY ?? "") { return /%2B|%3D|%2F/i.test(key); }
/** Encoding 키를 넣었으면 원래 값(Decoding)으로 되돌립니다. 그래야 주소에 넣을 때 한 번만 암호화됩니다 */
export function normalizeKey(key = process.env.DATA_GO_KR_KEY ?? "") {
  const k = key.trim().replace(/^["']|["']$/g, "");
  if (!keyLooksEncoded(k)) return k;
  try { return decodeURIComponent(k); } catch { return k; }
}
const HEADERS = { Accept: "application/json, text/xml;q=0.9, */*;q=0.8", "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 HyundamCE/1.0" };
const snippet = (t: string) => t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);

function stamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
}
const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^0-9.-]/g, "")); return Number.isFinite(n) && n > 0 ? n : undefined; };
const dt = (v?: string) => (v ? v.replace("T", " ").slice(0, 16) : undefined);

/** 응답 한 줄을 우리 모양으로. 우리 지역 공고가 아니면 null */
export function toNotice(kind: BidKind, r: RawItem): BidNotice | null {
  const demand = (r.dminsttNm ?? "").trim();
  const agency = (r.ntceInsttNm ?? "").trim();
  const site = (r.cnstrtsiteRgnNm ?? "").trim();
  const limit = (r.rgnLmtBidLocplcJdgmBssNm || r.prtcptLmtRgnNm || "").trim() || undefined;
  const region = regionOf(demand, agency, limit, site);
  if (!region) return null;
  const title = (r.bidNtceNm ?? "").trim();
  const keywords = keywordsOf(title);
  const no = String(r.bidNtceNo ?? "").trim();
  const ord = String(r.bidNtceOrd ?? "00").trim();
  return {
    id: `${no}-${ord}`, kind, no, ord, title, agency, demand, region,
    noticeAt: dt(r.bidNtceDt) ?? "", closeAt: dt(r.bidClseDt), openAt: dt(r.opengDt),
    budget: num(r.bdgtAmt) ?? num(r.asignBdgtAmt), estimate: num(r.presmptPrce),
    planNo: (r.orderPlanUntyNo ?? "").trim() || undefined, site: site || undefined, contact: (r.ntceInsttOfclNm ?? "").trim() || undefined, contactPhone: (r.ntceInsttOfclTelNo ?? "").trim() || undefined, contactEmail: (r.ntceInsttOfclEmailAdrs ?? "").trim() || undefined,
    method: methodOf(r.cntrctCnclsMthdNm), methodRaw: r.cntrctCnclsMthdNm, bidMethod: r.bidMethdNm, award: r.sucsfbidMthdNm, noticeKind: r.ntceKindNm,
    regionLimit: limit, url: r.bidNtceDtlUrl || r.bidNtceUrl || undefined,
    related: isRelated(keywords, title, kind), keywords,
  };
}

function itemsOf(json: unknown): RawItem[] {
  const body = (json as { response?: { body?: { items?: unknown; totalCount?: unknown } } })?.response?.body;
  const items = body?.items;
  if (Array.isArray(items)) return items as RawItem[];
  if (items && typeof items === "object" && Array.isArray((items as { item?: unknown }).item)) return (items as { item: RawItem[] }).item;
  return [];
}
function totalOf(json: unknown): number {
  const body = (json as { response?: { body?: { totalCount?: unknown } } })?.response?.body;
  return Number(body?.totalCount ?? 0) || 0;
}
function headerError(json: unknown): string | undefined {
  const h = (json as { response?: { header?: { resultCode?: string; resultMsg?: string } } })?.response?.header;
  if (h && h.resultCode && h.resultCode !== "00") return `${h.resultCode} ${h.resultMsg ?? ""}`.trim();
  // 공공데이터포털 게이트웨이 오류가 JSON 으로 오는 경우: { OpenAPI_ServiceResponse: { cmmMsgHeader: { errMsg, returnAuthMsg, returnReasonCode } } }
  const g = (json as { OpenAPI_ServiceResponse?: { cmmMsgHeader?: { errMsg?: string; returnAuthMsg?: string; returnReasonCode?: string } } })?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (g && (g.errMsg || g.returnAuthMsg)) return `${g.returnReasonCode ?? ""} ${g.errMsg ?? ""} ${g.returnAuthMsg ?? ""}`.trim();
  // 공공데이터포털 공통 오류 (인증키 오류 등)은 XML로 옵니다
  const s = typeof json === "string" ? json : "";
  const m = s.match(/<returnAuthMsg>([^<]+)<\/returnAuthMsg>|<errMsg>([^<]+)<\/errMsg>/);
  return m ? (m[1] ?? m[2]) : undefined;
}

/** 한 종류(공사/물품/용역)의 공고를 기간 안에서 모두 가져와 우리 지역 것만 돌려줍니다 */
export async function fetchKind(kind: BidKind, from: Date, to: Date, rawKey = process.env.DATA_GO_KR_KEY ?? "", opts: { keyword?: string } = {}): Promise<{ notices: BidNotice[]; scanned: number }> {
  const key = normalizeKey(rawKey);
  const out: BidNotice[] = [];
  let scanned = 0;
  const rows = 999;
  for (let page = 1; page <= 40; page++) {
    const qs = new URLSearchParams({ pageNo: String(page), numOfRows: String(rows), type: "json", inqryDiv: "1", inqryBgnDt: stamp(from), inqryEndDt: stamp(to) });
    if (opts.keyword) qs.set("bidNtceNm", opts.keyword); // 공고명 검색 (지원 안 되면 무시되고 전체가 옵니다)
    const url = `${BASE}/${OPS[kind]}?ServiceKey=${encodeURIComponent(key.trim())}&${qs}`;
    const res = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(60_000) });
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text; }
    const err = headerError(json);
    if (err) throw new Error(`나라장터 응답 오류: ${err}`);
    if (!res.ok) throw new Error(`나라장터 연결 실패 (${res.status}) ${snippet(text) || "(내용 없음)"}`);
    const items = itemsOf(json);
    scanned += items.length;
    for (const r of items) { const n = toNotice(kind, r); if (n) out.push(n); }
    if (items.length < rows || scanned >= totalOf(json)) break;
  }
  return { notices: out, scanned };
}

/** 연결 확인: 공사 공고 1건만 요청해 상태코드와 답장 내용을 돌려줍니다 */
export async function probe(rawKey = process.env.DATA_GO_KR_KEY ?? "") {
  const key = normalizeKey(rawKey);
  const to = new Date(); const from = new Date(to.getTime() - 86400_000);
  const qs = new URLSearchParams({ pageNo: "1", numOfRows: "1", type: "json", inqryDiv: "1", inqryBgnDt: stamp(from), inqryEndDt: stamp(to) });
  const url = `${BASE}/${OPS.공사}?ServiceKey=${encodeURIComponent(key.trim())}&${qs}`;
  try {
    const res = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    let json: unknown; try { json = JSON.parse(text); } catch { json = text; }
    return { ok: res.ok && !headerError(json), status: res.status, body: snippet(text), headerError: headerError(json), total: res.ok ? totalOf(json) : undefined, url: url.replace(/ServiceKey=[^&]*/, "ServiceKey=(숨김)"), keyLength: key.length, keyLooksEncoded: false };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : String(e), url: url.replace(/ServiceKey=[^&]*/, "ServiceKey=(숨김)"), keyLength: key.length, keyLooksEncoded: false };
  }
}

/** 세 종류 모두 가져오기. 기간은 최대 31일(나라장터 제한) */
export async function fetchAll(from: Date, to: Date) {
  const result: { notices: BidNotice[]; scanned: number; errors: string[] } = { notices: [], scanned: 0, errors: [] };
  for (const kind of ["공사", "물품", "용역"] as BidKind[]) {
    try { const r = await fetchKind(kind, from, to); result.notices.push(...r.notices); result.scanned += r.scanned; }
    catch (e) { result.errors.push(`${kind}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  return result;
}
