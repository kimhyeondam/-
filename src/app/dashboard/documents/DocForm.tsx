"use client";

import { useState } from "react";
import type { FormDoc, DocType, QuoteItem, Customer, Project, Quotation } from "@/data/sample";
import { docTotal } from "@/lib/documents/calc";
import { formatWon } from "@/lib/format";
import { units } from "../quotes/quoteMeta";

export type DocInput = Omit<FormDoc, "id" | "number" | "createdBy" | "createdAt">;

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const cellCls = "w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-primary";
const emptyItem = (): QuoteItem => ({ name: "", spec: "", unit: "본", qty: 1, unitPrice: 0 });

export default function DocForm({
  initial,
  defaultType,
  defaultDate,
  customers,
  projects,
  quotations,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: FormDoc;
  defaultType: DocType;
  defaultDate: string;
  customers: Customer[];
  projects: Project[];
  quotations: Quotation[];
  onSubmit: (data: DocInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<DocInput>({
    type: initial?.type ?? defaultType,
    date: initial?.date ?? defaultDate,
    customer: initial?.customer ?? "",
    customerRef: initial?.customerRef ?? "",
    project: initial?.project ?? "",
    site: initial?.site ?? "",
    items: initial?.items.length ? initial.items.map((i) => ({ ...i })) : [emptyItem()],
    vatIncluded: initial?.vatIncluded ?? false,
    memo: initial?.memo ?? "",
    validDays: initial?.validDays ?? 30,
    receiver: initial?.receiver ?? "",
    quoteId: initial?.quoteId,
  });

  const setItem = (idx: number, patch: Partial<QuoteItem>) => setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));

  /** 견적관리에 있는 견적을 골라 품목·수신자를 그대로 가져옵니다. */
  function importQuote(id: string) {
    const q = quotations.find((x) => x.id === id);
    if (!q) return;
    setForm((f) => ({ ...f, customer: q.recipient, project: q.project ?? f.project, items: q.items.map((i) => ({ ...i })), quoteId: q.id, memo: f.memo || q.memo || "" }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const items = form.items.filter((i) => i.name.trim()).map((i) => ({ ...i, name: i.name.trim(), spec: i.spec?.trim() || undefined, qty: Number(i.qty) || 0, unitPrice: Number(i.unitPrice) || 0 }));
          if (!form.customer.trim() || !form.date || items.length === 0) return;
          const clean = (v?: string) => v?.trim() || undefined;
          onSubmit({ ...form, customer: form.customer.trim(), customerRef: clean(form.customerRef), project: form.project || undefined, site: clean(form.site), memo: clean(form.memo), receiver: clean(form.receiver), validDays: form.type === "견적서" ? Number(form.validDays) || undefined : undefined, items });
        }}
        className="w-full max-w-4xl rounded-2xl bg-card p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">{initial ? `${initial.type} ${initial.number}` : "문서 작성"}</h2>
          {!initial && (
            <div className="flex rounded-full border border-line p-1">
              {(["견적서", "거래명세표", "납품확인서"] as DocType[]).map((t) => (
                <button type="button" key={t} onClick={() => setForm({ ...form, type: t })} className={`rounded-full px-4 py-1.5 text-sm ${form.type === t ? "bg-primary text-white font-semibold" : "text-slate-600 hover:bg-primary-soft"}`}>{t}</button>
              ))}
            </div>
          )}
        </div>

        {quotations.length > 0 && (
          <label className="block text-sm rounded-xl bg-primary-soft/50 border border-primary/10 px-4 py-3">
            <span className="text-primary font-semibold">견적에서 가져오기</span> <span className="text-xs text-slate-500">— 견적관리의 품목과 수신자를 그대로 채웁니다.</span>
            <select defaultValue="" onChange={(e) => e.target.value && importQuote(e.target.value)} className={inputCls}>
              <option value="">선택 안 함</option>
              {quotations.map((q) => <option key={q.id} value={q.id}>{q.number} · {q.recipient} · {q.items.map((i) => i.name).join(", ")}</option>)}
            </select>
          </label>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block text-sm"><span className="text-slate-600">수신(거래처) *</span>
            <input list="doc-customer-list" autoFocus value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} className={inputCls} placeholder="고객명 입력 또는 선택" />
            <datalist id="doc-customer-list">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          </label>
          <label className="block text-sm"><span className="text-slate-600">담당자/연락처</span><input value={form.customerRef} onChange={(e) => setForm({ ...form, customerRef: e.target.value })} className={inputCls} placeholder="예) 공무부 김현장 부장" /></label>
          <label className="block text-sm"><span className="text-slate-600">일자 *</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">건명(프로젝트)</span>
            <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} className={inputCls}>
              <option value="">선택 안 함</option>
              {projects.map((p) => <option key={p.id} value={p.name}>[{p.code}] {p.name}</option>)}
            </select>
          </label>
          <label className="block text-sm"><span className="text-slate-600">현장(납품 장소)</span><input value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} className={inputCls} /></label>
          {form.type === "견적서" && <label className="block text-sm"><span className="text-slate-600">유효기간(일)</span><input type="number" min={0} value={form.validDays ?? ""} onChange={(e) => setForm({ ...form, validDays: Number(e.target.value) })} className={inputCls} /></label>}
          {form.type === "납품확인서" && <label className="block text-sm"><span className="text-slate-600">인수자</span><input value={form.receiver} onChange={(e) => setForm({ ...form, receiver: e.target.value })} className={inputCls} placeholder="현장에서 서명할 분" /></label>}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">품목 *</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={form.vatIncluded} onChange={(e) => setForm({ ...form, vatIncluded: e.target.checked })} className="accent-primary" /> 단가에 부가세 포함</label>
              <button type="button" onClick={() => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }))} className="text-xs text-primary hover:underline">＋ 품목 추가</button>
            </div>
          </div>
          <div className="mt-2 overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-background text-xs text-slate-500">
                <tr><th className="px-2 py-2 text-left font-medium w-[26%]">품명</th><th className="px-2 py-2 text-left font-medium w-[24%]">규격</th><th className="px-2 py-2 text-left font-medium w-[10%]">단위</th><th className="px-2 py-2 text-right font-medium w-[10%]">수량</th><th className="px-2 py-2 text-right font-medium w-[14%]">단가</th><th className="px-2 py-2 text-right font-medium w-[12%]">금액</th><th className="w-8" /></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {form.items.map((it, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5"><input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} className={cellCls} placeholder="예) 흄관" /></td>
                    <td className="px-2 py-1.5"><input value={it.spec ?? ""} onChange={(e) => setItem(i, { spec: e.target.value })} className={cellCls} placeholder="예) D600 × 2.5m" /></td>
                    <td className="px-2 py-1.5"><select value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} className={cellCls}>{units.map((u) => <option key={u} value={u}>{u}</option>)}</select></td>
                    <td className="px-2 py-1.5"><input type="number" min={0} value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} className={`${cellCls} text-right`} /></td>
                    <td className="px-2 py-1.5"><input type="number" min={0} step="any" value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })} className={`${cellCls} text-right`} /></td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{(it.qty * it.unitPrice).toLocaleString("ko-KR")}</td>
                    <td className="px-1 text-center"><button type="button" onClick={() => setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, j) => j !== i) : f.items }))} className="text-slate-400 hover:text-red-600">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-right text-sm text-slate-700">합계 <b className="tabular-nums">{formatWon(docTotal(form))}</b> <span className="text-xs text-slate-400">({form.vatIncluded ? "부가세 포함" : "부가세 별도, 부가세 10% 자동 계산"})</span></div>
        </div>

        <label className="block text-sm"><span className="text-slate-600">비고</span><textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} rows={2} className={inputCls} placeholder="결제 조건, 납기, 운반비 포함 여부 등" /></label>

        <div className="flex items-center justify-between pt-2">
          <div>{onDelete && <button type="button" onClick={onDelete} className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">삭제</button>}</div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
            <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark px-5 py-2 text-sm font-semibold text-white">{initial ? "저장" : "만들기"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
