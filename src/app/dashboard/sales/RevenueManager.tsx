"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import SortTh, { useSort, compareValues } from "@/components/SortTh";
import Tabs from "@/components/Tabs";
import { useServerState } from "@/lib/useServerState";
import LoadingCard from "@/components/LoadingCard";
import { formatWon } from "@/lib/format";
import {
  revenues as initialRevenues, deposits as initialDeposits, customers as initialCustomers, projects as initialProjects, formDocs as initialDocs,
  type Revenue, type Deposit, type Customer, type Project, type FormDoc,
} from "@/data/sample";
import { nextDocNumber } from "@/lib/documents/calc";
import { todayIso } from "@/lib/format";
import { docFromRevenue, syncDocWithRevenue } from "@/lib/sales/revenueDoc";
import { newId } from "@/lib/ids";
import { entaxSalesPaste } from "@/lib/entax/paste";
import DunningDialog from "./DunningDialog";
import { dispatchFromRevenue, syncDispatchWithRevenue } from "@/lib/dispatch/fromRevenue";
import { dispatches as initialDispatches, deliveryModeLabel, type Dispatch } from "@/data/sample";
import { movesForRevenue, replaceMovesByRef } from "@/lib/inventory/stock";
import { products as initialProducts, stockMoves as initialMoves, type Product, type StockMove } from "@/data/sample";
import MonthlyChart from "./MonthlyChart";
import RevenueForm, { type RevenueInput } from "./RevenueForm";
import ReceiptDialog from "./ReceiptDialog";
import type { Receipt } from "@/lib/receipts";

type SortKey = "date" | "title" | "customer" | "amount" | "paid" | "due";

