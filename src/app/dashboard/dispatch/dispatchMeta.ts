import type { DispatchStatus } from "@/data/sample";

export const statusBadge: Record<DispatchStatus, string> = {
  대기: "bg-slate-100 text-slate-600 border-slate-200",
  상차완료: "bg-amber-50 text-amber-700 border-amber-200",
  출발: "bg-sky-50 text-sky-700 border-sky-200",
  도착: "bg-primary-soft text-primary border-primary/20",
  인수완료: "bg-green-50 text-green-700 border-green-200",
  취소: "bg-red-50 text-red-600 border-red-200",
};

export function deliverUrl(token: string) {
  if (typeof window === "undefined") return `/deliver/${token}`;
  return `${window.location.origin}/deliver/${token}`;
}

/** 기사님에게 보낼 문자 본문 */
export function smsBody(company: string, d: { customer: string; site?: string; date: string; items: { name: string; qty: number; unit: string }[] }, url: string) {
  const items = d.items.map((i) => `${i.name} ${i.qty}${i.unit}`).join(", ");
  return `[${company}] ${d.date} 납품 배차\n${d.customer}${d.site ? ` · ${d.site}` : ""}\n${items}\n아래 링크에서 상차/도착 버튼과 사진을 올려 주세요.\n${url}`;
}

/** 휴대폰 문자 앱 열기 링크 (아이폰은 &body, 안드로이드는 ?body) */
export function smsHref(phone: string | undefined, body: string) {
  const num = (phone ?? "").replace(/[^\d]/g, "");
  const ios = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);
  return `sms:${num}${ios ? "&" : "?"}body=${encodeURIComponent(body)}`;
}
