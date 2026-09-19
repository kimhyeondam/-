// 엔택스CS 「매출추가 → Paste」 형식으로 매출 한 건을 문자열로 만듭니다.
// (엔택스 도움말 "웹 개발자용 Paste 매뉴얼" 형식: 항목명=값 줄들 + [제품목록] + 판매일자;제품코드;제품명;규격;단위;수량;단가;공급가;세액;비고)
import type { Customer, Revenue } from "@/data/sample";

export type EntaxEvidence = 1 | 2 | 4 | 8 | 16 | 32; // 1 세금계산서, 2 계산서, 4 거래명세표, 8 입금표, 16 영수증, 32 카드매출전표
export const entaxEvidenceLabels: Record<EntaxEvidence, string> = { 1: "세금계산서", 2: "계산서", 4: "거래명세표", 8: "입금표", 16: "영수증", 32: "카드매출전표" };

export interface EntaxOptions {
  evidence?: EntaxEvidence; // 기본 4 (거래명세표)
  receipt?: "영수" | "청구"; // 기본: 전액 입금이면 영수, 아니면 청구
  payMethod?: "무통장" | "신용카드" | "어음" | "현금" | "수표";
  paid?: number; // 입금액 (영수/청구 판단용)
}

/** 세미콜론·줄바꿈이 형식을 깨지 않도록 정리 */
const clean = (v?: string | number) => String(v ?? "").replace(/[;\r\n]+/g, " ").replace(/\s+/g, " ").trim();

/** 품목 한 줄의 공급가·세액 (단가에 부가세 포함이면 역산) */
export function lineAmounts(qty: number, unitPrice: number, vatIncluded: boolean) {
  const gross = Math.round((qty || 0) * (unitPrice || 0));
  if (vatIncluded) {
    const supply = Math.round(gross / 1.1);
    return { supply, vat: gross - supply };
  }
  return { supply: gross, vat: Math.round(gross * 0.1) };
}

export function entaxSalesPaste(rev: Revenue, customer: Customer | undefined, opts: EntaxOptions = {}) {
  const items = rev.items ?? [];
  const evidence = opts.evidence ?? 4;
  const paid = opts.paid ?? 0;
  const receipt = opts.receipt ?? (rev.amount > 0 && paid >= rev.amount ? "영수" : "청구");
  const date = rev.date || new Date().toISOString().slice(0, 10);
  const first = items[0]?.name || rev.title;
  const head = [
    `작성일=${date}`,
    `사업자번호=${clean(customer?.bizNo && customer.bizNo !== "-" ? customer.bizNo : "")}`,
    `대표제품명=${clean(items.length > 1 ? `${first} 외 ${items.length - 1}건` : first)}`,
    `증빙서=${evidence}`,
    `영수청구=${receipt}`,
    `장부출력=yes`,
    `고정자산=no`,
    `결제방법=${opts.payMethod ?? "무통장"}`,
    `결제번호=`,
    // 회사명;사업자번호;대표자명;사업장주소;업태;종목;담당자명;Email;전화번호;휴대폰번호
    `거래처정보=${[rev.customer ?? customer?.name ?? "", customer?.bizNo && customer.bizNo !== "-" ? customer.bizNo : "", customer?.ceo && customer.ceo !== "-" ? customer.ceo : "", customer?.address ?? "", "", "", "", customer?.email ?? "", customer?.phone ?? "", ""].map(clean).join(";")}`,
    `상단메모=`,
    `중간메모=`,
    `하단메모=`,
    `비고메모=${clean([rev.project ? `프로젝트: ${rev.project}` : "", rev.site ? `현장: ${rev.site}` : "", rev.memo].filter(Boolean).join(" / "))}`,
    `주문번호=${clean(rev.docNumber ?? "")}`,
    `기타메모=${clean(`현담토목 업무관리 매출 ${rev.title}`)}`,
    "[제품목록]",
  ];
  const lines = items.map((it) => {
    const { supply, vat } = lineAmounts(it.qty, it.unitPrice, !!rev.vatIncluded);
    // 판매일자;제품코드;제품명;규격;단위;수량;단가;공급가;세액;비고
    return [date, "", clean(it.name), clean(it.spec), clean(it.unit), it.qty || 0, it.unitPrice || 0, supply, vat, ""].join(";");
  });
  if (!lines.length) {
    // 품목 없이 금액만 있는 매출: 한 줄로 만들어 공급가·세액만 넘김
    const supply = Math.round(rev.amount / 1.1);
    lines.push([date, "", clean(rev.title), "", "식", 1, supply, supply, rev.amount - supply, ""].join(";"));
  }
  return [...head, ...lines].join("\r\n");
}

/** 엔택스 「거래처 정보 → Paste」 형식 (회사명;사업자번호;대표자명;사업장주소;업태;종목;담당자명;Email;전화번호;휴대폰번호;팩스번호;홈페이지) */
export function entaxCustomerPaste(c: Customer) {
  const dash = (v?: string) => (v && v !== "-" ? v : "");
  return [c.name, dash(c.bizNo), dash(c.ceo), c.address ?? "", "", "", "", c.email ?? "", c.phone ?? "", "", "", ""].map(clean).join(";");
}
