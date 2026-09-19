// 거래명세표·송장의 공급자/공급받는자를 사업자번호로 확인해 매출·매입·대리점 매출을 가립니다.
import type { Customer } from "@/data/sample";
import type { InboxDoc } from "@/app/api/inbox/analyze/route";

export type PartyMatch = { type: "us" | "dealer" | "purchase" | "unknown-supplier" | "none"; dealer?: { id: string; name: string; bizNo?: string } };

const digits = (v?: string) => (v ?? "").replace(/[^0-9]/g, "");
const bare = (v?: string) => (v ?? "").replace(/\(주\)|㈜|주식회사|\s/g, "").toLowerCase();

/** doc 을 제자리에서 고치고(kind·counterparty·memo), 어떤 경우였는지 돌려줍니다. */
export function resolveParties(doc: InboxDoc, customers: Customer[], ourBizNo: string): PartyMatch {
  const hasParties = ["매출명세표", "매입명세표", "기타"].includes(doc.kind) && (doc.supplierName || doc.supplierBizNo);
  if (!hasParties) return { type: "none" };
  const ourBiz = digits(ourBizNo);
  const supplierBiz = digits(doc.supplierBizNo);
  const recipientBiz = digits(doc.recipientBizNo);
  const dealer =
    customers.find((c) => c.dealer && c.bizNo && supplierBiz && digits(c.bizNo) === supplierBiz) ??
    customers.find((c) => c.dealer && doc.supplierName && bare(c.name) === bare(doc.supplierName));

  if (supplierBiz && supplierBiz === ourBiz) {
    doc.kind = "매출명세표";
    if (!doc.counterparty) doc.counterparty = doc.recipientName;
    return { type: "us" };
  }
  if (dealer) {
    // 대리점이 자기 이름으로 최종 현장에 납품한 송장 → 우리 매출은 대리점 앞으로, 최종 납품처는 메모에
    doc.kind = "매출명세표";
    doc.counterparty = dealer.name;
    const dest = [doc.recipientName, doc.siteName].filter(Boolean).join(" · ");
    doc.location = doc.siteName || doc.location;
    doc.memo = [dest ? `최종 납품처: ${dest}` : "", doc.contact ? `담당 ${doc.contact}` : "", doc.memo].filter(Boolean).join(" · ");
    return { type: "dealer", dealer: { id: dealer.id, name: dealer.name, bizNo: dealer.bizNo } };
  }
  if (recipientBiz && recipientBiz === ourBiz) {
    doc.kind = "매입명세표";
    doc.counterparty = doc.supplierName || doc.counterparty;
    return { type: "purchase" };
  }
  // 우리도 아니고 등록된 대리점도 아닌 공급자 → 화면에서 대리점으로 등록할지 물어봄
  return { type: "unknown-supplier" };
}
