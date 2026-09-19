// 나라장터 종합쇼핑몰 「납품요구」: 어느 기관이 어느 업체에서 무엇을 얼마에 샀는지.
// 조달데이터허브 「나라장터쇼핑몰 납품요구 물품 내역」(UI-ADOXAA-038R) 파일을 읽어 정리합니다.
// 실제 파일 모양: UTF-16 LE, 탭 구분, 값은 큰따옴표, 위에 「검색조건 프롬프트」 설명 줄이 여럿, 그 다음 제목 줄.
import { keywordsOf, regionOf } from "./classify";
import { isOurItem, type DeliveryRules } from "./deliveryRules";
import { profileByKey, type RegionProfile } from "./regions";

export interface Delivery {
  id: string; // 납품요구번호-물품순번 (변경 차수는 최신 것만 남김)
  reqNo?: string; // 납품요구번호
  ord?: string; // 납품요구변경차수
  seq?: string; // 물품순번
  reqName?: string; // 납품요구명 (현장·사업 이름이 들어 있음)
  date: string; // 납품요구일자 YYYY-MM-DD
  dueDate?: string; // 납품기한
  agency: string; // 수요기관
  agencyRegion?: string; // 수요기관 소재 시군구 (원문)
  region: string; // 우리 기준 지역 묶음
  company: string; // 납품 업체 (경쟁사 또는 우리 회사)
  item: string; // 품명 (예: 레미콘, 원심력철근콘크리트관)
  detail?: string; // 세부품명
  spec?: string; // 품목명 (규격까지 적힌 긴 이름)
  unit?: string;
  qty?: number; // 납품수량
  unitPrice?: number; // 납품단가
  amount?: number; // 납품금액
  contractNo?: string;
  method?: string; // 구매방법·계약구분 (제3자단가계약 등)
  flags?: string; // 우수제품·MAS 등
  final?: boolean; // 최종납품요구여부
  related: boolean;
  keywords?: string[]; // 저장하지 않고 필요할 때 다시 계산
}

/** 저장용으로 가볍게: 긴 글은 자르고 계산 가능한 항목은 뺍니다 */
export function slimDelivery(d: Delivery): Delivery {
  const { keywords: _k, ...rest } = d; void _k;
  return { ...rest, reqName: rest.reqName?.slice(0, 80), spec: rest.spec?.slice(0, 120), agencyRegion: rest.agencyRegion?.slice(0, 40), flags: rest.flags?.slice(0, 20) };
}

export interface DeliveriesFile { items: Delivery[]; updatedAt?: string; files?: { name: string; at: string; rows: number; added: number }[] }

/** 바이트 → 글자. UTF-16(BOM) → UTF-8 → EUC-KR 순서로 알아봅니다 */
export function decodeText(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes).replace(/^﻿/, "");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes).replace(/^﻿/, "");
  // BOM 없는 UTF-16LE: 짝수 자리가 0 인 바이트가 많으면
  if (bytes.length >= 64) { let zeros = 0; for (let i = 1; i < 64; i += 2) if (bytes[i] === 0) zeros++; if (zeros >= 24) return new TextDecoder("utf-16le").decode(bytes); }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, ""); }
  catch { return new TextDecoder("euc-kr").decode(bytes); }
}

/** 구분자 알아내기: 따옴표 밖에서 가장 많이 쓰인 것 (탭·쉼표·세미콜론·세로줄) */
export function detectDelimiter(text: string): string {
  const head = text.slice(0, 50000);
  const count: Record<string, number> = { "\t": 0, ",": 0, ";": 0, "|": 0 };
  let q = false;
  for (const c of head) { if (c === '"') q = !q; else if (!q && c in count) count[c]++; }
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
}

