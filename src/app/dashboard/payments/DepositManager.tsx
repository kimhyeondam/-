"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import SortTh, { useSort, compareValues } from "@/components/SortTh";
import { useServerState } from "@/lib/useServerState";
import LoadingCard from "@/components/LoadingCard";
import { formatWon, todayIso } from "@/lib/format";
import { deposits as initialDeposits, revenues as initialRevenues, type Deposit, type Revenue } from "@/data/sample";
import DepositForm, { type DepositInput } from "./DepositForm";

type SortKey = "date" | "payer" | "amount" | "bank" | "source";

export default function DepositManager() {
  const [items, setItems, loaded, loadError] = useServerState<Deposit[]>("deposits", initialDeposits, "jeil.deposits");
  const [today] = useState(todayIso);
  const [revenues] = useServerState<Revenue[]>("revenues", initialRevenues, "jeil.revenues");
  const [query, setQuery] = useState("");
  const { sort, toggle } = useSort<SortKey>({ key: "date", dir: -1 });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Deposit | null>(null);

  const thisYear = today.slice(0, 4);
  const thisMonth = today.slice(0, 7);
  const monthTotal = items.filter((d) => d.date.startsWith(thisMonth)).reduce((s, d) => s + d.amount, 0);
  const yearTotal = items.filter((d) => d.date.startsWith(thisYear)).reduce((s, d) => s + d.amount, 0);
  const linkedCount = items.filter((d) => d.revenueId && revenues.some((r) => r.id === d.revenueId)).length;

  const revenueOf = (d: Deposit) => revenues.find((r) => r.id === d.revenueId);
  /** 특정 입금을 제외한 매출의 미수금 */
  const remainingOf = (r: Revenue, exceptId?: string) => Math.max(r.amount - items.filter((d) => d.revenueId === r.id && d.id !== exceptId).reduce((s, d) => s + d.amount, 0), 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((d) => !q || [d.payer, d.bank ?? "", d.memo ?? "", revenueOf(d)?.title ?? ""].join(" ").toLowerCase().includes(q))
      .sort((a, b) => compareValues(a[sort.key] ?? "", b[sort.key] ?? "") * sort.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, revenues, query, sort]);

  function add(data: DepositInput) {
    setItems((prev) => [{ ...data, id: `d${Date.now()}` }, ...prev]);
    setAdding(false);
  }
  function update(id: string, data: DepositInput) {
    setItems((prev) => prev.map((d) => (d.id === id ? { ...d, ...data } : d)));
    setEditing(null);
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((d) => d.id !== id));
    setEditing(null);
  }

  return (
    <>
      <PageHeader
        title="입금 관리"
        description="통장에 들어온 돈을 기록하고 매출과 연결해 미수금을 줄여 갑니다."
        action={<button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">입금 등록</button>}
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label={`${Number(thisMonth.slice(5))}월 입금액`} value={formatWon(monthTotal)} sub="이번 달에 확인된 총 입금액" icon="₩" tone="green" />
        <StatCard label={`${thisYear}년 입금액`} value={formatWon(yearTotal)} sub="올해 누적 입금액" icon="▤" />
        <StatCard label="입금 건수" value={`${items.length}건`} sub="현재 등록된 총 입금 수" icon="▥" highlight />
        <StatCard label="매출 연결" value={`${linkedCount}건`} sub="매출 항목과 연결된 입금 수" icon="⇄" />
      </div>

      <Card className="p-4 flex items-center justify-between gap-3">
        <div className="relative max-w-md flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="입금자명, 은행, 메모, 연결 매출을 검색하세요" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary" />
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap">{filtered.length}건 표시 중</span>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-line">
              <SortTh label="입금일" k="date" sort={sort} onSort={toggle} className="px-5" />
              <SortTh label="입금자명" k="payer" sort={sort} onSort={toggle} />
              <SortTh label="입금액" k="amount" sort={sort} onSort={toggle} className="text-right" />
              <SortTh label="은행" k="bank" sort={sort} onSort={toggle} />
              <SortTh label="출처" k="source" sort={sort} onSort={toggle} />
              <th className="px-3 py-3 font-medium">매출 연결</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">표시할 입금이 없습니다.</td></tr>}
            {filtered.map((d) => {
              const r = revenueOf(d);
              return (
                <tr key={d.id} className="hover:bg-primary-soft/30 transition">
                  <td className="px-5 py-3 text-slate-600 whitespace-nowrap"><button onClick={() => setEditing(d)} className="hover:text-primary">{d.date}</button></td>
                  <td className="px-3 py-3 whitespace-nowrap"><button onClick={() => setEditing(d)} className="font-medium text-slate-800 hover:text-primary truncate max-w-[18rem]">{d.payer}</button></td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-800 whitespace-nowrap">{formatWon(d.amount)}</td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{d.bank ?? "-"}</td>
                  <td className="px-3 py-3 whitespace-nowrap"><span className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs text-slate-600">{d.source}</span></td>
                  <td className="px-3 py-3">
                    {r ? (
                      <Link href="/dashboard/sales" className="text-primary hover:underline">{r.title}</Link>
                    ) : (
                      <span className="text-slate-400">미연결</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {adding && <DepositForm defaultDate={today} revenues={revenues} remainingOf={(r) => remainingOf(r)} onSubmit={add} onCancel={() => setAdding(false)} />}
      {editing && <DepositForm initial={editing} defaultDate={today} revenues={revenues} remainingOf={(r) => remainingOf(r, editing.id)} onSubmit={(d) => update(editing.id, d)} onCancel={() => setEditing(null)} onDelete={() => remove(editing.id)} />}
      </>)}
    </>
  );
}
