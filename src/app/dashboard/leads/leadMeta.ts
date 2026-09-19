import type { LeadSource, LeadStatus } from "@/data/sample";

export const leadSources: LeadSource[] = ["전화", "홈페이지", "소개", "입찰공고", "현장방문", "기타"];
export const leadStatuses: LeadStatus[] = ["신규", "상담중", "견적발송", "계약완료", "실패", "보류"];

export const leadStatusBadge: Record<LeadStatus, string> = {
  신규: "bg-sky-50 text-sky-700 border-sky-200",
  상담중: "bg-amber-50 text-amber-700 border-amber-200",
  견적발송: "bg-purple-50 text-purple-700 border-purple-200",
  계약완료: "bg-green-50 text-green-700 border-green-200",
  실패: "bg-red-50 text-red-600 border-red-200",
  보류: "bg-slate-100 text-slate-500 border-slate-200",
};
