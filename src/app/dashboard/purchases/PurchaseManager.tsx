
"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import Tabs from "@/components/Tabs";
import SortTh, { useSort, compareValues } from "@/components/SortTh";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { formatWon, todayIso } from "@/lib/format";
import { movesForPurchase, replaceMaterialMovesByRef } from "@/lib/inventory/stock";
import { materials as initialMaterials, materialMoves as initialMaterialMoves, type Material, type MaterialMove } from "@/data/sample";
import { newId } from "@/lib/ids";
import { purchases as initialPurchases, purchaseTotal, type Purchase, type PurchaseCategory } from "@/data/sample";
import MonthlyChart from "../sales/MonthlyChart";
import { purchaseCategories } from "./purchaseMeta";
import PurchaseForm, { type PurchaseInput } from "./PurchaseForm";

type SortKey = "date" | "item" | "supplier" | "category" | "total" | "paid" | "due" | "payDue";

export default function PurchaseManager() {
  const [items, setItems, loaded, loadError] = useServerState<Purchase[]>("purchases", initialPurchases);
  const [today] = useState(todayIso);
  const [materials, , materialsLoaded] = useServerState<Material[]>("materials", initialMaterials);
  const [, setMatMoves, matLoaded] = useServerState<MaterialMove[]>("materialMoves", initialMaterialMoves);
  /** 매입 품목이 원자재(시멘트·골재…)면 원자재 재고에 입고 처리. 삭제 시 purchase를 null로 */
  function syncMaterial(purchase: Purchase | null, id: string) {
    if (!materialsLoaded || !matLoaded) return;
    setMatMoves((prev) => replaceMaterialMovesByRef(prev, id, purchase ? movesForPurchase(purchase, materials) : []));
  }
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState<number | null>(null);
  const [category, setCategory] = useState<"all" | PurchaseCategory>("all");
  const [query, setQuery] = useState("");
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const { sort, toggle } = useSort<SortKey>({ key: "date", dir: -1 });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);

  const due = (p: Purchase) => Math.max(purchaseTotal(p) - p.paid, 0);

  const years = useMemo(() => {
    const ys = new Set<number>([thisYear]);
    items.forEach((p) => ys.add(Number(p.date.slice(0, 4))));
    return [...ys].sort((a, b) => b - a);
  }, [items, thisYear]);

  const monthly = useMemo(() => {
    const arr = Array(12).fill(0) as number[];
    items.forEach((p) => { if (Number(p.date.slice(0, 4)) === year) arr[Number(p.date.slice(5, 7)) - 1] += purchaseTotal(p); });
    return arr;
  }, [items, year]);

  const yearTotal = items.filter((p) => p.date.startsWith(String(thisYear))).reduce((s, p) => s + purchaseTotal(p), 0);
  const monthTotal = items.filter((p) => p.date.startsWith(`${thisYear}-${String(thisMonth).padStart(2, "0")}`)).reduce((s, p) => s + purchaseTotal(p), 0);
  const payable = items.reduce((s, p) => s + due(p), 0);
  const overdueCount = items.filter((p) => due(p) > 0 && !!p.payDue && p.payDue < today).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((p) => (unpaidOnly ? due(p) > 0 : Number(p.date.slice(0, 4)) === year && (month === null || Number(p.date.slice(5, 7)) === month)))
      .filter((p) => category === "all" || p.category === category)
      .filter((p) => !q || [p.supplier, p.item, p.spec ?? "", p.memo ?? ""].join(" ").toLowerCase().includes(q))
      .sort((a, b) => {
        const v = (p: Purchase): string | number =>
          sort.key === "total" ? purchaseTotal(p) : sort.key === "paid" ? p.paid : sort.key === "due" ? due(p) : sort.key === "payDue" ? p.payDue ?? "" : p[sort.key];
        return compareValues(v(a), v(b)) * sort.dir;
      });
  }, [items, query, year, month, category, unpaidOnly, sort]);

  const selectedTotal = filtered.reduce((s, p) => s + purchaseTotal(p), 0);
  const suppliers = useMemo(() => [...new Set(items.map((p) => p.supplier))].sort(), [items]);
  const count = (c: PurchaseCategory) => items.filter((p) => p.category === c).length;

  function add(data: PurchaseInput) { const p: Purchase = { ...data, id: newId("pu") }; setItems((prev) => [p, ...prev]); syncMaterial(p, p.id); setAdding(false); }
  function update(id: string, data: PurchaseInput) { const p: Purchase = { ...data, id }; setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x))); syncMaterial(p, id); setEditing(null); }
  function remove(id: string) { setItems((prev) => prev.filter((p) => p.id !== id)); syncMaterial(null, id); setEditing(null); }
  function markPaid(p: Purchase) { setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, paid: purchaseTotal(x) } : x))); }
  function resetFilter() { setYear(thisYear); setMonth(null); setQuery(""); setUnpaidOnly(false); setCategory("all"); }

  const rangeLabel = unpaidOnly ? "미지급 전체" : month ? `${year}년 ${month}월` : `${year}년 전체`;
  const selectCls = "rounded-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <>
      <PageHeader
        title="매입 관리"
        description="시멘트·골재·철근 같은 원자재와 운반·외주 비용을 기록하고, 지급하지 않은 금액(미지급금)을 관리합니다."
        action={<button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">매입 등록</button>}
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label={`${thisYear}년 누적 매입`} value={formatWon(yearTotal)} sub="올해 누적된 총 매입액입니다." icon="↘" />
            <StatCard label={`${thisMonth}월 매입`} value={formatWon(monthTotal)} sub="이번 달 기준 집계입니다." icon="₩" tone="green" />
            <StatCard label="누적 미지급금" value={formatWon(payable)} sub={overdueCount ? `지급 예정일이 지난 건 ${overdueCount}건` : "아직 지급하지 않은 총 금액입니다."} icon="!" tone="amber" />
            <StatCard label="현재 선택 합계" value={formatWon(selectedTotal)} sub={`${filtered.length}건이 현재 필터에 포함되어 있습니다.`} icon="▤" highlight />
          </div>

          <Card className="p-5">
            <MonthlyChart title="매입" year={year} data={monthly} selectedMonth={month} onSelectMonth={(m) => { setMonth(m); setUnpaidOnly(false); }} />
          </Card>

          <Card className="p-4 space-y-3">
            <Tabs value={category} onChange={(v) => setCategory(v as "all" | PurchaseCategory)} tabs={[{ key: "all", label: "전체", n: items.length }, ...purchaseCategories.map((c) => ({ key: c, label: c, n: count(c) }))]} />
            <div className="flex flex-wrap items-center gap-3">
              <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setMonth(null); }} className={selectCls}>{years.map((y) => <option key={y} value={y}>{y}년</option>)}</select>
              <select value={month ?? ""} onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : null)} className={selectCls}>
                <option value="">전체 월</option>
                {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}월</option>)}
              </select>
              <span className="text-sm text-slate-500">{rangeLabel}</span>
              <div className="flex w-full flex-wrap items-center gap-3 md:ml-auto md:w-auto">
                <div className="relative w-full sm:w-72">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="매입처, 품목, 규격, 메모 검색" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2 text-sm outline-none focus:border-primary" />
                </div>
                <label className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm cursor-pointer ${unpaidOnly ? "border-primary bg-primary-soft text-primary" : "border-line bg-white text-slate-600"}`}>
                  <input type="checkbox" checked={unpaidOnly} onChange={(e) => setUnpaidOnly(e.target.checked)} className="accent-primary" /> 미지급만
                </label>
              </div>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <div className="text-3xl text-slate-300">▤</div>
              <div className="mt-3 font-semibold text-slate-800">조건에 맞는 매입이 없습니다.</div>
              <p className="mt-1 text-xs text-slate-400">{rangeLabel} 기준으로 조회된 항목이 없습니다.</p>
              <button onClick={resetFilter} className="mt-4 rounded-full border border-line bg-white px-4 py-2 text-sm text-slate-700 hover:border-primary hover:text-primary">필터 초기화</button>
            </Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm min-w-[960px]">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-line">
                    <SortTh label="매입일" k="date" sort={sort} onSort={toggle} className="px-5" />
                    <SortTh label="품목" k="item" sort={sort} onSort={toggle} />
                    <SortTh label="매입처" k="supplier" sort={sort} onSort={toggle} />
                    <SortTh label="분류" k="category" sort={sort} onSort={toggle} />
                    <SortTh label="합계" k="total" sort={sort} onSort={toggle} className="text-right" />
                    <SortTh label="지급액" k="paid" sort={sort} onSort={toggle} className="text-right" />
                    <SortTh label="미지급" k="due" sort={sort} onSort={toggle} className="text-right" />
                    <SortTh label="지급예정" k="payDue" sort={sort} onSort={toggle} />
                    <th className="px-3 py-3 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((p) => {
                    const d = due(p);
                    const overdue = d > 0 && !!p.payDue && p.payDue < today;
                    const state = d === 0 ? { t: "완납", c: "bg-green-50 text-green-700 border-green-200" } : p.paid > 0 ? { t: "부분지급", c: "bg-sky-50 text-sky-700 border-sky-200" } : { t: "미지급", c: "bg-amber-50 text-amber-700 border-amber-200" };
                    return (
                      <tr key={p.id} className="hover:bg-primary-soft/30 transition">
                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{p.date}</td>
                        <td className="px-3 py-3">
                          <button onClick={() => setEditing(p)} className="text-left">
                            <div className="font-medium text-slate-800 hover:text-primary truncate max-w-[18rem]">{p.item}</div>
                            <div className="text-xs text-slate-400">{[p.spec, p.qty ? `${p.qty}${p.unit ?? ""}` : "", p.unitPrice ? `@${p.unitPrice.toLocaleString("ko-KR")}` : ""].filter(Boolean).join(" · ") || (p.invoice ? "" : "계산서 미수취")}</div>
                          </button>
                        </td>
                        <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{p.supplier}</td>
                        <td className="px-3 py-3 whitespace-nowrap"><span className="rounded-full border border-line bg-white px-2 py-0.5 text-xs text-slate-600">{p.category}</span></td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-800 whitespace-nowrap">{purchaseTotal(p).toLocaleString("ko-KR")}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-green-700 whitespace-nowrap">{p.paid ? p.paid.toLocaleString("ko-KR") : "-"}</td>
                        <td className={`px-3 py-3 text-right tabular-nums whitespace-nowrap ${d > 0 ? "text-amber-700 font-semibold" : "text-slate-400"}`}>{d ? d.toLocaleString("ko-KR") : "-"}</td>
                        <td className={`px-3 py-3 whitespace-nowrap ${overdue ? "text-red-600 font-semibold" : "text-slate-600"}`}>{p.payDue ?? "-"}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs ${state.c}`}>{state.t}</span>
                          {d > 0 && <button onClick={() => markPaid(p)} className="ml-2 text-[11px] text-primary hover:underline" title="전액 지급 처리">지급완료</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {adding && <PurchaseForm defaultDate={today} suppliers={suppliers} onSubmit={add} onCancel={() => setAdding(false)} />}
      {editing && <PurchaseForm initial={editing} defaultDate={today} suppliers={suppliers} onSubmit={(d) => update(editing.id, d)} onCancel={() => setEditing(null)} onDelete={() => remove(editing.id)} />}
    </>
  );
}
