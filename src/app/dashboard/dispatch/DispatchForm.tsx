"use client";

import { useState } from "react";
import type { Dispatch, QuoteItem, Revenue, Vehicle } from "@/data/sample";
import { units } from "../quotes/quoteMeta";

export type DispatchInput = Omit<Dispatch, "id" | "token" | "status" | "log" | "photos" | "createdAt" | "createdBy">;

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const cellCls = "w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-primary";

export default function DispatchForm({ initial, fromRevenue, revenues, vehicles, today, onSubmit, onCancel }: { initial?: Dispatch; fromRevenue?: Revenue; revenues: Revenue[]; vehicles: Vehicle[]; today: string; onSubmit: (d: DispatchInput) => void; onCancel: () => void }) {
  const src = initial ?? (fromRevenue ? { date: fromRevenue.date ?? today, revenueId: fromRevenue.id, docNumber: fromRevenue.docNumber, customer: fromRevenue.customer ?? "", site: fromRevenue.site, items: fromRevenue.items ?? [], memo: fromRevenue.memo } : undefined);
  const [form, setForm] = useState({
    date: src?.date ?? today,
    revenueId: src?.revenueId ?? "",
    docNumber: src?.docNumber ?? "",
    customer: src?.customer ?? "",
    site: src?.site ?? "",
    address: (src as Dispatch | undefined)?.address ?? "",
    contact: (src as Dispatch | undefined)?.contact ?? "",
    vehicleId: vehicles.find((v) => initial && initial.vehicle.startsWith(v.plate))?.id ?? "",
    vehicle: initial?.vehicle ?? "",
    driver: initial?.driver ?? "",
    driverPhone: initial?.driverPhone ?? "",
    own: initial?.own ?? true,
    carrier: initial?.carrier ?? (initial ? (initial.own ? "자차" : "용차") : "자차"),
    memo: src?.memo ?? "",
  });
  const [items, setItems] = useState<QuoteItem[]>(src?.items?.length ? src.items.map((i) => ({ ...i })) : [{ name: "", spec: "", unit: "본", qty: 0, unitPrice: 0 }]);
  const setItem = (i: number, patch: Partial<QuoteItem>) => setItems((prev) => prev.map((it, k) => (k === i ? { ...it, ...patch } : it)));

  function pickVehicle(id: string) {
    const v = vehicles.find((x) => x.id === id);
    if (v) setForm({ ...form, vehicleId: id, vehicle: `${v.plate}${v.name ? ` · ${v.name}` : ""}`, driver: v.driver ?? form.driver, driverPhone: v.driverPhone ?? form.driverPhone, own: v.own, carrier: v.own ? "자차" : "용차" });
    else setForm({ ...form, vehicleId: "" });
  }
  function pickRevenue(id: string) {
    const r = revenues.find((x) => x.id === id);
    if (!r) { setForm({ ...form, revenueId: "" }); return; }
    setForm({ ...form, revenueId: r.id, docNumber: r.docNumber ?? "", customer: r.customer ?? form.customer, site: r.site ?? form.site, date: r.date ?? form.date });
    if (r.items?.length) setItems(r.items.map((i) => ({ ...i })));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const clean = items.filter((i) => i.name.trim() && i.qty > 0);
          if (!form.customer.trim() || !form.vehicle.trim() || !form.driver.trim() || clean.length === 0) { alert("거래처, 차량, 기사, 품목(수량)을 채워 주세요."); return; }
          onSubmit({ date: form.date, revenueId: form.revenueId || undefined, docNumber: form.docNumber || undefined, customer: form.customer.trim(), site: form.site.trim() || undefined, address: form.address.trim() || undefined, contact: form.contact.trim() || undefined, items: clean, vehicle: form.vehicle.trim(), driver: form.driver.trim(), driverPhone: form.driverPhone.trim() || undefined, own: form.carrier === "자차", carrier: form.carrier, memo: form.memo.trim() || undefined });
        }}
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-line shadow-2xl p-5 sm:p-6 space-y-4"
      >
        <h2 className="text-lg font-bold text-slate-800">{initial ? "배차 수정" : "배차 등록"}</h2>
        {!initial && (
          <label className="block text-sm"><span className="text-slate-600">매출(거래명세표)에서 가져오기</span>
            <select value={form.revenueId} onChange={(e) => pickRevenue(e.target.value)} className={inputCls}>
              <option value="">직접 입력</option>
              {revenues.filter((r) => r.items?.length).slice(0, 60).map((r) => <option key={r.id} value={r.id}>{r.date ?? "날짜미정"} · {r.customer ?? ""} · {r.title}{r.docNumber ? ` (${r.docNumber})` : ""}</option>)}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm"><span className="text-slate-600">납품일 *</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} required /></label>
          <label className="block text-sm"><span className="text-slate-600">거래처 *</span><input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} className={inputCls} required /></label>
          <label className="block text-sm"><span className="text-slate-600">현장명</span><input value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} className={inputCls} placeholder="예) ○○지구 우수관로" /></label>
          <label className="block text-sm"><span className="text-slate-600">현장 주소</span><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} /></label>
          <label className="block text-sm col-span-2"><span className="text-slate-600">현장 담당자 연락처</span><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className={inputCls} placeholder="예) 김반장 010-0000-0000" /></label>
        </div>

        <div className="rounded-xl border border-line bg-background p-3 space-y-2">
          <div className="text-sm font-semibold text-slate-800">차량·기사</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm col-span-2"><span className="text-slate-600">등록 차량에서 고르기</span>
              <select value={form.vehicleId} onChange={(e) => pickVehicle(e.target.value)} className={inputCls}>
                <option value="">직접 입력</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}{v.name ? ` · ${v.name}` : ""}{v.driver ? ` · ${v.driver}` : ""}{v.own ? "" : " (용차)"}</option>)}
              </select>
            </label>
            <label className="block text-sm"><span className="text-slate-600">차량 *</span><input value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} className={inputCls} placeholder="차량번호 · 차종" required /></label>
            <label className="block text-sm"><span className="text-slate-600">기사 *</span><input value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })} className={inputCls} required /></label>
            <label className="block text-sm"><span className="text-slate-600">기사 휴대폰</span><input value={form.driverPhone} onChange={(e) => setForm({ ...form, driverPhone: e.target.value })} className={inputCls} placeholder="문자 링크 발송용" /></label>
            <label className="block text-sm"><span className="text-slate-600">누구 차</span>
              <select value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value as "자차" | "용차" | "거래처차량", own: e.target.value === "자차" })} className={inputCls}><option value="자차">우리 차(자차)</option><option value="용차">용차(외주)</option><option value="거래처차량">거래처 차량</option></select>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-background p-3">
          <div className="flex items-center justify-between"><div className="text-sm font-semibold text-slate-800">싣는 품목</div><button type="button" onClick={() => setItems((p) => [...p, { name: "", spec: "", unit: "본", qty: 0, unitPrice: 0 }])} className="text-xs text-primary hover:underline">＋ 품목 추가</button></div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead><tr className="text-left text-xs text-slate-500"><th className="px-2 py-1">품명</th><th className="px-2 py-1">규격</th><th className="px-2 py-1 w-20">단위</th><th className="px-2 py-1 w-24 text-right">수량</th><th className="w-8"></th></tr></thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1"><input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} className={cellCls} /></td>
                    <td className="px-2 py-1"><input value={it.spec ?? ""} onChange={(e) => setItem(i, { spec: e.target.value })} className={cellCls} /></td>
                    <td className="px-2 py-1"><select value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} className={cellCls}>{units.map((u) => <option key={u}>{u}</option>)}</select></td>
                    <td className="px-2 py-1"><input type="number" min={0} value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} className={`${cellCls} text-right`} /></td>
                    <td className="px-1 py-1 text-center"><button type="button" onClick={() => setItems((p) => p.filter((_, k) => k !== i))} className="text-slate-400 hover:text-red-600">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <label className="block text-sm"><span className="text-slate-600">기사님께 전할 메모</span><input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className={inputCls} placeholder="예) 크레인 하차, 현장 진입로 좁음, 오전 중 도착" /></label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">취소</button>
          <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2">{initial ? "저장" : "배차 등록"}</button>
        </div>
      </form>
    </div>
  );
}
