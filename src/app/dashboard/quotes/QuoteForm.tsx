"use client";

import { useState } from "react";
import { quoteSupply, quoteVat, quoteTotal, type Quotation, type QuoteItem, type QuoteStatus, type Customer, type Project } from "@/data/sample";
import { formatWon } from "@/lib/format";
import { quoteStatuses, units } from "./quoteMeta";

export type QuoteInput = Omit<Quotation, "id" | "number">;

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const cellCls = "w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-primary";
const emptyItem = (): QuoteItem => ({ name: "", spec: "", unit: "개", qty: 1, unitPrice: 0 });

export default function QuoteForm({
  initial,
  defaultDate,
  customers,
  projects,
  onSubmit,
  onCancel,
  onDelete,
  onConvert,
  convertedAlready = false,
}: {
  initial?: Quotation;
  defaultDate: string;
  customers: Customer[];
  projects: Project[];
  onSubmit: (data: QuoteInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onConvert?: () => void;
  convertedAlready?: boolean;
}) {
  const [form, setForm] = useState<QuoteInput>({
    recipient: initial?.recipient ?? "",
    date: initial?.date ?? defaultDate,
    validUntil: initial?.validUntil ?? "",
    items: initial?.items.length ? initial.items.map((i) => ({ ...i })) : [emptyItem()],
    status: initial?.status ?? "작성중",
    project: initial?.project ?? "",
    memo: initial?.memo ?? "",
  });

  const setItem = (idx: number, patch: Partial<QuoteItem>) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (idx: number) => setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : f.items }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const items = form.items.filter((i) => i.name.trim()).map((i) => ({ ...i, name: i.name.trim(), spec: i.spec?.trim() || undefined, qty: Number(i.qty) || 0, unitPrice: Number(i.unitPrice) || 0 }));
          if (!form.recipient.trim() || !form.date || items.length === 0) return;
          onSubmit({ ...form, recipient: form.recipient.trim(), validUntil: form.validUntil || undefined, project: form.project || undefined, memo: form.memo?.trim() || undefined, items });
        }}
        className="w-full max-w-4xl rounded-2xl bg-card p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-slate-800">{initial ? `견적 ${initial.number}` : "견적 등록"}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block text-sm">
            <span className="text-slate-600">수신자(거래처) *</span>
            <input list="customer-list" autoFocus value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} className={inputCls} placeholder="고객명 입력 또는 선택" />
            <datalist id="customer-list">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">견적일 *</span>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">유효기간</span>
            <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">상태</span>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as QuoteStatus })} className={inputCls}>
              {quoteStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">연결 프로젝트</span>
            <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} className={inputCls}>
              <option value="">프로젝트 미연결</option>
              {projects.map((p) => <option key={p.id} value={p.name}>[{p.code}] {p.name}</option>)}
            </select>
          </label>
        </div>

        {/* 품목 표 */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">품목 *</span>
            <button type="button" onClick={addItem} className="text-xs text-primary hover:underline">＋ 품목 추가</button>
          </div>
          <div className="mt-2 overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-background text-xs text-slate-500">
                <tr>
                  <th className="px-2 py-2 text-left font-medium w-[26%]">품명</th>
                  <th className="px-2 py-2 text-left font-medium w-[22%]">규격</th>
                  <th className="px-2 py-2 text-left font-medium w-[10%]">단위</th>
                  <th className="px-2 py-2 text-right font-medium w-[10%]">수량</th>
                  <th className="px-2 py-2 text-right font-medium w-[14%]">단가</th>
                  <th className="px-2 py-2 text-right font-medium w-[14%]">금액</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {form.items.map((it, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5"><input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} className={cellCls} placeholder="예) 흄관" /></td>
                    <td className="px-2 py-1.5"><input value={it.spec ?? ""} onChange={(e) => setItem(i, { spec: e.target.value })} className={cellCls} placeholder="예) D600 × 2.5m" /></td>
                    <td className="px-2 py-1.5">
                      <select value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} className={cellCls}>
                        {units.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5"><input type="number" min={0} value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} className={`${cellCls} text-right`} /></td>
                    <td className="px-2 py-1.5"><input type="number" min={0} step="any" value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })} className={`${cellCls} text-right`} /></td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{(it.qty * it.unitPrice).toLocaleString("ko-KR")}</td>
                    <td className="px-1 text-center"><button type="button" onClick={() => removeItem(i)} className="text-slate-400 hover:text-red-600" title="삭제">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 ml-auto w-full sm:w-80 space-y-1 text-sm">
            <div className="flex justify-between text-slate-600"><span>공급가액</span><span className="tabular-nums">{formatWon(quoteSupply(form))}</span></div>
            <div className="flex justify-between text-slate-600"><span>부가세 (10%)</span><span className="tabular-nums">{formatWon(quoteVat(form))}</span></div>
            <div className="flex justify-between font-bold text-slate-800 border-t border-line pt-1"><span>합계금액</span><span className="tabular-nums">{formatWon(quoteTotal(form))}</span></div>
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-slate-600">메모</span>
          <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} rows={2} className={inputCls} placeholder="결제 조건, 납품 조건, 특이 사항" />
        </label>

        {initial && onConvert && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-green-800">매출로 전환</div>
              <p className="text-xs text-green-700 mt-0.5">
                {convertedAlready ? "이미 이 견적으로 만든 매출이 있습니다." : "고객이 수락한 견적을 매출관리에 청구 건으로 등록합니다. 상태가 '수락'으로 바뀝니다."}
              </p>
            </div>
            <button type="button" disabled={convertedAlready} onClick={onConvert} className="shrink-0 rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2">전환하기</button>
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
