"use client";

import { useState } from "react";
import type { Lead, LeadStatus } from "@/data/sample";
import { useMembers } from "@/lib/useMembers";
import { leadSources, leadStatuses } from "./leadMeta";

export type LeadInput = Omit<Lead, "id" | "createdAt">;

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

export default function LeadForm({
  initial,
  alreadyCustomer = false,
  onSubmit,
  onCancel,
  onDelete,
  onConvert,
}: {
  initial?: Lead;
  alreadyCustomer?: boolean;
  onSubmit: (data: LeadInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onConvert?: () => void;
}) {
  const members = useMembers();
  const [form, setForm] = useState<LeadInput>({
    company: initial?.company ?? "",
    contact: initial?.contact ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    source: initial?.source ?? "전화",
    status: initial?.status ?? "신규",
    assignee: initial?.assignee ?? "",
    product: initial?.product ?? "",
    memo: initial?.memo ?? "",
  });
  const set = (k: keyof LeadInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.company.trim() || !form.contact.trim()) return;
          const clean = (v?: string) => v?.trim() || undefined;
          onSubmit({ ...form, company: form.company.trim(), contact: form.contact.trim(), phone: clean(form.phone), email: clean(form.email), assignee: clean(form.assignee), product: clean(form.product), memo: clean(form.memo) });
        }}
        className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-slate-800">{initial ? "리드 정보" : "리드 등록"}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-slate-600">회사명 *</span>
            <input autoFocus value={form.company} onChange={set("company")} className={inputCls} placeholder="예) ●●종합건설" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">담당자 *</span>
            <input value={form.contact} onChange={set("contact")} className={inputCls} placeholder="상대 회사 담당자 이름" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">연락처</span>
            <input value={form.phone} onChange={set("phone")} className={inputCls} placeholder="010-0000-0000" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">이메일</span>
            <input type="email" value={form.email} onChange={set("email")} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">유입경로</span>
            <select value={form.source} onChange={set("source")} className={inputCls}>
              {leadSources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">상태</span>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })} className={inputCls}>
              {leadStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">담당직원</span>
            <select value={form.assignee} onChange={set("assignee")} className={inputCls}>
              <option value="">미배정</option>
              {members.map((m) => <option key={m.id} value={m.name}>{m.name} · {m.team}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">관심 제품</span>
            <input value={form.product} onChange={set("product")} className={inputCls} placeholder="예) 흄관 D600, 경계석" />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">메모</span>
            <textarea value={form.memo} onChange={set("memo")} rows={3} className={inputCls} placeholder="문의 내용, 상담 기록" />
          </label>
        </div>

        {initial && onConvert && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-green-800">고객으로 전환</div>
              <p className="text-xs text-green-700 mt-0.5">
                {alreadyCustomer ? "이미 같은 이름의 고객이 등록되어 있습니다." : "이 회사를 고객관리에 등록하고 상태를 '계약완료'로 바꿉니다."}
              </p>
            </div>
            <button type="button" disabled={alreadyCustomer} onClick={onConvert} className="shrink-0 rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2">
              전환하기
            </button>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div>{onDelete && <button type="button" onClick={onDelete} className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">삭제</button>}</div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
            <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark px-5 py-2 text-sm font-semibold text-white">{initial ? "저장" : "등록"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
