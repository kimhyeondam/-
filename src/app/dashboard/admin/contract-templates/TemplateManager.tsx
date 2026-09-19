"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { todayIso } from "@/lib/format";
import { contractTemplates as initialTemplates, contractPlaceholders, type ContractTemplate } from "@/data/sample";

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

export default function TemplateManager() {
  const [items, setItems, loaded, loadError] = useServerState<ContractTemplate[]>("contractTemplates", initialTemplates);
  const [editing, setEditing] = useState<ContractTemplate | null | "new">(null);

  function save(data: Omit<ContractTemplate, "id" | "createdAt">, id?: string) {
    if (id) setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    else setItems((prev) => [{ ...data, id: `ct${Date.now()}`, createdAt: todayIso() }, ...prev]);
    setEditing(null);
  }
  function remove(id: string) { if (confirm("이 템플릿을 삭제할까요? (이미 작성된 계약서에는 영향이 없습니다)")) { setItems((prev) => prev.filter((t) => t.id !== id)); setEditing(null); } }

  return (
    <>
      <PageHeader
        title="계약 템플릿"
        description="자주 쓰는 계약서 틀을 만들어 두면 계약 작성 때 고객명·금액·기간이 자동으로 채워집니다."
        action={<button onClick={() => setEditing("new")} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">＋ 템플릿 추가</button>}
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="템플릿" value={`${items.length}개`} sub="등록된 계약서 틀" icon="▤" />
            <StatCard label="빈칸 항목" value={`${contractPlaceholders.length}개`} sub="자동으로 채워지는 항목" icon="{}" highlight />
          </div>
          <Card className="p-4 text-xs text-slate-600">
            <b className="text-slate-800">쓸 수 있는 빈칸:</b> {contractPlaceholders.map((p) => <code key={p} className="ml-1 rounded bg-background border border-line px-1.5 py-0.5">{p}</code>)}
            <span className="ml-2 text-slate-400">— 본문에 그대로 적어 두면 계약 작성 시 실제 값으로 바뀝니다.</span>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((t) => (
              <Card key={t.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-800">{t.name}</div>
                    {t.description && <div className="mt-0.5 text-xs text-slate-500">{t.description}</div>}
                  </div>
                  <button onClick={() => setEditing(t)} className="shrink-0 rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-700 hover:border-primary hover:text-primary">수정</button>
                </div>
                <pre className="mt-3 max-h-40 overflow-hidden whitespace-pre-wrap rounded-xl bg-background p-3 text-[11px] leading-relaxed text-slate-600 font-sans">{t.body.slice(0, 500)}{t.body.length > 500 ? "\n…" : ""}</pre>
                <div className="mt-2 text-[11px] text-slate-400">{t.body.split("\n").length}줄 · 등록 {t.createdAt}</div>
              </Card>
            ))}
          </div>
        </>
      )}
      {editing && <TemplateForm initial={editing === "new" ? undefined : editing} onSubmit={(d) => save(d, editing === "new" ? undefined : editing.id)} onCancel={() => setEditing(null)} onDelete={editing !== "new" ? () => remove(editing.id) : undefined} />}
    </>
  );
}

function TemplateForm({ initial, onSubmit, onCancel, onDelete }: { initial?: ContractTemplate; onSubmit: (d: Omit<ContractTemplate, "id" | "createdAt">) => void; onCancel: () => void; onDelete?: () => void }) {
  const [form, setForm] = useState({ name: initial?.name ?? "", description: initial?.description ?? "", body: initial?.body ?? "물품 공급 계약서\n\n{{공급자명}}(이하 \"갑\")과 {{고객명}}(이하 \"을\")은 아래와 같이 계약한다.\n\n제1조 (목적)\n\n제2조 (계약금액)\n일금 {{계약금액한글}}원정(₩{{계약금액}})\n\n{{계약일}}\n\n갑: {{공급자명}} 대표 {{공급자대표}} (인)\n을: {{고객명}} {{고객담당자}} (서명)" });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!form.name.trim() || !form.body.trim()) return; onSubmit({ name: form.name.trim(), description: form.description.trim() || undefined, body: form.body }); }} className="w-full max-w-3xl rounded-2xl bg-card p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-slate-800">{initial ? "템플릿 수정" : "템플릿 추가"}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm"><span className="text-slate-600">템플릿 이름 *</span><input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">설명</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} /></label>
        </div>
        <label className="block text-sm"><span className="text-slate-600">본문 * <span className="text-slate-400">(첫 줄은 제목으로 크게 표시됩니다. 「제1조」 같은 조항 제목은 굵게 표시됩니다)</span></span><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={18} className={`${inputCls} font-mono text-[13px]`} /></label>
        <div className="flex items-center justify-between">
          <div>{onDelete && <button type="button" onClick={onDelete} className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">삭제</button>}</div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
            <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark px-5 py-2 text-sm font-semibold text-white">저장</button>
          </div>
        </div>
      </form>
    </div>
  );
}
