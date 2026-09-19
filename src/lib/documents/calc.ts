// 양식 문서 공통 계산 (브라우저/서버 공용)
import type { FormDoc, QuoteItem, DocType } from "@/data/sample";
import { docPrefix } from "@/data/sample";

export function docSupply(items: QuoteItem[]) {
  return items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
}
export function docVat(doc: Pick<FormDoc, "items" | "vatIncluded">) {
  const supply = docSupply(doc.items);
  return doc.vatIncluded ? Math.round(supply - supply / 1.1) : Math.round(supply * 0.1);
}
export function docTotal(doc: Pick<FormDoc, "items" | "vatIncluded">) {
  const supply = docSupply(doc.items);
  return doc.vatIncluded ? supply : supply + docVat(doc);
}
/** 부가세 포함이면 공급가액은 합계에서 부가세를 뺀 값 */
export function docNetSupply(doc: Pick<FormDoc, "items" | "vatIncluded">) {
  return docTotal(doc) - docVat(doc);
}

export function nextDocNumber(existing: FormDoc[], type: DocType, date: string) {
  const prefix = `${docPrefix[type]}-${date.slice(2, 4)}${date.slice(5, 7)}-`;
  const nums = existing.filter((d) => d.number.startsWith(prefix)).map((d) => parseInt(d.number.slice(prefix.length), 10) || 0);
  return `${prefix}${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
}

const KOREAN_DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const SMALL_UNITS = ["", "십", "백", "천"];
const BIG_UNITS = ["", "만", "억", "조"];

/** 금액을 한글로: 25740000 → 이천오백칠십사만 */
export function toKoreanNumber(n: number) {
  if (!n) return "영";
  let result = "";
  let big = 0;
  while (n > 0) {
    const chunk = n % 10000;
    if (chunk) {
      let s = "";
      let c = chunk;
      for (let i = 0; c > 0; i++) {
        const d = c % 10;
        if (d) s = (d === 1 && i > 0 ? "" : KOREAN_DIGITS[d]) + SMALL_UNITS[i] + s;
        c = Math.floor(c / 10);
      }
      result = s + BIG_UNITS[big] + result;
    }
    n = Math.floor(n / 10000);
    big++;
  }
  return result;
}

export function fmtDateKo(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}
