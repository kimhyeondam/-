"use client";

import { useState } from "react";
import type { Customer, Project } from "@/data/sample";

export type CustomerInput = Omit<Customer, "id" | "createdAt">;

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

export default function CustomerForm({
  initial,
  linkedProjects = [],
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Customer;
  linkedProjects?: Project[];
  onSubmit: (data: CustomerInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<CustomerInput>({
    name: initial?.name ?? "",
    ceo: initial?.ceo ?? "",
    bizNo: initial?.bizNo ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    address: initial?.address ?? "",
    memo: initial?.memo ?? "",
    dealer: initial?.dealer ?? false,
  });
  const set = (k: keyof CustomerInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return;
          const clean = (v?: string) => v?.trim() || undefined;
          onSubmit({ name: form.name.trim(), ceo: clean(form.ceo), bizNo: clean(form.bizNo), phone: clean(form.phone), email: clean(form.email), address: clean(form.address), memo: clean(form.memo), dealer: form.dealer || undefined });
        }}
        className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-slate-800">{initial ? "고객 정보" : "고객 등록"}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">고객명(거래처명) *</span>
            <input autoFocus value={form.name} onChange={set("name")} className={inputCls} placeholder="예) ○○건설, □□시청" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">대표자</span>
            <input value={form.ceo} onChange={set("ceo")} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">사업자번호</span>
            <input value={form.bizNo} onChange={set("bizNo")} className={inputCls} placeholder="000-00-00000" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">연락처</span>
            <input value={form.phone} onChange={set("phone")} className={inputCls} placeholder="02-000-0000" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">이메일</span>
            <input type="email" value={form.email} onChange={set("email")} className={inputCls} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">주소</span>
            <input value={form.address} onChange={set("address")} className={inputCls} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">메모</span>
            <textarea value={form.memo} onChange={set("memo")} rows={3} className={inputCls} placeholder="결제 조건, 특이 사항" />
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2 rounded-xl border border-line bg-background p-3">
            <input type="checkbox" checked={!!form.dealer} onChange={(e) => setForm({ ...form, dealer: e.target.checked })} className="mt-0.5 accent-primary" />
            <span><b>대리점</b> <span className="text-slate-500">— 우리 제품을 받아 자기 이름으로 최종 현장에 납품하는 거래처. 이 거래처가 공급자로 적힌 거래송장·명세표 사진을 올리면 사업자번호로 알아보고 매출을 이 거래처 앞으로 잡습니다.</span></span>
          </label>
        </div>

        {initial && (
          <div className="rounded-xl bg-background border border-line p-4 text-sm">
            <div className="font-semibold text-slate-700">연결된 프로젝트 {linkedProjects.length}건</div>
            {linkedProjects.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400">프로젝트관리에서 고객명을 이 이름으로 등록하면 자동으로 연결됩니다.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {linkedProjects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-xs text-slate-600">
                    <span>[{p.code}] {p.name} · {p.status}</span>
                    <span className="tabular-nums">{p.revenue ? `${p.revenue.toLocaleString("ko-KR")}원` : "-"}</span>
                  </li>
                ))}
              </ul>
            )}
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
