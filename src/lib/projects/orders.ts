// 납품 문서(분할납품요구서·거래명세표)와 프로젝트를 연결하는 순수 로직
// - 같은 문서를 또 올렸는지(중복) 판정
// - 어느 기존 프로젝트에 합치면 좋을지 추천
// - 프로젝트끼리 합치기
import type { DeliveryOrder, Project } from "@/data/sample";

/** 비교용으로 문자열을 단순화: 공백·괄호·기호 제거, 소문자 */
export function norm(s?: string) {
  return (s ?? "").toLowerCase().replace(/[\s()\[\]{}\-_/·.,:;'"「」『』]/g, "");
}

/** 한글/영문/숫자 덩어리 중 2글자 이상만 뽑아 단어 목록으로 */
export function tokens(s?: string) {
  return (s ?? "").split(/[^0-9A-Za-z가-힣]+/).map((t) => t.trim()).filter((t) => t.length >= 2);
}

export function orderKey(o: Pick<DeliveryOrder, "orderNo" | "kind">) {
  return o.orderNo ? `${o.kind}:${norm(o.orderNo)}` : "";
}

/** 같은 문서 번호가 이미 어느 프로젝트에 들어 있는지 */
export function findDuplicate(projects: Project[], order: Pick<DeliveryOrder, "orderNo" | "kind">) {
  const key = orderKey(order);
  if (!key) return null;
  for (const p of projects) {
    const hit = (p.orders ?? []).find((o) => orderKey(o) === key);
    if (hit) return { project: p, order: hit };
  }
  return null;
}

export interface Suggestion {
  project: Project;
  score: number;
  reasons: string[];
  strong: boolean; // 사업명·현장명이 일치해 자동으로 합쳐도 되는 추천
}

/** 새 문서와 비슷한 기존 프로젝트 추천 (점수 높은 순) */
/** 자동으로 합쳐도 되는 추천인지: 사업명 또는 현장명이 그대로 일치할 때만 true. 계약번호·발주처만 같은 것은 연간 단가계약이라 다른 현장일 수 있어 합치지 않습니다 */
export function suggestProjects(projects: Project[], order: Pick<DeliveryOrder, "agency" | "site" | "contractNo" | "orderNo" | "projectName">): Suggestion[] {
  const site = norm(order.site);
  const biz = norm(order.projectName);
  const agency = norm(order.agency);
  const contract = norm(order.contractNo);
  const siteTokens = tokens(order.site);
  const out: Suggestion[] = [];
  for (const p of projects) {
    if (p.status === "취소") continue;
    let score = 0;
    const reasons: string[] = [];
    const orders = p.orders ?? [];
    let strong = false;
    if (contract && orders.some((o) => norm(o.contractNo) === contract)) { score += 20; reasons.push("계약번호 일치 (연간 계약이면 현장이 다를 수 있음)"); }
    const pName = norm(p.name);
    const pClient = norm(p.client);
    const pSites = orders.map((o) => norm(o.site)).filter(Boolean);
    const pBiz = orders.map((o) => norm(o.projectName)).filter(Boolean);
    if (biz && biz.length >= 4 && (pName === biz || pBiz.includes(biz) || pName.includes(biz) || biz.includes(pName) && pName.length >= 4)) { score += 50; strong = true; reasons.push("사업명 일치"); }
    else if (biz && biz.length >= 4 && pBiz.length && !pBiz.includes(biz)) { score -= 30; reasons.push("사업명이 다름"); }
    if (site && site.length >= 4 && !/지정장소|수요기관/.test(site) && (pSites.includes(site) || pName.includes(site) || site.includes(pName) && pName.length >= 4)) { score += 40; strong = true; reasons.push("현장명 일치"); }
    else {
      const shared = /지정장소|수요기관/.test(site) ? [] : siteTokens.filter((t) => t.length >= 3 && (pName.includes(norm(t)) || pSites.some((s) => s.includes(norm(t)))));
      if (shared.length) { score += Math.min(15, 5 * shared.length); reasons.push(`현장명 일부 일치 (${shared.slice(0, 3).join(", ")})`); }
    }
    if (agency && agency.length >= 2 && (pClient === agency || pClient.includes(agency) || agency.includes(pClient) && pClient.length >= 2 || orders.some((o) => norm(o.agency) === agency))) { score += 15; reasons.push("발주처 일치"); }
    if (score > 0) out.push({ project: p, score, reasons, strong });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function orderTotals(orders: DeliveryOrder[] = []) {
  return {
    count: orders.length,
    qty: orders.reduce((s, o) => s + (o.totalQty || 0), 0),
    amount: orders.reduce((s, o) => s + (o.totalAmount || 0), 0),
  };
}

function laterDate(a?: string, b?: string) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
function earlierDate(a?: string, b?: string) {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

/** 기존 프로젝트에 문서 한 건 붙이기 (같은 번호는 교체) */
export function attachOrder(project: Project, order: DeliveryOrder): Project {
  const key = orderKey(order);
  const rest = (project.orders ?? []).filter((o) => !key || orderKey(o) !== key);
  const orders = [...rest, order].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  // 시작일은 문서 중 가장 이른 날짜, 납기는 가장 늦은 납품기한으로 맞춥니다.
  const startDate = orders.reduce<string | undefined>((acc, o) => earlierDate(acc, o.date), project.startDate);
  const dueDate = orders.reduce<string | undefined>((acc, o) => laterDate(acc, o.dueDate), project.dueDate);
  return {
    ...project,
    orders,
    client: project.client || order.agency || undefined,
    startDate,
    dueDate,
  };
}

/** 두 프로젝트를 하나로: from 의 문서·매출·메모를 into 에 합침. 결과는 합쳐진 into. */
export function mergeProjects(into: Project, from: Project): Project {
  let merged: Project = { ...into };
  for (const o of from.orders ?? []) merged = attachOrder(merged, o);
  const memo = [into.memo, from.memo ? `[${from.code} ${from.name}] ${from.memo}` : ""].filter(Boolean).join("\n");
  return {
    ...merged,
    revenue: (into.revenue || 0) + (from.revenue || 0),
    assignees: Array.from(new Set([...into.assignees, ...from.assignees])),
    progress: Math.max(into.progress, from.progress),
    client: into.client || from.client,
    startDate: earlierDate(into.startDate, from.startDate),
    dueDate: laterDate(into.dueDate, from.dueDate),
    memo: memo || undefined,
  };
}

/** 문서 내용으로 프로젝트 이름 제안 */
export function suggestProjectName(order: Pick<DeliveryOrder, "site" | "agency" | "items" | "kind" | "projectName">) {
  if (order.projectName?.trim()) return order.projectName.trim();
  const site = (order.site ?? "").trim();
  const agency = (order.agency ?? "").trim();
  const firstItem = order.items[0]?.name?.trim();
  const base = site || agency || "납품 프로젝트";
  return firstItem && !base.includes(firstItem) ? `${base} ${firstItem} 납품` : `${base} 납품`;
}

/** 문서 품목별 누적 납품 수량 */
export function deliveredQtys(order: DeliveryOrder) {
  const out = order.items.map(() => 0);
  for (const sh of order.shipments ?? []) sh.qtys.forEach((q, i) => { if (i < out.length) out[i] += q || 0; });
  return out;
}

/** 문서 품목별 잔여 수량 (음수는 0) */
export function remainingQtys(order: DeliveryOrder) {
  const done = deliveredQtys(order);
  return order.items.map((it, i) => Math.max(0, (it.qty || 0) - done[i]));
}

/** 프로젝트 전체 납품 진행률(%) = 납품 수량 / 요구 수량 */
export function deliveryProgress(project: Pick<Project, "orders">) {
  let total = 0;
  let done = 0;
  for (const o of project.orders ?? []) {
    total += o.items.reduce((s, it) => s + (it.qty || 0), 0);
    done += deliveredQtys(o).reduce((s, q) => s + q, 0);
  }
  return total ? Math.min(100, Math.round((done / total) * 100)) : null;
}
