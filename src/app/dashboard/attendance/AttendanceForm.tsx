"use client";

import { useState } from "react";
import { attendanceStatuses, type Attendance, type AttendanceStatus } from "@/data/sample";
import { statusMeta } from "./attendanceMeta";

export interface AttendanceInput { status: AttendanceStatus; checkIn?: string; checkOut?: string; overtime?: number; memo?: string }

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

export default function AttendanceForm({ name, date, initial, onSubmit, onClear, onCancel }: { name: string; date: string; initial?: Attendance; onSubmit: (d: AttendanceInput) => void; onClear: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ status: initial?.status ?? ("출근" as AttendanceStatus), checkIn: initial?.checkIn ?? "", checkOut: initial?.checkOut ?? "", overtime: initial?.overtime ?? 0, memo: initial?.memo ?? "" });
  const working = statusMeta[form.status].working;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); onSubmit({ status: form.status, checkIn: working && form.checkIn ? form.checkIn : undefined, checkOut: working && form.checkOut ? form.checkOut : undefined, overtime: working ? Number(form.overtime) || undefined : undefined, memo: form.memo.trim() || undefined }); }}
        className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-line shadow-2xl p-5 sm:p-6 space-y-4"
      >
        <div>
          <h2 className="text-lg font-bold text-slate-800">{name}</h2>
          <div className="text-sm text-slate-500">{date}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {attendanceStatuses.map((s) => (
            <button key={s} type="button" onClick={() => setForm({ ...form, status: s })} className={`rounded-full border px-3 py-1.5 text-sm transition ${form.status === s ? "border-primary bg-primary text-white font-semibold" : `${statusMeta[s].badge} hover:border-primary`}`}>{s}</button>
          ))}
        </div>
        {working && (
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm"><span className="text-slate-600">출근</span><input type="time" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} className={inputCls} /></label>
            <label className="block text-sm"><span className="text-slate-600">퇴근</span><input type="time" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} className={inputCls} /></label>
            <label className="block text-sm"><span className="text-slate-600">연장(시간)</span><input type="number" min={0} step={0.5} value={form.overtime} onChange={(e) => setForm({ ...form, overtime: Number(e.target.value) })} className={inputCls} /></label>
          </div>
        )}
        <label className="block text-sm"><span className="text-slate-600">메모</span><input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="예) ○○현장 외근, 병원" className={inputCls} /></label>
        <div className="flex items-center justify-between pt-1">
          <div>{initial && <button type="button" onClick={onClear} className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">기록 지우기</button>}</div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">취소</button>
            <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2">저장</button>
          </div>
        </div>
      </form>
    </div>
  );
}