/** CSV 를 한 줄씩 읽어 cb 에 넘깁니다 (따옴표 안의 구분자·줄바꿈 처리). cb 가 false 를 돌려주면 멈춥니다 */
export function forEachCsvRow(text: string, cb: (row: string[], rowIndex: number) => void | boolean, delimiter = detectDelimiter(text)): void {
  let row: string[] = []; let cell = ""; let q = false; let n = 0;
  const flush = () => { row.push(cell); cell = ""; const r = row; row = []; if (r.some((v) => v.trim() !== "")) { const keep = cb(r, n++); return keep !== false; } return true; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === delimiter) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; if (!flush()) return; }
    else cell += c;
  }
  if (cell !== "" || row.length) flush();
}
/** 전체를 배열로 (작은 파일·시험용) */
export function parseCsv(text: string, delimiter?: string): string[][] { const rows: string[][] = []; forEachCsvRow(text, (r) => { rows.push(r); }, delimiter); return rows; }

/** 제목 칸 이름이 조금씩 달라 「이런 글자가 들어간 칸」으로 찾습니다. 앞 규칙이 우선 */
const COLS: Record<string, RegExp[]> = {
  reqNo: [/^납품요구번호$/, /납품요구번호/],
  ord: [/^납품요구변경차수$/, /납품요구변경차수/, /^변경차수$/],
  seq: [/^물품순번$/, /순번/],
  reqName: [/^납품요구명$/, /납품요구명|납품요구건명|건명/],
  date: [/^납품요구일자$/, /납품요구일/, /요구일자/, /계약일자/, /^일자$/],
  dueDate: [/납품기한/],
  agency: [/^수요기관명$/, /^수요기관$/, /수요기관명/, /수요기관(?!지역|코드|구분|소재)/],
  agencyRegion: [/수요기관소재시군구/, /수요기관소재/, /수요기관지역/, /지역명/, /^지역$/],
  company: [/^업체명$/, /계약업체명|공급업체명|납품업체명/, /업체명/, /업체(?!사업자|번호|코드|소재)/],
  item: [/^품명$/, /^물품명$/, /품명(?!번호|코드)/],
  detail: [/^세부품명$/, /세부품명(?!번호)/],
  spec: [/^품목명$/, /품목명/, /규격|모델명|사양/],
  unit: [/^단위$/, /단위(?!가)/],
  qty: [/^납품수량$/, /^수량$/, /(?<!증감)수량/],
  unitPrice: [/^납품단가$/, /^단가$/, /단가/],
  amount: [/^납품금액$/, /납품요구금액|납품요구총액/, /^금액$/, /(?<!증감)금액/],
  contractNo: [/^계약번호$/, /계약번호/],
  method: [/^구매방법$/, /구매방법|계약구분|계약방법/],
  flags: [/우수제품여부|MAS여부|다수공급자/],
  final: [/최종납품요구여부/],
};
export function mapHeader(header: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  const clean = header.map((h) => h.replace(/\s+/g, "").replace(/[()（）]/g, ""));
  for (const [key, pats] of Object.entries(COLS)) {
    for (const p of pats) { const i = clean.findIndex((h, j) => p.test(h) && !Object.values(idx).includes(j)); if (i >= 0) { idx[key] = i; break; } }
  }
  return idx;
}
const num = (v?: string) => { if (!v) return undefined; const n = Number(String(v).replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : undefined; };
const ymd = (v?: string) => { if (!v) return ""; const m = String(v).match(/(20\d{2})[^\d]?(\d{1,2})[^\d]?(\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : ""; };
/** 업체 이름 정리: (주)·주식회사·공백 제거해 같은 회사가 하나로 묶이게 */
export const normCompany = (s: string) => s.replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\s+/g, "").trim();
export const isHeaderRow = (r: string[]) => r.some((c) => /수요기관/.test(c)) && r.some((c) => /업체|품명|물품/.test(c));

export interface ParseResult { items: Delivery[]; rows: number; header?: string[]; missing: string[]; preview?: string }

/**
 * 파일 전체를 한 줄씩 읽어 우리 지역 것만 남깁니다. 큰 파일도 메모리를 적게 씁니다.
 * onProgress 를 주면 몇 줄마다 잠깐 쉬어 화면이 진행 상황을 그릴 수 있게 합니다 (브라우저용).
 */
export async function parseDeliveriesAsync(text: string, onProgress?: (rows: number, found: number) => void | Promise<void>, yieldEvery = 20000, rules: Partial<DeliveryRules> = {}, profile: RegionProfile = profileByKey(typeof process !== "undefined" ? process.env.BID_REGION : undefined)): Promise<ParseResult> {
  const delimiter = detectDelimiter(text);
  const byId = new Map<string, Delivery>();
  let header: string[] | undefined; let idx: Record<string, number> = {}; let hi = -1; let rows = 0;
  const preview: string[] = [];
  let missing: string[] = [];
  const get = (r: string[], k: string) => (idx[k] === undefined ? undefined : (r[idx[k]] ?? "").trim());
  // 동기 파서를 조각으로 돌리기 위해, 줄을 모았다가 처리
  const pending: string[][] = [];
  forEachCsvRow(text, (r, i) => { if (i < 3) preview.push(`${i + 1}째 줄: ${r.join(" | ").slice(0, 300)}`); pending.push(r); }, delimiter);
  for (let i = 0; i < pending.length; i++) {
    const r = pending[i];
    if (hi < 0) {
      if (isHeaderRow(r)) {
        hi = i; header = r; idx = mapHeader(r);
        missing = ["agency", "company", "item"].filter((k) => idx[k] === undefined).map((k) => ({ agency: "수요기관명", company: "업체명", item: "품명" })[k]!);
        if (missing.length) break;
      }
      continue;
    }
    rows++;
    const agency = get(r, "agency") ?? "";
    if (agency) {
      const agencyRegion = get(r, "agencyRegion");
      const site = agencyRegion && profile.area.test(agencyRegion) ? agencyRegion : undefined;
      const region = regionOf(agency, "", undefined, site, profile) ?? (site ? "기타" : undefined);
      if (region) {
        const item = get(r, "item") ?? ""; const detail = get(r, "detail") || undefined; const spec = get(r, "spec") || undefined;
        const keywords = keywordsOf(`${item} ${detail ?? ""} ${spec ?? ""}`);
        const reqNo = get(r, "reqNo") || undefined; const seq = get(r, "seq") || undefined; const ord = get(r, "ord") || undefined;
        const id = reqNo ? `${reqNo}-${seq ?? String(rows)}` : `row-${rows}`;
        const d: Delivery = {
          id, reqNo, ord, seq, reqName: get(r, "reqName") || undefined, date: ymd(get(r, "date")), dueDate: ymd(get(r, "dueDate")) || undefined,
          agency, agencyRegion: agencyRegion || undefined, region, company: (get(r, "company") ?? "").trim(), item, detail, spec,
          unit: get(r, "unit") || undefined, qty: num(get(r, "qty")), unitPrice: num(get(r, "unitPrice")), amount: num(get(r, "amount")),
          contractNo: get(r, "contractNo") || undefined, method: get(r, "method") || undefined, flags: get(r, "flags") || undefined,
          final: /^Y/i.test(get(r, "final") ?? "") || undefined,
          related: isOurItem(item, detail, rules), keywords,
        };
        // 같은 납품요구·물품순번의 변경 차수는 큰 차수(최신)만 남깁니다
        const prev = byId.get(id);
        if (!prev || (d.ord ?? "") >= (prev.ord ?? "")) byId.set(id, d);
      }
    }
    if (onProgress && rows % yieldEvery === 0) { await onProgress(rows, byId.size); await new Promise((res) => setTimeout(res, 0)); }
  }
  if (hi < 0) return { items: [], rows: pending.length, missing: ["제목 줄(수요기관명·업체명·품명)을 찾지 못했습니다"], preview: preview.join("\n") };
  if (missing.length) return { items: [], rows, header, missing, preview: preview.join("\n") };
  return { items: [...byId.values()], rows, header, missing: [] };
}
