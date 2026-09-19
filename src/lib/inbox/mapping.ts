// 스마트 업로드 결과(InboxDoc)를 각 메뉴의 기록으로 바꾸는 순수 함수들
import type { BusinessCard, DeliveryOrder, Deposit, Event, Project, Purchase, QuoteItem, Revenue, Task, ProductionReport, ProductionItem } from "@/data/sample";
import type { InboxDoc, InboxKind } from "@/app/api/inbox/analyze/route";
import { docTotal } from "@/lib/documents/calc";
import { newId } from "@/lib/ids";

export const kindMeta: Record<InboxKind, { label: string; menu: string; href: string; icon: string }> = {
  명함: { label: "명함", menu: "명함관리", href: "/dashboard/business-cards", icon: "▬" },
  매출명세표: { label: "매출 (거래명세표)", menu: "매출관리", href: "/dashboard/sales", icon: "$" },
  매입명세표: { label: "매입 (명세표·영수증)", menu: "매입관리", href: "/dashboard/purchases", icon: "▽" },
  납품요구서: { label: "납품요구서", menu: "프로젝트관리", href: "/dashboard/projects", icon: "▭" },
  입금내역: { label: "입금 내역", menu: "입금관리", href: "/dashboard/payments", icon: "▮" },
  생산일보: { label: "생산일보", menu: "생산관리", href: "/dashboard/production", icon: "▦" },
  일정: { label: "일정", menu: "일정관리", href: "/dashboard/schedule", icon: "▤" },
  할일: { label: "할일", menu: "할일관리", href: "/dashboard/tasks", icon: "☑" },
  기타: { label: "기타 (분류 안 됨)", menu: "-", href: "/dashboard", icon: "?" },
};

export function toQuoteItems(items: InboxDoc["items"]): QuoteItem[] {
  return items.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), spec: i.spec || undefined, unit: i.unit || "EA", qty: i.qty || 0, unitPrice: i.unitPrice || (i.qty ? Math.round((i.amount || 0) / i.qty) : 0) }));
}

export function toCard(d: InboxDoc, today: string): BusinessCard {
  return { id: newId("bc"), name: d.person || d.counterparty || "이름 없음", company: d.counterparty, title: d.jobTitle || undefined, phone: d.phone || undefined, mobile: d.mobile || undefined, email: d.email || undefined, address: d.address || undefined, source: "스캔", memo: d.memo || undefined, createdAt: today };
}

/** 매출: 품목이 있으면 품목 기준 금액, 없으면 합계 금액. 외부에서 이미 발행된 명세표라 양식 문서는 만들지 않습니다. */
export function toRevenue(d: InboxDoc): Revenue {
  const items = toQuoteItems(d.items);
  const vatIncluded = d.supplyAmount > 0 && d.totalAmount > 0 ? Math.abs(d.supplyAmount - d.totalAmount) < 1 : false;
  const amount = items.length && items.some((i) => i.unitPrice > 0) ? docTotal({ items, vatIncluded }) : d.totalAmount || 0;
  const first = items[0]?.name;
  return {
    id: newId("r"),
    title: d.title || `${d.counterparty || "거래처"} ${first ? `${first}${items.length > 1 ? ` 외 ${items.length - 1}건` : ""}` : "납품"}${d.orderNo ? ` (No.${d.orderNo})` : ""}`,
    date: d.date || undefined,
    customer: d.counterparty || undefined,
    project: d.projectName || undefined,
    site: d.location || undefined,
    amount,
    items: items.length ? items : undefined,
    vatIncluded: items.length ? vatIncluded : undefined,
    memo: [d.orderNo ? `외부 명세표 No.${d.orderNo}` : "", d.memo].filter(Boolean).join(" · ") || undefined,
  };
}

