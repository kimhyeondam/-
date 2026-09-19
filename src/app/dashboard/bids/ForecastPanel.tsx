"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { useServerState } from "@/lib/useServerState";
import { tasks as initialTasks, type Task } from "@/data/sample";
import { nowIso } from "@/lib/ids";
import { formatWonShort, todayIso } from "@/lib/format";
import { profileByKey, regionOrderOf } from "@/lib/bids/regions";
import { DEFAULT_DESIGN_MONTHS, forecasts, reminderTitle } from "@/lib/bids/forecast";
import type { BidNotice } from "@/lib/bids/types";
import type { OrderPlan, PlansFile } from "@/lib/bids/plans";
import type { MatchSummary } from "@/lib/bids/match";
import { normCompany } from "@/lib/bids/deliveries";

/** 설계용역 공고마다 담당자가 표시한 영업 상태 */
export interface ForecastMark { id: string; status: ForecastStatus; memo?: string; by?: string; at: string }
export type ForecastStatus = "영업대상" | "납품됨" | "우리납품" | "제외";
const statusLabel: Record<ForecastStatus, string> = { 영업대상: "영업 대상", 납품됨: "이미 납품됨 (타사)", 우리납품: "우리가 납품", 제외: "제외" };
const statusCls: Record<ForecastStatus, string> = { 영업대상: "bg-primary-soft text-primary", 납품됨: "bg-red-50 text-red-700", 우리납품: "bg-green-50 text-green-700", 제외: "bg-slate-100 text-slate-500" };

type PlansResp = PlansFile & { hasKey?: boolean; error?: string };
type Job = { running: boolean; total: number; done: number; current?: string; found: number; added?: number; scanned: number; error?: string; finishedAt?: string; monthsBack?: number };
type Probe = { ok: boolean; status: number; variant?: string; body?: string; headerError?: string; total?: number; sample?: Record<string, string> | null; url?: string; tried?: { variant: string; status: number; result: string }[] };
const selectCls = "rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const monthLabel = (ym: string) => { const [y, m] = ym.split("-"); return `${y}년 ${Number(m)}월`; };

