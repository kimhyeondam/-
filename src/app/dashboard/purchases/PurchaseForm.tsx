"use client";

import { useState } from "react";
import type { Purchase, PurchaseCategory } from "@/data/sample";
import { formatWon } from "@/lib/format";
import { purchaseCategories, purchaseUnits } from "./purchaseMeta";

export type PurchaseInput = Omit<Purchase, "id">;

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

export default function PurchaseForm({
  initial,
  defaultDate,
  suppliers,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Purchase;
  defaultDate: string;
  suppliers: string[];
  onSubmit: (data: PurchaseInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState({
    date: initial?.date ?? defaultDate,
    supplier: initial?.supplier ?? "",
    item: initial?.item ?? "",
    spec: initial?.spec ?? "",
    qty: initial?.qty ?? 0,
    unit: initial?.unit ?? "톤",
    unitPrice: initial?.unitPrice ?? 0,
    supply: initial?.supply ?? 0,
    vatOn: initial ? initial.vat > 0 : true,
    category: initial?.category ?? ("원자재" as PurchaseCategory),
    paid: initial?.paid ?? 0,
    payDue: initial?.payDue ?? "",
    invoice: initial?.invoice ?? true,
    memo: initial?.memo ?? "",
  });
  const vat = form.vatOn ? Math.round(Number(form.supply) * 0.1) : 0;
  const total = Number(form.supply) + vat;

  /** 수량·단가를 넣으면 공급가액을 자동 계산 */
  function setQtyPrice(patch: { qty?: number; unitPrice?: number }) {
    const qty = patch.qty ?? form.qty;
    const unitPrice = patch.unitPrice ?? form.unitPrice;
    const supply = qty && unitPrice ? qty * unitPrice : form.supply;
    setForm({ ...form, qty, unitPrice, supply });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.date || !form.supplier.trim() || !form.item.trim() || !(Number(form.supply) > 0)) return;
          onSubmit({
            date: form.date,
            supplier: form.supplier.trim(),
            item: form.item.trim(),
            spec: form.spec.trim() || undefined,
            qty: Number(form.qty) || undefined,
            unit: Number(form.qty) ? form.unit : undefined,
            unitPrice: Number(form.unitPrice) || undefined,
            supply: Number(form.supply),
            vat,
            category: form.category,
            paid: Math.max(0, Number(form.paid) || 0),
            payDue: form.payDue || undefined,
            invoice: form.invoice,
            memo: form.memo.trim() || undefined,
          });
        }}
        className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-slate-800">{initial ? "매입 정보" : "매입 등록"}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-slate-600">매입일 *</span>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">매입처 *</span>
            <input list="supplier-list" autoFocus value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className={inputCls} placeholder="예) ★★레미콘, 대한철강" />
            <datalist id="supplier-list">{suppliers.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">품목 *</span>
            <input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} className={inputCls} placeholder="예) 시멘트, 골재, 철근, 운반" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">규격</span>
            <input value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} className={inputCls} placeholder="예) 1종 벌크, 25mm 쇄석" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">분류</span>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as PurchaseCategory })} className={inputCls}>
              {purchaseCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <label className="block"><span className="text-slate-600">수량</span><input type="number" min={0} value={form.qty} onChange={(e) => setQtyPrice({ qty: Number(e.target.value) })} className={inputCls} /></label>
            <label className="block"><span className="text-slate-600">단위</span>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls}>{purchaseUnits.map((u) => <option key={u} value={u}>{u}</option>)}</select>
            </label>
            <label className="block"><span className="text-slate-600">단가</span><input type="number" min={0} step="any" value={form.unitPrice} onChange={(e) => setQtyPrice({ unitPrice: Number(e.target.value) })} className={inputCls} /></label>
          </div>
          <label className="block text-sm">
            <span className="text-slate-600">공급가액 (원) * <span className="text-slate-400">수량×단가로 자동 계산, 직접 수정 가능</span></span>
            <input type="number" min={0} step="any" value={form.supply} onChange={(e) => setForm({ ...form, supply: Number(e.target.value) })} className={inputCls} />
          </label>
          <div className="text-sm">
            <span className="text-slate-600">부가세</span>
            <label className="mt-1 flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={form.vatOn} onChange={(e) => setForm({ ...form, vatOn: e.target.checked })} className="accent-primary" />
              <span>10% 별도 ({formatWon(vat)})</span>
            </label>
          </div>
          <div className="sm:col-span-2 rounded-xl bg-background border border-line px-4 py-3 text-sm flex items-center justify-between">
            <span className="text-slate-600">합계 (부가세 포함)</span>
            <b className="text-slate-800 tabular-nums">{formatWon(total)}</b>
          </div>
          <label className="block text-sm">
            <span className="text-slate-600">지급액 (원)</span>
            <input type="number" min={0} step={10000} value={form.paid} onChange={(e) => setForm({ ...form, paid: Number(e.target.value) })} className={inputCls} />
            <span className="mt-1 block text-xs text-slate-400">미지급 {formatWon(Math.max(total - Number(form.paid || 0), 0))}</span>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">지급 예정일</span>
            <input type="date" value={form.payDue} onChange={(e) => setForm({ ...form, payDue: e.target.value })} className={inputCls} />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" checked={form.invoice} onChange={(e) => setForm({ ...form, invoice: e.target.checked })} className="accent-primary" /> 세금계산서를 받았습니다
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">메모</span>
            <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} rows={2} className={inputCls} placeholder="결제 조건, 납품 현장 등" />
          </label>
        </div>

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
