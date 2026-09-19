"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { productions as initialReports, products as initialProducts, stockMoves as initialMoves, materialMoves as initialMaterialMoves, type Product, type ProductionReport, type StockMove, type MaterialMove } from "@/data/sample";
import { newId, nowIso } from "@/lib/ids";
import { todayIso } from "@/lib/format";
import { movesForProduction, replaceMovesByRef, materialMovesForProduction, replaceMaterialMovesByRef } from "@/lib/inventory/stock";
import ProductionForm, { type ProductionInput } from "./ProductionForm";

export default function ProductionManager({ openId }: { openId?: string } = {}) {
  const [items, setItems, loaded, loadError] = useServerState<ProductionReport[]>("productions", initialReports);
  const [products, setProducts, productsLoaded] = useServerState<Product[]>("products", initialProducts);
  const [, setMoves, movesLoaded] = useServerState<StockMove[]>("stockMoves", initialMoves);
  const [, setMatMoves, matLoaded] = useServerState<MaterialMove[]>("materialMoves", initialMaterialMoves);
  const [today] = useState(todayIso);
  const [month, setMonth] = useState(() => todayIso().slice(0, 7));
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ProductionReport | null>(null);
  const [me, setMe] = useState<{ name?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  function flash(msg: string) { setNotice(msg); setTimeout(() => setNotice(null), 6000); }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => {}); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (loaded && openId) { const r = items.find((x) => x.id === openId); if (r) setEditing(r); } }, [loaded, openId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = productsLoaded && movesLoaded && matLoaded;
  const inMonth = items.filter((r) => r.date.startsWith(month));
  const sum = (rs: ProductionReport[], k: "produced" | "defect") => rs.reduce((s, r) => s + r.items.reduce((a, i) => a + (i[k] ?? 0), 0), 0);
  const todayRs = items.filter((r) => r.date === today);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inMonth
      .filter((r) => !q || [r.line ?? "", r.workers.join(" "), r.items.map((i) => i.name).join(" "), r.notes ?? ""].join(" ").toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [inMonth, query]);
  const months = useMemo(() => {
    const set = new Set(items.map((r) => r.date.slice(0, 7)));
    set.add(today.slice(0, 7));
    return [...set].sort().reverse();
  }, [items, today]);

  /** 품목에 없는 이름은 새 품목으로 등록하고, 각 줄에 productId를 붙입니다. 연결된 품목의 규격·단위를 고쳤으면 재고관리 품목도 같이 바꿉니다 */
  function ensureProducts(input: ProductionInput): ProductionInput & { allProducts: Product[] } {
    const created: Product[] = [];
    const changed = new Map<string, Partial<Product>>();
    const itemsWithId = input.items.map((it) => {
      const linked = it.productId ? products.find((p) => p.id === it.productId) : undefined;
      if (linked) {
        if ((linked.spec ?? "") !== (it.spec ?? "") || linked.unit !== it.unit) changed.set(linked.id, { spec: it.spec || undefined, unit: it.unit });
        return it;
      }
      const found = products.find((p) => p.name === it.name && (p.spec ?? "") === (it.spec ?? "")) ?? created.find((p) => p.name === it.name && (p.spec ?? "") === (it.spec ?? ""));
      if (found) return { ...it, productId: found.id };
      const np: Product = { id: newId("pd"), name: it.name, spec: it.spec, unit: it.unit, category: "기타", safetyStock: 0, createdAt: today };
      created.push(np);
      return { ...it, productId: np.id };
    });
    if (changed.size) {
      setProducts((prev) => prev.map((p) => (changed.has(p.id) ? { ...p, ...changed.get(p.id) } : p)));
      flash(`재고관리 품목 ${[...changed.keys()].map((id) => `「${products.find((p) => p.id === id)?.name ?? ""}」`).join(", ")}의 규격·단위를 생산일보에 맞춰 바꿨습니다.`);
    }
    if (created.length) {
      setProducts((prev) => [...created, ...prev]);
      flash(`재고관리에 새 품목 ${created.map((p) => `「${p.name}」`).join(", ")}을(를) 등록했습니다. 안전재고는 재고관리에서 정해 주세요.`);
    }
    return { ...input, items: itemsWithId, allProducts: [...created, ...products] };
  }

  function add(input: ProductionInput) {
    if (!ready) return;
    const { allProducts, ...data } = ensureProducts(input);
    const report: ProductionReport = { ...data, id: newId("pr"), createdBy: me?.name, createdAt: nowIso() };
    setItems((prev) => [report, ...prev]);
    setMoves((prev) => replaceMovesByRef(prev, report.id, movesForProduction(report, me?.name)));
    const used = materialMovesForProduction(report, allProducts, me?.name);
    setMatMoves((prev) => replaceMaterialMovesByRef(prev, report.id, used));
    setAdding(false);
    const total = report.items.reduce((s, i) => s + i.produced, 0);
    if (total > 0) flash(`${report.date} 생산일보를 저장하고 재고에 ${total.toLocaleString("ko-KR")}개를 입고했습니다.${used.length ? ` 배합대로 원자재 ${used.length}종을 사용 처리했습니다.` : ""}`);
  }
  function update(id: string, input: ProductionInput) {
    if (!ready) return;
    const { allProducts, ...data } = ensureProducts(input);
    const prevReport = items.find((r) => r.id === id);
    const report: ProductionReport = { ...(prevReport as ProductionReport), ...data, id };
    setItems((prev) => prev.map((r) => (r.id === id ? report : r)));
    setMoves((prev) => replaceMovesByRef(prev, id, movesForProduction(report, me?.name)));
    setMatMoves((prev) => replaceMaterialMovesByRef(prev, id, materialMovesForProduction(report, allProducts, me?.name)));
    setEditing(null);
  }
  function remove(id: string) {
    if (!confirm("이 생산일보를 삭제할까요? 재고에 입고된 수량도 되돌아갑니다.")) return;
    setItems((prev) => prev.filter((r) => r.id !== id));
    if (movesLoaded) setMoves((prev) => prev.filter((m) => m.ref !== id));
    if (matLoaded) setMatMoves((prev) => prev.filter((m) => m.ref !== id));
    setEditing(null);
  }

  return (
    <>
      <PageHeader
        title="생산일보"
        description="하루 생산량·불량·작업 인원을 기록합니다. 저장하면 양품 수량이 재고관리에 자동으로 입고됩니다."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/inventory" className="rounded-full border border-line bg-white text-slate-700 text-sm font-semibold px-4 py-2.5 hover:border-primary hover:text-primary transition">재고관리</Link>
            <Link href="/dashboard/production/print" className="rounded-full border border-line bg-white text-slate-700 text-sm font-semibold px-4 py-2.5 hover:border-primary hover:text-primary transition" title="★ 생산 품목이 인쇄된 종이 양식. 수량만 적고 사진으로 올리면 됩니다">양식 인쇄</Link>
            <button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">＋ 생산일보 작성</button>
          </div>
        }
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>
      {notice && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="오늘 생산" value={sum(todayRs, "produced").toLocaleString("ko-KR")} sub={todayRs.length ? `일보 ${todayRs.length}건 작성` : "아직 작성 전"} icon="⚒" onClick={() => setMonth(today.slice(0, 7))} />
        <StatCard label={`${Number(month.slice(5, 7))}월 생산`} value={sum(inMonth, "produced").toLocaleString("ko-KR")} sub={`일보 ${inMonth.length}건`} icon="▲" tone="green" />
        <StatCard label={`${Number(month.slice(5, 7))}월 불량`} value={<span className={sum(inMonth, "defect") ? "text-red-600" : ""}>{sum(inMonth, "defect").toLocaleString("ko-KR")}</span>} sub={sum(inMonth, "produced") ? `불량률 ${((sum(inMonth, "defect") / (sum(inMonth, "produced") + sum(inMonth, "defect"))) * 100).toFixed(1)}%` : "-"} icon="!" />
        <StatCard label="작업 인원 (월 연인원)" value={`${inMonth.reduce((s, r) => s + r.workers.length, 0)}명`} sub="일보에 적힌 인원 합계" icon="☺" />
      </div>

      <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-full border border-line bg-white px-4 py-2 text-sm outline-none focus:border-primary">
            {months.map((m) => <option key={m} value={m}>{m.slice(0, 4)}년 {Number(m.slice(5, 7))}월</option>)}
          </select>
          <span className="text-sm text-slate-500">{rows.length}건</span>
        </div>
        <div className="relative w-full md:w-72 md:ml-auto">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="품목, 작업자, 라인, 특이사항 검색" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary" />
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-line">
              <th className="px-5 py-3 font-medium">날짜</th>
              <th className="px-3 py-3 font-medium">라인</th>
              <th className="px-3 py-3 font-medium">생산 품목</th>
              <th className="px-3 py-3 font-medium text-right">생산</th>
              <th className="px-3 py-3 font-medium text-right">불량</th>
              <th className="px-3 py-3 font-medium">작업 인원</th>
              <th className="px-3 py-3 font-medium">특이사항</th>
              <th className="px-3 pr-5 py-3 font-medium">작성</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">이 달의 생산일보가 없습니다. 「생산일보 작성」으로 오늘 생산량을 기록하세요.</td></tr>}
            {rows.map((r) => {
              const produced = r.items.reduce((s, i) => s + i.produced, 0);
              const defect = r.items.reduce((s, i) => s + (i.defect ?? 0), 0);
              return (
                <tr key={r.id} className="hover:bg-primary-soft/30 transition">
                  <td className="px-5 py-3 whitespace-nowrap"><button onClick={() => setEditing(r)} className="font-medium text-slate-800 hover:text-primary">{r.date}</button>{r.weather && <div className="text-xs text-slate-400">{r.weather}</div>}</td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{r.line ?? "-"}</td>
                  <td className="px-3 py-3 text-slate-700"><span className="block max-w-[20rem] truncate" title={r.items.map((i) => `${i.name} ${i.produced}${i.unit}`).join(", ")}>{r.items.map((i) => `${i.name} ${i.produced}${i.unit}`).join(", ")}</span></td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-800 whitespace-nowrap">{produced.toLocaleString("ko-KR")}</td>
                  <td className={`px-3 py-3 text-right tabular-nums whitespace-nowrap ${defect ? "text-red-600" : "text-slate-400"}`}>{defect}</td>
                  <td className="px-3 py-3 text-xs text-slate-600"><span className="block max-w-[12rem] truncate">{r.workers.length ? `${r.workers.join(", ")} (${r.workers.length}명)` : "-"}</span></td>
                  <td className="px-3 py-3 text-xs text-slate-500"><span className="block max-w-[14rem] truncate" title={r.notes}>{r.notes ?? "-"}</span></td>
                  <td className="px-3 pr-5 py-3 text-xs text-slate-500 whitespace-nowrap">{r.createdBy ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      </>)}

      {adding && <ProductionForm defaultDate={today} products={products} lastReport={[...items].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0]} onSubmit={add} onCancel={() => setAdding(false)} />}
      {editing && <ProductionForm initial={editing} defaultDate={today} products={products} onSubmit={(d) => update(editing.id, d)} onCancel={() => setEditing(null)} onDelete={() => remove(editing.id)} />}
    </>
  );
}
