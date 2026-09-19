"use client";

// 생산일보 종이 양식: ★ 생산 품목이 카탈로그 이름 그대로 박혀 있어 수량만 손으로 적고, 사진을 찍어 올리면 그대로 읽힙니다.
import { useMemo, useState } from "react";
import Link from "next/link";
import { useServerState } from "@/lib/useServerState";
import { products as initialProducts, type Product } from "@/data/sample";
import { useBrand } from "@/lib/brand";
import { todayIso } from "@/lib/format";
import LoadingCard from "@/components/LoadingCard";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function PrintForm() {
  const brand = useBrand();
  const [products, , loaded, loadError] = useServerState<Product[]>("products", initialProducts);
  const [date, setDate] = useState(todayIso());
  const [blank, setBlank] = useState(3); // 빈 줄 수 (별표에 없는 품목을 손으로 적을 자리)
  const favs = useMemo(() => products.filter((p) => p.favorite).sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "", "ko") || a.name.localeCompare(b.name, "ko")), [products]);
  const d = new Date(date + "T00:00:00");
  const dateLabel = isNaN(d.getTime()) ? date : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`;

  if (!loaded) return <LoadingCard error={loadError} />;
  return (
    <>
      <div data-print-hide className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
        <div className="text-sm text-slate-600">생산일보 종이 양식 · ★ 생산 품목 {favs.length}개</div>
        <label className="text-sm">날짜 <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ml-1 rounded-xl border border-line bg-white px-2 py-1.5 text-sm" /></label>
        <label className="text-sm">빈 줄 <input type="number" min={0} max={20} value={blank} onChange={(e) => setBlank(Math.max(0, Math.min(20, Number(e.target.value) || 0)))} className="ml-1 w-16 rounded-xl border border-line bg-white px-2 py-1.5 text-sm" /></label>
        <div className="ml-auto flex gap-2">
          <Link href="/dashboard/production" className="rounded-full border border-line bg-white px-4 py-2 text-sm">생산일보로</Link>
          <button type="button" onClick={() => window.print()} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white">인쇄</button>
        </div>
        {favs.length === 0 && <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">아직 ★ 생산 품목이 없습니다. 재고관리에서 우리 공장이 만드는 품목에 별표를 켜 주세요.</div>}
      </div>

      <div className="doc-print-root mx-auto max-w-[210mm] bg-white p-6 text-[11px] text-black print:p-[10mm]">
        <div className="flex items-end justify-between border-b-2 border-black pb-2">
          <div>
            <div className="text-2xl font-bold tracking-widest">생 산 일 보</div>
            <div className="mt-1 text-xs">{brand.name}</div>
          </div>
          <div className="text-right text-xs">
            <div>{dateLabel}</div>
            <div className="mt-1">라인·조: ____________ &nbsp; 작업시간: ______ 시간</div>
          </div>
        </div>
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black px-1 py-1 text-left w-[38%]">품목</th>
              <th className="border border-black px-1 py-1 text-left">규격</th>
              <th className="border border-black px-1 py-1 w-12">단위</th>
              <th className="border border-black px-1 py-1 w-16">계획</th>
              <th className="border border-black px-1 py-1 w-20">생산(양품)</th>
              <th className="border border-black px-1 py-1 w-14">불량</th>
              <th className="border border-black px-1 py-1 w-20">비고</th>
            </tr>
          </thead>
          <tbody>
            {favs.map((p) => (
              <tr key={p.id} className="h-7">
                <td className="border border-black px-1 py-0.5">{p.name}</td>
                <td className="border border-black px-1 py-0.5">{p.spec ?? ""}</td>
                <td className="border border-black px-1 py-0.5 text-center">{p.unit}</td>
                <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
              </tr>
            ))}
            {Array.from({ length: blank }).map((_, i) => (
              <tr key={`b${i}`} className="h-7"><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td></tr>
            ))}
            <tr className="h-7 bg-slate-100 font-semibold"><td className="border border-black px-1" colSpan={4}>합계</td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td></tr>
          </tbody>
        </table>
        <table className="mt-3 w-full border-collapse">
          <tbody>
            <tr className="h-8"><td className="border border-black bg-slate-100 px-1 w-24 font-semibold">작업 인원</td><td className="border border-black px-1" colSpan={3}></td></tr>
            <tr className="h-8"><td className="border border-black bg-slate-100 px-1 font-semibold">근태 현황</td><td className="border border-black px-1" colSpan={3}></td></tr>
            <tr className="h-8"><td className="border border-black bg-slate-100 px-1 font-semibold">시멘트</td><td className="border border-black px-1">사용량 ________ kg</td><td className="border border-black px-1">입고량 ________ kg</td><td className="border border-black px-1">사이로 재고 ________ kg</td></tr>
            <tr className="h-14"><td className="border border-black bg-slate-100 px-1 font-semibold align-top">기타 사항</td><td className="border border-black px-1" colSpan={3}></td></tr>
          </tbody>
        </table>
        <div className="mt-3 flex justify-end gap-8 text-xs">
          <span>작성: ____________</span><span>확인: ____________</span>
        </div>
      </div>
    </>
  );
}
