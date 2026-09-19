"use client";

import { useMemo, useState } from "react";
import type { Contract, ContractTemplate, Customer, CompanyProfile } from "@/data/sample";
import { fillTemplate } from "@/lib/contracts/fill";
import { todayIso, formatWon } from "@/lib/format";

export type ContractInput = Omit<Contract, "id" | "createdBy" | "createdAt" | "status" | "signToken" | "signedAt" | "signerName" | "signature" | "sentAt">;
const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

export default function ContractForm({ initial, templates, customers, company, onSubmit, onCancel }: { initial?: Contract; templates: ContractTemplate[]; customers: Customer[]; company: CompanyProfile; onSubmit: (d: ContractInput) => void; onCancel: () => void }) {
  const [templateId, setTemplateId] = useState(initial?.templateId ?? templates[0]?.id ?? "");
  const [f, setF] = useState({
    title: initial?.title ?? "",
    customer: initial?.customer ?? "",
    customerEmail: initial?.customerEmail ?? "",
    customerRef: initial?.customerRef ?? "",
    amount: initial?.amount ?? 0,
    startDate: initial?.startDate ?? "",
    endDate: initial?.endDate ?? "",
    items: initial?.items ?? "",
    special: "",
    date: todayIso(),
    memo: initial?.memo ?? "",
  });
  const [body, setBody] = useState(initial?.body ?? "");
  const [manual, setManual] = useState(!!initial); // 본문을 직접 고친 뒤에는 자동 생성으로 덮지 않음

  const generated = useMemo(() => {
    const t = templates.find((x) => x.id === templateId);
    return t ? fillTemplate(t.body, { customer: f.customer, customerRef: f.customerRef, amount: Number(f.amount) || 0, startDate: f.startDate, endDate: f.endDate, items: f.items, special: f.special, date: f.date }, company) : "";
  }, [templates, templateId, f, company]);
  const shownBody = manual ? body : generated;

  function pickCustomer(name: string) {
    const c = customers.find((x) => x.name === name);
    setF({ ...f, customer: name, customerEmail: c?.email ?? f.customerEmail, customerRef: f.customerRef || (c?.ceo && c.ceo !== "-" ? `${c.ceo} 대표` : "") });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.customer.trim() || !shownBody.trim()) return;
          const t = templates.find((x) => x.id === templateId);
          onSubmit({ title: f.title.trim() || `${f.customer} ${t?.name ?? "계약서"}`, customer: f.customer.trim(), customerEmail: f.customerEmail.trim() || undefined, customerRef: f.customerRef.trim() || undefined, templateId: templateId || undefined, body: shownBody, amount: Number(f.amount) || 0, startDate: f.startDate || undefined, endDate: f.endDate || undefined, items: f.items.trim() || undefined, memo: f.memo.trim() || undefined });
        }}
        className="w-full max-w-5xl rounded-2xl bg-card p-6 shadow-xl max-h-[92vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-slate-800">{initial ? "계약 수정" : "계약 작성"}</h2>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          <div className="space-y-3">
            <label className="block text-sm"><span className="text-slate-600">템플릿</span>
              <select value={templateId} onChange={(e) => { setTemplateId(e.target.value); setManual(false); }} className={inputCls}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </label>
            <label className="block text-sm"><span className="text-slate-600">고객(을) *</span>
              <input list="ct-customers" value={f.customer} onChange={(e) => pickCustomer(e.target.value)} className={inputCls} placeholder="고객명 입력 또는 선택" />
              <datalist id="ct-customers">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm"><span className="text-slate-600">상대 담당자</span><input value={f.customerRef} onChange={(e) => setF({ ...f, customerRef: e.target.value })} className={inputCls} placeholder="예) 오건설 대표" /></label>
              <label className="block text-sm"><span className="text-slate-600">서명 받을 이메일</span><input type="email" value={f.customerEmail} onChange={(e) => setF({ ...f, customerEmail: e.target.value })} className={inputCls} /></label>
            </div>
            <label className="block text-sm"><span className="text-slate-600">계약 제목 <span className="text-slate-400">(비우면 자동)</span></span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inputCls} placeholder={`${f.customer || "○○건설"} ${templates.find((t) => t.id === templateId)?.name ?? "계약서"}`} /></label>
            <label className="block text-sm"><span className="text-slate-600">계약금액 (원, 부가세 포함)</span><input type="number" min={0} step={10000} value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} className={inputCls} /><span className="text-xs text-slate-400">{formatWon(Number(f.amount) || 0)}</span></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm"><span className="text-slate-600">시작일</span><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">종료일</span><input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} className={inputCls} /></label>
            </div>
            <label className="block text-sm"><span className="text-slate-600">품목</span><input value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })} className={inputCls} placeholder="예) 흄관 D600 400본, D800 120본" /></label>
            <label className="block text-sm"><span className="text-slate-600">특약사항</span><textarea value={f.special} onChange={(e) => setF({ ...f, special: e.target.value })} rows={2} className={inputCls} placeholder="예) 운반비 별도, 야간 하차 불가" /></label>
            <label className="block text-sm"><span className="text-slate-600">계약일</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={inputCls} /></label>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">계약서 본문 {manual ? <span className="text-amber-700 text-xs">(직접 수정 중)</span> : <span className="text-slate-400 text-xs">(왼쪽 입력에 따라 자동 생성)</span>}</span>
              {manual ? <button type="button" onClick={() => setManual(false)} className="text-xs text-primary hover:underline">자동 생성으로 되돌리기</button> : <button type="button" onClick={() => { setBody(generated); setManual(true); }} className="text-xs text-primary hover:underline">본문 직접 수정</button>}
            </div>
            <textarea value={shownBody} readOnly={!manual} onChange={(e) => setBody(e.target.value)} className={`${inputCls} flex-1 min-h-[520px] font-mono text-[12.5px] leading-relaxed ${manual ? "" : "bg-slate-50"}`} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
          <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark px-5 py-2 text-sm font-semibold text-white">{initial ? "저장" : "작성중으로 저장"}</button>
        </div>
      </form>
    </div>
  );
}