export default function RevenueManager() {
  const [items, setItems, loaded, loadError] = useServerState<Revenue[]>("revenues", initialRevenues, "jeil.revenues");
  // 인수증 사진 목록 (서버 파일 + receipts 장부). 올리거나 지우면 다시 읽습니다
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const loadReceipts = () => fetch("/api/data/receipts").then((r) => r.json()).then((d: { data?: Receipt[] }) => setReceipts(Array.isArray(d.data) ? d.data : [])).catch(() => {});
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadReceipts(); }, []);
  const [receiptFor, setReceiptFor] = useState<Revenue | null>(null);
  const receiptsOf = (id: string) => receipts.filter((x) => x.revenueId === id);
  const [today] = useState(todayIso);
  const [deposits] = useServerState<Deposit[]>("deposits", initialDeposits, "jeil.deposits");
  const [products, , productsLoaded] = useServerState<Product[]>("products", initialProducts);
  const [dispatches, setDispatches, dispatchesLoaded] = useServerState<Dispatch[]>("dispatches", initialDispatches);
  /** 납품 방법에 따라 배차를 만들거나 맞춥니다. 돌려주는 값은 dispatchId 가 채워진 매출 */
  function syncDispatch(rev: Revenue): Revenue {
    if (!dispatchesLoaded) return rev;
    const dv = rev.delivery;
    const existing = dv?.dispatchId ? dispatches.find((d) => d.id === dv.dispatchId) : undefined;
    if (!dv || dv.mode === "미정") {
      // 배차가 있었는데 미정으로 바꾸면: 아직 출발 전이면 지우고, 진행 중이면 그대로 둠
      if (existing && existing.status === "대기") setDispatches((prev) => prev.filter((d) => d.id !== existing.id));
      return { ...rev, delivery: dv ? { ...dv, dispatchId: existing && existing.status !== "대기" ? existing.id : undefined } : undefined };
    }
    if (existing) {
      setDispatches((prev) => prev.map((d) => (d.id === existing.id ? syncDispatchWithRevenue(d, rev) : d)));
      return rev;
    }
    const created = dispatchFromRevenue(rev, me?.name);
    if (!created) return rev;
    setDispatches((prev) => [created, ...prev]);
    return { ...rev, delivery: { ...dv, dispatchId: created.id } };
  }
  const [, setMoves, movesLoaded] = useServerState<StockMove[]>("stockMoves", initialMoves);
  const [customers] = useServerState<Customer[]>("customers", initialCustomers, "jeil.customers");
  const [projects] = useServerState<Project[]>("projects", initialProjects, "jeil.projects");
  const [docs, setDocs] = useServerState<FormDoc[]>("documents", initialDocs);
  const [me, setMe] = useState<{ name?: string } | null>(null);
  /** 매출의 품목을 재고관리 품목과 맞춰 출하 처리 (없으면 건너뜀). 삭제 시에는 rev를 null로 */
  function syncStock(rev: Revenue | null, id: string) {
    if (!productsLoaded || !movesLoaded) return;
    const { moves } = rev ? movesForRevenue(rev, products, me?.name) : { moves: [] };
    setMoves((prev) => replaceMovesByRef(prev, id, moves));
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => {}); }, []);
  const [notice, setNotice] = useState<string | null>(null);
  function flash(msg: string) { setNotice(msg); setTimeout(() => setNotice(null), 5000); }

  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState<number | null>(null);
  // 보기 방식: 연도별(year) 또는 최근 N개월(recent)
  const [range, setRange] = useState<"year" | "3" | "6" | "12">("year");
  /** 현재 보기의 기간 목록 (연도별이면 1~12월, 최근이면 이번 달까지 N개월) */
  const periods = useMemo(() => {
    if (range === "year") return Array.from({ length: 12 }, (_, i) => ({ y: year, m: i + 1 }));
    const n = Number(range);
    const out: { y: number; m: number }[] = [];
    for (let k = n - 1; k >= 0; k--) {
      const d = new Date(thisYear, thisMonth - 1 - k, 1);
      out.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
    }
    return out;
  }, [range, year, thisYear, thisMonth]);
  const periodKey = (p: { y: number; m: number }) => `${p.y}-${String(p.m).padStart(2, "0")}`;
  // 최근 N개월 보기에서는 선택한 막대(월)를 periods 의 순번으로 기억
  const [pick, setPick] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [undatedOnly, setUndatedOnly] = useState(false);
  const { sort, toggle } = useSort<SortKey>({ key: "date", dir: -1 });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Revenue | null>(null);
  const [dunning, setDunning] = useState<Revenue | null>(null);

  // 매출별 입금액
  const paidOf = (r: Revenue) => deposits.filter((d) => d.revenueId === r.id).reduce((s, d) => s + d.amount, 0);

  const years = useMemo(() => {
    const ys = new Set<number>([thisYear]);
    items.forEach((r) => r.date && ys.add(Number(r.date.slice(0, 4))));
    return [...ys].sort((a, b) => b - a);
  }, [items, thisYear]);

  const monthly = useMemo(() => {
    const arr = periods.map(() => 0);
    items.forEach((r) => {
      if (!r.date) return;
      const idx = periods.findIndex((p) => periodKey(p) === r.date!.slice(0, 7));
      if (idx >= 0) arr[idx] += r.amount;
    });
    return arr;
  }, [items, periods]);

  const yearTotal = monthly.reduce((a, b) => a + b, 0);
  const monthTotal = items.filter((r) => r.date?.startsWith(`${thisYear}-${String(thisMonth).padStart(2, "0")}`)).reduce((s, r) => s + r.amount, 0);
  const outstanding = items.reduce((s, r) => s + Math.max(r.amount - paidOf(r), 0), 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items
      .filter((r) => {
        if (undatedOnly) return !r.date;
        if (!r.date) return false;
        const ym = r.date.slice(0, 7);
        if (range === "year") return Number(r.date.slice(0, 4)) === year && (month === null || Number(r.date.slice(5, 7)) === month);
        if (pick !== null) return ym === periodKey(periods[pick]);
        return periods.some((p) => periodKey(p) === ym);
      })
      .filter((r) => !q || [r.title, r.customer ?? "", r.project ?? "", r.memo ?? ""].join(" ").toLowerCase().includes(q))
      .map((r) => ({ r, paid: paidOf(r), due: Math.max(r.amount - paidOf(r), 0) }));
    return list.sort((a, b) => {
      const v = (x: typeof a): string | number => (sort.key === "paid" ? x.paid : sort.key === "due" ? x.due : sort.key === "amount" ? x.r.amount : sort.key === "date" ? x.r.date ?? "" : x.r[sort.key] ?? "");
      return compareValues(v(a), v(b)) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, deposits, query, year, month, undatedOnly, sort, range, pick, periods]);

  const selectedTotal = filtered.reduce((s, x) => s + x.r.amount, 0);
  const undatedCount = items.filter((r) => !r.date).length;

  /** 매출 등록: 품목이 있으면 거래명세표를 같이 만듭니다 */
  function add(data: RevenueInput) {
    const rev: Revenue = { ...data, id: newId("r") };
    if (rev.items?.length) {
      const doc = docFromRevenue(rev, nextDocNumber(docs, "거래명세표", rev.date || todayIso()), { createdBy: me?.name, today: todayIso() });
      rev.docId = doc.id;
      rev.docNumber = doc.number;
      setDocs((prevDocs) => [doc, ...prevDocs]);
      flash(`매출 「${rev.title}」과 거래명세표 ${doc.number}를 함께 등록했습니다. 양식 문서에서 PDF로 볼 수 있습니다.`);
    }
    const withDispatch = syncDispatch(rev);
    setItems((prev) => [withDispatch, ...prev]);
    syncStock(rev, rev.id);
    setAdding(false);
    if (withDispatch.delivery?.dispatchId && withDispatch.delivery.mode !== "미정") flash(`납품 방법 「${deliveryModeLabel[withDispatch.delivery.mode]}」으로 배차를 만들었습니다. 배차·출고에서 기사님께 링크를 보낼 수 있습니다.`);
  }
  /** 매출 수정: 연결된 거래명세표도 같은 내용으로 맞춥니다 */
  function update(id: string, data: RevenueInput) {
    const rev: Revenue = { ...data, id };
    if (rev.items?.length) {
      const existing = rev.docId ? docs.find((d) => d.id === rev.docId) : undefined;
      if (existing) {
        setDocs((prevDocs) => prevDocs.map((d) => (d.id === existing.id ? syncDocWithRevenue(d, rev) : d)));
      } else {
        const doc = docFromRevenue(rev, nextDocNumber(docs, "거래명세표", rev.date || todayIso()), { createdBy: me?.name, today: todayIso() });
        rev.docId = doc.id;
        rev.docNumber = doc.number;
        setDocs((prevDocs) => [doc, ...prevDocs]);
      }
    }
    const withDispatch = syncDispatch(rev);
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...withDispatch } : r)));
    syncStock(rev, id);
    setEditing(null);
  }
  /** 매출 삭제: 함께 만든 거래명세표도 지웁니다 */
  function remove(id: string) {
    const target = items.find((r) => r.id === id);
    if (!confirm(`매출 「${target?.title ?? ""}」을(를) 삭제할까요?${target?.docNumber ? ` 거래명세표 ${target.docNumber}도 함께 지워집니다.` : ""}`)) return;
    if (target?.docId) setDocs((prevDocs) => prevDocs.filter((d) => d.id !== target.docId));
    setItems((prev) => prev.filter((r) => r.id !== id));
    syncStock(null, id);
    if (dispatchesLoaded && target?.delivery?.dispatchId) setDispatches((prev) => prev.filter((d) => !(d.id === target.delivery!.dispatchId && d.status === "대기")));
    setEditing(null);
  }
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  async function fetchPdf(doc: FormDoc) {
    const res = await fetch("/api/documents/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc }) });
    if (!res.ok) throw new Error("PDF를 만들지 못했습니다.");
    return res.arrayBuffer();
  }
  /** 거래명세표 PDF 를 새 창으로 열거나(인쇄) 파일로 내려받기 */
  async function openDocPdf(doc: FormDoc, mode: "view" | "download" = "view") {
    setPdfBusy(doc.id);
    try {
      const url = URL.createObjectURL(new Blob([await fetchPdf(doc)], { type: "application/pdf" }));
      if (mode === "download") {
        const a = document.createElement("a");
        a.href = url; a.download = `거래명세표_${doc.number}_${doc.customer || ""}.pdf`; a.click();
      } else {
        window.open(url, "_blank");
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { flash((e as Error).message); } finally { setPdfBusy(null); }
  }
  /** 엔택스 매출추가 화면의 [Paste] 용 텍스트를 클립보드로 복사 */
  async function copyForEntax(rev: Revenue) {
    const cust = customers.find((c) => c.name === rev.customer);
    const text = entaxSalesPaste(rev, cust, { paid: paidOf(rev) });
    try {
      await navigator.clipboard.writeText(text);
      flash(`「${rev.title}」을(를) 엔택스 형식으로 복사했습니다. 엔택스 → 매출추가 화면에서 [Paste] 를 누르세요.${cust?.bizNo ? "" : " (고객관리에 사업자번호가 없어 거래처는 이름으로만 넘어갑니다)"}`);
    } catch {
      window.prompt("자동 복사가 막혀 있습니다. 아래 내용을 전체 선택(Ctrl+A)해 복사한 뒤 엔택스에서 Paste 하세요.", text);
    }
  }
  /** 품목은 있는데 명세표가 없는 매출(사진으로 등록한 것 등)에 거래명세표를 만들어 붙임 */
  function issueDocFor(rev: Revenue, thenOpen = true) {
    if (!rev.items?.length) return;
    const doc = docFromRevenue(rev, nextDocNumber(docs, "거래명세표", rev.date || todayIso()), { createdBy: me?.name, today: todayIso() });
    setDocs((prevDocs) => [doc, ...prevDocs]);
    setItems((prev) => prev.map((r) => (r.id === rev.id ? { ...r, docId: doc.id, docNumber: doc.number } : r)));
    flash(`거래명세표 ${doc.number}를 만들었습니다.`);
    if (thenOpen) openDocPdf(doc);
  }
  function resetFilter() {
    setYear(thisYear); setMonth(null); setQuery(""); setUndatedOnly(false); setRange("year"); setPick(null);
  }
  function changeRange(v: string) {
    setRange(v as typeof range); setMonth(null); setPick(null); setUndatedOnly(false);
  }

  const recentLabel = (p: { y: number; m: number }) => `${String(p.y).slice(2)}년 ${p.m}월`;
  const rangeLabel = undatedOnly
    ? `날짜 미정 ${undatedCount}건`
    : range === "year"
      ? (month ? `${year}년 ${month}월` : `${year}년 전체`)
      : (pick !== null ? recentLabel(periods[pick]) : `최근 ${range}개월 (${recentLabel(periods[0])} ~ ${recentLabel(periods[periods.length - 1])})`);
  const selectCls = "rounded-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <>
      <PageHeader
        title="매출 관리"
        description="청구한 매출을 월별로 살펴보고, 입금과 비교해 미수금을 확인합니다."
        action={<button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">매출 등록</button>}
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>
      {notice && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label={`${thisYear}년 누적 매출`} value={formatWon(items.filter((r) => r.date?.startsWith(String(thisYear))).reduce((s, r) => s + r.amount, 0))} sub="올해 누적된 총 매출입니다." icon="↗" />
        <StatCard label={`${thisMonth}월 매출`} value={formatWon(monthTotal)} sub="이번 달 기준 집계입니다." icon="₩" tone="green" />
        <StatCard label="누적 미수금" value={formatWon(outstanding)} sub="아직 입금되지 않은 총 금액입니다." icon="!" tone="amber" />
        <StatCard label="현재 선택 합계" value={formatWon(selectedTotal)} sub={`${filtered.length}건이 현재 필터에 포함되어 있습니다.`} icon="▤" highlight />
      </div>

      <Card className="p-5">
        {range === "year" ? (
          <MonthlyChart year={year} data={monthly} selectedMonth={month} onSelectMonth={(m) => { setMonth(m); setUndatedOnly(false); }} />
        ) : (
          <MonthlyChart year={year} data={monthly} labels={periods.map(recentLabel)} heading={`최근 ${range}개월 매출 현황`} sumLabel="기간 합계" selectedMonth={pick === null ? null : pick + 1} onSelectMonth={(m) => { setPick(m === null ? null : m - 1); setUndatedOnly(false); }} />
        )}
        <p className="mt-3 text-xs text-slate-400">{range === "year" ? `${year}년 합계 ${formatWon(yearTotal)}` : `기간 합계 ${formatWon(monthly.reduce((a, b) => a + b, 0))}`} · 날짜 미정 매출은 그래프에 포함되지 않습니다.</p>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={range} onChange={changeRange} tabs={[{ key: "year", label: "연도별" }, { key: "3", label: "최근 3개월" }, { key: "6", label: "최근 6개월" }, { key: "12", label: "최근 12개월" }]} />
          {range === "year" && (
            <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setMonth(null); }} className={selectCls}>
              {years.map((y) => <option key={y} value={y}>{y}년</option>)}
            </select>
          )}
          <span className="text-sm text-slate-500">{rangeLabel}</span>
        </div>
        {range === "year" && (
          <Tabs
            value={month === null ? "all" : String(month)}
            onChange={(v) => { setMonth(v === "all" ? null : Number(v)); setUndatedOnly(false); }}
            tabs={[{ key: "all", label: "전체" }, ...Array.from({ length: 12 }, (_, i) => ({ key: String(i + 1), label: `${i + 1}월` }))]}
          />
        )}
        <div className="flex w-full flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="매출명, 프로젝트명, 고객, 메모 검색" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <label className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm cursor-pointer ${undatedOnly ? "border-primary bg-primary-soft text-primary" : "border-line bg-white text-slate-600"}`}>
            <input type="checkbox" checked={undatedOnly} onChange={(e) => setUndatedOnly(e.target.checked)} className="accent-primary" /> 날짜미정 {undatedCount > 0 && <span className="text-xs">({undatedCount})</span>}
          </label>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="text-3xl text-slate-300">▤</div>
          <div className="mt-3 font-semibold text-slate-800">조건에 맞는 매출이 없습니다.</div>
          <p className="mt-1 text-xs text-slate-400">{rangeLabel} 기준으로 조회된 항목이 없습니다.</p>
          <button onClick={resetFilter} className="mt-4 rounded-full border border-line bg-white px-4 py-2 text-sm text-slate-700 hover:border-primary hover:text-primary">필터 초기화</button>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-line">
                <SortTh label="매출일" k="date" sort={sort} onSort={toggle} className="px-5" />
                <SortTh label="매출명" k="title" sort={sort} onSort={toggle} />
                <SortTh label="고객" k="customer" sort={sort} onSort={toggle} />
                <th className="px-3 py-3 font-medium whitespace-nowrap">품목 / 명세표</th>
                <SortTh label="청구액" k="amount" sort={sort} onSort={toggle} className="text-right" />
                <SortTh label="입금액" k="paid" sort={sort} onSort={toggle} className="text-right" />
                <SortTh label="미수금" k="due" sort={sort} onSort={toggle} className="text-right" />
                <th className="px-3 py-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map(({ r, paid, due }) => {
                const state = r.amount <= 0 ? { t: "단가 미입력", c: "bg-red-50 text-red-700 border-red-200" } : due === 0 ? { t: "완납", c: "bg-green-50 text-green-700 border-green-200" } : paid > 0 ? { t: "부분입금", c: "bg-sky-50 text-sky-700 border-sky-200" } : { t: "미입금", c: "bg-amber-50 text-amber-700 border-amber-200" };
                return (
                  <tr key={r.id} className="hover:bg-primary-soft/30 transition">
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{r.date ?? <span className="text-slate-400">날짜 미정</span>}</td>
                    <td className="px-3 py-3">
                      <button onClick={() => setEditing(r)} className="text-left">
                        <div className="font-medium text-slate-800 hover:text-primary truncate max-w-[18rem]">{r.title}</div>
                        {r.project && <div className="text-xs text-slate-400">{r.project}</div>}
                      </button>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <button onClick={() => copyForEntax(r)} title="엔택스 매출추가 화면의 [Paste] 용으로 복사" className="rounded-full border border-line bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:border-primary hover:text-primary">엔택스로 복사</button>
                        {(() => { const n = receiptsOf(r.id).length; return <button onClick={() => setReceiptFor(r)} title={n ? "서명 받은 거래명세표 사진 보기" : "서명 받은 거래명세표 사진 올리기"} className={`rounded-full border px-2 py-0.5 text-[11px] ${n ? "border-green-200 bg-green-50 text-green-700 hover:border-green-400" : "border-line bg-white text-slate-500 hover:border-primary hover:text-primary"}`}>{n ? `✍ 인수증 ${n}` : "📷 인수증"}</button>; })()}
                        {r.amount > 0 && due > 0 && <button onClick={() => setDunning(r)} title="미수금 안내 문자·메일 문안을 만듭니다" className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 hover:border-amber-400">수금 안내</button>}
                        {r.delivery?.dispatchId ? (
                          <Link href={`/dashboard/dispatch?open=${r.delivery.dispatchId}`} title="배차 상세 (기사 링크·사진)" className="rounded-full border border-primary/30 bg-primary-soft px-2 py-0.5 text-[11px] text-primary hover:border-primary">🚚 {deliveryModeLabel[r.delivery.mode]}{(() => { const d = dispatches.find((x) => x.id === r.delivery?.dispatchId); return d ? ` · ${d.status}` : ""; })()}</Link>
                        ) : r.delivery && r.delivery.mode !== "미정" ? (
                          <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[11px] text-slate-600">🚚 {deliveryModeLabel[r.delivery.mode]}</span>
                        ) : r.items?.length ? <Link href={`/dashboard/dispatch?from=${r.id}`} title="이 품목으로 배차를 만들고 기사님께 링크를 보냅니다" className="rounded-full border border-line bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:border-primary hover:text-primary">배차</Link> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{r.customer ?? "-"}</td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {r.items?.length ? <span title={r.items.map((i) => `${i.name} ${i.qty}${i.unit}`).join(", ")}>{r.items[0].name}{r.items.length > 1 ? ` 외 ${r.items.length - 1}` : ""} · {r.items.reduce((s, i) => s + i.qty, 0)}개</span> : <span className="text-slate-300">금액만</span>}
                      {(() => {
                        const doc = r.docId ? docs.find((d) => d.id === r.docId) : undefined;
                        if (doc) return (
                          <span className="ml-1 inline-flex items-center gap-1">
                            <span className="rounded-full border border-primary/20 bg-primary-soft px-2 py-0.5 text-[11px] text-primary">{doc.number}</span>
                            <button onClick={() => openDocPdf(doc)} disabled={pdfBusy === doc.id} title="거래명세표 PDF 보기·인쇄" className="rounded-full border border-line bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:border-primary hover:text-primary disabled:opacity-50">{pdfBusy === doc.id ? "…" : "PDF"}</button>
                            <button onClick={() => openDocPdf(doc, "download")} disabled={pdfBusy === doc.id} title="PDF 파일로 내려받기" className="rounded-full border border-line bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:border-primary hover:text-primary disabled:opacity-50">↓</button>
                          </span>
                        );
                        if (r.items?.length) return <button onClick={() => issueDocFor(r)} title="이 매출 내용으로 거래명세표를 만들어 PDF로 엽니다" className="ml-1 rounded-full border border-primary/40 bg-white px-2 py-0.5 text-[11px] text-primary hover:bg-primary-soft">명세표 발행</button>;
                        return null;
                      })()}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-800 whitespace-nowrap">{r.amount.toLocaleString("ko-KR")}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-green-700 whitespace-nowrap">{paid ? paid.toLocaleString("ko-KR") : "-"}</td>
                    <td className={`px-3 py-3 text-right tabular-nums whitespace-nowrap ${due > 0 ? "text-amber-700 font-semibold" : "text-slate-400"}`}>{due ? due.toLocaleString("ko-KR") : "-"}</td>
                    <td className="px-3 py-3 whitespace-nowrap"><span className={`rounded-full border px-2.5 py-0.5 text-xs ${state.c}`}>{state.t}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {receiptFor && <ReceiptDialog revenue={receiptFor} receipts={receiptsOf(receiptFor.id)} onClose={() => setReceiptFor(null)} onChange={loadReceipts} />}
      {adding && <RevenueForm customers={customers} projects={projects} onSubmit={add} onCancel={() => setAdding(false)} />}
      {dunning && <DunningDialog rev={dunning} paid={paidOf(dunning)} customer={customers.find((c) => c.name === dunning.customer)} onClose={() => setDunning(null)} />}
      {editing && <RevenueForm initial={editing} linkedDoc={docs.find((d) => d.id === editing.docId)} customers={customers} projects={projects} paid={paidOf(editing)} onSubmit={(d) => update(editing.id, d)} onCancel={() => setEditing(null)} onDelete={() => remove(editing.id)} onOpenDoc={openDocPdf} onDownloadDoc={(d) => openDocPdf(d, "download")} onCopyEntax={() => copyForEntax(editing)} onIssueDoc={() => { issueDocFor(editing, false); setEditing(null); }} />}
      </>)}
    </>
  );
}
