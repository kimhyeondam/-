// 달력 계산에 쓰는 작은 도우미 함수들 (모두 YYYY-MM-DD 문자열 기준)

export const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

export function toIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromIso(iso: string) {
  return new Date(iso + "T00:00:00");
}

export function addDays(iso: string, n: number) {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function addMonths(iso: string, n: number) {
  const d = fromIso(iso);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toIso(d);
}

/** 월요일 시작 기준, 해당 날짜가 속한 주의 월요일 */
export function startOfWeek(iso: string) {
  const d = fromIso(iso);
  const dow = (d.getDay() + 6) % 7; // 월=0 ... 일=6
  return addDays(iso, -dow);
}

/** 월간 달력에 표시할 6주(42일) 날짜 목록 */
export function monthGrid(iso: string) {
  const d = fromIso(iso);
  d.setDate(1);
  const first = startOfWeek(toIso(d));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function weekDays(iso: string) {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function sameMonth(a: string, b: string) {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function formatMonth(iso: string) {
  const d = fromIso(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

export function formatDateLong(iso: string) {
  const d = fromIso(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[(d.getDay() + 6) % 7]})`;
}

export function formatDateShort(iso: string) {
  const d = fromIso(iso);
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[(d.getDay() + 6) % 7]})`;
}
