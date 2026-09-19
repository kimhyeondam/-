import type { ProjectType, ProjectStatus } from "@/data/sample";

export const projectTypes: ProjectType[] = ["관급", "민간", "내부"];
export const projectStatuses: ProjectStatus[] = ["진행예정", "진행중", "완료", "보류", "취소"];

export const statusBadge: Record<ProjectStatus, string> = {
  진행예정: "border-line text-slate-600 bg-white",
  진행중: "border-primary bg-primary text-white",
  완료: "border-slate-200 bg-slate-100 text-slate-600",
  보류: "border-amber-200 bg-amber-50 text-amber-700",
  취소: "border-slate-200 bg-slate-50 text-slate-400 line-through",
};

export const statusHint: Record<ProjectStatus, string> = {
  진행예정: "시작 전",
  진행중: "실행 단계에 있는 프로젝트",
  완료: "마무리된 프로젝트",
  보류: "잠시 멈춘 프로젝트",
  취소: "중단된 프로젝트",
};

export function formatWon(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}
