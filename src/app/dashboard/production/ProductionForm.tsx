"use client";

import { useMemo, useState } from "react";
import type { Product, ProductionItem, ProductionReport } from "@/data/sample";
import { useMembers } from "@/lib/useMembers";
import { productUnits } from "../inventory/inventoryMeta";
import ProductPicker from "@/components/ProductPicker";

export type ProductionInput = Omit<ProductionReport, "id" | "createdAt" | "createdBy">;

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const cellCls = "w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-primary";
const emptyItem = (): ProductionItem => ({ name: "", spec: "", unit: "본", planned: 0, produced: 0, defect: 0 });

export default function ProductionForm({ initial, defaultDate, products, lastReport, onSubmit, onCancel, onDelete }: { initial?: ProductionReport; defaultDate: string; products: Product[]; lastReport?: ProductionReport; onSubmit: (d: ProductionInput) => void; onCancel: () => void; onDelete?: () => void }) {
  const members = useMembers();
  // ★ 생산 품목: 숫자만 치는 빠른 입력 칸. 그 밖의 품목은 아래 표에서 찾아 넣습니다
  const favs = useMemo(() => products.filter((p) => p.favorite).sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "", "ko") || a.name.localeCompare(b.name, "ko")), [products]);
  const favIds = useMemo(() => new Set(favs.map((p) => p.id)), [favs]);
  const [quick, setQuick] = useState<Record<string, { produced: number; defect: number }>>(() => {
    const q: Record<string, { produced: number; defect: number }> = {};
    for (const it of initial?.items ?? []) if (it.productId && favIds.has(it.productId)) q[it.productId] = { produced: it.produced || 0, defect: it.defect || 0 };
    return q;
  });
  const [favQuery, setFavQuery] = useState("");
  const favShown = useMemo(() => { const q = favQuery.trim().toLowerCase().replace(/\s+/g, ""); return q ? favs.filter((p) => `${p.name}${p.spec ?? ""}${(p.aliases ?? []).join("")}`.toLowerCase().replace(/\s+/g, "").includes(q)) : favs; }, [favs, favQuery]);
  const setQ = (id: string, patch: Partial<{ produced: number; defect: number }>) => setQuick((prev) => ({ ...prev, [id]: { ...{ produced: 0, defect: 0 }, ...(prev[id] ?? {}), ...patch } }));
  const quickItems = (): ProductionItem[] => favs.filter((p) => (quick[p.id]?.produced || 0) > 0 || (quick[p.id]?.defect || 0) > 0).map((p) => ({ productId: p.id, name: p.name, spec: p.spec, unit: p.unit, planned: 0, produced: quick[p.id].produced || 0, defect: quick[p.id].defect || 0 }));
  const [form, setForm] = useState({
    date: initial?.date ?? defaultDate,
    line: initial?.line ?? "",
    workers: initial?.workers ?? [],
    hours: initial?.hours ?? 8,
    weather: initial?.weather ?? "",
    notes: initial?.notes ?? "",
  });
  const [items, setItems] = useState<ProductionItem[]>(() => { const rest = (initial?.items ?? []).filter((i) => !(i.productId && favIds.has(i.productId))).map((i) => ({ ...i })); return rest.length ? rest : favs.length ? [] : [emptyItem()]; });
  /** 어제(가장 최근) 일보의 품목·수량을 그대로 가져옵니다 */
  function copyLast() {
    if (!lastReport) return;
    const q: Record<string, { produced: number; defect: number }> = {}; const rest: ProductionItem[] = [];
    for (const it of lastReport.items) { if (it.productId && favIds.has(it.productId)) q[it.productId] = { produced: it.produced || 0, defect: it.defect || 0 }; else rest.push({ ...it }); }
    setQuick(q); setItems(rest);
    setForm((f) => ({ ...f, line: f.line || lastReport.line || "", workers: f.workers.length ? f.workers : lastReport.workers, hours: lastReport.hours ?? f.hours }));
  }

  function setItem(i: number, patch: Partial<ProductionItem>) {
    setItems((prev) => prev.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  }
  /** 품목 선택 시 품명·규격·단위를 채움. "직접 입력"이면 연결 해제 */
  function pickProduct(i: number, id: string) {
    const p = products.find((x) => x.id === id);
    if (p) setItem(i, { productId: p.id, name: p.name, spec: p.spec ?? "", unit: p.unit });
    else setItem(i, { productId: undefined });
  }
  function toggleWorker(name: string) {
    setForm((f) => ({ ...f, workers: f.workers.includes(name) ? f.workers.filter((w) => w !== name) : [...f.workers, name] }));
  }
  const quickProduced = favs.reduce((s, p) => s + (quick[p.id]?.produced || 0), 0);
  const quickDefect = favs.reduce((s, p) => s + (quick[p.id]?.defect || 0), 0);
  const totalProduced = items.reduce((s, i) => s + (Number(i.produced) || 0), 0) + quickProduced;
  const totalDefect = items.reduce((s, i) => s + (Number(i.defect) || 0), 0) + quickDefect;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const clean = [...quickItems(), ...items.filter((i) => i.name.trim()).map((i) => ({ ...i, name: i.name.trim(), spec: i.spec?.trim() || undefined, planned: Number(i.planned) || 0, produced: Number(i.produced) || 0, defect: Number(i.defect) || 0 }))];
          if (!form.date || clean.length === 0) { alert("날짜와 생산 품목을 하나 이상 넣어 주세요."); return; }
          onSubmit({ date: form.date, line: form.line.trim() || undefined, workers: form.workers, hours: Number(form.hours) || undefined, weather: form.weather.trim() || undefined, notes: form.notes.trim() || undefined, items: clean });
        }}
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-line shadow-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-800">{initial ? "생산일보 수정" : "생산일보 작성"}</h2>
          {!initial && lastReport && <button type="button" onClick={copyLast} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-primary hover:text-primary">↺ {lastReport.date.slice(5).replace("-", "/")} 일보 복사</button>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block text-sm"><span className="text-slate-600">날짜 *</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} required /></label>
          <label className="block text-sm"><span className="text-slate-600">라인·조</span><input value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} placeholder="예) 1라인" className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">작업 시간</span><input type="number" min={0} step={0.5} value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">날씨</span><input value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })} placeholder="맑음 / 비" className={inputCls} /></label>
        </div>

        <div>
          <div className="text-sm text-slate-600">작업 인원 <span className="text-xs text-slate-400">({form.workers.length}명)</span></div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {members.map((m) => (
              <button key={m.id} type="button" onClick={() => toggleWorker(m.name)} className={`rounded-full border px-3 py-1 text-sm transition ${form.workers.includes(m.name) ? "border-primary bg-primary text-white" : "border-line bg-white text-slate-700 hover:border-primary"}`}>{m.name}<span className={`ml-1 text-[11px] ${form.workers.includes(m.name) ? "text-white/70" : "text-slate-400"}`}>{m.team}</span></button>
            ))}
          </div>
        </div>

        {favs.length > 0 ? (
          <div className="rounded-2xl border border-primary/30 bg-primary-soft/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-800">★ 생산 품목 <span className="text-xs font-normal text-slate-500">오늘 만든 수량만 치세요. 비워 두면 저장되지 않습니다</span></div>
              <input value={favQuery} onChange={(e) => setFavQuery(e.target.value)} placeholder="품목 찾기" className="w-40 rounded-full border border-line bg-white px-3 py-1 text-xs outline-none focus:border-primary" />
            </div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {favShown.map((p) => { const q = quick[p.id]; const on = (q?.produced || 0) > 0 || (q?.defect || 0) > 0; return (
                <div key={p.id} className={`flex flex-col gap-1.5 rounded-xl border px-2.5 py-1.5 sm:flex-row sm:items-center sm:gap-2 ${on ? "border-primary bg-white" : "border-line bg-white/70"}`}>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-800" title={p.name}>{p.name}</div><div className="truncate text-[11px] text-slate-500">{p.spec ?? ""}{p.aliases?.length ? ` · ${p.aliases[0]}` : ""}</div></div>
                  <div className="flex items-center justify-end gap-1.5">
                    <input type="number" inputMode="numeric" min={0} value={q?.produced || ""} onChange={(e) => setQ(p.id, { produced: Number(e.target.value) || 0 })} placeholder="생산" className="w-20 rounded-lg border border-line bg-white px-2 py-1.5 text-right text-sm font-semibold outline-none focus:border-primary sm:w-16" />
                    <input type="number" inputMode="numeric" min={0} value={q?.defect || ""} onChange={(e) => setQ(p.id, { defect: Number(e.target.value) || 0 })} placeholder="불량" className="w-16 rounded-lg border border-line bg-white px-2 py-1.5 text-right text-xs outline-none focus:border-primary sm:w-14" />
                  </div>
                </div>
              ); })}
              {favShown.length === 0 && <div className="text-xs text-slate-400 sm:col-span-2">찾는 품목이 없습니다. 아래 표에서 검색해 넣으세요.</div>}
            </div>
            <div className="mt-2 text-right text-xs text-slate-600">★ 품목 생산 <b>{quickProduced.toLocaleString("ko-KR")}</b>{quickDefect ? <> · 불량 <b className="text-red-600">{quickDefect}</b></> : null}</div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">재고관리에서 우리 공장이 만드는 품목에 ★를 켜 두면, 여기서 찾을 필요 없이 숫자만 치면 됩니다.</div>
        )}

        <div className="rounded-2xl border border-line bg-background p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800">{favs.length ? "그 밖의 품목" : "생산 품목"} <span className="text-xs font-normal text-slate-400">양품 수량이 재고에 입고됩니다</span></div>
            <button type="button" onClick={() => setItems((p) => [...p, emptyItem()])} className="text-xs text-primary hover:underline">＋ 품목 추가</button>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-2 py-1 font-medium w-[30%]">품목</th>
                  <th className="px-2 py-1 font-medium">규격</th>
                  <th className="px-2 py-1 font-medium w-20">단위</th>
                  <th className="px-2 py-1 font-medium w-20 text-right">계획</th>
                  <th className="px-2 py-1 font-medium w-24 text-right">생산(양품)</th>
                  <th className="px-2 py-1 font-medium w-20 text-right">불량</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1">
                      <ProductPicker products={products} value={it.name} onChange={(t) => setItem(i, { name: t, productId: undefined })} onPick={(p) => pickProduct(i, p.id)} className={cellCls} placeholder="품명 검색 (없으면 그대로 새 품목)" />
                      {(() => {
                        const linked = it.productId ? products.find((p) => p.id === it.productId) : undefined;
                        const changed = linked && ((linked.spec ?? "") !== (it.spec ?? "") || linked.unit !== it.unit);
                        if (changed) return <div className="mt-0.5 text-[10px] text-amber-600">저장하면 재고관리 품목의 규격·단위도 같이 바뀝니다</div>;
                        if (it.productId) return <div className="mt-0.5 text-[10px] text-primary">품목 연결됨</div>;
                        return it.name.trim() ? <div className="mt-0.5 text-[10px] text-amber-600">새 품목으로 등록됩니다</div> : null;
                      })()}
                    </td>
                    <td className="px-2 py-1"><input value={it.spec ?? ""} onChange={(e) => setItem(i, { spec: e.target.value })} className={cellCls} placeholder="규격" /></td>
                    <td className="px-2 py-1"><select value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} className={cellCls}>{productUnits.map((u) => <option key={u}>{u}</option>)}</select></td>
                    <td className="px-2 py-1"><input type="number" min={0} value={it.planned ?? 0} onChange={(e) => setItem(i, { planned: Number(e.target.value) })} className={`${cellCls} text-right`} /></td>
                    <td className="px-2 py-1"><input type="number" min={0} value={it.produced} onChange={(e) => setItem(i, { produced: Number(e.target.value) })} className={`${cellCls} text-right font-semibold`} /></td>
                    <td className="px-2 py-1"><input type="number" min={0} value={it.defect ?? 0} onChange={(e) => setItem(i, { defect: Number(e.target.value) })} className={`${cellCls} text-right`} /></td>
                    <td className="px-1 py-1 text-center"><button type="button" onClick={() => setItems((p) => p.filter((_, k) => k !== i))} className="text-slate-400 hover:text-red-600">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex justify-end gap-4 text-sm text-slate-700">
            <span>생산 합계 <b>{totalProduced.toLocaleString("ko-KR")}</b></span>
            <span>불량 <b className={totalDefect ? "text-red-600" : ""}>{totalDefect.toLocaleString("ko-KR")}</b></span>
          </div>
        </div>

        <label className="block text-sm"><span className="text-slate-600">특이사항</span><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="설비 고장, 자재 부족, 안전 사항 등" className={inputCls} /></label>

        <div className="flex items-center justify-between pt-1">
          <div>{onDelete && <button type="button" onClick={onDelete} className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">삭제</button>}</div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">취소</button>
            <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2">{initial ? "저장" : "등록"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
