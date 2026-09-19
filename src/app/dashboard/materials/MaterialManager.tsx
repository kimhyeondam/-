"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import Tabs from "@/components/Tabs";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { materials as initialMaterials, materialMoves as initialMoves, type Material, type MaterialMove, type MaterialMoveType } from "@/data/sample";
import { newId, nowIso } from "@/lib/ids";
import { todayIso } from "@/lib/format";
import { materialStock, movesForPurchase } from "@/lib/inventory/stock";
import { purchases as initialPurchases, type Purchase } from "@/data/sample";

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const typeBadge: Record<MaterialMoveType, string> = { 기초재고: "bg-slate-100 text-slate-600", 매입입고: "bg-green-50 text-green-700", 생산사용: "bg-primary-soft text-primary", 재고조정: "bg-amber-50 text-amber-700", 폐기: "bg-red-50 text-red-700" };
const units = ["ton", "㎥", "kg", "EA", "포", "L"];
const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString("ko-KR") : n.toLocaleString("ko-KR", { maximumFractionDigits: 2 }));

export default function MaterialManager({ initialTab = "stock" }: { initialTab?: "stock" | "moves" } = {}) {
  const [items, setItems, loaded, loadError] = useServerState<Material[]>("materials", initialMaterials);
  const [moves, setMoves, movesLoaded] = useServerState<MaterialMove[]>("materialMoves", initialMoves);
  const [purchases, , purchasesLoaded] = useServerState<Purchase[]>("purchases", initialPurchases, "jeil.purchases");
  // 매입관리에는 있는데 원자재 입고가 안 된 매입 (예: 예전 방식으로 올린 시멘트 매입)
  const unposted = useMemo(() => purchasesLoaded ? purchases.filter((p) => !moves.some((m) => m.ref === p.id) && movesForPurchase(p, items).length > 0) : [], [purchases, purchasesLoaded, moves, items]);
  function postUnposted() {
    if (!movesLoaded || !unposted.length) return;
    const add = unposted.flatMap((p) => movesForPurchase(p, items, me?.name));
    setMoves((prev) => [...add, ...prev]);
  }
  const [today] = useState(todayIso);
  const [tab, setTab] = useState<"stock" | "moves">(initialTab);
  const [editing, setEditing] = useState<Material | null | "new">(null);
  const [moving, setMoving] = useState<Material | null>(null);
  const [me, setMe] = useState<{ name?: string } | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => {}); }, []);

  const stock = useMemo(() => materialStock(moves), [moves]);
  const low = items.filter((m) => m.safetyStock !== undefined && (stock.get(m.id) ?? 0) <= m.safetyStock);
  const monthUsed = moves.filter((m) => m.date.startsWith(today.slice(0, 7)) && m.type === "생산사용");
  const monthIn = moves.filter((m) => m.date.startsWith(today.slice(0, 7)) && m.type === "매입입고");
  const name = (id: string) => items.find((m) => m.id === id)?.name ?? "(삭제된 자재)";
  const moveRows = useMemo(() => [...moves].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [moves]);

  function save(m: Material, initialStock?: number) {
    setItems((prev) => (prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m]));
    if (initialStock && movesLoaded) setMoves((prev) => [{ id: newId("mm"), date: today, materialId: m.id, type: "기초재고", qty: initialStock, memo: "자재 등록 시 입력", createdBy: me?.name, createdAt: nowIso() }, ...prev]);
    setEditing(null);
  }
  function remove(id: string) {
    if (!confirm("이 원자재를 삭제할까요? 입출고 내역도 함께 지워집니다. (품목 배합에 들어 있으면 그 줄도 무시됩니다)")) return;
    setItems((prev) => prev.filter((m) => m.id !== id));
    if (movesLoaded) setMoves((prev) => prev.filter((m) => m.materialId !== id));
    setEditing(null);
  }
  function addMove(materialId: string, type: MaterialMoveType, qty: number, date: string, memo?: string) {
    if (!movesLoaded || !qty) return;
    setMoves((prev) => [{ id: newId("mm"), date, materialId, type, qty, memo, createdBy: me?.name, createdAt: nowIso() }, ...prev]);
    setMoving(null);
  }

  return (
    <>
      <PageHeader
        title="원자재 재고"
        description="시멘트·골재·자갈·혼화재·철망 같은 자재입니다. 매입관리에 매입을 넣으면 입고, 생산일보를 저장하면 품목 배합대로 자동으로 빠집니다."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/purchases" className="rounded-full border border-line bg-white text-slate-700 text-sm font-semibold px-4 py-2.5 hover:border-primary hover:text-primary transition">매입 등록</Link>
            <button onClick={() => setEditing("new")} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">＋ 자재 등록</button>
          </div>
        }
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>
      {unposted.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex-1"><div className="font-semibold text-slate-800">매입관리에 있는데 아직 입고 처리되지 않은 원자재 매입이 {unposted.length}건 있습니다</div><div className="text-xs text-slate-600">{unposted.slice(0, 4).map((p) => `${p.date} ${p.supplier} ${p.item}${p.qty ? ` ${p.qty}${p.unit ?? ""}` : ""}`).join(" · ")}{unposted.length > 4 ? " …" : ""}</div></div>
          <button onClick={postUnposted} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm">입고 처리</button>
        </div>
      )}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="자재 종류" value={`${items.length}종`} sub="관리 중인 원자재" icon="▤" onClick={() => setTab("stock")} />
        <StatCard label="부족 자재" value={<span className={low.length ? "text-red-600" : ""}>{low.length}종</span>} sub={low.length ? low.map((m) => m.name).join(", ") : "안전재고 이상"} icon="!" highlight={low.length > 0} onClick={() => setTab("stock")} />
        <StatCard label="이달 매입 입고" value={`${monthIn.length}건`} sub="매입관리에서 자동" icon="▲" tone="green" onClick={() => setTab("moves")} />
        <StatCard label="이달 생산 사용" value={`${monthUsed.length}건`} sub="생산일보 배합 기준" icon="▼" onClick={() => setTab("moves")} />
      </div>

      <Card className="p-4"><Tabs value={tab} onChange={(v) => setTab(v as "stock" | "moves")} tabs={[{ key: "stock", label: "재고 현황", n: items.length }, { key: "moves", label: "입출고 내역", n: moves.length }]} /></Card>

      {tab === "stock" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-line"><th className="px-5 py-3 font-medium">자재</th><th className="px-3 py-3 font-medium">단위</th><th className="px-3 py-3 font-medium text-right">현재고</th><th className="px-3 py-3 font-medium text-right">안전재고</th><th className="px-3 py-3 font-medium text-right">이달 사용</th><th className="px-3 py-3 font-medium">상태</th><th className="px-3 pr-5 py-3 text-right"></th></tr></thead>
            <tbody className="divide-y divide-line">
              {items.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">자재가 없습니다.</td></tr>}
              {items.map((m) => {
                const qty = stock.get(m.id) ?? 0;
                const isLow = m.safetyStock !== undefined && qty <= m.safetyStock;
                const used = -monthUsed.filter((x) => x.materialId === m.id).reduce((s, x) => s + x.qty, 0);
                return (
                  <tr key={m.id} className={`hover:bg-primary-soft/30 ${isLow ? "bg-red-50/40" : ""}`}>
                    <td className="px-5 py-3"><button onClick={() => setEditing(m)} className="font-medium text-slate-800 hover:text-primary">{m.name}</button>{m.memo && <div className="text-xs text-slate-400">{m.memo}</div>}</td>
                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{m.unit}</td>
                    <td className={`px-3 py-3 text-right tabular-nums font-semibold whitespace-nowrap ${isLow ? "text-red-600" : "text-slate-800"}`}>{fmt(qty)} <span className="text-xs font-normal text-slate-400">{m.unit}</span></td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-500 whitespace-nowrap">{m.safetyStock ?? "-"}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600 whitespace-nowrap">{used ? fmt(used) : "-"}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{isLow ? <span className="rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs">부족 · 발주 필요</span> : <span className="rounded-full bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-xs">정상</span>}</td>
                    <td className="px-3 pr-5 py-3 text-right whitespace-nowrap"><button onClick={() => setMoving(m)} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-700 hover:border-primary hover:text-primary">조정·폐기</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "moves" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-line"><th className="px-5 py-3 font-medium">날짜</th><th className="px-3 py-3 font-medium">종류</th><th className="px-3 py-3 font-medium">자재</th><th className="px-3 py-3 font-medium text-right">수량</th><th className="px-3 py-3 font-medium">연결</th><th className="px-3 py-3 font-medium">메모</th><th className="px-3 pr-5 py-3"></th></tr></thead>
            <tbody className="divide-y divide-line">
              {moveRows.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">내역이 없습니다.</td></tr>}
              {moveRows.map((m) => (
                <tr key={m.id} className="hover:bg-primary-soft/30">
                  <td className="px-5 py-2.5 text-slate-600 whitespace-nowrap">{m.date}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap"><span className={`rounded-full px-2 py-0.5 text-xs ${typeBadge[m.type]}`}>{m.type}</span></td>
                  <td className="px-3 py-2.5 text-slate-800 whitespace-nowrap">{name(m.materialId)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap ${m.qty >= 0 ? "text-green-700" : "text-red-600"}`}>{m.qty >= 0 ? "+" : ""}{fmt(m.qty)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500"><span className="block max-w-[12rem] truncate">{m.refLabel ?? "-"}</span></td>
                  <td className="px-3 py-2.5 text-xs text-slate-500"><span className="block max-w-[14rem] truncate">{m.memo ?? "-"}</span></td>
                  <td className="px-3 pr-5 py-2.5 text-right">{!m.ref && <button onClick={() => { if (confirm("이 내역을 지울까요?")) setMoves((prev) => prev.filter((x) => x.id !== m.id)); }} className="text-xs text-slate-400 hover:text-red-600">삭제</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      </>)}

      {editing && <MaterialForm initial={editing === "new" ? undefined : editing} onSubmit={save} onCancel={() => setEditing(null)} onDelete={editing !== "new" ? () => remove(editing.id) : undefined} today={today} />}
      {moving && <MaterialMoveForm material={moving} current={stock.get(moving.id) ?? 0} today={today} onSubmit={addMove} onCancel={() => setMoving(null)} />}
    </>
  );
}

function MaterialForm({ initial, today, onSubmit, onCancel, onDelete }: { initial?: Material; today: string; onSubmit: (m: Material, initialStock?: number) => void; onCancel: () => void; onDelete?: () => void }) {
  const [form, setForm] = useState({ name: initial?.name ?? "", unit: initial?.unit ?? "ton", safetyStock: initial?.safetyStock ?? 0, memo: initial?.memo ?? "", initialStock: 0 });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return; onSubmit({ id: initial?.id ?? newId("mt"), name: form.name.trim(), unit: form.unit, safetyStock: Number(form.safetyStock) || 0, memo: form.memo.trim() || undefined, createdAt: initial?.createdAt ?? today }, initial ? undefined : Number(form.initialStock) || 0); }} className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-line shadow-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">{initial ? "자재 수정" : "자재 등록"}</h2>
        <label className="block text-sm"><span className="text-slate-600">자재명 *</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required placeholder="예) 시멘트" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm"><span className="text-slate-600">단위</span><select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls}>{units.map((u) => <option key={u}>{u}</option>)}</select></label>
          <label className="block text-sm"><span className="text-slate-600">안전재고</span><input type="number" min={0} step="any" value={form.safetyStock} onChange={(e) => setForm({ ...form, safetyStock: Number(e.target.value) })} className={inputCls} /></label>
          {!initial && <label className="block text-sm col-span-2"><span className="text-slate-600">현재 재고 (기초재고)</span><input type="number" min={0} step="any" value={form.initialStock} onChange={(e) => setForm({ ...form, initialStock: Number(e.target.value) })} className={inputCls} /></label>}
        </div>
        <label className="block text-sm"><span className="text-slate-600">메모</span><input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className={inputCls} placeholder="예) 1루베 단위, ○○레미콘에서 매입" /></label>
        <div className="flex items-center justify-between pt-1">
          <div>{onDelete && <button type="button" onClick={onDelete} className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">삭제</button>}</div>
          <div className="flex gap-2"><button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">취소</button><button type="submit" className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2">{initial ? "저장" : "등록"}</button></div>
        </div>
      </form>
    </div>
  );
}

function MaterialMoveForm({ material, current, today, onSubmit, onCancel }: { material: Material; current: number; today: string; onSubmit: (materialId: string, type: MaterialMoveType, qty: number, date: string, memo?: string) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ type: "재고조정" as MaterialMoveType, qty: 0, date: today, memo: "" });
  const signed = form.type === "재고조정" ? Math.round((Number(form.qty) - current) * 1000) / 1000 : form.type === "폐기" ? -Math.abs(Number(form.qty)) : Math.abs(Number(form.qty));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!signed) return; onSubmit(material.id, form.type, signed, form.date, form.memo.trim() || undefined); }} className="w-full max-w-md rounded-2xl bg-card border border-line shadow-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">{material.name} 조정·폐기</h2>
        <p className="text-xs text-slate-500">매입 입고는 매입관리에서, 생산 사용은 생산일보에서 자동으로 반영됩니다. 여기서는 실사 조정·폐기·기초재고만 넣습니다.</p>
        <div className="flex flex-wrap gap-1 rounded-full border border-line p-1 w-fit">
          {(["재고조정", "폐기", "기초재고"] as MaterialMoveType[]).map((t) => <button key={t} type="button" onClick={() => setForm({ ...form, type: t })} className={`rounded-full px-3 py-1.5 text-sm ${form.type === t ? "bg-primary text-white font-semibold" : "text-slate-600 hover:bg-primary-soft"}`}>{t}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm"><span className="text-slate-600">{form.type === "재고조정" ? "실제 수량 (실사)" : "수량"} ({material.unit})</span><input type="number" min={0} step="any" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} className={inputCls} required /></label>
          <label className="block text-sm"><span className="text-slate-600">날짜</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} required /></label>
        </div>
        <div className="rounded-xl bg-background px-4 py-3 text-sm text-slate-700">현재 {fmt(current)} → <b>{fmt(current + signed)}</b> <span className={`ml-1 text-xs ${signed >= 0 ? "text-green-700" : "text-red-600"}`}>({signed >= 0 ? "+" : ""}{fmt(signed)})</span></div>
        <label className="block text-sm"><span className="text-slate-600">메모</span><input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className={inputCls} /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">취소</button><button type="submit" className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2">등록</button></div>
      </form>
    </div>
  );
}
