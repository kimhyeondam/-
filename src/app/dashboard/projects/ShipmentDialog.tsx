"use client";

// 납품요구서 품목으로 거래명세표 발행: 이번에 납품하는 수량·단가를 정하면 거래명세표 + 매출이 함께 등록됩니다.
import { useMemo, useState } from "react";
import type { DeliveryOrder, Project, QuoteItem } from "@/data/sample";
import { formatWon } from "@/lib/format";
import { docTotal, docVat } from "@/lib/documents/calc";
import { remainingQtys, deliveredQtys } from "@/lib/projects/orders";

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const cellCls = "w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-primary";

export interface ShipmentInput {
  date: string;
  customer: string;
  site?: string;
  vatIncluded: boolean;
  memo?: string;
  qtys: number[]; // order.items 순서
  unitPrices: number[];
}

export default function ShipmentDialog({ project, order, today, onCancel, onIssue }: { project: Project; order: DeliveryOrder; today: string; onCancel: () => void; onIssue: (input: ShipmentInput) => void }) {
  const remaining = useMemo(() => remainingQtys(order), [order]);
  const delivered = useMemo(() => deliveredQtys(order), [order]);
  const [date, setDate] = useState(today);
  const [customer, setCustomer] = useState(project.client || order.agency || "");
  const [site, setSite] = useState(order.site || "");
  const [vatIncluded, setVatIncluded] = useState(false);
  const [memo, setMemo] = useState("");
  const [qtys, setQtys] = useState<number[]>(remaining);
  const [prices, setPrices] = useState<number[]>(order.items.map((it) => it.unitPrice || 0));

  const lines: QuoteItem[] = order.items.map((it, i) => ({ name: it.name, spec: it.spec, unit: it.unit || "EA", qty: qtys[i] || 0, unitPrice: prices[i] || 0 })).filter((l) => l.qty > 0);
  const total = docTotal({ items: lines, vatIncluded });
  const vat = docVat({ items: lines, vatIncluded });
  const over = order.items.some((_, i) => (qtys[i] || 0) > remaining[i]);
  const noPrice = lines.some((l) => !l.unitPrice);
  const nth = (order.shipments?.length ?? 0) + 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-3">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card p-5 md:p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">거래명세표 발행 · {nth}차 납품</h2>
          <p className="text-xs text-slate-500">[{project.code}] {project.name} · {order.kind} {order.orderNo ?? ""} 의 품목으로 만듭니다. 이번에 납품하는 수량만 적으세요. 잔여 수량은 다음 차수에 다시 발행할 수 있습니다.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block text-sm"><span className="text-slate-600">납품일 *</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">거래처(수신) *</span><input value={customer} onChange={(e) => setCustomer(e.target.value)} className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">납품 장소</span><input value={site} onChange={(e) => setSite(e.target.value)} className={inputCls} /></label>
        </div>

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-3 py-2 text-left">품명</th><th className="px-3 py-2 text-left">규격</th><th className="px-3 py-2 text-left w-14">단위</th><th className="px-3 py-2 text-right w-20">요구</th><th className="px-3 py-2 text-right w-20">기납품</th><th className="px-3 py-2 text-right w-20">잔여</th><th className="px-3 py-2 text-right w-24">이번 납품</th><th className="px-3 py-2 text-right w-28">단가</th><th className="px-3 py-2 text-right w-32">금액</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {order.items.map((it, i) => (
                <tr key={i} className={remaining[i] === 0 ? "text-slate-400" : ""}>
                  <td className="px-3 py-1.5">{it.name}</td>
                  <td className="px-3 py-1.5">{it.spec ?? ""}</td>
                  <td className="px-3 py-1.5">{it.unit ?? "EA"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{it.qty}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{delivered[i] || "-"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium">{remaining[i]}</td>
                  <td className="px-2 py-1"><input type="number" min={0} max={remaining[i]} value={qtys[i] ?? 0} onChange={(e) => setQtys(qtys.map((q, j) => (j === i ? Number(e.target.value) : q)))} className={`${cellCls} text-right ${(qtys[i] || 0) > remaining[i] ? "border-red-400" : ""}`} /></td>
                  <td className="px-2 py-1"><input type="number" min={0} step="any" value={prices[i] ?? 0} onChange={(e) => setPrices(prices.map((q, j) => (j === i ? Number(e.target.value) : q)))} className={`${cellCls} text-right`} /></td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{((qtys[i] || 0) * (prices[i] || 0)).toLocaleString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={vatIncluded} onChange={(e) => setVatIncluded(e.target.checked)} className="accent-primary" /> 단가에 부가세 포함</label>
            <button type="button" onClick={() => setQtys(remaining)} className="text-primary hover:underline">잔여 전량으로</button>
            <button type="button" onClick={() => setQtys(order.items.map(() => 0))} className="text-slate-500 hover:underline">모두 0</button>
          </div>
          <div className="flex flex-wrap gap-x-6 text-sm text-slate-700">
            <span>공급가액 <b className="tabular-nums">{formatWon(total - vat)}</b></span>
            <span>부가세 <b className="tabular-nums">{formatWon(vat)}</b></span>
            <span>청구액 <b className="tabular-nums text-primary">{formatWon(total)}</b></span>
          </div>
        </div>
        {over && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">잔여 수량보다 많이 적은 품목이 있습니다.</div>}
        {!over && noPrice && lines.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">단가가 0원인 품목이 있습니다. 관급 단가표를 보고 단가를 넣어야 매출 금액이 맞습니다.</div>}

        <label className="block text-sm"><span className="text-slate-600">메모</span><input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} placeholder="차량·인수자·특이사항" /></label>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
          <button type="button" disabled={!date || !customer.trim() || lines.length === 0 || over} onClick={() => onIssue({ date, customer: customer.trim(), site: site.trim() || undefined, vatIncluded, memo: memo.trim() || undefined, qtys: qtys.map((q) => q || 0), unitPrices: prices.map((p) => p || 0) })} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white">
            거래명세표 발행 + 매출 등록
          </button>
        </div>
      </div>
    </div>
  );
}
