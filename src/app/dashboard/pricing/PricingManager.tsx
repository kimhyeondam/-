"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import Tabs from "@/components/Tabs";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { products as initialProducts, customers as initialCustomers, type Product, type Customer } from "@/data/sample";
import { rateOf } from "@/lib/sales/pricing";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

export default function PricingManager() {
  const [products, setProducts, loaded, loadError] = useServerState<Product[]>("products", initialProducts);
  const [customers, setCustomers, customersLoaded] = useServerState<Customer[]>("customers", initialCustomers, "jeil.customers");
  const [tab, setTab] = useState<"base" | "customers" | "matrix">("base");
  const [query, setQuery] = useState("");
  const [previewCustomer, setPreviewCustomer] = useState<string>("");

  const q = query.trim().toLowerCase();
  const productRows = useMemo(() => products.filter((p) => !q || `${p.name} ${p.spec ?? ""} ${p.category ?? ""}`.toLowerCase().includes(q)).sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "", "ko") || a.name.localeCompare(b.name, "ko")), [products, q]);
  const customerRows = useMemo(() => customers.filter((c) => !q || c.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, "ko")), [customers, q]);
  const priced = products.filter((p) => p.basePrice).length;
  const discounted = customers.filter((c) => rateOf(c) !== 100).length;

  function setBase(id: string, v: number) { setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, basePrice: v || undefined } : p))); }
  function setRate(id: string, v: number) { if (!customersLoaded) return; setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, priceRate: v === 100 || !v ? undefined : v } : c))); }
  const preview = customers.find((c) => c.id === previewCustomer);

  return (
    <>
      <PageHeader
        title="단가표"
        description="품목마다 기준 단가를 정하고, 거래처마다 적용률(%)을 정합니다. 매출 등록 때 거래처와 품명을 고르면 단가가 자동으로 들어갑니다."
        action={<Link href="/dashboard/inventory" className="rounded-full border border-line bg-white text-slate-700 text-sm font-semibold px-4 py-2.5 hover:border-primary hover:text-primary transition">품목 관리(재고관리)</Link>}
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="단가 있는 품목" value={`${priced}/${products.length}`} sub="기준 단가가 비어 있으면 자동 입력이 안 됩니다" icon="₩" onClick={() => setTab("base")} />
        <StatCard label="할인·할증 거래처" value={`${discounted}곳`} sub={`전체 ${customers.length}곳 중 적용률이 100%가 아닌 곳`} icon="%" onClick={() => setTab("customers")} />
        <StatCard label="계산 규칙" value="기준 × %" sub="예) 185,000원 × 95% = 175,750원" icon="=" />
        <StatCard label="거래처별 단가표" value="보기" sub="거래처를 골라 전체 품목 단가 확인" icon="▤" onClick={() => setTab("matrix")} />
      </div>

      <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center">
        <Tabs value={tab} onChange={(v) => setTab(v as typeof tab)} tabs={[{ key: "base", label: "기준 단가", n: products.length }, { key: "customers", label: "거래처 적용률", n: customers.length }, { key: "matrix", label: "거래처별 단가표" }]} />
        <div className="relative w-full md:w-72 md:ml-auto">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tab === "customers" ? "거래처 검색" : "품명, 규격, 분류 검색"} className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary" />
        </div>
      </Card>

      {tab === "base" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-line"><th className="px-5 py-3 font-medium">분류</th><th className="px-3 py-3 font-medium">품명</th><th className="px-3 py-3 font-medium">규격</th><th className="px-3 py-3 font-medium">단위</th><th className="px-3 pr-5 py-3 font-medium text-right w-44">기준 단가 (원)</th></tr></thead>
            <tbody className="divide-y divide-line">
              {productRows.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">품목이 없습니다. 재고관리에서 품목을 먼저 등록하세요.</td></tr>}
              {productRows.map((p) => (
                <tr key={p.id} className="hover:bg-primary-soft/30">
                  <td className="px-5 py-2 text-xs text-slate-500 whitespace-nowrap">{p.category ?? "기타"}</td>
                  <td className="px-3 py-2 font-medium text-slate-800"><span className="block max-w-[18rem] truncate">{p.name}</span></td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{p.spec ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{p.unit}</td>
                  <td className="px-3 pr-5 py-2 text-right"><input type="number" min={0} step="any" value={p.basePrice ?? ""} placeholder="미정" onChange={(e) => setBase(p.id, Number(e.target.value))} className="w-36 rounded-lg border border-line bg-white px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-primary" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "customers" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-line"><th className="px-5 py-3 font-medium">거래처</th><th className="px-3 py-3 font-medium">구분</th><th className="px-3 py-3 font-medium text-right w-40">적용률 (%)</th><th className="px-3 pr-5 py-3 font-medium">예시 (흄관 D600 기준)</th></tr></thead>
            <tbody className="divide-y divide-line">
              {customerRows.map((c) => {
                const ex = products.find((p) => p.basePrice);
                const rate = rateOf(c);
                return (
                  <tr key={c.id} className="hover:bg-primary-soft/30">
                    <td className="px-5 py-2 font-medium text-slate-800"><span className="block max-w-[16rem] truncate">{c.name}</span></td>
                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{c.dealer ? "대리점" : c.bizNo && c.bizNo !== "-" ? "일반" : "관급"}</td>
                    <td className="px-3 py-2 text-right"><div className="inline-flex items-center gap-1"><input type="number" min={1} max={300} step={1} value={rate} onChange={(e) => setRate(c.id, Number(e.target.value))} className={`w-24 rounded-lg border bg-white px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-primary ${rate < 100 ? "border-green-300" : rate > 100 ? "border-amber-300" : "border-line"}`} /><span className="text-slate-500">%</span></div></td>
                    <td className="px-3 pr-5 py-2 text-xs text-slate-500 whitespace-nowrap">{ex && ex.basePrice ? `${ex.name} ${won(ex.basePrice)} → ${won((ex.basePrice * rate) / 100)}` : "-"}{rate < 100 && <span className="ml-2 rounded-full bg-green-50 text-green-700 px-2 py-0.5">{100 - rate}% 할인</span>}{rate > 100 && <span className="ml-2 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5">{rate - 100}% 할증</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "matrix" && (
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-600">거래처</span>
            <select value={previewCustomer} onChange={(e) => setPreviewCustomer(e.target.value)} className="rounded-full border border-line bg-white px-4 py-2 text-sm outline-none focus:border-primary">
              <option value="">(선택) 기준 단가만 보기</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {rateOf(c)}%</option>)}
            </select>
            {preview && <span className="text-sm text-slate-500">적용률 {rateOf(preview)}%</span>}
            <button onClick={() => window.print()} className="ml-auto rounded-full border border-line bg-white px-4 py-2 text-sm text-slate-700 hover:border-primary hover:text-primary">인쇄</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="text-left text-xs text-slate-500 border-b border-line"><th className="px-3 py-2 font-medium">품명</th><th className="px-3 py-2 font-medium">규격</th><th className="px-3 py-2 font-medium">단위</th><th className="px-3 py-2 font-medium text-right">기준 단가</th>{preview && <th className="px-3 py-2 font-medium text-right">{preview.name} 단가</th>}</tr></thead>
              <tbody className="divide-y divide-line">
                {productRows.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 text-slate-800">{p.name}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{p.spec ?? "-"}</td>
                    <td className="px-3 py-2 text-slate-500">{p.unit}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.basePrice ? won(p.basePrice) : <span className="text-slate-300">미정</span>}</td>
                    {preview && <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">{p.basePrice ? won((p.basePrice * rateOf(preview)) / 100) : "-"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      </>)}
    </>
  );
}
