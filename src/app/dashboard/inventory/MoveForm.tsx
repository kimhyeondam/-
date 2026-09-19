"use client";

import { useState } from "react";
import type { Product, StockMoveType } from "@/data/sample";
import { manualMoveTypes, moveTypeMeta } from "./inventoryMeta";

export interface MoveInput { productId: string; type: StockMoveType; qty: number; date: string; memo?: string }

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

/** 반품·폐기·조정처럼 손으로 넣는 입출고 */
export default function MoveForm({ products, product, stock, today, onSubmit, onCancel }: { products: Product[]; product?: Product; stock: Map<string, number>; today: string; onSubmit: (d: MoveInput) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ productId: product?.id ?? products[0]?.id ?? "", type: "재고조정" as StockMoveType, qty: 0, date: today, memo: "" });
  const currentQty = stock.get(form.productId) ?? 0;
  const meta = moveTypeMeta[form.type];
  // 재고조정은 "실제 수량"을 입력받아 차이를 계산, 나머지는 수량 그대로
  const signed = form.type === "재고조정" ? Number(form.qty) - currentQty : meta.sign * Math.abs(Number(form.qty));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (!form.productId || !form.date || signed === 0) return; onSubmit({ productId: form.productId, type: form.type, qty: signed, date: form.date, memo: form.memo.trim() || undefined }); }}
        className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-line shadow-2xl p-5 sm:p-6 space-y-4"
      >
        <h2 className="text-lg font-bold text-slate-800">입출고 등록</h2>
        <p className="text-xs text-slate-500">생산 입고는 <b>생산일보</b>에서, 출하는 <b>매출관리(거래명세표)</b>에서 자동으로 반영됩니다. 여기서는 반품·폐기·실사 조정만 넣습니다.</p>
        <label className="block text-sm"><span className="text-slate-600">품목</span>
          <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className={inputCls} disabled={!!product}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.spec ? ` (${p.spec})` : ""}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-1 rounded-full border border-line p-1 w-fit">
          {manualMoveTypes.map((t) => (
            <button key={t} type="button" onClick={() => setForm({ ...form, type: t })} className={`rounded-full px-3 py-1.5 text-sm ${form.type === t ? "bg-primary text-white font-semibold" : "text-slate-600 hover:bg-primary-soft"}`}>{t}</button>
          ))}
        </div>
        <div className="text-xs text-slate-500">{meta.hint}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm"><span className="text-slate-600">{form.type === "재고조정" ? "실제 수량 (실사)" : "수량"}</span><input type="number" min={0} value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} className={inputCls} required /></label>
          <label className="block text-sm"><span className="text-slate-600">날짜</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} required /></label>
        </div>
        <div className="rounded-xl bg-background px-4 py-3 text-sm text-slate-700">
          현재 {currentQty.toLocaleString("ko-KR")} → <b>{(currentQty + signed).toLocaleString("ko-KR")}</b> <span className={`ml-1 text-xs ${signed >= 0 ? "text-green-700" : "text-red-600"}`}>({signed >= 0 ? "+" : ""}{signed.toLocaleString("ko-KR")})</span>
        </div>
        <label className="block text-sm"><span className="text-slate-600">메모</span><input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="예) 9월 실사, ○○현장 반품" className={inputCls} /></label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">취소</button>
          <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2">등록</button>
        </div>
      </form>
    </div>
  );
}
