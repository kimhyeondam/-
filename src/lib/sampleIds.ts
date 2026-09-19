// 예시 데이터를 구분하기 위한 표: 컬렉션 이름 → 예시 배열. id 가 여기 있는 것만 "예시"로 봅니다.
// 직원이 직접 등록한 항목의 id 는 시각 기반(예: r1789048608560)이라 예시 id(r1, c3 …)와 겹치지 않습니다.
import * as S from "@/data/sample";

export const sampleByCollection: Record<string, { id: string }[]> = {
  tasks: S.tasks, events: S.events, projects: S.projects, customers: S.customers, leads: S.leads, quotations: S.quotations,
  revenues: S.revenues, deposits: S.deposits, resources: S.resources, businessCards: S.businessCards, purchases: S.purchases,
  meetings: S.meetings, documents: S.formDocs, suggestions: S.suggestions, contracts: S.contracts, contractTemplates: S.contractTemplates,
  products: S.products, stockMoves: S.stockMoves, productions: S.productions, attendance: S.attendance, materials: S.materials,
  materialMoves: S.materialMoves, dispatches: S.dispatches, vehicles: S.vehicles, qualityTests: S.qualityTests,
  payProfiles: S.payProfiles.map((p) => ({ ...p, id: p.memberId })),
  workers: S.workers,
};

export function sampleIdSet(collection: string): Set<string> {
  return new Set((sampleByCollection[collection] ?? []).map((x) => x.id));
}

/** 목록에서 예시와 직접 입력을 나눕니다 */
export function splitSample<T extends { id?: string; memberId?: string }>(collection: string, list: T[]) {
  const ids = sampleIdSet(collection);
  const key = (x: T) => x.id ?? x.memberId ?? "";
  return { sample: list.filter((x) => ids.has(key(x))), mine: list.filter((x) => !ids.has(key(x))) };
}
