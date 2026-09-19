"use client";

import { useState } from "react";
import type { Event, EventType } from "@/data/sample";
import { useMembers } from "@/lib/useMembers";
import { eventTypes } from "./eventMeta";

export type EventInput = Omit<Event, "id">;

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

export default function EventForm({
  initial,
  defaultDate,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Event;
  defaultDate: string;
  onSubmit: (data: EventInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const members = useMembers();
  const [form, setForm] = useState<EventInput>({
    title: initial?.title ?? "",
    date: initial?.date ?? defaultDate,
    endDate: initial?.endDate ?? "",
    time: initial?.time ?? "",
    endTime: initial?.endTime ?? "",
    type: initial?.type ?? "회의",
    attendees: initial?.attendees ?? [],
    location: initial?.location ?? "",
    memo: initial?.memo ?? "",
  });
  const allDay = !form.time;

  function toggle(name: string) {
    setForm((f) => ({ ...f, attendees: f.attendees.includes(name) ? f.attendees.filter((n) => n !== name) : [...f.attendees, name] }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title.trim() || !form.date) return;
          const endDate = form.endDate && form.endDate > form.date ? form.endDate : undefined;
          onSubmit({
            ...form,
            title: form.title.trim(),
            endDate,
            time: form.time || undefined,
            endTime: form.time && form.endTime ? form.endTime : undefined,
            location: form.location?.trim() || undefined,
            memo: form.memo?.trim() || undefined,
          });
        }}
        className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-slate-800">{initial ? "일정 수정" : "일정 등록"}</h2>

        <label className="block text-sm">
          <span className="text-slate-600">일정명 *</span>
          <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="예) 흄관 D600 납품 (○○지구)" />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-slate-600">시작일 *</span>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">종료일 <span className="text-slate-400">(여러 날이면)</span></span>
            <input type="date" value={form.endDate} min={form.date} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">시작 시간 <span className="text-slate-400">(비우면 종일)</span></span>
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">종료 시간</span>
            <input type="time" value={form.endTime} disabled={allDay} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">종류</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as EventType })} className={inputCls}>
              {eventTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">장소</span>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} placeholder="예) 본사 회의실, ○○지구 현장" />
          </label>
        </div>

        <div className="text-sm">
          <span className="text-slate-600">참석자</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.map((m) => {
              const on = form.attendees.includes(m.name);
              return (
                <button type="button" key={m.id} onClick={() => toggle(m.name)} className={`rounded-full border px-3 py-1.5 text-xs transition ${on ? "bg-primary border-primary text-white" : "border-line text-slate-600 hover:border-primary"}`}>
                  {m.name} <span className={on ? "text-white/70" : "text-slate-400"}>· {m.team}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-slate-600">메모</span>
          <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} rows={3} className={inputCls} placeholder="준비물, 참고 사항" />
        </label>

        <div className="flex items-center justify-between pt-2">
          <div>
            {onDelete && (
              <button type="button" onClick={onDelete} className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">삭제</button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
            <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark px-5 py-2 text-sm font-semibold text-white">{initial ? "저장" : "등록"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
