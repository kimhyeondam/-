// 급여 집계 규칙 (출근부 × 급여 기준). 4대보험·소득세는 세무사 몫이라 여기서는 계산하지 않습니다.
import type { Attendance, PayProfile } from "@/data/sample";

const WORKING = new Set(["출근", "지각", "조퇴", "반차", "외근"]);

export interface PayrollRow {
  memberId: string;
  name: string;
  payType: PayProfile["payType"];
  workDays: number; // 출근일 (반차는 0.5)
  absentDays: number;
  leaveDays: number; // 휴가·병가
  overtimeHours: number;
  basePay: number; // 기본급 (월급 / 일급×일수 / 시급×시간)
  overtimePay: number;
  absentDeduction: number; // 월급제 결근 공제
  allowances: number;
  deductions: number;
  total: number;
  hourly: number; // 연장 시급 기준
  note?: string;
}

export function hourlyOf(p: PayProfile) {
  if (p.hourlyForOvertime) return p.hourlyForOvertime;
  if (p.payType === "월급") return Math.round(p.basePay / 209); // 주 40시간 기준 월 소정근로 209시간
  if (p.payType === "일급") return Math.round(p.basePay / 8);
  return p.basePay;
}

export function payrollFor(month: string, profiles: PayProfile[], attendance: Attendance[], members: { id: string; name: string }[]): PayrollRow[] {
  const inMonth = attendance.filter((a) => a.date.startsWith(month));
  return members.map((m) => {
    const p = profiles.find((x) => x.memberId === m.id);
    const recs = inMonth.filter((a) => a.memberId === m.id);
    const workDays = recs.reduce((s, a) => s + (a.status === "반차" ? 0.5 : WORKING.has(a.status) ? 1 : 0), 0);
    const absentDays = recs.filter((a) => a.status === "결근").length;
    const leaveDays = recs.filter((a) => a.status === "휴가" || a.status === "병가").length;
    const overtimeHours = recs.reduce((s, a) => s + (a.overtime ?? 0), 0);
    if (!p) return { memberId: m.id, name: m.name, payType: "월급" as const, workDays, absentDays, leaveDays, overtimeHours, basePay: 0, overtimePay: 0, absentDeduction: 0, allowances: 0, deductions: 0, total: 0, hourly: 0, note: "급여 기준 미설정" };
    const hourly = hourlyOf(p);
    const rate = p.overtimeRate ?? 1.5;
    const overtimePay = Math.round(overtimeHours * hourly * rate);
    let basePay = 0;
    let absentDeduction = 0;
    if (p.payType === "월급") {
      basePay = p.basePay;
      const std = p.standardDays ?? 22;
      absentDeduction = Math.round((p.basePay / std) * absentDays);
    } else if (p.payType === "일급") {
      basePay = Math.round(p.basePay * workDays);
    } else {
      // 시급제: 출퇴근 시간이 있으면 그 시간(점심 1시간 제외), 없으면 8시간으로
      const hours = recs.reduce((s, a) => {
        if (!WORKING.has(a.status)) return s;
        if (a.checkIn && a.checkOut) { const [h1, m1] = a.checkIn.split(":").map(Number); const [h2, m2] = a.checkOut.split(":").map(Number); return s + Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60 - 1); }
        return s + (a.status === "반차" ? 4 : 8);
      }, 0);
      basePay = Math.round(p.basePay * hours);
    }
    const allowances = (p.allowances ?? []).reduce((s, a) => s + a.amount, 0);
    const deductions = (p.deductions ?? []).reduce((s, a) => s + a.amount, 0);
    const total = basePay + overtimePay + allowances - absentDeduction - deductions;
    return { memberId: m.id, name: m.name, payType: p.payType, workDays, absentDays, leaveDays, overtimeHours, basePay, overtimePay, absentDeduction, allowances, deductions, total, hourly };
  });
}
