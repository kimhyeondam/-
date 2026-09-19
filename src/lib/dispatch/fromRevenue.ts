// 매출의 납품 방법(delivery) → 배차 만들기·맞추기
import type { Dispatch, Revenue } from "@/data/sample";
import { newId, nowIso } from "@/lib/ids";

export function makeToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function carrierOf(d: Dispatch) {
  return d.carrier ?? (d.own ? "자차" : "용차");
}

/** 매출 내용으로 배차를 새로 만듭니다 (거래처 차량이면 차량·기사는 비어 있을 수 있음) */
export function dispatchFromRevenue(rev: Revenue, by?: string): Dispatch | null {
  const dv = rev.delivery;
  if (!dv || dv.mode === "미정") return null;
  return {
    id: newId("dp"), token: makeToken(), date: rev.date ?? nowIso().slice(0, 10), revenueId: rev.id, docNumber: rev.docNumber,
    customer: rev.customer ?? "(거래처 미지정)", site: rev.site, items: (rev.items ?? []).map((i) => ({ ...i })),
    vehicle: dv.vehicle?.trim() || (dv.mode === "거래처차량" ? "거래처 차량" : "(차량 미정)"), driver: dv.driver?.trim() || (dv.mode === "거래처차량" ? "거래처 기사" : "(기사 미정)"), driverPhone: dv.driverPhone?.trim() || undefined,
    own: dv.mode === "자차", carrier: dv.mode, status: "대기", log: [{ status: "대기", at: nowIso(), by }], photos: [], memo: dv.memo?.trim() || rev.memo, createdBy: by, createdAt: nowIso(),
  };
}

/** 이미 있는 배차를 매출의 최신 내용으로 맞춥니다 (상태·사진·기록은 그대로) */
export function syncDispatchWithRevenue(d: Dispatch, rev: Revenue): Dispatch {
  const dv = rev.delivery;
  if (!dv || dv.mode === "미정") return d;
  return {
    ...d, date: rev.date ?? d.date, docNumber: rev.docNumber ?? d.docNumber, customer: rev.customer ?? d.customer, site: rev.site ?? d.site, items: rev.items?.length ? rev.items.map((i) => ({ ...i })) : d.items,
    vehicle: dv.vehicle?.trim() || d.vehicle, driver: dv.driver?.trim() || d.driver, driverPhone: dv.driverPhone?.trim() || d.driverPhone, own: dv.mode === "자차", carrier: dv.mode, memo: dv.memo?.trim() || d.memo,
  };
}
