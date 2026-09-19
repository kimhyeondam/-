import type { EventType } from "@/data/sample";

export const eventTypes: EventType[] = ["납품", "회의", "생산", "점검", "기타"];

export const eventMeta: Record<EventType, { chip: string; dot: string }> = {
  납품: { chip: "bg-sky-100 text-sky-800 border-sky-200", dot: "bg-sky-500" },
  회의: { chip: "bg-purple-100 text-purple-800 border-purple-200", dot: "bg-purple-500" },
  생산: { chip: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-500" },
  점검: { chip: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  기타: { chip: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
};
