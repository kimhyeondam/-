import type { TaskStatus, Priority } from "@/data/sample";

export const statusOrder: TaskStatus[] = ["backlog", "todo", "doing", "done", "cancelled"];

export const statusMeta: Record<TaskStatus, { label: string; badge: string; hint: string }> = {
  backlog: { label: "백로그", badge: "border-slate-300 text-slate-500 bg-white", hint: "아이디어 단계" },
  todo: { label: "할 일", badge: "border-amber-300 text-amber-700 bg-amber-50", hint: "착수 대기" },
  doing: { label: "진행중", badge: "border-sky-300 text-sky-700 bg-sky-50", hint: "" },
  done: { label: "완료", badge: "border-green-300 text-green-700 bg-green-50", hint: "누적 완료" },
  cancelled: { label: "취소", badge: "border-slate-200 text-slate-400 bg-slate-50 line-through", hint: "중단/취소" },
};

export const priorityMeta: Record<Priority, { label: string; badge: string }> = {
  high: { label: "높음", badge: "bg-red-50 text-red-600" },
  medium: { label: "보통", badge: "bg-sky-50 text-sky-700" },
  low: { label: "낮음", badge: "bg-slate-100 text-slate-500" },
};
