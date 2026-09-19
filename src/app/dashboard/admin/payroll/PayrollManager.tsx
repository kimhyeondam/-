"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { useMembers } from "@/lib/useMembers";
import { attendance as initialAttendance, payProfiles as initialProfiles, type Attendance, type PayProfile, type PayType } from "@/data/sample";
import { todayIso, formatWon } from "@/lib/format";
import { hourlyOf, payrollFor } from "@/lib/payroll/calc";

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
function shiftMonth(month: string, n: number) { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

export default function PayrollManager({ initialMonth }: { initialMonth?: string } = {}) {
  const [profiles, setProfiles, loaded, loadError] = useServerState<PayProfile[]>("payProfiles", initialProfiles);
  const [attendance] = useServerState<Attendance[]>("attendance", initialAttendance);
  const members = useMembers();
  const [today] = useState(todayIso);
  const [month, setMonth] = useState(initialMonth ?? today.slice(0, 7));
  const [editing, setEditing] = useState<{ memberId: string; name: string } | null>(null);

  const rows = useMemo(() => payrollFor(month, profiles, attendance, members), [month, profiles, attendance, members]);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const overtime = rows.reduce((s, r) => s + r.overtimePay, 0);
  const missing = rows.filter((r) => r.note).length;
  const monthLabel = `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;

  function saveProfile(p: PayProfile) { setProfiles((prev) => [...prev.filter((x) => x.memberId !== p.memberId), p]); setEditing(null); }

  return (
    <>
      <PageHeader
        title="급여 집계"
        description="출근부의 출근일·연장시간에 급여 기준을 곱한 집계표입니다. 4대보험·소득세는 세무사에게 넘길 때 이 표를 기준으로 하면 됩니다."
        action={<button onClick={() => window.print()} className="rounded-full border border-line bg-white text-slate-700 text-sm font-semibold px-4 py-2.5 hover:border-primary hover:text-primary transition">인쇄 / PDF 저장</button>}
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 print:hidden">
        <StatCard label={`${Number(month.slice(5, 7))}월 급여 합계`} value={formatWon(total)} sub="기본급+연장+수당−공제" icon="₩" />
        <StatCard label="연장근무 수당" value={formatWon(overtime)} sub={`${rows.reduce((s, r) => s + r.overtimeHours, 0)}시간`} icon="◷" tone="amber" />
        <StatCard label="출근 연일수" value={`${rows.reduce((s, r) => s + r.workDays, 0)}일`} sub="반차는 0.5일" icon="○" tone="green" />
        <StatCard label="기준 미설정" value={<span className={missing ? "text-red-600" : ""}>{missing}명</span>} sub="이름을 눌러 급여 기준 입력" icon="!" />
      </div>
      <Card className="p-4 flex flex-wrap items-center gap-3 print:hidden">
        <div className="inline-flex items-center rounded-full border border-line overflow-hidden">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="px-3 py-1.5 text-slate-600 hover:bg-primary-soft">‹</button>
          <button onClick={() => setMonth(today.slice(0, 7))} className="px-3 py-1.5 text-sm font-semibold text-slate-700 border-x border-line">이번 달</button>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="px-3 py-1.5 text-slate-600 hover:bg-primary-soft">›</button>
        </div>
        <span className="font-bold text-slate-800">{monthLabel}</span>
        <Link href={`/dashboard/attendance?month=${month}`} className="ml-auto text-sm text-primary hover:underline">출근부 보기 →</Link>
      </Card>
      <Card className="overflow-x-auto">
        <div className="hidden print:block px-5 pt-4 text-lg font-bold">{monthLabel} 급여 집계표</div>
        <table className="w-full text-sm min-w-[980px]">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-line"><th className="px-5 py-3 font-medium">직원</th><th className="px-3 py-3 font-medium">구분</th><th className="px-3 py-3 font-medium text-right">출근</th><th className="px-3 py-3 font-medium text-right">결근</th><th className="px-3 py-3 font-medium text-right">휴가</th><th className="px-3 py-3 font-medium text-right">연장(h)</th><th className="px-3 py-3 font-medium text-right">기본급</th><th className="px-3 py-3 font-medium text-right">연장수당</th><th className="px-3 py-3 font-medium text-right">수당</th><th className="px-3 py-3 font-medium text-right">공제</th><th className="px-3 pr-5 py-3 font-medium text-right">지급액</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.memberId} className={`hover:bg-primary-soft/30 ${r.note ? "bg-amber-50/40" : ""}`}>
                <td className="px-5 py-3 whitespace-nowrap"><button onClick={() => setEditing({ memberId: r.memberId, name: r.name })} className="font-medium text-slate-800 hover:text-primary">{r.name}</button>{r.note && <div className="text-[11px] text-amber-700">{r.note}</div>}</td>
                <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{r.note ? "-" : r.payType}</td>
                <td className="px-3 py-3 text-right tabular-nums">{r.workDays}</td>
                <td className={`px-3 py-3 text-right tabular-nums ${r.absentDays ? "text-red-600" : "text-slate-400"}`}>{r.absentDays}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-600">{r.leaveDays}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-600">{r.overtimeHours || "-"}</td>
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{r.basePay.toLocaleString("ko-KR")}</td>
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{r.overtimePay ? r.overtimePay.toLocaleString("ko-KR") : "-"}</td>
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{r.allowances ? r.allowances.toLocaleString("ko-KR") : "-"}</td>
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap text-red-600">{r.absentDeduction + r.deductions ? `-${(r.absentDeduction + r.deductions).toLocaleString("ko-KR")}` : "-"}</td>
                <td className="px-3 pr-5 py-3 text-right tabular-nums font-semibold text-slate-800 whitespace-nowrap">{r.total.toLocaleString("ko-KR")}원</td>
              </tr>
            ))}
            <tr className="bg-background font-semibold"><td className="px-5 py-3" colSpan={6}>합계</td><td className="px-3 py-3 text-right tabular-nums">{rows.reduce((s, r) => s + r.basePay, 0).toLocaleString("ko-KR")}</td><td className="px-3 py-3 text-right tabular-nums">{overtime.toLocaleString("ko-KR")}</td><td className="px-3 py-3 text-right tabular-nums">{rows.reduce((s, r) => s + r.allowances, 0).toLocaleString("ko-KR")}</td><td className="px-3 py-3 text-right tabular-nums text-red-600">-{rows.reduce((s, r) => s + r.absentDeduction + r.deductions, 0).toLocaleString("ko-KR")}</td><td className="px-3 pr-5 py-3 text-right tabular-nums">{total.toLocaleString("ko-KR")}원</td></tr>
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-400 print:hidden">연장수당 = 연장시간 × 시급 × 배율(기본 1.5). 시급은 월급÷209시간, 일급÷8시간으로 잡습니다. 월급제 결근은 월급÷기준일수(기본 22일)만큼 뺍니다. 직원 이름을 누르면 기준을 바꿀 수 있습니다.</p>
      </>)}
      {editing && <ProfileForm memberId={editing.memberId} name={editing.name} initial={profiles.find((p) => p.memberId === editing.memberId)} onSubmit={saveProfile} onCancel={() => setEditing(null)} />}
    </>
  );
}

function ProfileForm({ memberId, name, initial, onSubmit, onCancel }: { memberId: string; name: string; initial?: PayProfile; onSubmit: (p: PayProfile) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ payType: initial?.payType ?? ("월급" as PayType), basePay: initial?.basePay ?? 0, hourlyForOvertime: initial?.hourlyForOvertime ?? 0, overtimeRate: initial?.overtimeRate ?? 1.5, standardDays: initial?.standardDays ?? 22, memo: initial?.memo ?? "" });
  const [allow, setAllow] = useState(initial?.allowances ?? [{ name: "식대", amount: 0 }]);
  const [deduct, setDeduct] = useState(initial?.deductions ?? []);
  const preview: PayProfile = { memberId, name, payType: form.payType, basePay: Number(form.basePay) || 0, hourlyForOvertime: Number(form.hourlyForOvertime) || undefined };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); onSubmit({ memberId, name, payType: form.payType, basePay: Number(form.basePay) || 0, hourlyForOvertime: Number(form.hourlyForOvertime) || undefined, overtimeRate: Number(form.overtimeRate) || 1.5, standardDays: Number(form.standardDays) || 22, allowances: allow.filter((a) => a.name.trim() && a.amount > 0), deductions: deduct.filter((a) => a.name.trim() && a.amount > 0), memo: form.memo.trim() || undefined }); }} className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-line shadow-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">{name} 급여 기준</h2>
        <div className="flex gap-1 rounded-full border border-line p-1 w-fit">{(["월급", "일급", "시급"] as PayType[]).map((t) => <button key={t} type="button" onClick={() => setForm({ ...form, payType: t })} className={`rounded-full px-4 py-1.5 text-sm ${form.payType === t ? "bg-primary text-white font-semibold" : "text-slate-600 hover:bg-primary-soft"}`}>{t}제</button>)}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm"><span className="text-slate-600">{form.payType === "월급" ? "월 기본급" : form.payType === "일급" ? "일급" : "시급"} (원)</span><input type="number" min={0} step="any" value={form.basePay} onChange={(e) => setForm({ ...form, basePay: Number(e.target.value) })} className={inputCls} required /></label>
          <label className="block text-sm"><span className="text-slate-600">연장 시급 (비우면 자동)</span><input type="number" min={0} step="any" value={form.hourlyForOvertime || ""} placeholder={`${hourlyOf(preview).toLocaleString("ko-KR")}원`} onChange={(e) => setForm({ ...form, hourlyForOvertime: Number(e.target.value) })} className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">연장 배율</span><input type="number" min={1} step={0.1} value={form.overtimeRate} onChange={(e) => setForm({ ...form, overtimeRate: Number(e.target.value) })} className={inputCls} /></label>
          {form.payType === "월급" && <label className="block text-sm"><span className="text-slate-600">결근 공제 기준일수</span><input type="number" min={1} value={form.standardDays} onChange={(e) => setForm({ ...form, standardDays: Number(e.target.value) })} className={inputCls} /></label>}
        </div>
        <ItemList title="고정 수당 (식대·교통비 등)" items={allow} onChange={setAllow} />
        <ItemList title="고정 공제 (가불·기숙사비 등)" items={deduct} onChange={setDeduct} />
        <label className="block text-sm"><span className="text-slate-600">메모</span><input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className={inputCls} /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">취소</button><button type="submit" className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2">저장</button></div>
      </form>
    </div>
  );
}

function ItemList({ title, items, onChange }: { title: string; items: { name: string; amount: number }[]; onChange: (v: { name: string; amount: number }[]) => void }) {
  return (
    <div className="rounded-xl border border-line bg-background p-3">
      <div className="flex items-center justify-between"><span className="text-sm text-slate-700">{title}</span><button type="button" onClick={() => onChange([...items, { name: "", amount: 0 }])} className="text-xs text-primary hover:underline">＋ 추가</button></div>
      {items.map((it, i) => (
        <div key={i} className="mt-2 flex items-center gap-2">
          <input value={it.name} onChange={(e) => onChange(items.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} placeholder="이름" className="flex-1 rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-primary" />
          <input type="number" min={0} step="any" value={it.amount} onChange={(e) => onChange(items.map((x, k) => (k === i ? { ...x, amount: Number(e.target.value) } : x)))} className="w-32 rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-right outline-none focus:border-primary" />
          <button type="button" onClick={() => onChange(items.filter((_, k) => k !== i))} className="text-slate-400 hover:text-red-600">×</button>
        </div>
      ))}
    </div>
  );
}
