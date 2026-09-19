"use client";

import { useState } from "react";
import { materials as initialMaterials, type Material, type Product } from "@/data/sample";
import { useServerState } from "@/lib/useServerState";
import { productCategories, productUnits } from "./inventoryMeta";

export type ProductInput = Omit<Product, "id" | "createdAt"> & { initialStock?: number };

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

export default function ProductForm({ initial, onSubmit, onCancel, onDelete }: { initial?: Product; onSubmit: (d: ProductInput) => void; onCancel: () => void; onDelete?: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    spec: initial?.spec ?? "",
    unit: initial?.unit ?? "본",
    category: initial?.category ?? "흄관",
    safetyStock: initial?.safetyStock ?? 0,
    memo: initial?.memo ?? "",
    aliases: (initial?.aliases ?? []).join(", "),
    favorite: initial?.favorite ?? false,
    initialStock: 0,
    basePrice: initial?.basePrice ?? 0,
  });
  const [materials] = useServerState<Material[]>("materials", initialMaterials);
  const [recipe, setRecipe] = useState<{ materialId: string; qty: number }[]>(initial?.recipe ?? []);
  function setRecipeQty(materialId: string, qty: number) {
    setRecipe((prev) => {
      const rest = prev.filter((r) => r.materialId !== materialId);
      return qty > 0 ? [...rest, { materialId, qty }] : rest;
    });
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return;
          onSubmit({ name: form.name.trim(), spec: form.spec.trim() || undefined, unit: form.unit, category: form.category, safetyStock: Number(form.safetyStock) || 0, memo: form.memo.trim() || undefined, aliases: form.aliases.split(/[,\n]/).map((a) => a.trim()).filter(Boolean), favorite: form.favorite || undefined, initialStock: initial ? undefined : Number(form.initialStock) || 0, basePrice: Number(form.basePrice) || undefined, recipe: recipe.length ? recipe : undefined });
        }}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-line shadow-2xl p-5 sm:p-6 space-y-4"
      >
        <h2 className="text-lg font-bold text-slate-800">{initial ? "품목 수정" : "품목 등록"}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-sm sm:col-span-2"><span className="text-slate-600">품명 *</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예) 흄관 D600" className={inputCls} required /></label>
          <label className="block text-sm"><span className="text-slate-600">규격</span><input value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} placeholder="예) L=2,500" className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">단위</span><select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls}>{productUnits.map((u) => <option key={u}>{u}</option>)}</select></label>
          <label className="block text-sm"><span className="text-slate-600">분류</span><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>{productCategories.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="block text-sm"><span className="text-slate-600">안전재고</span><input type="number" min={0} value={form.safetyStock} onChange={(e) => setForm({ ...form, safetyStock: Number(e.target.value) })} className={inputCls} /><span className="text-[11px] text-slate-400">이 수량 이하로 내려가면 빨간색으로 경고합니다</span></label>
          {!initial && <label className="block text-sm"><span className="text-slate-600">현재 재고 (기초재고)</span><input type="number" min={0} value={form.initialStock} onChange={(e) => setForm({ ...form, initialStock: Number(e.target.value) })} className={inputCls} /><span className="text-[11px] text-slate-400">지금 창고에 있는 수량을 넣으면 시작 재고로 기록됩니다</span></label>}
          <label className="block text-sm"><span className="text-slate-600">기준 단가 (원)</span><input type="number" min={0} step="any" value={form.basePrice || ""} placeholder="단가표" onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) })} className={inputCls} /><span className="text-[11px] text-slate-400">매출 등록 때 거래처 적용률을 곱해 자동 입력됩니다</span></label>
          <label className="block text-sm sm:col-span-2"><span className="text-slate-600">메모</span><input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className={inputCls} /></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2 rounded-xl border border-line bg-slate-50/60 px-3 py-2"><input type="checkbox" checked={form.favorite} onChange={(e) => setForm({ ...form, favorite: e.target.checked })} className="h-4 w-4 accent-primary" /><span>★ 생산 품목 <span className="text-slate-400">(우리 공장에서 만드는 품목. 생산일보 빠른 입력과 양식 인쇄에 나옵니다)</span></span></label>
          <label className="block text-sm sm:col-span-2"><span className="text-slate-600">별칭 <span className="text-slate-400">(공장에서 부르는 이름, 쉼표로 여러 개)</span></span><input value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} className={inputCls} placeholder="예) 원형1호 상부 600H, 원형1호상부600" /><span className="text-[11px] text-slate-400">생산일보 사진이나 거래명세표에 이 이름으로 적혀 있어도 이 품목으로 연결됩니다</span></label>
        </div>
        <div className="rounded-xl border border-line bg-background p-3">
          <div className="text-sm font-semibold text-slate-800">배합 (1{form.unit} 만들 때 드는 원자재)</div>
          <p className="text-[11px] text-slate-400 mt-0.5">생산일보를 저장하면 생산 수량 × 아래 양만큼 원자재 재고에서 자동으로 빠집니다. 모르면 비워 두세요.</p>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {materials.map((m) => (
              <label key={m.id} className="block text-xs"><span className="text-slate-600">{m.name} <span className="text-slate-400">({m.unit})</span></span>
                <input type="number" min={0} step="any" value={recipe.find((r) => r.materialId === m.id)?.qty ?? ""} placeholder="0" onChange={(e) => setRecipeQty(m.id, Number(e.target.value))} className="mt-0.5 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-primary" />
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
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
