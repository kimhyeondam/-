"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import {
  revenues as iRev, deposits as iDep, purchases as iPur, productions as iProd, products as iProducts, stockMoves as iMoves, attendance as iAtt, dispatches as iDisp, qualityTests as iQc, customers as iCust, company as defaultCompany, purchaseTotal,
  type Revenue, type Deposit, type Purchase, type ProductionReport, type Product, type StockMove, type Attendance, type Dispatch, type QualityTest, type Customer,
} from "@/data/sample";
import { formatWon, todayIso } from "@/lib/format";
import { lowStock } from "@/lib/inventory/stock";

function shiftMonth(month: string, n: number) { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
const WORKING = new Set(["출근", "지각", "조퇴", "반차", "외근"]);

export default function ReportView({ initialMonth }: { initialMonth?: string } = {}) {
  const [revenues, , l1] = useServerState<Revenue[]>("revenues", iRev, "jeil.revenues");
  const [deposits, , l2] = useServerState<Deposit[]>("deposits", iDep, "jeil.deposits");
  const [purchases, , l3] = useServerState<Purchase[]>("purchases", iPur);
  const [productions] = useServerState<ProductionReport[]>("productions", iProd);
  const [products] = useServerState<Product[]>("products", iProducts);
  const [moves] = useServerState<StockMove[]>("stockMoves", iMoves);
  const [attendance] = useServerState<Attendance[]>("attendance", iAtt);
  const [dispatches] = useServerState<Dispatch[]>("dispatches", iDisp);
  const [qc] = useServerState<QualityTest[]>("qualityTests", iQc);
  const [customers] = useServerState<Customer[]>("customers", iCust, "jeil.customers");
  const [today] = useState(todayIso);
  const [month, setMonth] = useState(initialMonth ?? today.slice(0, 7));
  const loaded = l1 && l2 && l3;
  const prev = shiftMonth(month, -1);
  const label = `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;

  const r = useMemo(() => {
    const inM = (d?: string) => !!d && d.startsWith(month);
    const inP = (d?: string) => !!d && d.startsWith(prev);
    const salesM = revenues.filter((x) => inM(x.date)); const salesP = revenues.filter((x) => inP(x.date));
    const depM = deposits.filter((x) => inM(x.date)); const depP = deposits.filter((x) => inP(x.date));
    const purM = purchases.filter((x) => inM(x.date)); const purP = purchases.filter((x) => inP(x.date));
    const paidOf = (rev: Revenue) => deposits.filter((d) => d.revenueId === rev.id).reduce((s, d) => s + d.amount, 0);
    const outstanding = revenues.filter((x) => x.amount > 0 && (!x.date || x.date <= `${month}-31`)).map((x) => ({ rev: x, due: Math.max(x.amount - paidOf(x), 0) })).filter((x) => x.due > 0);
    const payable = purchases.filter((x) => x.date <= `${month}-31`).reduce((s, p) => s + Math.max(purchaseTotal(p) - p.paid, 0), 0);
    const byCustomer = new Map<string, number>();
    salesM.forEach((x) => byCustomer.set(x.customer ?? "(미지정)", (byCustomer.get(x.customer ?? "(미지정)") ?? 0) + x.amount));
    const prodM = productions.filter((x) => inM(x.date));
    const produced = prodM.reduce((s, p) => s + p.items.reduce((a, i) => a + i.produced, 0), 0);
    const defect = prodM.reduce((s, p) => s + p.items.reduce((a, i) => a + (i.defect ?? 0), 0), 0);
    const byProduct = new Map<string, { qty: number; unit: string }>();
    prodM.forEach((p) => p.items.forEach((i) => { const cur = byProduct.get(i.name) ?? { qty: 0, unit: i.unit }; byProduct.set(i.name, { qty: cur.qty + i.produced, unit: i.unit }); }));
    const shipped = moves.filter((m) => inM(m.date) && m.type === "출하").reduce((s, m) => s - m.qty, 0);
    const low = lowStock(products, moves);
    const attM = attendance.filter((a) => inM(a.date));
    const workDays = attM.filter((a) => WORKING.has(a.status)).length;
    const overtime = attM.reduce((s, a) => s + (a.overtime ?? 0), 0);
    const absent = attM.filter((a) => a.status === "결근").length;
    const dispM = dispatches.filter((d) => inM(d.date));
    const qcM = qc.filter((q) => inM(q.date));
    return {
      sales: salesM.reduce((s, x) => s + x.amount, 0), salesPrev: salesP.reduce((s, x) => s + x.amount, 0), salesCount: salesM.length,
      dep: depM.reduce((s, x) => s + x.amount, 0), depPrev: depP.reduce((s, x) => s + x.amount, 0),
      pur: purM.reduce((s, x) => s + purchaseTotal(x), 0), purPrev: purP.reduce((s, x) => s + purchaseTotal(x), 0),
      outstanding, outstandingTotal: outstanding.reduce((s, x) => s + x.due, 0), payable,
      topCustomers: [...byCustomer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      produced, defect, byProduct: [...byProduct.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 8), shipped, low, prodDays: prodM.length,
      workDays, overtime, absent, people: new Set(attM.map((a) => a.memberId)).size,
      dispatches: dispM.length, dispatchDone: dispM.filter((d) => d.status === "인수완료").length, own: dispM.filter((d) => d.own).length,
      qc: qcM.length, qcPass: qcM.filter((q) => q.result === "합격").length, qcFail: qcM.filter((q) => q.result === "불합격").length,
    };
  }, [revenues, deposits, purchases, productions, moves, products, attendance, dispatches, qc, month, prev]);

  const diff = (a: number, b: number) => (b ? `${a >= b ? "▲" : "▼"} ${Math.abs(Math.round(((a - b) / b) * 100))}% (전월 ${formatWon(b)})` : "전월 자료 없음");
  const dealerCount = customers.filter((c) => c.dealer).length;

  return (
    <>
      <PageHeader
        title="월간 보고"
        description="매출·입금·매입·생산·재고·출근·배차·품질을 한 장으로 봅니다. 은행·세무사에 줄 때는 「인쇄 / PDF 저장」을 누르세요."
        action={<button onClick={() => window.print()} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">인쇄 / PDF 저장</button>}
      />
      {!loaded && <LoadingCard />}
      {loaded && (<>
      <Card className="p-4 flex flex-wrap items-center gap-3 print:hidden">
        <div className="inline-flex items-center rounded-full border border-line overflow-hidden">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="px-3 py-1.5 text-slate-600 hover:bg-primary-soft">‹</button>
          <button onClick={() => setMonth(today.slice(0, 7))} className="px-3 py-1.5 text-sm font-semibold text-slate-700 border-x border-line">이번 달</button>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="px-3 py-1.5 text-slate-600 hover:bg-primary-soft">›</button>
        </div>
        <span className="font-bold text-slate-800">{label}</span>
      </Card>
      <div className="hidden print:block"><div className="text-2xl font-bold">{defaultCompany.name} {label} 경영 보고</div><div className="text-sm text-slate-500">작성일 {today}</div></div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="매출" value={formatWon(r.sales)} sub={`${r.salesCount}건 · ${diff(r.sales, r.salesPrev)}`} icon="$" />
        <StatCard label="입금" value={formatWon(r.dep)} sub={diff(r.dep, r.depPrev)} icon="▮" tone="green" />
        <StatCard label="매입" value={formatWon(r.pur)} sub={diff(r.pur, r.purPrev)} icon="▽" />
        <StatCard label="매출 − 매입" value={<span className={r.sales - r.pur >= 0 ? "" : "text-red-600"}>{formatWon(r.sales - r.pur)}</span>} sub="단순 차액 (인건비·경비 제외)" icon="=" tone="amber" />
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="미수금 (월말 기준)" value={<span className={r.outstandingTotal ? "text-red-600" : ""}>{formatWon(r.outstandingTotal)}</span>} sub={`${r.outstanding.length}건`} icon="!" href="/dashboard/payments" />
        <StatCard label="미지급금" value={formatWon(r.payable)} sub="매입 중 아직 안 준 돈" icon="▽" href="/dashboard/purchases" />
        <StatCard label="생산" value={r.produced.toLocaleString("ko-KR")} sub={`일보 ${r.prodDays}일 · 불량 ${r.defect} (${r.produced + r.defect ? ((r.defect / (r.produced + r.defect)) * 100).toFixed(1) : 0}%)`} icon="⚒" href={`/dashboard/production`} />
        <StatCard label="출하" value={r.shipped.toLocaleString("ko-KR")} sub={`배차 ${r.dispatches}건 (인수완료 ${r.dispatchDone}, 자차 ${r.own})`} icon="🚚" href="/dashboard/dispatch" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="font-bold text-slate-800">거래처별 매출</h2>
          {r.topCustomers.length === 0 ? <p className="mt-2 text-sm text-slate-400">이달 매출이 없습니다.</p> : (
            <ul className="mt-3 space-y-2">{r.topCustomers.map(([name, amt]) => (
              <li key={name} className="text-sm"><div className="flex justify-between"><span className="text-slate-700">{name}</span><b>{formatWon(amt)}</b></div><div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary" style={{ width: `${r.sales ? Math.round((amt / r.sales) * 100) : 0}%` }} /></div></li>
            ))}</ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-bold text-slate-800">미수금 상위</h2>
          {r.outstanding.length === 0 ? <p className="mt-2 text-sm text-slate-400">미수금이 없습니다.</p> : (
            <table className="mt-3 w-full text-sm"><tbody className="divide-y divide-line">{[...r.outstanding].sort((a, b) => b.due - a.due).slice(0, 6).map(({ rev, due }) => (
              <tr key={rev.id}><td className="py-1.5 text-slate-500 whitespace-nowrap text-xs">{rev.date ?? "-"}</td><td className="py-1.5 px-2 text-slate-700"><span className="block max-w-[14rem] truncate">{rev.customer ?? ""} · {rev.title}</span></td><td className="py-1.5 text-right tabular-nums font-semibold text-red-600 whitespace-nowrap">{formatWon(due)}</td></tr>
            ))}</tbody></table>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-bold text-slate-800">품목별 생산</h2>
          {r.byProduct.length === 0 ? <p className="mt-2 text-sm text-slate-400">생산일보가 없습니다.</p> : (
            <table className="mt-3 w-full text-sm"><tbody className="divide-y divide-line">{r.byProduct.map(([name, v]) => <tr key={name}><td className="py-1.5 text-slate-700">{name}</td><td className="py-1.5 text-right tabular-nums font-semibold whitespace-nowrap">{v.qty.toLocaleString("ko-KR")} {v.unit}</td></tr>)}</tbody></table>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-bold text-slate-800">재고 · 품질 · 인력</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>재고 부족 품목: {r.low.length ? <span className="text-red-600 font-semibold">{r.low.map((l) => `${l.product.name} ${l.qty}${l.product.unit}`).join(", ")}</span> : <span className="text-green-700">없음</span>}</li>
            <li>품질 시험: {r.qc}건 (합격 {r.qcPass}, 불합격 <span className={r.qcFail ? "text-red-600 font-semibold" : ""}>{r.qcFail}</span>)</li>
            <li>출근: 연 {r.workDays}일 · {r.people}명 기록 · 연장 {r.overtime}시간 · 결근 {r.absent}일</li>
            <li>거래처 {customers.length}곳 (대리점 {dealerCount})</li>
          </ul>
        </Card>
      </div>
      <p className="text-xs text-slate-400 print:hidden">매출과 입금은 그 달 날짜 기준, 미수금·미지급금은 그 달 말까지 쌓인 금액입니다. 인건비는 관리자 메뉴 「급여 집계」에서 따로 봅니다.</p>
      </>)}
    </>
  );
}
