"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import SortTh, { useSort, compareValues } from "@/components/SortTh";
import { useServerState } from "@/lib/useServerState";
import LoadingCard from "@/components/LoadingCard";
import { formatWon, todayIso } from "@/lib/format";
import {
  quotations as initialQuotes, customers as initialCustomers, projects as initialProjects, revenues as initialRevenues, quoteTotal,
  type Quotation, type Customer, type Project, type Revenue,
} from "@/data/sample";
import { quoteStatusBadge } from "./quoteMeta";
import QuoteForm, { type QuoteInput } from "./QuoteForm";

type SortKey = "number" | "recipient" | "date" | "total" | "status";

/** 견적번호: QT-연월-순번 (같은 달 안에서 이어짐) */
function nextNumber(items: Quotation[], date: string) {
  const ym = date.slice(2, 4) + date.slice(5, 7);
  const prefix = `QT-${ym}-`;
  const n = items.filter((q) => q.number.startsWith(prefix)).map((q) => parseInt(q.number.slice(prefix.length), 10) || 0);
  return `${prefix}${String((n.length ? Math.max(...n) : 0) + 1).padStart(3, "0")}`;
}

export default function QuoteManager() {
  const [items, setItems, loaded, loadError] = useServerState<Quotation[]>("quotations", initialQuotes, "jeil.quotations");
  const [today] = useState(todayIso);
  const [customers] = useServerState<Customer[]>("customers", initialCustomers, "jeil.customers");
  const [projects] = useServerState<Project[]>("projects", initialProjects, "jeil.projects");
  const [revenues, setRevenues] = useServerState<Revenue[]>("revenues", initialRevenues, "jeil.revenues");
  const [query, setQuery] = useState("");
  const { sort, toggle } = useSort<SortKey>({ key: "date", dir: -1 });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((x) => !q || [x.number, x.recipient, x.memo ?? "", x.project ?? "", x.items.map((i) => i.name).join(" ")].join(" ").toLowerCase().includes(q))
      .sort((a, b) => {
        const v = (x: Quotation): string | number => (sort.key === "total" ? quoteTotal(x) : x[sort.key]);
        return compareValues(v(a), v(b)) * sort.dir;
      });
  }, [items, query, sort]);

  const totalAmount = filtered.reduce((s, q) => s + quoteTotal(q), 0);
  const drafting = filtered.filter((q) => q.status === "작성중").length;
  const accepted = filtered.filter((q) => q.status === "수락").length;

  function add(data: QuoteInput) {
    setItems((prev) => [{ ...data, id: `q${Date.now()}`, number: nextNumber(prev, data.date) }, ...prev]);
    setAdding(false);
  }
  function update(id: string, data: QuoteInput) {
    setItems((prev) => prev.map((q) => (q.id === id ? { ...q, ...data } : q)));
    setEditing(null);
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((q) => q.id !== id));
    setEditing(null);
  }
  /** 수락된 견적을 매출 청구 건으로 등록 */
  function convert(q: Quotation) {
    setRevenues((prev) => [
      { id: `r${Date.now()}`, title: `${q.recipient} 견적 ${q.number}`, customer: q.recipient, project: q.project, amount: quoteTotal(q), quoteId: q.id, memo: "견적에서 전환 (매출일은 청구 시 지정)" },
      ...prev,
    ]);
    setItems((prev) => prev.map((x) => (x.id === q.id ? { ...x, status: "수락" } : x)));
    setEditing(null);
    flash(`${q.number} 견적을 매출로 전환했습니다. 매출관리에서 매출일을 지정하세요.`);
  }
  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4500);
  }

  return (
    <>
      <PageHeader
        title="견적 관리"
        description="거래처에 보낸 견적서를 등록하고 발송 → 수락 → 매출까지 이어서 관리합니다."
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => flash("AI 지침(단가표·문구 규칙)은 AI 비서 단계에서 설정할 수 있게 됩니다.")} className="rounded-full border border-line bg-white text-slate-700 text-sm px-4 py-2.5 hover:border-primary hover:text-primary transition">☰ AI 지침</button>
            <button onClick={() => flash("AI 견적 생성은 AI 비서 단계에서 연결됩니다. 지금은 직접 등록해 주세요.")} className="rounded-full border border-line bg-white text-slate-700 text-sm px-4 py-2.5 hover:border-primary hover:text-primary transition">✦ AI 견적 생성</button>
            <button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">＋ 견적 등록</button>
          </div>
        }
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>
      {notice && <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">{notice}</div>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="총 견적" value={`${filtered.length}건`} sub="현재 조건 기준으로 보이는 견적 수" icon="▤" />
        <StatCard label="총 견적금액" value={formatWon(totalAmount)} sub="현재 목록의 합계 금액" icon="▤" highlight />
        <StatCard label="작성중" value={`${drafting}건`} sub="작성 또는 내부 조정 중인 견적" icon="✎" tone="amber" />
        <StatCard label="수락" value={`${accepted}건`} sub="고객이 수락한 견적" icon="✓" tone="green" />
      </div>

      <Card className="p-4 flex items-center justify-between gap-3">
        <div className="relative max-w-md flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="견적번호, 수신자명, 품명, 메모를 검색하세요" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary" />
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap">{filtered.length}건 표시 중</span>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-line">
              <SortTh label="견적번호" k="number" sort={sort} onSort={toggle} className="px-5" />
              <SortTh label="수신자" k="recipient" sort={sort} onSort={toggle} />
              <th className="px-3 py-3 font-medium">품목</th>
              <SortTh label="견적일" k="date" sort={sort} onSort={toggle} />
              <SortTh label="합계금액" k="total" sort={sort} onSort={toggle} className="text-right" />
              <SortTh label="상태" k="status" sort={sort} onSort={toggle} />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">표시할 견적이 없습니다.</td></tr>}
            {filtered.map((q) => (
              <tr key={q.id} className="hover:bg-primary-soft/30 transition">
                <td className="px-5 py-3 whitespace-nowrap"><button onClick={() => setEditing(q)} className="font-medium text-slate-800 hover:text-primary truncate max-w-[18rem]">{q.number}</button></td>
                <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{q.recipient}</td>
                <td className="px-3 py-3 text-slate-500 text-xs max-w-[260px] truncate">{q.items.map((i) => `${i.name}${i.spec ? ` ${i.spec}` : ""} ${i.qty}${i.unit}`).join(", ")}</td>
                <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{q.date}</td>
                <td className="px-3 py-3 text-right text-slate-800 whitespace-nowrap tabular-nums">{quoteTotal(q).toLocaleString("ko-KR")}</td>
                <td className="px-3 py-3 whitespace-nowrap"><span className={`rounded-full border px-2.5 py-0.5 text-xs ${quoteStatusBadge[q.status]}`}>{q.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {adding && <QuoteForm defaultDate={today} customers={customers} projects={projects} onSubmit={add} onCancel={() => setAdding(false)} />}
      {editing && (
        <QuoteForm
          initial={editing}
          defaultDate={today}
          customers={customers}
          projects={projects}
          onSubmit={(d) => update(editing.id, d)}
          onCancel={() => setEditing(null)}
          onDelete={() => remove(editing.id)}
          onConvert={() => convert(editing)}
          convertedAlready={revenues.some((r) => r.quoteId === editing.id)}
        />
      )}
      </>)}
    </>
  );
}
