"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import Tabs from "@/components/Tabs";
import SortTh, { useSort, compareValues } from "@/components/SortTh";
import { useServerState } from "@/lib/useServerState";
import LoadingCard from "@/components/LoadingCard";
import { leads as initialLeads, customers as initialCustomers, type Lead, type LeadStatus, type Customer } from "@/data/sample";
import { leadStatuses, leadStatusBadge } from "./leadMeta";
import LeadForm, { type LeadInput } from "./LeadForm";

type SortKey = "company" | "contact" | "phone" | "source" | "status" | "assignee" | "createdAt";

function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function LeadManager() {
  const [items, setItems, loaded, loadError] = useServerState<Lead[]>("leads", initialLeads, "jeil.leads");
  const [customers, setCustomers] = useServerState<Customer[]>("customers", initialCustomers, "jeil.customers");
  const [status, setStatus] = useState<"all" | LeadStatus>("all");
  const [query, setQuery] = useState("");
  const { sort, toggle } = useSort<SortKey>({ key: "createdAt", dir: -1 });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const count = (s: LeadStatus) => items.filter((l) => l.status === s).length;
  const converted = count("계약완료");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((l) => status === "all" || l.status === status)
      .filter((l) => !q || [l.company, l.contact, l.phone ?? "", l.email ?? "", l.product ?? ""].join(" ").toLowerCase().includes(q))
      .sort((a, b) => {
        const v = (l: Lead): string | number => (sort.key === "status" ? leadStatuses.indexOf(l.status) : l[sort.key] ?? "");
        return compareValues(v(a), v(b)) * sort.dir;
      });
  }, [items, status, query, sort]);

  function add(data: LeadInput) {
    setItems((prev) => [{ ...data, id: `l${Date.now()}`, createdAt: todayIso() }, ...prev]);
    setAdding(false);
  }
  function update(id: string, data: LeadInput) {
    setItems((prev) => prev.map((l) => (l.id === id ? { ...l, ...data } : l)));
    setEditing(null);
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((l) => l.id !== id));
    setEditing(null);
  }
  /** 리드 → 고객 전환: 고객관리에 등록하고 리드 상태를 계약완료로 */
  function convert(l: Lead) {
    if (!customers.some((c) => c.name === l.company)) {
      setCustomers((prev) => [{ id: `c${Date.now()}`, name: l.company, ceo: undefined, phone: l.phone, email: l.email, memo: `리드에서 전환 (담당자 ${l.contact}${l.product ? `, 관심 제품 ${l.product}` : ""})`, createdAt: todayIso() }, ...prev]);
    }
    setItems((prev) => prev.map((x) => (x.id === l.id ? { ...x, status: "계약완료" } : x)));
    setEditing(null);
    setToast(`${l.company}을(를) 고객으로 전환했습니다. 고객관리에서 확인하세요.`);
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <>
      <PageHeader
        title="리드 관리"
        description="문의가 들어온 잠재 고객을 등록하고 상담 → 견적 → 계약까지 단계별로 관리합니다."
        action={
          <button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">
            ＋ 리드 등록
          </button>
        }
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>
      {toast && <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">{toast}</div>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="전체 리드" value={`${items.length}건`} sub="현재 등록된 잠재 고객 수" icon="▣" />
        <StatCard label="신규" value={`${count("신규")}건`} sub="아직 첫 응대가 필요한 문의" icon="⌕" tone="amber" />
        <StatCard label="상담중" value={`${count("상담중")}건`} sub="현재 커뮤니케이션이 진행 중인 리드" icon="…" highlight />
        <StatCard label="전환 완료" value={`${converted}건`} sub="계약 또는 고객 전환이 끝난 리드" icon="✓" tone="green" />
      </div>

      <Card className="p-4 space-y-3">
        <Tabs value={status} onChange={(v) => setStatus(v as "all" | LeadStatus)} tabs={[{ key: "all", label: "전체" }, ...leadStatuses.map((s) => ({ key: s, label: s }))]} />
        <div className="flex items-center justify-between gap-3">
          <div className="relative max-w-md flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="회사명, 담당자, 연락처, 이메일을 검색하세요" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary" />
          </div>
          <span className="text-xs text-slate-400 whitespace-nowrap">{filtered.length}건 표시 중</span>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-line">
              <SortTh label="회사명" k="company" sort={sort} onSort={toggle} className="px-5" />
              <SortTh label="담당자" k="contact" sort={sort} onSort={toggle} />
              <SortTh label="연락처" k="phone" sort={sort} onSort={toggle} />
              <SortTh label="유입경로" k="source" sort={sort} onSort={toggle} />
              <SortTh label="상태" k="status" sort={sort} onSort={toggle} />
              <SortTh label="담당직원" k="assignee" sort={sort} onSort={toggle} />
              <SortTh label="등록일" k="createdAt" sort={sort} onSort={toggle} />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">표시할 리드가 없습니다.</td></tr>}
            {filtered.map((l) => (
              <tr key={l.id} className="hover:bg-primary-soft/30 transition">
                <td className="px-5 py-3">
                  <button onClick={() => setEditing(l)} className="text-left">
                    <div className="font-medium text-slate-800 hover:text-primary truncate max-w-[18rem]">{l.company}</div>
                    {l.product && <div className="text-xs text-slate-400">{l.product}</div>}
                  </button>
                </td>
                <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{l.contact}</td>
                <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{l.phone ?? "-"}</td>
                <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{l.source}</td>
                <td className="px-3 py-3 whitespace-nowrap"><span className={`rounded-full border px-2.5 py-0.5 text-xs ${leadStatusBadge[l.status]}`}>{l.status}</span></td>
                <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{l.assignee ?? "-"}</td>
                <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{l.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {adding && <LeadForm onSubmit={add} onCancel={() => setAdding(false)} />}
      {editing && (
        <LeadForm
          initial={editing}
          alreadyCustomer={customers.some((c) => c.name === editing.company)}
          onSubmit={(d) => update(editing.id, d)}
          onCancel={() => setEditing(null)}
          onDelete={() => remove(editing.id)}
          onConvert={() => convert(editing)}
        />
      )}
      </>)}
    </>
  );
}
