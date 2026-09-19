"use client";

import { useState } from "react";
import type { BusinessCard, CardSource } from "@/data/sample";

export type CardInput = Omit<BusinessCard, "id" | "createdAt">;

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

export default function CardForm({ initial, owners, onSubmit, onCancel }: { initial?: BusinessCard; owners?: { id: string; name: string }[]; onSubmit: (data: CardInput) => void; onCancel: () => void }) {
  const [form, setForm] = useState<CardInput>({
    ownerId: initial?.ownerId,
    ownerName: initial?.ownerName,
    name: initial?.name ?? "",
    company: initial?.company ?? "",
    title: initial?.title ?? "",
    phone: initial?.phone ?? "",
    mobile: initial?.mobile ?? "",
    email: initial?.email ?? "",
    address: initial?.address ?? "",
    source: initial?.source ?? "수기",
    memo: initial?.memo ?? "",
  });
  const set = (k: keyof CardInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim() || !form.company.trim()) return;
          const clean = (v?: string) => v?.trim() || undefined;
          onSubmit({ name: form.name.trim(), company: form.company.trim(), title: clean(form.title), phone: clean(form.phone), mobile: clean(form.mobile), email: clean(form.email), address: clean(form.address), source: form.source, memo: clean(form.memo) });
        }}
        className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-slate-800">{initial ? "명함 수정" : "명함 추가"}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm"><span className="text-slate-600">이름 *</span><input autoFocus value={form.name} onChange={set("name")} className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">회사명 *</span><input value={form.company} onChange={set("company")} className={inputCls} placeholder="예) ○○건설" /></label>
          {owners && (
            <label className="block text-sm sm:col-span-2"><span className="text-slate-600">담당자 <span className="text-slate-400">(이 명함을 받은 직원. 직원은 자기 담당 명함만 봅니다)</span></span>
              <select value={form.ownerId ?? ""} onChange={(e) => { const o = owners.find((x) => x.id === e.target.value); setForm({ ...form, ownerId: o?.id, ownerName: o?.name }); }} className={inputCls}>
                <option value="">미지정 (관리자만 봄)</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
          )}
          <label className="block text-sm"><span className="text-slate-600">직책</span><input value={form.title} onChange={set("title")} className={inputCls} placeholder="예) 현장소장" /></label>
          <label className="block text-sm"><span className="text-slate-600">이메일</span><input type="email" value={form.email} onChange={set("email")} className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">휴대전화</span><input value={form.mobile} onChange={set("mobile")} className={inputCls} placeholder="010-0000-0000" /></label>
          <label className="block text-sm"><span className="text-slate-600">회사 전화</span><input value={form.phone} onChange={set("phone")} className={inputCls} placeholder="02-000-0000" /></label>
          <label className="block text-sm sm:col-span-2"><span className="text-slate-600">주소</span><input value={form.address} onChange={set("address")} className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">등록 방법</span>
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as CardSource })} className={inputCls}>
              <option value="수기">수기 입력</option>
              <option value="스캔">스캔 (사진 인식, 준비 중)</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2"><span className="text-slate-600">메모</span><textarea value={form.memo} onChange={set("memo")} rows={2} className={inputCls} placeholder="만난 자리, 담당 업무 등" /></label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
          <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark px-5 py-2 text-sm font-semibold text-white">{initial ? "저장" : "등록"}</button>
        </div>
      </form>
    </div>
  );
}
