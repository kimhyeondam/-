"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import SortTh, { useSort, compareValues } from "@/components/SortTh";
import { useServerState } from "@/lib/useServerState";
import LoadingCard from "@/components/LoadingCard";
import { customers as initialCustomers, projects as initialProjects, type Customer, type Project } from "@/data/sample";
import CustomerForm, { type CustomerInput } from "./CustomerForm";
import { entaxCustomerPaste } from "@/lib/entax/paste";

type SortKey = "name" | "bizNo" | "projects" | "revenue";

function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function CustomerManager() {
  const [items, setItems, loaded, loadError] = useServerState<Customer[]>("customers", initialCustomers, "jeil.customers");
  // 프로젝트관리에 저장된 데이터를 읽어 고객별 프로젝트 수·매출을 계산합니다.
  const [projects] = useServerState<Project[]>("projects", initialProjects, "jeil.projects");
  const [query, setQuery] = useState("");
  const { sort, toggle } = useSort<SortKey>({ key: "name", dir: 1 });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  /** 엔택스 거래처 정보 화면의 [Paste] 용 텍스트 복사 */
  async function copyForEntax(c: Customer) {
    const text = entaxCustomerPaste(c);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(c.id);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      window.prompt("자동 복사가 막혀 있습니다. 아래 내용을 복사해 엔택스 거래처 화면에서 Paste 하세요.", text);
    }
  }

  const linked = (c: Customer) => projects.filter((p) => p.client === c.name && p.status !== "취소");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .map((c) => {
        const ps = linked(c);
        return { c, projects: ps.length, revenue: ps.reduce((s, p) => s + p.revenue, 0) };
      })
      .filter(({ c }) => !q || [c.name, c.ceo ?? "", c.bizNo ?? "", c.phone ?? ""].join(" ").toLowerCase().includes(q))
      .sort((a, b) => {
        const v = (r: typeof a): string | number => (sort.key === "projects" ? r.projects : sort.key === "revenue" ? r.revenue : sort.key === "bizNo" ? r.c.bizNo ?? "" : r.c.name);
        return compareValues(v(a), v(b)) * sort.dir;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, projects, query, sort]);

  const totalLinked = items.reduce((s, c) => s + linked(c).length, 0);
  const totalRevenue = items.reduce((s, c) => s + linked(c).reduce((x, p) => x + p.revenue, 0), 0);

  function add(data: CustomerInput) {
    setItems((prev) => [{ ...data, id: `c${Date.now()}`, createdAt: todayIso() }, ...prev]);
    setAdding(false);
  }
  function update(id: string, data: CustomerInput) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
    setEditing(null);
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((c) => c.id !== id));
    setEditing(null);
  }

  return (
    <>
      <PageHeader
        title="고객관리"
        description="거래처 정보를 관리하고, 연결된 프로젝트와 매출을 한눈에 봅니다."
        action={
          <button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">
            ＋ 고객 등록
          </button>
        }
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="총 고객 수" value={`${items.length}곳`} sub="현재 등록된 고객" icon="▣" />
        <StatCard label="연결 프로젝트" value={`${totalLinked}건`} sub="고객과 연결된 전체 프로젝트" icon="▭" highlight />
        <StatCard label="누적 매출" value={`${totalRevenue.toLocaleString("ko-KR")}원`} sub="고객별 프로젝트 합산 매출" icon="₩" tone="green" />
      </div>

      <Card className="p-4">
        <div className="relative max-w-md">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="고객명, 대표자명 또는 사업자번호로 검색" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary" />
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-line">
              <SortTh label="고객명" k="name" sort={sort} onSort={toggle} className="px-5" />
              <SortTh label="사업자번호" k="bizNo" sort={sort} onSort={toggle} />
              <th className="px-3 py-3 font-medium whitespace-nowrap">연락처</th>
              <SortTh label="프로젝트 수" k="projects" sort={sort} onSort={toggle} className="text-right" />
              <SortTh label="누적 매출" k="revenue" sort={sort} onSort={toggle} className="text-right pr-5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">표시할 고객이 없습니다.</td></tr>}
            {rows.map(({ c, projects: n, revenue }) => (
              <tr key={c.id} className="hover:bg-primary-soft/30 transition">
                <td className="px-5 py-3">
                  <button onClick={() => setEditing(c)} className="text-left">
                    <div className="font-medium text-slate-800 hover:text-primary truncate max-w-[18rem]">{c.name}</div>
                    {c.ceo && c.ceo !== "-" && <div className="text-xs text-slate-400">대표 {c.ceo}</div>}
                  </button>
                  <button onClick={() => copyForEntax(c)} title="엔택스 거래처 정보 화면의 [Paste] 용으로 복사" className="mt-1 block rounded-full border border-line bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:border-primary hover:text-primary">{copied === c.id ? "복사됨 ✓" : "엔택스로 복사"}</button>
                </td>
                <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{c.bizNo && c.bizNo !== "-" ? c.bizNo : "-"}{c.dealer && <span className="ml-1.5 rounded-full border border-primary/20 bg-primary-soft px-2 py-0.5 text-[11px] text-primary">대리점</span>}</td>
                <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{c.phone ?? "-"}</td>
                <td className="px-3 py-3 text-right text-slate-700 whitespace-nowrap">{n}건</td>
                <td className="px-3 pr-5 py-3 text-right text-slate-700 whitespace-nowrap tabular-nums">{revenue ? `${revenue.toLocaleString("ko-KR")}원` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {adding && <CustomerForm onSubmit={add} onCancel={() => setAdding(false)} />}
      {editing && <CustomerForm initial={editing} linkedProjects={linked(editing)} onSubmit={(d) => update(editing.id, d)} onCancel={() => setEditing(null)} onDelete={() => remove(editing.id)} />}
      </>)}
    </>
  );
}