/** 「발주 예측」 탭: 설계용역 → 예상 발주 시기, 그리고 지자체가 올린 발주계획 */
export default function ForecastPanel({ items, hasKey, onItems, myCompany = "", regionKey = "gj" }: { items: BidNotice[]; hasKey: boolean; onItems?: (items: BidNotice[]) => void; myCompany?: string; regionKey?: string }) {
  const profile = profileByKey(regionKey);
  const regionOrder = regionOrderOf(profile);
  const label = profile.label;
  const [matches, setMatches] = useState<Record<string, MatchSummary>>({});
  const [matchInfo, setMatchInfo] = useState<{ designs: number; deliveries: number } | null>(null);
  const [marks, setMarks, marksLoaded] = useServerState<ForecastMark[]>("forecastMarks", []);
  const [salesOnly, setSalesOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<"month" | "region">("month");
  const [regionFilter, setRegionFilter] = useState("");
  const [openMatch, setOpenMatch] = useState<string | null>(null);
  const me = normCompany(myCompany);
  const isMe = (c: string) => me.length >= 2 && normCompany(c).includes(me);
  useEffect(() => { fetch("/api/bids/forecast").then((r) => r.json()).then((j: { matches?: Record<string, MatchSummary>; designs?: number; deliveries?: number }) => { setMatches(j.matches ?? {}); setMatchInfo({ designs: j.designs ?? 0, deliveries: j.deliveries ?? 0 }); }).catch(() => {}); }, [items.length]);
  const markOf = (id: string) => marks.find((m) => m.id === id);
  /** 표시가 없으면 납품 기록으로 자동 판단: 우리 회사가 납품했으면 「우리납품」, 다른 업체면 「납품됨」, 기록 없으면 「영업대상」 */
  const statusOf = (id: string): { status: ForecastStatus; auto: boolean } => {
    const m = markOf(id); if (m) return { status: m.status, auto: false };
    const mt = matches[id]; if (!mt) return { status: "영업대상", auto: true };
    return { status: mt.companies.some((c) => isMe(c.name)) ? "우리납품" : "납품됨", auto: true };
  };
  function setStatus(id: string, status: ForecastStatus, memo?: string) {
    if (!marksLoaded) return;
    setMarks((prev) => [{ id, status, memo: memo ?? prev.find((m) => m.id === id)?.memo, at: nowIso() }, ...prev.filter((m) => m.id !== id)]);
  }
  function clearMark(id: string) { if (marksLoaded) setMarks((prev) => prev.filter((m) => m.id !== id)); }
  const [months, setMonths] = useState(DEFAULT_DESIGN_MONTHS);
  const [designRelated, setDesignRelated] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [monthsBack, setMonthsBack] = useState(16);
  const [job, setJob] = useState<Job | null>(null);
  const histSyncing = Boolean(job?.running);
  const [showRaw, setShowRaw] = useState(false);
  const [tasks, setTasks, tasksLoaded] = useServerState<Task[]>("tasks", initialTasks, "jeil.tasks");
  const [plans, setPlans] = useState<PlansResp | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [probing, setProbing] = useState(false);
  const [planRegion, setPlanRegion] = useState("");
  const [planRelated, setPlanRelated] = useState(true);
  const [year] = useState(() => todayIso().slice(0, 4));
  const [from, setFrom] = useState(`${todayIso().slice(0, 4)}-01-01`);
  const [today] = useState(todayIso);

  useEffect(() => { fetch("/api/bids/plans").then((r) => r.json()).then(setPlans).catch(() => setPlans({ items: [] })); }, []);
  // 화면을 열었을 때 이미 뒤에서 돌고 있는 작업이 있으면 이어서 보여 줍니다
  useEffect(() => { fetch("/api/bids/sync").then((r) => r.json()).then((j: { job?: Job }) => { if (j.job?.running) setJob(j.job); }).catch(() => {}); }, []);
  // 진행 상황 3초마다 확인, 끝나면 공고 목록 갱신
  useEffect(() => {
    if (!job?.running) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch("/api/bids/sync"); const j = (await r.json()) as { job: Job; items?: BidNotice[] };
        setJob(j.job);
        if (!j.job.running) { if (j.items && onItems) onItems(j.items); setMsg(j.job.error ? `지난 설계용역 가져오기 실패: ${j.job.error}` : `지난 ${j.job.monthsBack ?? ""}개월치 설계용역을 가져왔습니다. ${label} 설계용역 ${j.job.added ?? 0}건이 새로 들어왔습니다 (전국 용역 공고 ${j.job.scanned.toLocaleString("ko-KR")}건 확인).`); }
      } catch { /* 다음 번에 다시 */ }
    }, 3000);
    return () => clearInterval(t);
  }, [job?.running]); // eslint-disable-line react-hooks/exhaustive-deps

  const listAll = useMemo(() => forecasts(items, months).filter((f) => !designRelated || f.notice.related), [items, months, designRelated]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => listAll.filter((f) => (!salesOnly || statusOf(f.notice.id).status === "영업대상") && (!regionFilter || f.notice.region === regionFilter)), [listAll, salesOnly, regionFilter, marks, matches]);
  const stat = useMemo(() => { const c = { 영업대상: 0, 납품됨: 0, 우리납품: 0, 제외: 0 } as Record<ForecastStatus, number>; for (const f of listAll) c[statusOf(f.notice.id).status]++; return c; }, [listAll, marks, matches]); // eslint-disable-line react-hooks/exhaustive-deps
  const byMonth = useMemo(() => { const m = new Map<string, typeof list>(); for (const f of list) { const l = m.get(f.expectedMonth) ?? []; l.push(f); m.set(f.expectedMonth, l); } return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])); }, [list]);
  const thisMonth = today.slice(0, 7);
  const prevMonth = useMemo(() => { const [y, m] = thisMonth.split("-").map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return d.toISOString().slice(0, 7); }, [thisMonth]);
  // 지난달부터 앞으로가 「지금 챙길 것」, 그 전은 접어 둡니다
  const upcoming = byMonth.filter(([ym]) => ym >= prevMonth);
  const past = byMonth.filter(([ym]) => ym < prevMonth);
  const nowCount = byMonth.find(([ym]) => ym === thisMonth)?.[1].length ?? 0;
  // 지역별 묶음: 지역 순서대로, 안에서는 예상 발주일 순
  const byRegion = useMemo(() => {
    const src = list.filter((f) => showPast || f.expectedMonth >= prevMonth);
    const m = new Map<string, typeof list>(); for (const f of src) { const l = m.get(f.notice.region) ?? []; l.push(f); m.set(f.notice.region, l); }
    return regionOrder.filter((r) => m.has(r)).map((r) => [r, m.get(r)!.sort((a, b) => a.expected.localeCompare(b.expected))] as [string, typeof list]);
  }, [list, showPast, prevMonth]);
  const regionsPresent = useMemo(() => regionOrder.filter((r) => listAll.some((f) => f.notice.region === r)), [listAll]);
  const oldest = useMemo(() => items.filter((n) => n.kind === "용역").reduce((min, n) => (!min || n.noticeAt < min ? n.noticeAt : min), ""), [items]);

  async function syncHistory() {
    setMsg(null);
    try {
      const r = await fetch("/api/bids/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "design", monthsBack }) });
      const j = (await r.json()) as { job?: Job; error?: string };
      if (!r.ok || !j.job) throw new Error(j.error ?? `가져오기 실패 (${r.status})`);
      setJob(j.job);
    } catch (e) { setMsg(`지난 설계용역 가져오기 실패: ${e instanceof Error ? e.message : String(e)}`); }
  }
  const made = useMemo(() => new Set(tasks.map((t) => t.title.match(/\[공고 ([^\]]+)\]/)?.[1]).filter(Boolean)), [tasks]);

  function remind(f: (typeof list)[number]) {
    if (!tasksLoaded || made.has(f.notice.id)) return;
    setTasks((prev) => [{ id: `t${Date.now()}`, title: reminderTitle(f.notice), description: `${f.notice.demand || f.notice.agency} 설계용역(개찰 ${f.base}) → 예상 발주 ${f.expected} 무렵. 담당 부서에 발주 계획·규격 확인.${f.notice.contact ? ` 공고 담당 ${f.notice.contact}${f.notice.contactPhone ? ` ${f.notice.contactPhone}` : ""}` : ""}${f.notice.url ? `\n${f.notice.url}` : ""}`, assignees: [], due: f.remind, status: "todo", priority: "medium", createdAt: nowIso() }, ...prev]);
    setMsg(`「${f.notice.title}」 확인 할일을 ${f.remind} 마감으로 만들었습니다. 할일관리에서 담당자를 정해 주세요.`);
  }
  function remindAll() {
    if (!tasksLoaded) return;
    const todo = list.filter((f) => !made.has(f.notice.id) && f.notice.related && statusOf(f.notice.id).status === "영업대상");
    if (!todo.length) { setMsg("새로 만들 할일이 없습니다."); return; }
    setTasks((prev) => [...todo.map((f, i) => ({ id: `t${Date.now() + i}`, title: reminderTitle(f.notice), description: `${f.notice.demand || f.notice.agency} 설계용역(개찰 ${f.base}) → 예상 발주 ${f.expected} 무렵.${f.notice.url ? `\n${f.notice.url}` : ""}`, assignees: [], due: f.remind, status: "todo" as const, priority: "medium" as const, createdAt: nowIso() })), ...prev]);
    setMsg(`우리 제품 관련 설계용역 ${todo.length}건의 확인 할일을 만들었습니다.`);
  }

  async function syncPlans() {
    setSyncing(true); setMsg(null); setProbe(null);
    try {
      const r = await fetch("/api/bids/plans/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from }) });
      const j = (await r.json()) as PlansResp;
      if (!r.ok) throw new Error(j.error ?? `가져오기 실패 (${r.status})`);
      setPlans(j);
      setMsg(`발주계획을 가져왔습니다. ${label} ${j.items.length}건 보관 중${j.error ? ` (일부 실패: ${j.error})` : ""}`);
    } catch (e) { setMsg(`발주계획 가져오기 실패: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setSyncing(false); }
  }
  async function runProbe() { setProbing(true); try { const r = await fetch("/api/bids/plans/test"); setProbe(await r.json()); } catch (e) { setProbe({ ok: false, status: 0, body: String(e) }); } finally { setProbing(false); } }

  const planItems = useMemo(() => (plans?.items ?? []).filter((p) => (!planRelated || p.related) && (!planRegion || p.region === planRegion)), [plans, planRelated, planRegion]);
  const planByMonth = useMemo(() => { const m = new Map<string, OrderPlan[]>(); for (const p of planItems) { const k = p.month ?? "미정"; const l = m.get(k) ?? []; l.push(p); m.set(k, l); } return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])); }, [planItems]);
  const noticedPlan = useMemo(() => new Set(items.map((n) => n.planNo).filter(Boolean)), [items]);

  return (
    <div className="space-y-5">
      {msg && <div className={`rounded-2xl border px-5 py-3 text-sm ${/실패/.test(msg) ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-800"}`}>{msg}</div>}

      <Card className="p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-bold text-slate-800">① 설계용역 → 예상 발주 시기</h2>
            <p className="mt-1 text-xs text-slate-500">「실시설계」 같은 설계용역 공고가 나오면 보통 {months}개월쯤 뒤에 공사·자재 발주가 나옵니다. 그래서 <b>약 1년 전 설계용역 = 지금 발주가 나올 사업</b>입니다. 「지난 설계용역 가져오기」로 작년 것을 받아 두면 이번 달·다음 달 발주 예상 사업이 보입니다. 「확인 할일」을 만들면 예상 발주 한 달 전에 할일관리에 뜹니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <select value={monthsBack} onChange={(e) => setMonthsBack(Number(e.target.value))} className={selectCls}><option value={12}>지난 12개월</option><option value={16}>지난 16개월</option><option value={24}>지난 24개월</option></select>
            <button onClick={syncHistory} disabled={histSyncing || !hasKey} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 shadow-sm">{histSyncing ? "가져오는 중…" : "지난 설계용역 가져오기"}</button>
          </div>
        </div>
        {job?.running && (
          <div className="mt-3 rounded-xl border border-primary/30 bg-primary-soft/50 px-4 py-3 text-sm text-slate-700">
            <div className="flex items-center justify-between"><span>서버가 뒤에서 가져오는 중입니다. 화면을 닫아도 계속됩니다.</span><span className="font-semibold text-primary">{job.total ? `${job.total}구간 중 ${job.done}번째` : "준비 중"}</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full bg-primary transition-all" style={{ width: `${job.total ? Math.round((job.done / job.total) * 100) : 5}%` }} /></div>
            <div className="mt-1 text-xs text-slate-500">{job.current ? `지금 ${job.current} 구간` : ""}{job.found ? ` · ${label} 설계용역 ${job.found}건 찾음` : ""}{job.scanned ? ` · 전국 ${job.scanned.toLocaleString("ko-KR")}건 확인` : ""}</div>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <label className="inline-flex items-center gap-1">설계 뒤 <input type="number" min={3} max={24} value={months} onChange={(e) => setMonths(Math.max(3, Math.min(24, Number(e.target.value) || DEFAULT_DESIGN_MONTHS)))} className="w-14 rounded-xl border border-line bg-white px-2 py-1 text-center" />개월에 발주</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={designRelated} onChange={(e) => setDesignRelated(e.target.checked)} className="accent-primary" />우리 제품 관련만 (배수로·농로·하천·도로·수로 등)</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={salesOnly} onChange={(e) => setSalesOnly(e.target.checked)} className="accent-primary" />영업 대상만 보기</label>
          <span className="inline-flex overflow-hidden rounded-full border border-line text-xs">
            <button onClick={() => setGroupBy("month")} className={`px-3 py-1 ${groupBy === "month" ? "bg-primary text-white font-semibold" : "bg-white text-slate-600"}`}>달별</button>
            <button onClick={() => setGroupBy("region")} className={`px-3 py-1 ${groupBy === "region" ? "bg-primary text-white font-semibold" : "bg-white text-slate-600"}`}>지역별</button>
          </span>
          <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className={selectCls}><option value="">모든 지역</option>{regionsPresent.map((r) => <option key={r} value={r}>{r}</option>)}</select>
          <span className="text-xs text-slate-400">{oldest ? `보관 중인 용역 공고 ${oldest.slice(0, 10)}부터` : ""}</span>
          <button onClick={remindAll} className="ml-auto rounded-full border border-line bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-primary hover:text-primary">관련 설계용역 모두 할일로</button>
        </div>
        <div className="mt-3 rounded-xl bg-primary-soft/60 px-4 py-2 text-sm text-slate-700"><b className="text-primary">{monthLabel(thisMonth)}</b> 발주 예상 <b>{nowCount}건</b> · 앞으로 {upcoming.reduce((s, [, l]) => s + l.length, 0)}건{past.length ? ` · 지난 예상 ${past.reduce((s, [, l]) => s + l.length, 0)}건` : ""}{nowCount === 0 && !oldest.startsWith(String(Number(today.slice(0, 4)) - 1)) ? " — 작년 설계용역을 아직 안 가져왔습니다. 위 「지난 설계용역 가져오기」를 눌러 주세요." : ""}
          <div className="mt-1 text-xs text-slate-500">영업 대상 <b className="text-primary">{stat.영업대상}</b> · 이미 납품됨(타사) <b className="text-red-600">{stat.납품됨}</b> · 우리가 납품 <b className="text-green-700">{stat.우리납품}</b> · 제외 {stat.제외}{matchInfo ? ` · 납품 현황 ${matchInfo.deliveries.toLocaleString("ko-KR")}건과 자동 대조` : ""}{matchInfo && matchInfo.deliveries === 0 ? " (납품 현황 탭에 CSV 를 올리면 자동으로 「이미 납품됨」이 표시됩니다)" : ""}</div></div>
        {list.length === 0 && <div className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">가져온 공고 중 설계용역이 없습니다. 「지난 설계용역 가져오기」를 누르면 작년 설계용역을 받아 지금 발주 예상 사업을 보여 줍니다.</div>}
        {past.length > 0 && <button onClick={() => setShowPast((v) => !v)} className="mt-3 text-xs text-slate-500 underline hover:text-primary">{showPast ? "지난 예상 접기" : `지난 예상 ${past.reduce((s, [, l]) => s + l.length, 0)}건 펼치기 (예상 시기가 이미 지난 것)`}</button>}
        <div className="mt-3 space-y-3">
          {(groupBy === "month" ? [...(showPast ? past : []), ...upcoming] : byRegion).map(([key, fs]) => (
            <div key={key}>
              <div className="flex items-baseline gap-2">
                {groupBy === "month"
                  ? <span className={`font-semibold ${key === thisMonth ? "rounded-full bg-primary px-2 text-white" : key < thisMonth ? "text-slate-400" : "text-primary"}`}>{monthLabel(key)}{key === thisMonth ? " (이번 달)" : ""}</span>
                  : <span className="font-semibold text-primary">{key}</span>}
                <span className="text-xs text-slate-400">발주 예상 {fs.length}건{groupBy === "region" ? ` · 이번 달 ${fs.filter((f) => f.expectedMonth === thisMonth).length}건 · 영업 대상 ${fs.filter((f) => statusOf(f.notice.id).status === "영업대상").length}건` : ""}</span>
              </div>
              {/* 휴대폰: 카드 */}
              <ul className="md:hidden mt-1 divide-y divide-line rounded-xl border border-line">
                {fs.map((f) => { const n = f.notice; const done = made.has(n.id); const st = statusOf(n.id); const mt = matches[n.id]; return (
                  <li key={n.id} className={`px-3 py-3 space-y-1.5 ${st.status !== "영업대상" ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500"><span>{n.region}</span><span className="text-slate-300">·</span><span>설계 개찰 {f.base}</span>{n.related && <span className="rounded-full bg-green-50 px-1.5 text-green-700">★ 관련</span>}</div>
                    {n.url ? <a href={n.url} target="_blank" rel="noreferrer" className="block text-[15px] font-medium leading-snug text-slate-800 break-keep">{n.title}</a> : <div className="text-[15px] font-medium leading-snug text-slate-800 break-keep">{n.title}</div>}
                    <div className="text-xs text-slate-600">{n.demand || n.agency}{n.budget || n.estimate ? ` · ${formatWonShort(n.budget ?? n.estimate ?? 0)}` : ""}</div>
                    <div className={`text-xs ${f.expectedMonth === thisMonth ? "font-semibold text-primary" : "text-slate-600"}`}>예상 발주 {f.expected}{f.expectedMonth === thisMonth ? " (이번 달)" : ""}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={st.status} onChange={(e) => setStatus(n.id, e.target.value as ForecastStatus)} className={`rounded-full border-0 px-2 py-1 text-xs font-semibold ${statusCls[st.status]}`}>
                        {(Object.keys(statusLabel) as ForecastStatus[]).map((k) => <option key={k} value={k}>{statusLabel[k]}{k === st.status && st.auto ? " (자동)" : ""}</option>)}
                      </select>
                      {!st.auto && <button onClick={() => clearMark(n.id)} className="text-[11px] text-slate-400">표시 지우기</button>}
                      <span className="ml-auto">{done ? <Link href="/dashboard/tasks" className="text-xs text-slate-400">할일 있음</Link> : st.status === "영업대상" ? <button onClick={() => remind(f)} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-600 active:bg-primary-soft">확인 할일</button> : null}</span>
                    </div>
                    {mt && <button onClick={() => setOpenMatch(openMatch === n.id ? null : n.id)} className="block text-[11px] text-slate-500">납품 기록 {mt.count}건 · {mt.companies.map((c) => c.name).join(", ")} · {formatWonShort(mt.amount)} {openMatch === n.id ? "▲" : "▼"}</button>}
                    {mt && openMatch === n.id && <ul className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">{mt.samples.map((x, i) => <li key={i}>{x.date} · {x.company} · {x.item}{x.amount ? ` · ${formatWonShort(x.amount)}` : ""}<div className="text-slate-400">{x.reqName}</div></li>)}</ul>}
                  </li>
                ); })}
              </ul>
              <div className="hidden md:block mt-1 overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {fs.map((f) => { const n = f.notice; const done = made.has(n.id); return (
                      <tr key={n.id} className={`border-t border-line align-top ${statusOf(n.id).status !== "영업대상" ? "opacity-60" : ""}`}>
                        <td className="px-2 py-2 whitespace-nowrap text-slate-600">{n.region}</td>
                        <td className="px-2 py-2 min-w-[220px]">{n.url ? <a href={n.url} target="_blank" rel="noreferrer" className="font-medium text-slate-800 hover:text-primary hover:underline">{n.title}</a> : <span className="font-medium text-slate-800">{n.title}</span>}<div className="text-[11px] text-slate-400">{n.demand || n.agency} · 설계 개찰 {f.base}{n.related && <span className="ml-1 rounded-full bg-green-50 px-1.5 text-green-700">★ 관련</span>}</div></td>
                        <td className="px-2 py-2 whitespace-nowrap text-right text-slate-700">{n.budget ? formatWonShort(n.budget) : n.estimate ? formatWonShort(n.estimate) : "-"}</td>
                        <td className={`px-2 py-2 whitespace-nowrap ${f.expectedMonth === thisMonth ? "font-semibold text-primary" : f.expectedMonth < thisMonth ? "text-slate-400" : "text-slate-600"}`}>예상 {f.expected}{f.expectedMonth === thisMonth ? " (이번 달)" : ""}</td>
                        <td className="px-2 py-2 min-w-[190px]">
                          {(() => { const st = statusOf(n.id); const mt = matches[n.id]; const mk = markOf(n.id); return (
                            <div className="space-y-1">
                              <select value={st.status} onChange={(e) => setStatus(n.id, e.target.value as ForecastStatus)} className={`rounded-full border-0 px-2 py-0.5 text-xs font-semibold ${statusCls[st.status]}`}>
                                {(Object.keys(statusLabel) as ForecastStatus[]).map((k) => <option key={k} value={k}>{statusLabel[k]}{k === st.status && st.auto ? " (자동)" : ""}</option>)}
                              </select>
                              {mt && <button onClick={() => setOpenMatch(openMatch === n.id ? null : n.id)} className="block text-[11px] text-slate-500 hover:text-primary">납품 기록 {mt.count}건 · {mt.companies.map((c) => c.name).join(", ")} · {formatWonShort(mt.amount)} {openMatch === n.id ? "▲" : "▼"}</button>}
                              {mt && openMatch === n.id && <ul className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">{mt.samples.map((x, i) => <li key={i}>{x.date} · {x.company} · {x.item}{x.amount ? ` · ${formatWonShort(x.amount)}` : ""}<div className="text-slate-400">{x.reqName}</div></li>)}</ul>}
                              {!st.auto && <button onClick={() => clearMark(n.id)} className="text-[11px] text-slate-400 hover:text-primary">표시 지우기 (자동으로)</button>}
                            </div>
                          ); })()}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">{done ? <Link href="/dashboard/tasks" className="text-xs text-slate-400 hover:text-primary">할일 있음</Link> : statusOf(n.id).status === "영업대상" ? <button onClick={() => remind(f)} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-600 hover:border-primary hover:text-primary">확인 할일</button> : null}</td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-bold text-slate-800">② 발주계획 (지자체가 미리 올린 올해 발주 목록)</h2>
            <p className="mt-1 text-xs text-slate-500">각 기관은 연초에 「무엇을 언제 발주할지」를 나라장터에 등록합니다. 등록일 기준으로 가져와 발주 예정 달별로 보여 줍니다. 이미 공고가 나온 계획에는 「공고 나옴」 표시가 붙습니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-600">등록일 <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls} /> 부터</label>
            <button onClick={syncPlans} disabled={syncing} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 shadow-sm">{syncing ? "가져오는 중…" : "발주계획 가져오기"}</button>
          </div>
        </div>
        {plans?.fetchedAt && <div className="mt-1 text-xs text-slate-400"><button onClick={runProbe} disabled={probing} className="mr-2 underline hover:text-primary disabled:opacity-60">{probing ? "확인 중…" : "연결 확인"}</button>{plans.fetchedFrom} ~ {plans.fetchedTo} 등록분 · {new Date(plans.fetchedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 기준 · {plans.items.length}건{plans.error ? ` · 일부 실패: ${plans.error}` : ""}</div>}
        {!hasKey && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-slate-700">인증키가 없어 가져올 수 없습니다. 먼저 「공고 목록」의 안내대로 인증키를 넣어 주세요.</div>}
        {hasKey && plans && !plans.fetchedAt && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-slate-700">
            <div className="font-semibold text-slate-800">처음 한 번: 공공데이터포털에서 「조달청 나라장터 발주계획현황서비스」(오픈API) 활용신청을 해 주세요 (같은 인증키로 됩니다. 신청 뒤 반영까지 최대 1시간)</div>
            <div className="mt-1">신청했으면 「발주계획 가져오기」를 누르세요. 안 되면 <button onClick={runProbe} disabled={probing} className="underline hover:text-primary disabled:opacity-60">{probing ? "확인 중…" : "연결 확인"}</button>으로 답장 내용을 볼 수 있습니다. (처음 한 번은 검색 형식 4가지를 자동으로 시험해 맞는 것을 찾습니다)</div>
          </div>
        )}
        {probe && (
          <div className={`mt-3 rounded-xl border px-4 py-3 text-xs ${probe.ok ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-slate-700"}`}>
            <div className="font-semibold">{probe.ok ? `연결 성공 (검색 형식 ${probe.variant}, 전국 물품 발주계획 ${probe.total ?? 0}건). 「발주계획 가져오기」를 눌러 주세요.` : probe.headerError && /NOT_REGISTERED|등록되지 않은/.test(probe.headerError) ? "「등록되지 않은 서비스키」: 발주계획정보서비스 활용신청이 아직 안 되었거나 반영 전입니다." : probe.headerError && /NO_OPENAPI|없거나 폐기/.test(probe.headerError) ? "요청 주소 후보를 모두 시험했지만 맞는 것이 없습니다. 공공데이터포털의 「조달청 나라장터 발주계획현황서비스」 상세 화면에서 End Point 와 기능(오퍼레이션) 목록이 보이는 부분을 캡처해 알려 주세요." : `연결 실패 (${probe.status})`}</div>
            <div className="mt-1 text-slate-500">{probe.url}</div>
            {probe.tried && probe.tried.length > 0 && <div className="mt-1 text-slate-500">시험한 주소·형식: {probe.tried.map((t) => `${t.variant} → ${t.result}`).join(" · ")}</div>}
            {probe.sample && <pre className="mt-1 whitespace-pre-wrap break-all rounded-xl bg-white/70 p-2 text-[11px] text-slate-600">{JSON.stringify(probe.sample, null, 1).slice(0, 1500)}</pre>}
            {!probe.sample && probe.body && <pre className="mt-1 whitespace-pre-wrap break-all rounded-xl bg-white/70 p-2 text-[11px] text-slate-600">{probe.body}</pre>}
          </div>
        )}
        {plans && plans.items.length > 0 && (<>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select value={planRegion} onChange={(e) => setPlanRegion(e.target.value)} className={selectCls}><option value="">모든 지역</option>{regionOrder.map((r) => <option key={r} value={r}>{r}</option>)}</select>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={planRelated} onChange={(e) => setPlanRelated(e.target.checked)} className="accent-primary" />우리 제품 관련만</label>
            <span className="text-xs text-slate-400">{planItems.length}건</span>
          </div>
          <div className="mt-3 space-y-3">
            {planByMonth.map(([ym, ps]) => (
              <div key={ym}>
                <div className="flex items-baseline gap-2"><span className={`font-semibold ${ym !== "미정" && ym < today.slice(0, 7) ? "text-slate-400" : "text-primary"}`}>{ym === "미정" ? "시기 미정" : monthLabel(ym)}</span><span className="text-xs text-slate-400">{ps.length}건 · 예산 합계 {formatWonShort(ps.reduce((s, p) => s + (p.budget ?? 0), 0))}</span></div>
                <ul className="md:hidden mt-1 divide-y divide-line rounded-xl border border-line">
                  {ps.map((p) => (
                    <li key={p.id} className="px-3 py-2.5 space-y-1">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500"><span className={`rounded-full px-2 py-0.5 ${p.kind === "공사" ? "bg-amber-50 text-amber-700" : p.kind === "물품" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"}`}>{p.kind}</span><span>{p.region}</span>{p.related && <span className="rounded-full bg-green-50 px-1.5 text-green-700">★ 관련</span>}{noticedPlan.has(p.id) && <span className="rounded-full bg-primary-soft px-1.5 text-primary">공고 나옴</span>}</div>
                      <div className="text-[15px] font-medium leading-snug text-slate-800 break-keep">{p.title}</div>
                      <div className="text-xs text-slate-600">{p.agency}{p.method ? ` · ${p.method}` : ""}{p.budget ? ` · ${formatWonShort(p.budget)}` : ""}</div>
                    </li>
                  ))}
                </ul>
                <div className="hidden md:block mt-1 overflow-x-auto">
                  <table className="w-full text-sm"><tbody>
                    {ps.map((p) => (
                      <tr key={p.id} className="border-t border-line align-top">
                        <td className="px-2 py-2 whitespace-nowrap text-slate-600">{p.region}</td>
                        <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${p.kind === "공사" ? "bg-amber-50 text-amber-700" : p.kind === "물품" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"}`}>{p.kind}</span></td>
                        <td className="px-2 py-2 min-w-[220px]"><span className="font-medium text-slate-800">{p.title}</span><div className="text-[11px] text-slate-400">{p.agency}{p.method ? ` · ${p.method}` : ""}{p.related && <span className="ml-1 rounded-full bg-green-50 px-1.5 text-green-700">★ 관련</span>}{noticedPlan.has(p.id) && <span className="ml-1 rounded-full bg-primary-soft px-1.5 text-primary">공고 나옴</span>}</div></td>
                        <td className="px-2 py-2 whitespace-nowrap text-right text-slate-700">{p.budget ? formatWonShort(p.budget) : "-"}</td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              </div>
            ))}
          </div>
        </>)}
        {plans && plans.fetchedAt && plans.items.length === 0 && (
          <div className="mt-3 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
            <div className="text-center">가져온 기간에 {label} 발주계획이 없습니다{plans.scanned ? ` (전국 ${plans.scanned.toLocaleString("ko-KR")}건은 받았지만 기관 이름 항목을 못 찾았을 수 있습니다)` : " (전국 자료도 0건: 검색 형식이 맞지 않을 수 있습니다)"}. 등록일을 {year}-01-01 로 두고 다시 가져와 보세요.</div>
            {plans.sampleRaw && (
              <div className="mt-2 text-center"><button onClick={() => setShowRaw((v) => !v)} className="text-xs underline hover:text-primary">{showRaw ? "원문 예시 접기" : "받은 자료 원문 예시 보기 (항목 이름 확인용, 캡처해서 보내 주세요)"}</button>
                {showRaw && <pre className="mt-2 whitespace-pre-wrap break-all rounded-xl bg-white p-3 text-left text-[11px] text-slate-600">{JSON.stringify(plans.sampleRaw, null, 1)}</pre>}</div>
            )}
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-400">이 화면의 흐름: 설계용역 공고(약 1년 전) → 발주계획 등록(연초) → 사전규격 공개(공고 1~2주 전) → 공사·물품 공고. 사전규격·낙찰정보(설계사 확인) 연동은 다음 단계에서 붙일 수 있습니다.</p>
    </div>
  );
}
