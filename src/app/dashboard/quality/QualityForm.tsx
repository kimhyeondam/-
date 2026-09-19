"use client";

import { useState } from "react";
import { qualityTestTypes, type Product, type ProductionReport, type QualityResult, type QualityTest } from "@/data/sample";
import { useMembers } from "@/lib/useMembers";
import ProductPicker from "@/components/ProductPicker";

export type QualityInput = Omit<QualityTest, "id" | "createdAt" | "createdBy">;
const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const unitByType: Record<string, string> = { 압축강도: "MPa", 휨강도: "MPa", 외압강도: "kN/m", 흡수율: "%", 치수검사: "mm", 외관검사: "", 기타: "" };

export default function QualityForm({ initial, today, products, productions, onSubmit, onCancel, onDelete }: { initial?: QualityTest; today: string; products: Product[]; productions: ProductionReport[]; onSubmit: (d: QualityInput) => void; onCancel: () => void; onDelete?: () => void }) {
  const members = useMembers();
  const [form, setForm] = useState({
    date: initial?.date ?? today, castDate: initial?.castDate ?? "", productId: initial?.productId ?? "", productName: initial?.productName ?? "", spec: initial?.spec ?? "", batchNo: initial?.batchNo ?? "", productionId: initial?.productionId ?? "",
    testType: initial?.testType ?? "압축강도", age: initial?.age ?? 28, sampleCount: initial?.sampleCount ?? 3, values: initial?.values?.length ? initial.values.map(String) : ["", "", ""], unit: initial?.unit ?? "MPa", standard: initial?.standard ?? 0,
    result: initial?.result ?? ("판정대기" as QualityResult), tester: initial?.tester ?? "", reviewer: initial?.reviewer ?? "", certNo: initial?.certNo ?? "", memo: initial?.memo ?? "",
  });
  const [attachment, setAttachment] = useState<{ name: string; data: string } | undefined>(initial?.attachment);
  const nums = form.values.map(Number).filter((v) => !Number.isNaN(v) && v > 0);
  const avg = nums.length ? Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 100) / 100 : 0;
  const autoResult: QualityResult | null = form.standard > 0 && nums.length ? (avg >= form.standard && Math.min(...nums) >= form.standard * 0.9 ? "합격" : "불합격") : null;

  function pickProduct(id: string) {
    const p = products.find((x) => x.id === id);
    setForm({ ...form, productId: id, productName: p?.name ?? form.productName, spec: p?.spec ?? form.spec });
  }
  function pickProduction(id: string) {
    const r = productions.find((x) => x.id === id);
    setForm({ ...form, productionId: id, castDate: r?.date ?? form.castDate });
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { alert("파일은 3MB까지 올릴 수 있습니다."); return; }
    const data = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file); });
    setAttachment({ name: file.name, data });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.date || !form.productName.trim()) { alert("시험일과 품목을 넣어 주세요."); return; }
          onSubmit({ date: form.date, castDate: form.castDate || undefined, productId: form.productId || undefined, productName: form.productName.trim(), spec: form.spec.trim() || undefined, batchNo: form.batchNo.trim() || undefined, productionId: form.productionId || undefined, testType: form.testType, age: Number(form.age) || undefined, sampleCount: Number(form.sampleCount) || undefined, values: nums, unit: form.unit, standard: Number(form.standard) || undefined, result: form.result, tester: form.tester.trim() || undefined, reviewer: form.reviewer.trim() || undefined, certNo: form.certNo.trim() || undefined, attachment, memo: form.memo.trim() || undefined });
        }}
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-line shadow-2xl p-5 sm:p-6 space-y-4"
      >
        <h2 className="text-lg font-bold text-slate-800">{initial ? "시험 기록 수정" : "시험 기록 등록"}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block text-sm"><span className="text-slate-600">시험일 *</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} required /></label>
          <label className="block text-sm"><span className="text-slate-600">타설(제조)일</span><input type="date" value={form.castDate} onChange={(e) => setForm({ ...form, castDate: e.target.value })} className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">배치·로트 번호</span><input value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} className={inputCls} placeholder="예) 260811-A" /></label>
          <label className="block text-sm"><span className="text-slate-600">성적서 번호</span><input value={form.certNo} onChange={(e) => setForm({ ...form, certNo: e.target.value })} className={inputCls} placeholder="예) QC-2609-001" /></label>
          <label className="block text-sm sm:col-span-2"><span className="text-slate-600">품목</span>
            <ProductPicker products={products} value={form.productName} onChange={(t) => setForm({ ...form, productName: t, productId: "" })} onPick={(p) => pickProduct(p.id)} className={inputCls} placeholder="품명 검색 또는 직접 입력" />
          </label>
          <label className="block text-sm"><span className="text-slate-600">규격</span><input value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">생산일보 연결</span>
            <select value={form.productionId} onChange={(e) => pickProduction(e.target.value)} className={inputCls}><option value="">-</option>{productions.slice(0, 60).map((r) => <option key={r.id} value={r.id}>{r.date} {r.line ?? ""} · {r.items.map((i) => i.name).join(", ").slice(0, 30)}</option>)}</select>
          </label>
        </div>

        <div className="rounded-xl border border-line bg-background p-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="block text-sm"><span className="text-slate-600">시험 항목</span><select value={form.testType} onChange={(e) => setForm({ ...form, testType: e.target.value, unit: unitByType[e.target.value] ?? form.unit })} className={inputCls}>{qualityTestTypes.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="block text-sm"><span className="text-slate-600">재령(일)</span><input type="number" min={0} value={form.age} onChange={(e) => setForm({ ...form, age: Number(e.target.value) })} className={inputCls} /></label>
            <label className="block text-sm"><span className="text-slate-600">단위</span><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls} placeholder="MPa" /></label>
            <label className="block text-sm"><span className="text-slate-600">기준값 (이상)</span><input type="number" min={0} step="any" value={form.standard || ""} onChange={(e) => setForm({ ...form, standard: Number(e.target.value) })} className={inputCls} /></label>
          </div>
          <div>
            <div className="flex items-center justify-between"><span className="text-sm text-slate-600">측정값 <span className="text-xs text-slate-400">(공시체별)</span></span><button type="button" onClick={() => setForm({ ...form, values: [...form.values, ""], sampleCount: form.values.length + 1 })} className="text-xs text-primary hover:underline">＋ 공시체 추가</button></div>
            <div className="mt-1 flex flex-wrap gap-2">
              {form.values.map((v, i) => (
                <div key={i} className="flex items-center gap-1"><span className="text-xs text-slate-400">#{i + 1}</span><input type="number" step="any" value={v} onChange={(e) => setForm({ ...form, values: form.values.map((x, k) => (k === i ? e.target.value : x)) })} className="w-24 rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-right outline-none focus:border-primary" /><button type="button" onClick={() => setForm({ ...form, values: form.values.filter((_, k) => k !== i) })} className="text-slate-300 hover:text-red-600">×</button></div>
              ))}
            </div>
            <div className="mt-2 text-sm text-slate-700">평균 <b>{avg || "-"}</b> {form.unit}{form.standard ? <span className="ml-2 text-xs text-slate-500">기준 {form.standard} {form.unit} 이상{autoResult ? <span className={`ml-1 font-semibold ${autoResult === "합격" ? "text-green-700" : "text-red-600"}`}>→ {autoResult} 예상</span> : null}</span> : null}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block text-sm"><span className="text-slate-600">판정</span><select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value as QualityResult })} className={inputCls}>{(["판정대기", "합격", "불합격"] as QualityResult[]).map((r) => <option key={r}>{r}</option>)}</select></label>
          <label className="block text-sm"><span className="text-slate-600">시험자</span><input list="qc-members" value={form.tester} onChange={(e) => setForm({ ...form, tester: e.target.value })} className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">검토자</span><input list="qc-members" value={form.reviewer} onChange={(e) => setForm({ ...form, reviewer: e.target.value })} className={inputCls} /></label>
          <datalist id="qc-members">{members.map((m) => <option key={m.id} value={m.name} />)}</datalist>
          <label className="block text-sm"><span className="text-slate-600">성적서 파일 (PDF·사진)</span>
            <div className="mt-1 flex items-center gap-2">
              <label className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-slate-700 cursor-pointer hover:border-primary">파일 선택<input type="file" accept="application/pdf,image/*" className="hidden" onChange={onFile} /></label>
              {attachment && <span className="text-xs text-slate-600 truncate max-w-[10rem]" title={attachment.name}>{attachment.name}</span>}
              {attachment && <button type="button" onClick={() => setAttachment(undefined)} className="text-xs text-red-500">삭제</button>}
            </div>
          </label>
        </div>
        <label className="block text-sm"><span className="text-slate-600">메모</span><textarea rows={2} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className={inputCls} /></label>

        <div className="flex items-center justify-between pt-1">
          <div>{onDelete && <button type="button" onClick={onDelete} className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">삭제</button>}</div>
          <div className="flex gap-2"><button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">취소</button><button type="submit" className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2">{initial ? "저장" : "등록"}</button></div>
        </div>
      </form>
    </div>
  );
}
