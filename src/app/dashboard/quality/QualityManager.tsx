"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import Tabs from "@/components/Tabs";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { qualityTests as initialTests, products as initialProducts, productions as initialProductions, type Product, type ProductionReport, type QualityResult, type QualityTest } from "@/data/sample";
import { newId, nowIso } from "@/lib/ids";
import { todayIso } from "@/lib/format";
import QualityForm, { type QualityInput } from "./QualityForm";

const resultBadge: Record<QualityResult, string> = { 합격: "bg-green-50 text-green-700 border-green-200", 불합격: "bg-red-50 text-red-700 border-red-200", 판정대기: "bg-amber-50 text-amber-700 border-amber-200" };
const avgOf = (v: number[]) => (v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100 : 0);

export default function QualityManager() {
  const [items, setItems, loaded, loadError] = useServerState<QualityTest[]>("qualityTests", initialTests);
  const [products] = useServerState<Product[]>("products", initialProducts);
  const [productions] = useServerState<ProductionReport[]>("productions", initialProductions);
  const [today] = useState(todayIso);
  const [result, setResult] = useState<"all" | QualityResult>("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<QualityTest | null>(null);
  const [me, setMe] = useState<{ name?: string } | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => {}); }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((t) => result === "all" || t.result === result)
      .filter((t) => !q || [t.productName, t.spec ?? "", t.batchNo ?? "", t.certNo ?? "", t.testType, t.tester ?? ""].join(" ").toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [items, result, query]);
  const month = items.filter((t) => t.date.startsWith(today.slice(0, 7)));
  const pending = items.filter((t) => t.result === "판정대기");
  const failed = items.filter((t) => t.result === "불합격" && t.date >= `${today.slice(0, 4)}-01-01`);

  function add(d: QualityInput) { setItems((prev) => [{ ...d, id: newId("qt"), createdBy: me?.name, createdAt: nowIso() }, ...prev]); setAdding(false); }
  function update(id: string, d: QualityInput) { setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...d } : t))); setEditing(null); }
  function remove(id: string) { if (!confirm("이 시험 기록을 삭제할까요?")) return; setItems((prev) => prev.filter((t) => t.id !== id)); setEditing(null); }
  function openAttachment(t: QualityTest) {
    if (!t.attachment) return;
    const w = window.open("", "_blank");
    if (!w) return;
    if (t.attachment.data.startsWith("data:image/")) w.document.write(`<title>${t.attachment.name}</title><img src="${t.attachment.data}" style="max-width:100%">`);
    else w.document.write(`<title>${t.attachment.name}</title><iframe src="${t.attachment.data}" style="border:0;width:100vw;height:100vh"></iframe>`);
  }

  return (
    <>
      <PageHeader
        title="품질관리"
        description="배치(타설일)별 시험 결과와 자체 시험성적서를 기록합니다. 관급 납품 때 「이 제품 언제 만든 것이고 강도는 얼마였나」를 바로 찾을 수 있습니다."
        action={<button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">＋ 시험 기록</button>}
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="이달 시험" value={`${month.length}건`} sub={`합격 ${month.filter((t) => t.result === "합격").length}건`} icon="✓" onClick={() => setResult("all")} />
        <StatCard label="판정 대기" value={<span className={pending.length ? "text-amber-700" : ""}>{pending.length}건</span>} sub="재령 도달 후 판정" icon="◷" tone="amber" onClick={() => setResult("판정대기")} />
        <StatCard label="올해 불합격" value={<span className={failed.length ? "text-red-600" : ""}>{failed.length}건</span>} sub="원인 기록·재시험" icon="!" onClick={() => setResult("불합격")} />
        <StatCard label="성적서 첨부" value={`${items.filter((t) => t.attachment).length}건`} sub="PDF·사진 보관" icon="▤" />
      </div>
      <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center">
        <Tabs value={result} onChange={(v) => setResult(v as typeof result)} tabs={[{ key: "all", label: "전체", n: items.length }, { key: "합격", label: "합격" }, { key: "판정대기", label: "판정대기", n: pending.length }, { key: "불합격", label: "불합격" }]} />
        <div className="relative w-full md:w-72 md:ml-auto"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="품목, 배치번호, 성적서 번호, 시험자" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary" /></div>
      </Card>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[960px]">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-line"><th className="px-5 py-3 font-medium">시험일</th><th className="px-3 py-3 font-medium">타설일 · 배치</th><th className="px-3 py-3 font-medium">품목</th><th className="px-3 py-3 font-medium">항목</th><th className="px-3 py-3 font-medium text-right">평균 (기준)</th><th className="px-3 py-3 font-medium">판정</th><th className="px-3 py-3 font-medium">시험자</th><th className="px-3 py-3 font-medium">성적서</th><th className="px-3 pr-5 py-3 font-medium">메모</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">시험 기록이 없습니다.</td></tr>}
            {rows.map((t) => (
              <tr key={t.id} className="hover:bg-primary-soft/30">
                <td className="px-5 py-3 whitespace-nowrap"><button onClick={() => setEditing(t)} className="font-medium text-slate-800 hover:text-primary">{t.date}</button></td>
                <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{t.castDate ?? "-"}{t.batchNo ? <div className="text-slate-400">{t.batchNo}</div> : null}</td>
                <td className="px-3 py-3 text-slate-800"><span className="block max-w-[14rem] truncate">{t.productName}</span>{t.spec && <div className="text-xs text-slate-400">{t.spec}</div>}</td>
                <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{t.testType}{t.age ? <span className="text-xs text-slate-400"> · {t.age}일</span> : null}</td>
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap"><b>{avgOf(t.values) || "-"}</b> {t.unit}{t.standard ? <span className="text-xs text-slate-400"> ({t.standard}↑)</span> : null}</td>
                <td className="px-3 py-3 whitespace-nowrap"><span className={`rounded-full border px-2 py-0.5 text-xs ${resultBadge[t.result]}`}>{t.result}</span></td>
                <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{t.tester ?? "-"}</td>
                <td className="px-3 py-3 whitespace-nowrap text-xs">{t.certNo && <div className="text-slate-600">{t.certNo}</div>}{t.attachment ? <button onClick={() => openAttachment(t)} className="rounded-full border border-line bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:border-primary hover:text-primary">파일 보기</button> : <span className="text-slate-300">-</span>}</td>
                <td className="px-3 pr-5 py-3 text-xs text-slate-500"><span className="block max-w-[12rem] truncate" title={t.memo}>{t.memo ?? "-"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-400">자체 시험성적서 양식을 보내 주시면 그 양식대로 칸과 인쇄(PDF)를 맞추겠습니다. 지금은 일반적인 강도 시험 항목으로 칸을 두었습니다.</p>
      </>)}
      {adding && <QualityForm today={today} products={products} productions={productions} onSubmit={add} onCancel={() => setAdding(false)} />}
      {editing && <QualityForm initial={editing} today={today} products={products} productions={productions} onSubmit={(d) => update(editing.id, d)} onCancel={() => setEditing(null)} onDelete={() => remove(editing.id)} />}
    </>
  );
}
