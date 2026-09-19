"use client";

import { useState } from "react";
import type { Deposit, DepositSource, Revenue } from "@/data/sample";
import { formatWon } from "@/lib/format";

export type DepositInput = Omit<Deposit, "id">;

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const banks = ["국민은행", "농협", "기업은행", "신한은행", "우리은행", "하나은행", "기타"];

export default function DepositForm({
  initial,
  defaultDate,
  revenues,
  remainingOf,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Deposit;
  defaultDate: string;
  revenues: Revenue[];
  remainingOf: (r: Revenue) => number; // 이 입금을 제외한 미수금
  onSubmit: (data: DepositInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<DepositInput>({
    date: initial?.date ?? defaultDate,
    payer: initial?.payer ?? "",
    amount: initial?.amount ?? 0,
    bank: initial?.bank ?? "",
    source: initial?.source ?? "수기",
    revenueId: initial?.revenueId ?? "",
    memo: initial?.memo ?? "",
  });
  const linked = revenues.find((r) => r.id === form.revenueId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.payer.trim() || !form.date || !(Number(form.amount) > 0)) return;
          onSubmit({ ...form, payer: form.payer.trim(), amount: Number(form.amount), bank: form.bank || undefined, revenueId: form.revenueId || undefined, memo: form.memo?.trim() || undefined });
        }}
        className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-slate-800">{initial ? "입금 정보" : "입금 등록"}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-slate-600">입금일 *</span>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">입금자명 *</span>
            <input autoFocus value={form.payer} onChange={(e) => setForm({ ...form, payer: e.target.value })} className={inputCls} placeholder="통장에 찍힌 이름" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">입금액 (원) *</span>
            <input type="number" min={0} step={10000} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className={inputCls} />
            <span className="mt-1 block text-xs text-slate-400">{formatWon(Number(form.amount) || 0)}</span>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">은행</span>
            <select value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} className={inputCls}>
              <option value="">선택 안 함</option>
              {banks.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">출처</span>
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as DepositSource })} className={inputCls}>
              <option value="수기">수기 (직접 입력)</option>
              <option value="자동">자동 (은행 연동, 준비 중)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">매출 연결</span>
            <select value={form.revenueId} onChange={(e) => setForm({ ...form, revenueId: e.target.value })} className={inputCls}>
              <option value="">미연결</option>
              {revenues.map((r) => (
                <option key={r.id} value={r.id}>{r.title} · 미수금 {formatWon(remainingOf(r))}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">메모</span>
            <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} rows={2} className={inputCls} />
          </label>
        </div>

        {linked && (
          <div className="rounded-xl bg-background border border-line p-4 text-xs text-slate-600">
            <b className="text-slate-800">{linked.title}</b> · 청구액 {formatWon(linked.amount)} · 이 입금 전 미수금 {formatWon(remainingOf(linked))}
            {Number(form.amount) > remainingOf(linked) && <div className="mt-1 text-amber-700">입금액이 미수금보다 큽니다. 금액을 확인해 주세요.</div>}
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
