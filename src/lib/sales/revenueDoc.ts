// 매출 ↔ 거래명세표 연결 규칙
// - 매출에 품목을 넣으면 금액은 품목에서 자동 계산되고, 거래명세표가 같이 만들어집니다.
// - 양식 문서에서 거래명세표를 만들면 같은 내용의 매출이 자동으로 등록됩니다.
import type { FormDoc, QuoteItem, Revenue } from "@/data/sample";
import { docTotal } from "@/lib/documents/calc";
import { newId } from "@/lib/ids";

export function cleanItems(items: QuoteItem[] | undefined) {
  return (items ?? [])
    .filter((i) => i.name.trim())
    .map((i) => ({ ...i, name: i.name.trim(), spec: i.spec?.trim() || undefined, unit: i.unit || "EA", qty: Number(i.qty) || 0, unitPrice: Number(i.unitPrice) || 0 }));
}

/** 품목이 있으면 품목 합계(부가세 포함), 없으면 직접 적은 금액 */
export function revenueAmount(r: Pick<Revenue, "items" | "vatIncluded" | "amount">) {
  const items = cleanItems(r.items);
  return items.length ? docTotal({ items, vatIncluded: !!r.vatIncluded }) : Math.max(0, Number(r.amount) || 0);
}

/** 매출 내용으로 거래명세표 만들기 (문서 번호는 호출한 쪽에서 매김) */
export function docFromRevenue(r: Revenue, number: string, opts: { createdBy?: string; today: string }): FormDoc {
  return {
    id: newId("fd"),
    type: "거래명세표",
    number,
    date: r.date || opts.today,
    customer: r.customer || "",
    project: r.project,
    site: r.site,
    items: cleanItems(r.items),
    vatIncluded: !!r.vatIncluded,
    memo: r.memo,
    quoteId: r.quoteId,
    revenueId: r.id,
    createdBy: opts.createdBy,
    createdAt: opts.today,
  };
}

/** 이미 있는 거래명세표를 매출 내용에 맞게 갱신 */
export function syncDocWithRevenue(doc: FormDoc, r: Revenue): FormDoc {
  return { ...doc, date: r.date || doc.date, customer: r.customer || doc.customer, project: r.project, site: r.site, items: cleanItems(r.items), vatIncluded: !!r.vatIncluded, memo: r.memo, revenueId: r.id };
}

export function revenueTitleFromDoc(doc: Pick<FormDoc, "customer" | "project" | "site" | "items" | "number">) {
  const first = doc.items[0]?.name?.trim();
  const rest = doc.items.length > 1 ? ` 외 ${doc.items.length - 1}건` : "";
  const where = doc.project || doc.site || doc.customer;
  return `${where} ${first ? `${first}${rest}` : "납품"} (${doc.number})`;
}

/** 거래명세표 내용으로 매출 만들기 */
export function revenueFromDoc(doc: FormDoc): Revenue {
  return {
    id: newId("r"),
    title: revenueTitleFromDoc(doc),
    date: doc.date,
    customer: doc.customer || undefined,
    project: doc.project,
    site: doc.site,
    amount: docTotal(doc),
    quoteId: doc.quoteId,
    memo: doc.memo,
    items: doc.items.map((i) => ({ ...i })),
    vatIncluded: doc.vatIncluded,
    docId: doc.id,
    docNumber: doc.number,
  };
}

/** 이미 있는 매출을 거래명세표 내용에 맞게 갱신 (매출명·메모는 사용자가 고친 것을 유지) */
export function syncRevenueWithDoc(r: Revenue, doc: FormDoc): Revenue {
  return { ...r, date: doc.date, customer: doc.customer || r.customer, project: doc.project, site: doc.site, items: doc.items.map((i) => ({ ...i })), vatIncluded: doc.vatIncluded, amount: docTotal(doc), docId: doc.id, docNumber: doc.number };
}
