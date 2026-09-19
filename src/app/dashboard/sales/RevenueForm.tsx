"use client";

import { useState } from "react";
import type { Revenue, Customer, Project, QuoteItem, FormDoc } from "@/data/sample";
import { formatWon, todayIso } from "@/lib/format";
import { docTotal, docVat } from "@/lib/documents/calc";
import { cleanItems } from "@/lib/sales/revenueDoc";
import { priceFor } from "@/lib/sales/pricing";
import ProductPicker from "@/components/ProductPicker";
import { matchProduct } from "@/lib/inventory/stock";
import { useServerState } from "@/lib/useServerState";
import { products as initialProducts, vehicles as initialVehicles, deliveryModeLabel, type Product, type Vehicle, type DeliveryMode } from "@/data/sample";
import { units } from "../quotes/quoteMeta";

export type RevenueInput = Omit<Revenue, "id">;

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const cellCls = "w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-primary";
const emptyItem = (): QuoteItem => ({ name: "", spec: "", unit: "EA", qty: 1, unitPrice: 0 });

export default function RevenueForm({
  initial,
  linkedDoc,
  customers,
  projects,
  paid = 0,
  onSubmit,
  onCancel,
  onDelete,
  onOpenDoc,
  onDownloadDoc,
  onIssueDoc,
  onCopyEntax,
}: {
  initial?: Revenue;
  linkedDoc?: FormDoc;
  customers: Customer[];
  projects: Project[];
  paid?: number;
  onSubmit: (data: RevenueInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onOpenDoc?: (doc: FormDoc) => void;
  onDownloadDoc?: (doc: FormDoc) => void;
  onIssueDoc?: () => void;
  onCopyEntax?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [products] = useServerState<Product[]>("products", initialProducts);
  const [vehicles] = useServerState<Vehicle[]>("vehicles", initialVehicles);
  const [priceHint, setPriceHint] = useState<string | null>(null);
  const [form, setForm] = useState<RevenueInput>(() => ({
    title: initial?.title ?? "",
    // 새로 등록할 때는 오늘 날짜가 기본, 수정할 때는 저장된 날짜(날짜 미정이면 빈칸)
    date: initial ? initial.date ?? "" : todayIso(),
    delivery: initial?.delivery,
    customer: initial?.customer ?? "",
    project: initial?.project ?? "",
    site: initial?.site ?? "",
    amount: initial?.amount ?? 0,
    quoteId: initial?.quoteId,
    memo: initial?.memo ?? "",
    items: initial?.items?.length ? initial.items.map((i) => ({ ...i })) : [emptyItem()],
    vatIncluded: initial?.vatIncluded ?? false,
    docId: initial?.docId,
    docNumber: initial?.docNumber,
  }));
  const dv = form.delivery ?? { mode: "미정" as DeliveryMode };
  const setDv = (patch: Partial<typeof dv>) => setForm((f) => ({ ...f, delivery: { ...(f.delivery ?? { mode: "미정" as DeliveryMode }), ...patch } }));
  function pickVehicle(id: string) {
    const v = vehicles.find((x) => x.id === id);
    if (v) setDv({ vehicleId: id, vehicle: `${v.plate}${v.name ? ` · ${v.name}` : ""}`, driver: v.driver ?? "", driverPhone: v.driverPhone ?? "" });
    else setDv({ vehicleId: undefined });
  }
  const [undated, setUndated] = useState(!initial?.date && !!initial);
  // 품목 없이 금액만 적는 예전 방식 (선급금·정산 차액 등 품목이 없는 청구용)
  const [manual, setManual] = useState(!!initial && !initial.items?.length);

  const items = cleanItems(form.items);
  const total = manual ? Math.max(0, Number(form.amount) || 0) : docTotal({ items, vatIncluded: !!form.vatIncluded });
  const vat = manual ? 0 : docVat({ items, vatIncluded: !!form.vatIncluded });
  const setItem = (idx: number, patch: Partial<QuoteItem>) => setForm((f) => ({ ...f, items: (f.items ?? []).map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  /** 품명 칸에서 손을 떼면 단가표(기준 단가 × 거래처 적용률)로 단가·단위를 채웁니다. 이미 단가가 있으면 그대로 둡니다 */
  function autoPrice(idx: number, force = false) {
    const it = form.items?.[idx];
    if (!it?.name.trim()) return;
    const hit = priceFor(products, customers, form.customer, it.name, it.spec);
    if (!hit) {
      const p = matchProduct(products, it.name, it.spec);
      if (p && !force) setItem(idx, { unit: p.unit, spec: it.spec || p.spec || "" });
      return;
    }
    if (!force && it.unitPrice > 0) return;
    setItem(idx, { unitPrice: hit.price, unit: hit.product.unit, name: it.name });
    setPriceHint(`「${hit.product.name}」 단가표 ${hit.product.basePrice?.toLocaleString("ko-KR")}원 × ${hit.rate}% = ${hit.price.toLocaleString("ko-KR")}원을 넣었습니다.`);
    setTimeout(() => setPriceHint(null), 5000);
  }
  /** 검색 목록에서 품목을 고르면 품명·규격·단위를 채우고, 단가표가 있으면 단가까지 넣습니다 */
  function pickForRow(idx: number, p: Product) {
    const hit = priceFor(products, customers, form.customer, p.name, p.spec);
    setItem(idx, { name: p.name, spec: p.spec ?? "", unit: p.unit, unitPrice: hit ? hit.price : (form.items?.[idx]?.unitPrice ?? 0) });
    if (hit) { setPriceHint(`「${p.name}」 단가표 ${p.basePrice?.toLocaleString("ko-KR")}원 × ${hit.rate}% = ${hit.price.toLocaleString("ko-KR")}원`); setTimeout(() => setPriceHint(null), 5000); }
  }
  /** 거래처를 바꾸면 단가표에 있는 품목의 단가를 새 적용률로 다시 계산 */
  function repriceAll() {
    (form.items ?? []).forEach((_, i) => autoPrice(i, true));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title.trim()) { setError("매출명을 적어 주세요."); return; }
          if (!undated && !form.date) { setError("매출일을 고르거나 「아직 날짜가 정해지지 않았습니다」에 표시해 주세요."); return; }
          if (!manual && items.length === 0) { setError("품목을 하나 이상 넣어 주세요."); return; }
          if (manual && total <= 0) { setError("금액을 적어 주세요."); return; }
          if (!manual && total <= 0 && !items.some((i) => i.qty > 0)) { setError("수량을 하나 이상 넣어 주세요. (단가는 나중에 넣어도 됩니다)"); return; }
          setError(null);
          onSubmit({
            ...form,
            title: form.title.trim(),
            date: undated ? undefined : form.date,
            customer: form.customer?.trim() || undefined,
            project: form.project || undefined,
            site: form.site?.trim() || undefined,
            amount: total,
            memo: form.memo?.trim() || undefined,
            items: manual ? undefined : items,
            vatIncluded: manual ? undefined : !!form.vatIncluded,
            delivery: dv.mode === "미정" && !dv.dispatchId ? undefined : { ...dv, vehicle: dv.vehicle?.trim() || undefined, driver: dv.driver?.trim() || undefined, driverPhone: dv.driverPhone?.trim() || undefined, memo: dv.memo?.trim() || undefined },
          });
        }}
        className="w-full max-w-4xl rounded-2xl bg-card p-5 md:p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-800">{initial ? "매출 정보" : "매출 등록"}</h2>
          {initial?.docNumber && linkedDoc ? (
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              거래명세표 <b className="text-slate-700">{initial.docNumber}</b>
              {onOpenDoc && <button type="button" onClick={() => onOpenDoc(linkedDoc)} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-700 hover:border-primary hover:text-primary">PDF 보기·인쇄</button>}
              {onDownloadDoc && <button type="button" onClick={() => onDownloadDoc(linkedDoc)} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-700 hover:border-primary hover:text-primary">내려받기</button>}
            </span>
          ) : initial && initial.items?.length && onIssueDoc ? (
            <button type="button" onClick={onIssueDoc} className="rounded-full border border-primary/40 bg-white px-3 py-1 text-xs text-primary hover:bg-primary-soft">이 내용으로 거래명세표 발행</button>
          ) : (
            !manual && <span className="text-xs text-slate-500">저장하면 거래명세표가 자동으로 만들어집니다</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">매출명 *</span>
            <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="예) ○○지구 흄관 1차 납품" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">매출일 {undated ? "(날짜 미정)" : "*"}</span>
            <input type="date" disabled={undated} value={form.date ?? ""} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`} />
            <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={undated} onChange={(e) => setUndated(e.target.checked)} className="accent-primary" /> 아직 날짜가 정해지지 않았습니다</label>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">고객(거래처)</span>
            <input list="rev-customer-list" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} onBlur={() => { if ((form.items ?? []).some((it) => it.unitPrice > 0)) return; repriceAll(); }} className={inputCls} placeholder="고객명 입력 또는 선택" />
            <datalist id="rev-customer-list">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">프로젝트</span>
            <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} className={inputCls}>
              <option value="">프로젝트 미연결</option>
              {projects.map((p) => <option key={p.id} value={p.name}>[{p.code}] {p.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">납품 장소(현장)</span>
            <input value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} className={inputCls} placeholder="예) 고흥 농공단지 현장" />
          </label>
        </div>

        <div className="rounded-xl border border-line bg-background p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">납품 방법</span>
            <div className="flex flex-wrap gap-1 rounded-full border border-line bg-white p-1">
              {(["자차", "용차", "거래처차량", "미정"] as DeliveryMode[]).map((m) => (
                <button key={m} type="button" onClick={() => { if (m !== dv.mode) setDv({ mode: m, vehicleId: undefined, vehicle: "", driver: "", driverPhone: "" }); }} className={`rounded-full px-3 py-1 text-xs ${dv.mode === m ? "bg-primary text-white font-semibold" : "text-slate-600 hover:bg-primary-soft"}`}>{deliveryModeLabel[m]}</button>
              ))}
            </div>
            {dv.dispatchId && <span className="text-xs text-primary">배차 연결됨</span>}
          </div>
          {dv.mode !== "미정" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {dv.mode !== "거래처차량" && (
                <label className="block text-xs sm:col-span-4"><span className="text-slate-600">등록 차량에서 고르기</span>
                  <select value={dv.vehicleId ?? ""} onChange={(e) => pickVehicle(e.target.value)} className={inputCls}>
                    <option value="">직접 입력</option>
                    {vehicles.filter((v) => (dv.mode === "자차" ? v.own : !v.own)).map((v) => <option key={v.id} value={v.id}>{v.plate}{v.name ? ` · ${v.name}` : ""}{v.driver ? ` · ${v.driver}` : ""}</option>)}
                  </select>
                </label>
              )}
              <label className="block text-xs sm:col-span-2"><span className="text-slate-600">차량{dv.mode === "거래처차량" ? " (거래처가 알려준 번호, 몰라도 됨)" : ""}</span><input value={dv.vehicle ?? ""} onChange={(e) => setDv({ vehicle: e.target.value })} className={inputCls} placeholder="차량번호 · 차종" /></label>
              <label className="block text-xs"><span className="text-slate-600">기사</span><input value={dv.driver ?? ""} onChange={(e) => setDv({ driver: e.target.value })} className={inputCls} /></label>
              <label className="block text-xs"><span className="text-slate-600">기사 휴대폰</span><input value={dv.driverPhone ?? ""} onChange={(e) => setDv({ driverPhone: e.target.value })} className={inputCls} placeholder="링크 문자용" /></label>
              <label className="block text-xs sm:col-span-4"><span className="text-slate-600">기사님께 전할 메모</span><input value={dv.memo ?? ""} onChange={(e) => setDv({ memo: e.target.value })} className={inputCls} placeholder="예) 크레인 하차, 오전 중 도착" /></label>
            </div>
          )}
          <p className="text-[11px] text-slate-400">{dv.mode === "미정" ? "나중에 정해지면 여기서 고르거나 배차·출고 화면에서 만들면 됩니다." : dv.mode === "거래처차량" ? "저장하면 배차·출고에 「거래처 차량」으로 기록됩니다. 기사 휴대폰을 넣으면 상차 사진 링크를 보낼 수 있습니다." : "저장하면 배차·출고에 배차가 만들어지고 기사님 링크(문자·QR)를 보낼 수 있습니다."}</p>
        </div>

        <div className="rounded-xl border border-line bg-background p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-slate-700">품목 <span className="text-xs font-normal text-slate-400">(수량 × 단가로 금액이 자동 계산됩니다)</span></span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} className="accent-primary" /> 품목 없이 금액만 입력</label>
              {!manual && <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={!!form.vatIncluded} onChange={(e) => setForm({ ...form, vatIncluded: e.target.checked })} className="accent-primary" /> 단가에 부가세 포함</label>}
              {!manual && <button type="button" onClick={repriceAll} title="거래처 적용률로 모든 품목 단가를 단가표 기준으로 다시 넣습니다" className="text-xs text-slate-500 hover:text-primary">단가표로 채우기</button>}
              {!manual && <button type="button" onClick={() => setForm((f) => ({ ...f, items: [...(f.items ?? []), emptyItem()] }))} className="text-xs text-primary hover:underline">＋ 품목 추가</button>}
            </div>
          </div>
          {manual ? (
            <label className="block text-sm max-w-xs">
              <span className="text-slate-600">금액 (원, 부가세 포함) *</span>
              <input type="number" min={0} step={10000} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className={inputCls} />
              <span className="mt-1 block text-xs text-slate-400">{formatWon(Number(form.amount) || 0)} · 선급금이나 정산 차액처럼 품목이 없는 청구에만 쓰세요</span>
            </label>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="text-xs text-slate-500">
                  <tr><th className="px-2 py-1 text-left">품명</th><th className="px-2 py-1 text-left">규격</th><th className="px-2 py-1 text-left w-20">단위</th><th className="px-2 py-1 text-right w-20">수량</th><th className="px-2 py-1 text-right w-28">단가</th><th className="px-2 py-1 text-right w-32">금액</th><th className="w-8"></th></tr>
                </thead>
                <tbody>
                  {(form.items ?? []).map((it, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5"><ProductPicker products={products} value={it.name} onChange={(t) => setItem(i, { name: t })} onPick={(p) => pickForRow(i, p)} className={cellCls} placeholder="품명 검색 (예: 벤치 300, 원형 1호)" /></td>
                      <td className="px-2 py-1.5"><input value={it.spec ?? ""} onChange={(e) => setItem(i, { spec: e.target.value })} className={cellCls} placeholder="예) 900*H1000" /></td>
                      <td className="px-2 py-1.5"><select value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} className={cellCls}>{(units.includes(it.unit) ? units : [it.unit, ...units]).map((u) => <option key={u} value={u}>{u}</option>)}</select></td>
                      <td className="px-2 py-1.5"><input type="number" min={0} value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} className={`${cellCls} text-right`} /></td>
                      <td className="px-2 py-1.5"><input type="number" min={0} step="any" value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })} className={`${cellCls} text-right`} /></td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{((Number(it.qty) || 0) * (Number(it.unitPrice) || 0)).toLocaleString("ko-KR")}</td>
                      <td className="px-1 text-center"><button type="button" onClick={() => setForm((f) => ({ ...f, items: (f.items ?? []).length > 1 ? (f.items ?? []).filter((_, j) => j !== i) : f.items }))} className="text-slate-400 hover:text-red-600">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm text-slate-700">
                <span>공급가액 <b className="tabular-nums">{formatWon(total - vat)}</b></span>
                <span>부가세 <b className="tabular-nums">{formatWon(vat)}</b></span>
                <span>청구액 <b className="tabular-nums text-primary">{formatWon(total)}</b></span>
              </div>
            </div>
          )}
        </div>

        <label className="block text-sm">
          <span className="text-slate-600">메모</span>
          <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} rows={2} className={inputCls} placeholder="세금계산서 발행 여부, 결제 조건" />
        </label>

        {initial && (
          <div className="rounded-xl bg-background border border-line p-4 text-sm grid grid-cols-3 gap-2 text-center">
            <div><div className="text-xs text-slate-400">청구액</div><div className="font-semibold tabular-nums">{formatWon(initial.amount)}</div></div>
            <div><div className="text-xs text-slate-400">입금액</div><div className="font-semibold tabular-nums text-green-700">{formatWon(paid)}</div></div>
            <div><div className="text-xs text-slate-400">미수금</div><div className={`font-semibold tabular-nums ${initial.amount - paid > 0 ? "text-amber-700" : "text-slate-500"}`}>{formatWon(Math.max(initial.amount - paid, 0))}</div></div>
            <p className="col-span-3 text-xs text-slate-400 text-left">입금액은 입금관리에서 이 매출에 연결된 입금의 합계입니다.</p>
          </div>
        )}

        {priceHint && <div className="rounded-xl border border-primary/20 bg-primary-soft px-4 py-2 text-xs text-primary">{priceHint}</div>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            {onDelete && <button type="button" onClick={onDelete} className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">삭제</button>}
            {initial && onCopyEntax && <button type="button" onClick={onCopyEntax} title="엔택스 매출추가 화면의 [Paste] 용으로 복사" className="rounded-full border border-line bg-white px-4 py-2 text-sm text-slate-700 hover:border-primary hover:text-primary">엔택스로 복사</button>}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
            <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark px-5 py-2 text-sm font-semibold text-white">{initial ? "저장" : manual ? "등록" : "등록 + 거래명세표 만들기"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
