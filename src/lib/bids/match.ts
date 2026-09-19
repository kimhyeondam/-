// 설계용역 공고(사업명)와 납품요구(납품요구명)를 이름으로 맞춰 봅니다.
// 예: 「○○지구 배수로 정비사업 실시설계 용역」 ↔ 「○○지구 배수로 정비사업 관급자재(흄관) 구입」
import type { BidNotice } from "./types";
import type { Delivery } from "./deliveries";

const STOP = new Set(["및", "등", "외", "사업", "공사", "용역", "설계", "실시설계", "기본설계", "정비", "개선", "조성", "설치", "건립", "구축", "개량", "확장", "보수", "관급자재", "관급", "자재", "구입", "구매", "제조", "납품", "년도", "긴급", "재공고", "변경", "제안공모", "공모", "일반", "지방", "국가", "전남", "광주", "전라남도", "통합특별시"]);

/** 이름을 비교용 낱말 묶음으로: 괄호·기호·설계/용역 같은 말은 빼고, 2글자 이상 낱말만 */
export function nameTokens(name: string): string[] {
  const cleaned = name
    .replace(/\([^)]*\)|\[[^\]]*\]|「[^」]*」/g, " ")
    .replace(/(기본\s*및\s*)?실시설계|기본설계|설계용역|타당성|용역|제안공모|공모|관급자재|자재|구입|구매|제조|납품요구|\d{4}년(도)?|\d+차|제\d+차/g, " ")
    .replace(/[^0-9A-Za-z가-힣\s]/g, " ");
  const out: string[] = [];
  for (const t of cleaned.split(/\s+/)) {
    const w = t.trim(); if (w.length < 2 || STOP.has(w)) continue;
    // 「○○지구배수로정비사업」처럼 붙어 있으면 접미사로 나눕니다
    const parts = w.split(/(?<=지구|마을|단지|공원|하천)(?=[가-힣])/).filter((p) => p.length >= 2 && !STOP.has(p));
    for (const p of parts.length ? parts : [w]) {
      out.push(p);
      // 「삼호읍」「능주면」처럼 행정 단위가 붙은 이름은 이름만 따로도 넣어 「삼호」와 맞게 합니다
      const m = p.match(/^([가-힣]{2,})(읍|면|동|리|지구|마을|단지)$/); if (m && !isGenericToken(m[1])) out.push(m[1]);
    }
  }
  return [...new Set(out)];
}

export interface Match { delivery: Delivery; score: number }

/**
 * 흔한 말: 어느 사업에나 들어가는 말이라 겹쳐도 같은 사업의 증거가 못 됩니다.
 * (정비사업·개선공사 같은 일 종류, 배수로·도로·하천 같은 시설 종류, 관내·일원 같은 범위 말)
 */