/** 매입: 품목이 여러 줄이면 한 건으로 묶고 첫 품목명 + 외 N건 */
export function toPurchase(d: InboxDoc): Purchase {
  const items = toQuoteItems(d.items);
  const supplyFromItems = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const supply = d.supplyAmount || (d.totalAmount ? Math.round(d.totalAmount / 1.1) : supplyFromItems);
  const vat = d.vatAmount || (d.totalAmount ? d.totalAmount - supply : Math.round(supply * 0.1));
  const first = items[0];
  return {
    id: newId("pu"),
    date: d.date || new Date().toISOString().slice(0, 10),
    supplier: d.counterparty || "매입처 미상",
    item: first ? `${first.name}${items.length > 1 ? ` 외 ${items.length - 1}건` : ""}` : d.title || "매입",
    spec: items.length === 1 ? first?.spec : undefined,
    qty: items.length === 1 ? first?.qty : undefined,
    items: items.length > 1 ? items : undefined,
    unit: items.length === 1 ? first?.unit : undefined,
    unitPrice: items.length === 1 ? first?.unitPrice : undefined,
    supply,
    vat,
    category: d.category,
    paid: 0,
    payDue: d.dueDate || undefined,
    invoice: /세금계산서/.test(d.summary),
    memo: [d.orderNo ? `No.${d.orderNo}` : "", items.length > 1 ? items.map((i) => `${i.name} ${i.qty}${i.unit}`).join(", ") : "", d.memo].filter(Boolean).join(" · ") || undefined,
  };
}

export function toDeposit(d: InboxDoc): Deposit {
  return { id: newId("d"), date: d.date || new Date().toISOString().slice(0, 10), payer: d.counterparty || d.person || "입금자 미상", amount: d.totalAmount || 0, bank: d.bank || undefined, source: "수기", memo: d.memo || undefined };
}

export function toEvent(d: InboxDoc): Event {
  return { id: newId("e"), title: d.title || d.summary, date: d.date || new Date().toISOString().slice(0, 10), endDate: d.endDate || undefined, time: d.time || undefined, endTime: d.endTime || undefined, type: d.eventType, attendees: [], location: d.location || undefined, memo: [d.counterparty, d.memo].filter(Boolean).join(" · ") || undefined };
}

export function toTask(d: InboxDoc): Task {
  return { id: newId("t"), title: d.title || d.summary, description: [d.counterparty, d.memo].filter(Boolean).join(" · ") || undefined, project: d.projectName || undefined, assignees: [], due: d.dueDate || d.date || undefined, status: "todo", priority: d.priority, createdAt: new Date().toISOString() };
}

export function toOrder(d: InboxDoc, fileName: string, userName?: string): DeliveryOrder {
  const items = d.items.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), spec: i.spec || undefined, unit: i.unit || "EA", qty: i.qty || 0, unitPrice: i.unitPrice || undefined, amount: i.amount || undefined, note: i.note || undefined }));
  return {
    id: newId("do"), kind: "분할납품요구서", projectName: d.projectName || undefined, orderNo: d.orderNo || undefined, contractNo: d.contractNo || undefined,
    agency: d.counterparty || undefined, site: d.location || undefined, date: d.date || undefined, dueDate: d.dueDate || undefined,
    items, totalQty: items.reduce((s, i) => s + i.qty, 0), totalAmount: d.totalAmount || undefined,
    // 메모는 실수요부서 담당자 연락처만 (없으면 분석기가 준 짧은 메모)
    memo: (d.endUserContact ? `실수요부서 담당: ${d.endUserContact}` : d.memo) || undefined,
    fileName: fileName || undefined, uploadedAt: new Date().toISOString(), uploadedBy: userName,
  };
}

export function nextProjectCode(items: Project[]) {
  const yy = String(new Date().getFullYear()).slice(2);
  const nums = items.filter((p) => p.code.startsWith(yy + "-")).map((p) => parseInt(p.code.split("-")[1], 10) || 0);
  return `${yy}-${(nums.length ? Math.max(...nums) : 0) + 1}`;
}

/** 생산일보 사진 → 생산 기록 (품목 연결(productId)은 저장하는 쪽에서 붙입니다) */
export function toProductionReport(d: InboxDoc, by?: string): ProductionReport {
  const items: ProductionItem[] = d.items
    .filter((i) => i.name.trim() && ((i.qty || 0) > 0 || (i.defect || 0) > 0))
    .map((i) => ({ name: i.name.trim(), spec: (i.spec || "").trim() || undefined, unit: i.unit || "EA", produced: Math.max(0, Math.round(i.qty || 0)), defect: i.defect ? Math.max(0, Math.round(i.defect)) : undefined }));
  const workers = (d.workers || "").split(/[,、·\/]/).map((w) => w.trim()).filter(Boolean);
  const notes = [d.memo, d.items.filter((i) => i.note).map((i) => `${i.name}: ${i.note}`).join(", ")].filter(Boolean).join(" · ") || undefined;
  return { id: newId("pr"), date: d.date || new Date().toISOString().slice(0, 10), line: d.line || undefined, workers, items, hours: d.workHours || undefined, notes, createdBy: by, createdAt: new Date().toISOString() };
}
