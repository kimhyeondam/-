import type { AttendanceStatus } from "@/data/sample";

export const statusMeta: Record<AttendanceStatus, { short: string; cell: string; badge: string; working: boolean }> = {
  출근: { short: "○", cell: "bg-green-50 text-green-700", badge: "bg-green-50 text-green-700 border-green-200", working: true },
  지각: { short: "지", cell: "bg-amber-50 text-amber-700", badge: "bg-amber-50 text-amber-700 border-amber-200", working: true },
  조퇴: { short: "조", cell: "bg-amber-50 text-amber-700", badge: "bg-amber-50 text-amber-700 border-amber-200", working: true },
  반차: { short: "반", cell: "bg-sky-50 text-sky-700", badge: "bg-sky-50 text-sky-700 border-sky-200", working: true },
  외근: { short: "외", cell: "bg-primary-soft text-primary", badge: "bg-primary-soft text-primary border-primary/20", working: true },
  휴가: { short: "휴", cell: "bg-blue-50 text-blue-700", badge: "bg-blue-50 text-blue-700 border-blue-200", working: false },
  병가: { short: "병", cell: "bg-purple-50 text-purple-700", badge: "bg-purple-50 text-purple-700 border-purple-200", working: false },
  결근: { short: "×", cell: "bg-red-50 text-red-700", badge: "bg-red-50 text-red-700 border-red-200", working: false },
};

/** 칸을 짧게 톡톡 누를 때 바뀌는 순서 */
export const tapCycle: (AttendanceStatus | null)[] = ["출근", "휴가", "결근", "외근", null];