const GENERIC_EXACT = new Set(["정비사업", "개선사업", "개량사업", "보수사업", "확장사업", "확포장사업", "개설사업", "설치사업", "조성사업", "건립사업", "구축사업", "개발사업", "정비공사", "개선공사", "개량공사", "보수공사", "확장공사", "확포장공사", "개설공사", "설치공사", "조성공사", "건립공사", "구축공사", "유지보수", "시설개선", "환경개선", "시설정비", "안전개선", "위험도로", "노후", "노후화", "관내", "일원", "주변", "인근", "일대", "기타", "부대", "긴급", "재해", "재난", "복구", "예방", "안전", "교통", "환경", "시설", "정비", "개선", "개량", "보수", "확장", "확포장", "개설", "설치", "조성", "건립", "구축", "개발", "리모델링", "증축", "신축", "공공", "생활", "주민", "농촌", "어촌", "농어촌", "농어촌마을", "농촌마을", "어촌마을", "마을하수도", "공공하수도", "소규모", "추가", "잔여", "나머지", "본공사", "전기", "기계", "토목", "조경"]);
/** 시설 종류 말: 같은 종류 사업이 많아 이것만 겹치면 같은 사업이라 할 수 없습니다 */
const GENERIC_KIND = /^(.*(관로|관거|관망|배관|송수관|도수관|급수관|오수관|우수관|하수관|배수관)|배수로|용배수로|배수|우수관로|우수관|우수|하수관로|하수관|하수|하수도|상수관로|상수도|관로|수로|수로관|소하천|하천|하천정비|농로|도로|지방도|국도|군도|시도|농어촌도로|마을안길|마을길|보도|인도|차도|교량|교|터널|제방|호안|저수지|저류지|펌프장|배수장|양수장|취수장|정수장|하수처리장|처리장|공원|주차장|광장|운동장|체육관|학교|청사|회관|경로당|복지관|센터|도서관|박물관|전시관|주택|아파트|단지|산업단지|농공단지|택지|지구|마을|지역|구역|구간|노선|호선)$/;
/** 지역·기관 이름(발주처)과 입찰 용어: 사업 이름이 아니라 겹쳐도 증거가 못 됩니다 */
const GENERIC_PLACE = /^((?!.*(지구|단지|공구|구역|구간)$)[가-힣]{1,4}(시|군|구|도|읍|면)|광주광역시|전라남도|전남광주통합특별시|통합특별시|광주청사|전남청사|[가-힣]{1,6}(청|청사|사업소|본부|지청|지사|사무소|교육청|교육지원청))$/;
const GENERIC_BID = /(입찰|PQ|총괄|협상|제안|공모|낙찰|계약|설계|감리|용역|가격|적격|심사|분리|분할|일괄|턴키|단가|수의|긴급)/;
const GENERIC_NUM = /^(\d+[-~.]?\d*)?(단계|차|차수|공구|구간|구역|권역|블록|호|번|년|년도|기|호선|라인|공정)?$/;
export function isGenericToken(t: string): boolean {
  if (GENERIC_EXACT.has(t) || GENERIC_KIND.test(t) || GENERIC_PLACE.test(t) || GENERIC_BID.test(t) || GENERIC_NUM.test(t)) return true;
  // 「○○정비사업」처럼 흔한 말이 붙은 4글자 이상 낱말도 앞부분이 시설 종류면 흔한 말 (예: 하천정비사업, 도로개설공사)
  const m = t.match(/^(.+?)(정비|개선|개량|보수|확장|확포장|개설|설치|조성|건립|구축|개발)(사업|공사)?$/);
  if (m && (GENERIC_KIND.test(m[1]) || m[1].length <= 1)) return true;
  return false;
}
/** 그 사업만의 고유한 말(지구·마을·시설 이름 등) */
export const distinctive = (tokens: string[]) => tokens.filter((t) => !isGenericToken(t));

/**
 * 낱말 묶음끼리 비교 (미리 쪼개 둔 것을 쓰면 빠릅니다).
 * 고유한 말이 하나 이상 겹치고, 설계명의 고유한 말 중 60% 이상이 납품요구명에 있어야 같은 사업으로 봅니다.
 */
/** 「유천지구」「지소마을」처럼 그 사업의 자리를 딱 집는 이름 → 이름 부분(유천·지소)만 돌려줍니다 */
export function placeNames(tokens: string[]): string[] {
  const out: string[] = [];
  for (const t of tokens) { const m = t.match(/^([가-힣]{2,})(지구|마을|단지|공구)$/); if (m && !isGenericToken(m[1]) && !isGenericToken(t)) out.push(m[1]); }
  return out;
}

/** 「영산지구」「삼호읍」→「영산」「삼호」: 비교할 때는 자리 이름만 남깁니다 (같은 이름이 두 번 세어지지 않게) */
const bareName = (t: string) => { const m = t.match(/^([가-힣]{2,})(지구|마을|단지|공구|읍|면|동|리)$/); return m && !isGenericToken(m[1]) ? m[1] : t; };

