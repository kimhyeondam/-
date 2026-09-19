import type { QuoteStatus } from "@/data/sample";

export const quoteStatuses: QuoteStatus[] = ["작성중", "발송완료", "수락", "거절", "만료"];

export const quoteStatusBadge: Record<QuoteStatus, string> = {
  작성중: "bg-slate-100 text-slate-600 border-slate-200",
  발송완료: "bg-sky-50 text-sky-700 border-sky-200",
  수락: "bg-green-50 text-green-700 border-green-200",
  거절: "bg-red-50 text-red-600 border-red-200",
  만료: "bg-amber-50 text-amber-700 border-amber-200",
};

export const units = ["EA", "본", "개", "세트", "㎡", "m", "톤", "식"];
