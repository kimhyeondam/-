"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import Tabs from "@/components/Tabs";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { dispatches as initialDispatches, vehicles as initialVehicles, revenues as initialRevenues, company as defaultCompany, type Dispatch, type DispatchStatus, type Revenue, type Vehicle } from "@/data/sample";
import { newId, nowIso } from "@/lib/ids";
import { todayIso } from "@/lib/format";
import { statusBadge } from "./dispatchMeta";
import { carrierOf, makeToken } from "@/lib/dispatch/fromRevenue";
import DispatchForm, { type DispatchInput } from "./DispatchForm";
import DispatchDetail from "./DispatchDetail";
import VehicleManager from "./VehicleManager";

export default function DispatchManager({ fromRevenueId, openId }: { fromRevenueId?: string; openId?: string } = {}) {
  const [items, setItems, loaded, loadError] = useServerState<Dispatch[]>("dispatches", initialDispatches);
  const [vehicles, setVehicles, vehiclesLoaded] = useServerState<Vehicle[]>("vehicles", initialVehicles);
  const [revenues, , revenuesLoaded] = useServerState<Revenue[]>("revenues", initialRevenues, "jeil.revenues");
  const [today] = useState(todayIso);
  const [range, setRange] = useState<"today" | "week" | "all">("today");
  const [status, setStatus] = useState<"all" | "open" | DispatchStatus>("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Dispatch | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [showVehicles, setShowVehicles] = useState(false);
  const [me, setMe] = useState<{ name?: string; company?: string } | null>(null);
  const [companyName, setCompanyName] = useState(defaultCompany.name);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => {}); fetch("/api/data/settings").then((r) => r.json()).then((j) => { const n = j?.data?.company?.name; if (n) setCompanyName(n); }).catch(() => {}); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (loaded && openId && items.some((d) => d.id === openId)) setViewing(openId); }, [loaded, openId]); // eslint-disable-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (fromRevenueId && revenuesLoaded) setAdding(true); }, [fromRevenueId, revenuesLoaded]);
  // 기사님이 올린 사진·상태를 보기 위해 30초마다 새로 읽습니다
  useEffect(() => {
    if (!loaded) return;
    const t = setInterval(() => { fetch("/api/data/dispatches").then((r) => r.json()).then((j) => { if (Array.isArray(j?.data)) setItems(() => j.data as Dispatch[]); }).catch(() => {}); }, 30000);
    return () => clearInterval(t);
  }, [loaded, setItems]);

  const weekAgo = useMemo(() => { const d = new Date(today + "T00:00:00"); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); }, [today]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((d) => range === "all" || (range === "today" ? d.date === today : d.date >= weekAgo))
      .filter((d) => status === "all" || (status === "open" ? d.status !== "인수완료" && d.status !== "취소" : d.status === status))
      .filter((d) => !q || [d.customer, d.site ?? "", d.vehicle, d.driver, d.items.map((i) => i.name).join(" "), d.docNumber ?? ""].join(" ").toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || a.createdAt.localeCompare(b.createdAt));
  }, [items, range, status, query, today, weekAgo]);
  const todayAll = items.filter((d) => d.date === today);
  const moving = items.filter((d) => d.status === "출발" || d.status === "상차완료");
  const noPhoto = items.filter((d) => d.status === "인수완료" && !d.photos.some((p) => p.kind === "인수") && d.date >= weekAgo);
  const viewingD = viewing ? items.find((d) => d.id === viewing) ?? null : null;

  function add(input: DispatchInput) {
    const d: Dispatch = { ...input, id: newId("dp"), token: makeToken(), status: "대기", log: [{ status: "대기", at: nowIso(), by: me?.name }], photos: [], createdBy: me?.name, createdAt: nowIso() };
    setItems((prev) => [d, ...prev]);
    setAdding(false);
    setViewing(d.id);
  }
  function update(id: string, input: DispatchInput) {
    setItems((prev) => prev.map((d) => (d.id === id ? { ...d, ...input } : d)));
    setEditing(null);
    setViewing(id);
  }
  function setStatusOf(id: string, s: DispatchStatus) {
    setItems((prev) => prev.map((d) => (d.id === id ? { ...d, status: s, log: [...d.log, { status: s, at: nowIso(), by: me?.name }] } : d)));
  }
  function remove(id: string) {
    if (!confirm("이 배차를 삭제할까요? 기사님 링크와 사진도 함께 사라집니다.")) return;
    setItems((prev) => prev.filter((d) => d.id !== id));
    setViewing(null);
  }

  return (
    <>
      <PageHeader
        title="배차·출고관리"
        description="오늘 어느 차가 어느 현장에 무엇을 싣고 가는지 한눈에 봅니다. 기사님은 문자 링크에서 상차·도착 버튼을 누르고 사진을 올립니다."
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowVehicles(true)} className="rounded-full border border-line bg-white text-slate-700 text-sm font-semibold px-4 py-2.5 hover:border-primary hover:text-primary transition">차량·기사 관리</button>
            <button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">＋ 배차 등록</button>
          </div>
        }
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="오늘 배차" value={`${todayAll.length}건`} sub={`인수완료 ${todayAll.filter((d) => d.status === "인수완료").length}건`} icon="🚚" onClick={() => { setRange("today"); setStatus("all"); }} />
        <StatCard label="이동 중" value={`${moving.length}대`} sub="상차완료·출발 상태" icon="→" tone="amber" onClick={() => { setRange("all"); setStatus("open"); }} />
        <StatCard label="인수 사진 없음" value={<span className={noPhoto.length ? "text-red-600" : ""}>{noPhoto.length}건</span>} sub="최근 7일 인수완료 중" icon="📷" onClick={() => { setRange("week"); setStatus("인수완료"); }} />
        <StatCard label="등록 차량" value={`${vehicles.length}대`} sub={`자차 ${vehicles.filter((v) => v.own).length} · 용차 ${vehicles.filter((v) => !v.own).length} · 오늘 거래처차량 ${todayAll.filter((d) => d.carrier === "거래처차량").length}`} icon="▭" onClick={() => setShowVehicles(true)} />
      </div>

      <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center">
        <Tabs value={range} onChange={(v) => setRange(v as typeof range)} tabs={[{ key: "today", label: "오늘", n: todayAll.length }, { key: "week", label: "최근 7일" }, { key: "all", label: "전체", n: items.length }]} />
        <Tabs value={status} onChange={(v) => setStatus(v as typeof status)} tabs={[{ key: "all", label: "전체" }, { key: "open", label: "진행 중" }, { key: "인수완료", label: "인수완료" }, { key: "취소", label: "취소" }]} />
        <div className="relative w-full md:w-64 md:ml-auto">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="거래처, 현장, 차량, 기사, 품목" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary" />
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-line"><th className="px-5 py-3 font-medium">납품일</th><th className="px-3 py-3 font-medium">거래처 · 현장</th><th className="px-3 py-3 font-medium">품목</th><th className="px-3 py-3 font-medium">차량 · 기사</th><th className="px-3 py-3 font-medium">상태</th><th className="px-3 py-3 font-medium">사진</th><th className="px-3 pr-5 py-3 font-medium">최근 기록</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">{range === "today" ? "오늘 배차가 없습니다. 「배차 등록」 또는 매출관리의 「배차」 버튼으로 만드세요." : "표시할 배차가 없습니다."}</td></tr>}
            {rows.map((d) => {
              const last = d.log[d.log.length - 1];
              return (
                <tr key={d.id} className="hover:bg-primary-soft/30 transition cursor-pointer" onClick={() => setViewing(d.id)}>
                  <td className="px-5 py-3 whitespace-nowrap text-slate-700">{d.date}</td>
                  <td className="px-3 py-3"><div className="font-medium text-slate-800 truncate max-w-[16rem]">{d.customer}</div>{d.site && <div className="text-xs text-slate-400 truncate max-w-[16rem]">{d.site}</div>}</td>
                  <td className="px-3 py-3 text-xs text-slate-600"><span className="block max-w-[14rem] truncate" title={d.items.map((i) => `${i.name} ${i.qty}${i.unit}`).join(", ")}>{d.items.map((i) => `${i.name} ${i.qty}${i.unit}`).join(", ")}</span></td>
                  <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap"><div>{d.vehicle}</div><div className="text-slate-400">{d.driver}{carrierOf(d) === "자차" ? "" : ` · ${carrierOf(d)}`}</div></td>
                  <td className="px-3 py-3 whitespace-nowrap"><span className={`rounded-full border px-2 py-0.5 text-xs ${statusBadge[d.status]}`}>{d.status}</span></td>
                  <td className="px-3 py-3 whitespace-nowrap text-xs">{d.photos.length ? <span className="text-green-700">📷 {d.photos.length}장</span> : <span className="text-slate-300">-</span>}</td>
                  <td className="px-3 pr-5 py-3 text-xs text-slate-500 whitespace-nowrap">{last ? `${last.at.slice(5, 16).replace("T", " ")} ${last.status}` : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-400">매출관리 표의 「배차」 버튼을 누르면 그 거래명세표의 품목으로 바로 배차를 만들 수 있습니다. <Link href="/dashboard/sales" className="text-primary underline">매출관리로</Link></p>
      </>)}

      {adding && <DispatchForm fromRevenue={fromRevenueId ? revenues.find((r) => r.id === fromRevenueId) : undefined} revenues={revenues} vehicles={vehicles} today={today} onSubmit={add} onCancel={() => setAdding(false)} />}
      {editing && <DispatchForm initial={editing} revenues={revenues} vehicles={vehicles} today={today} onSubmit={(d) => update(editing.id, d)} onCancel={() => { setEditing(null); setViewing(editing.id); }} />}
      {viewingD && !editing && <DispatchDetail d={viewingD} company={companyName} onClose={() => setViewing(null)} onEdit={() => { setViewing(null); setEditing(viewingD); }} onStatus={(s) => setStatusOf(viewingD.id, s)} onDelete={() => remove(viewingD.id)} />}
      {showVehicles && <VehicleManager vehicles={vehicles} loaded={vehiclesLoaded} onChange={setVehicles} onClose={() => setShowVehicles(false)} />}
    </>
  );
}