export function tokenScore(ta: string[], tb: string[]): number {
  const da = [...new Set(distinctive(ta).map(bareName))]; const db = [...new Set(distinctive(tb).map(bareName))];
  if (!da.length || !db.length) return 0;
  // 양쪽 모두 「○○지구」 같은 자리 이름이 있는데 하나도 같지 않으면 다른 사업입니다 (예: 학산 유천지구 ↔ 학산 지소지구)
  const pa = placeNames(ta); const pb = placeNames(tb);
  const samePlace = pa.length > 0 && pb.length > 0 && pa.some((x) => pb.includes(x));
  if (pa.length && pb.length && !samePlace) return 0;
  const shared = da.filter((t) => db.includes(t) || (t.length >= 3 && db.some((u) => u.length >= 3 && (u.includes(t) || t.includes(u)))));
  if (!shared.length) return 0;
  const ratio = shared.length / da.length;
  // 자리 이름(○○지구)이 양쪽에 똑같이 있으면 그 사업이 맞다고 보고, 나머지 말이 절반만 겹쳐도 인정합니다
  if (samePlace && ratio >= 0.5) return Math.max(ratio, 0.6);
  if (shared.length >= 2 && ratio >= 0.5) return ratio;
  return ratio >= 0.6 ? ratio : 0;
}
/** 두 이름이 같은 사업으로 보이는 정도 (0~1). 긴 낱말(지구·마을 이름)이 겹치면 높게 */
export function nameScore(a: string, b: string): number { return tokenScore(nameTokens(a), nameTokens(b)); }

export interface PreparedDelivery { d: Delivery; tokens: string[]; agencyKey: string }
/** 납품요구를 미리 쪼개 둡니다 (설계용역 수백 건과 대조할 때 한 번만) */
export function prepareDeliveries(deliveries: Delivery[]): PreparedDelivery[] {
  return deliveries.filter((d) => d.reqName).map((d) => ({ d, tokens: nameTokens(d.reqName!), agencyKey: d.agency.replace(/\s+/g, "") }));
}

/** 설계용역 공고 하나에 대해 납품요구 중 같은 사업으로 보이는 것 */
export function matchDeliveries(notice: BidNotice, deliveries: Delivery[] | PreparedDelivery[], minScore = 0.6): Match[] {
  const prepared: PreparedDelivery[] = deliveries.length && "tokens" in (deliveries[0] as PreparedDelivery) ? (deliveries as PreparedDelivery[]) : prepareDeliveries(deliveries as Delivery[]);
  const titleTokens = nameTokens(notice.title);
  const region = notice.region;
  const agencyKey = (notice.demand || notice.agency).replace(/\s+/g, "");
  const out: Match[] = [];
  for (const p of prepared) {
    const d = p.d;
    // 같은 지역이거나 같은 기관일 때만 (도청 발주·현장 지역이 다른 경우는 기관 이름으로)
    const sameRegion = d.region === region || d.region === "기타" || region === "기타";
    const sameAgency = agencyKey.length >= 3 && (p.agencyKey.includes(agencyKey) || agencyKey.includes(p.agencyKey));
    if (!sameRegion && !sameAgency) continue;
    const s = tokenScore(titleTokens, p.tokens);
    if (s >= minScore) out.push({ delivery: d, score: s });
  }
  return out.sort((a, b) => b.score - a.score || b.delivery.date.localeCompare(a.delivery.date));
}

export interface MatchSummary { count: number; amount: number; companies: { name: string; amount: number; count: number }[]; items: string[]; latest?: string; samples: { date: string; company: string; item: string; amount?: number; reqName?: string }[] }

export function summarizeMatches(matches: Match[]): MatchSummary {
  const cm = new Map<string, { name: string; amount: number; count: number }>();
  let amount = 0; const items = new Set<string>(); let latest = "";
  for (const m of matches) { const d = m.delivery; amount += d.amount ?? 0; items.add(d.item); if (d.date > latest) latest = d.date; const e = cm.get(d.company) ?? { name: d.company, amount: 0, count: 0 }; e.amount += d.amount ?? 0; e.count++; cm.set(d.company, e); }
  return { count: matches.length, amount, companies: [...cm.values()].sort((a, b) => b.amount - a.amount).slice(0, 4), items: [...items].slice(0, 5), latest: latest || undefined, samples: matches.slice(0, 5).map((m) => ({ date: m.delivery.date, company: m.delivery.company, item: m.delivery.item, amount: m.delivery.amount, reqName: m.delivery.reqName })) };
}
