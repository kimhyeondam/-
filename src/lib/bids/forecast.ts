// 설계용역 공고로 1년 뒤 발주를 예측합니다.
import type { BidNotice } from "./types";

export const DEFAULT_DESIGN_MONTHS = 10; // 설계 개찰 뒤 발주까지 보통 걸리는 개월 수

/** 설계용역 공고인지 (감리·측량·타당성조사·안전점검은 제외) */
export function isDesignService(n: BidNotice): boolean {
  if (n.kind !== "용역") return false;
  const t = n.title.replace(/\s+/g, "");
  if (!/설계/.test(t)) return false;
  if (/감리|측량|안전점검|정밀점검|타당성|사후환경|설계변경|설계도서검토|설계경제성|VE/.test(t) && !/실시설계/.test(t)) return false;
  return true;
}

/** 예측 기준일: 개찰일 → 마감일 → 공고일 */
export function baseDateOf(n: BidNotice): string {
  return (n.openAt ?? n.closeAt ?? n.noticeAt).slice(0, 10);
}

export function addMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, Math.min(d, 28)));
  return dt.toISOString().slice(0, 10);
}

export interface Forecast {
  notice: BidNotice;
  base: string; // 기준일
  expected: string; // 예상 발주일 (YYYY-MM-DD)
  expectedMonth: string; // YYYY-MM
  remind: string; // 확인 할일 마감일 (예상 발주 한 달 전)
}

export function forecastOf(n: BidNotice, months = DEFAULT_DESIGN_MONTHS): Forecast {
  const base = baseDateOf(n);
  const expected = addMonths(base, months);
  return { notice: n, base, expected, expectedMonth: expected.slice(0, 7), remind: addMonths(expected, -1) };
}

/** 설계용역 공고들 → 예상 발주일 순으로 */
export function forecasts(items: BidNotice[], months = DEFAULT_DESIGN_MONTHS): Forecast[] {
  return dedupeNotices(items.filter(isDesignService)).map((n) => forecastOf(n, months)).sort((a, b) => a.expected.localeCompare(b.expected));
}

/** 공고번호는 다른데 제목·수요기관이 같은 공고(재공고·정정공고 등)는 가장 최근 것 하나만 남깁니다 */
export function dedupeNotices(items: BidNotice[]): BidNotice[] {
  const key = (n: BidNotice) => `${n.title.replace(/\s+/g, "")}|${(n.demand || n.agency).replace(/\s+/g, "")}`;
  const best = new Map<string, BidNotice>();
  for (const n of items) {
    const k = key(n); const cur = best.get(k);
    if (!cur || n.noticeAt > cur.noticeAt || (n.noticeAt === cur.noticeAt && n.id > cur.id)) best.set(k, n);
  }
  return [...best.values()];
}

/** 할일 제목 (같은 공고로 두 번 만들지 않기 위한 표식 포함) */
export function reminderTitle(n: BidNotice) { return `발주 확인: ${n.title} [공고 ${n.id}]`; }
