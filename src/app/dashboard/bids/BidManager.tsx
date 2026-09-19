"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import Tabs from "@/components/Tabs";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { leads as initialLeads, type Lead } from "@/data/sample";
import { newId } from "@/lib/ids";
import { formatWonShort, todayIso } from "@/lib/format";
import { profileByKey, regionOrderOf } from "@/lib/bids/regions";
import type { BidKind, BidMethod, BidNotice, BidsFile } from "@/lib/bids/types";
import ForecastPanel from "./ForecastPanel";
import DeliveryPanel from "./DeliveryPanel";

type Resp = BidsFile & { syncing?: boolean; hasKey?: boolean; autoError?: string; error?: string };
const methods: BidMethod[] = ["수의계약", "제한경쟁", "일반경쟁", "지명경쟁", "기타"];
const methodColor: Record<BidMethod, string> = { 수의계약: "bg-green-500", 제한경쟁: "bg-primary", 일반경쟁: "bg-blue-500", 지명경쟁: "bg-purple-500", 기타: "bg-slate-400" };
const methodBadge: Record<BidMethod, string> = { 수의계약: "bg-green-50 text-green-700", 제한경쟁: "bg-primary-soft text-primary", 일반경쟁: "bg-blue-50 text-blue-700", 지명경쟁: "bg-purple-50 text-purple-700", 기타: "bg-slate-100 text-slate-600" };
const kindBadge: Record<BidKind, string> = { 공사: "bg-amber-50 text-amber-700", 물품: "bg-sky-50 text-sky-700", 용역: "bg-slate-100 text-slate-600" };
const selectCls = "rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

/** 지역 하나의 요약: 건수·계약방법별 건수·예산 합계·주된 방식 */
function summarize(list: BidNotice[]) {
  const byMethod = Object.fromEntries(methods.map((m) => [m, 0])) as Record<BidMethod, number>;
  let budget = 0; let related = 0;
  for (const n of list) { byMethod[n.method]++; budget += n.budget ?? n.estimate ?? 0; if (n.related) related++; }
  const top = methods.filter((m) => byMethod[m] > 0).sort((a, b) => byMethod[b] - byMethod[a])[0];
  return { total: list.length, byMethod, budget, related, top };
}

export default function BidManager({ initialTab = "regions", initialRegion, companyName = "현담토목", regionKey = "jb" }: { initialTab?: "regions" | "list" | "forecast" | "deliveries"; initialRegion?: string; companyName?: string; regionKey?: string } = {}) {
  const profile = profileByKey(regionKey);
  const groups = profile.groups;
  const regionOrder = regionOrderOf(profile);
  const label = profile.label;
  const [file, setFile] = useState<Resp | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"regions" | "list" | "forecast" | "deliveries">(initialTab);
  const [region, setRegion] = useState<string>(initialRegion ?? "");
  const [kind, setKind] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [relatedOnly, setRelatedOnly] = useState(true);
  const [q, setQ] = useState("");
  const [days, setDays] = useState(7);
  const [probe, setProbe] = useState<{ ok: boolean; status: number; body: string; headerError?: string; total?: number; url?: string; keyLength: number; keyLooksEncoded?: boolean } | null>(null);
  const [probing, setProbing] = useState(false);
  async function runProbe() {
    setProbing(true);
    try { const r = await fetch("/api/bids/test"); setProbe(await r.json()); } catch (e) { setProbe({ ok: false, status: 0, body: String(e), keyLength: 0 }); }
    finally { setProbing(false); }
  }
  function explain(p: NonNullable<typeof probe>) {
    if (p.ok) return `연결 성공. 최근 하루 전국 공사 공고 ${p.total ?? 0}건이 확인됩니다. 「나라장터에서 가져오기」를 눌러 주세요.`;
    if (p.keyLooksEncoded) return "인증키가 Encoding 키로 보입니다(%2B, %3D 같은 글자 포함). 공공데이터포털 마이페이지의 「Decoding」 키를 다시 넣어 주세요.";
    if (p.headerError && /NO_OPENAPI_SERVICE|없거나 폐기/.test(p.headerError)) return "「해당 오픈API 서비스가 없거나 폐기됨」: 요청 주소(End Point)가 공공데이터포털에 등록된 것과 다릅니다. 서비스 상세 화면의 End Point 를 캡처해서 알려 주세요.";
    if (p.headerError) return /NOT_REGISTERED|UNREGISTERED|등록되지 않은/i.test(p.headerError) ? "「등록되지 않은 서비스키」: 이 인증키가 「조달청_나라장터 입찰공고정보서비스」에 아직 연결되지 않았습니다. ① 활용신청 직후라면 반영까지 최대 1시간 기다렸다가 다시 눌러 보세요. ② 공공데이터포털 마이페이지 → 활용신청 현황에서 서비스 이름이 정확히 「조달청_나라장터 입찰공고정보서비스」인지, 그 상세 화면의 End Point(요청주소)가 아래 요청 주소와 같은지 확인해 주세요." : /LIMITED|EXCEED/i.test(p.headerError) ? "오늘 요청 한도를 넘었습니다. 내일 다시 시도해 주세요." : `나라장터가 오류를 보냈습니다: ${p.headerError}`;
    if (p.status === 403 || p.status === 401) return "나라장터가 요청을 거부했습니다(403). 보통 ① 활용신청한 서비스가 다른 것이거나 ② 신청 직후라 아직 반영 전이거나 ③ 인증키를 잘못 복사한 경우입니다. 아래 답장 내용을 그대로 캡처해서 알려 주시면 정확히 잡아 드립니다.";
    if (p.status === 0) return `서버에서 나라장터에 접속하지 못했습니다: ${p.body}`;
    return `나라장터 연결 실패 (${p.status}). 아래 답장 내용을 캡처해서 알려 주세요.`;
  }
  const [leads, setLeads, leadsLoaded] = useServerState<Lead[]>("leads", initialLeads, "jeil.leads");
  const [today] = useState(todayIso);

  // 납품 현황·대조 결과를 서버가 미리 읽어 두도록 살짝 건드립니다 (탭을 누를 때 기다리지 않게)
  useEffect(() => { const t = setTimeout(() => { fetch("/api/bids/deliveries/summary?related=1").catch(() => {}); }, 1500); return () => clearTimeout(t); }, []);
  const [bgSyncing, setBgSyncing] = useState(false);
  useEffect(() => {
    let stop = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const load = (poll: boolean) => fetch(`/api/bids/list${poll ? "?poll=1" : ""}`).then(async (r) => { const j = (await r.json()) as Resp; if (!r.ok) throw new Error(j.error ?? `불러오기 실패 (${r.status})`); return j; });
    // 보관된 자료를 먼저 보여 주고, 서버가 뒤에서 새 공고를 받는 중이면 끝날 때까지 5초마다 확인합니다
    const watch = (j: Resp) => { setFile(j); setBgSyncing(!!j.syncing); if (j.syncing && !stop) timer = setTimeout(() => load(true).then(watch).catch(() => {}), 5000); };
    load(false).then(watch).catch((e) => setLoadError(e.message));
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, []);

  async function sync() {
    setSyncing(true); setMsg(null);
    try {
      const r = await fetch("/api/bids/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }) });
      const j = (await r.json()) as Resp;
      if (!r.ok) throw new Error(j.error ?? `가져오기 실패 (${r.status})`);
      setFile(j);
      setMsg(`나라장터에서 최근 ${days}일치를 가져왔습니다. ${label} 공고 ${j.items.length}건 보관 중${j.error ? ` (일부 실패: ${j.error})` : ""}`);
    } catch (e) { setMsg(`가져오기 실패: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setSyncing(false); }
  }

  const items = useMemo(() => file?.items ?? [], [file]);
  const relatedItems = useMemo(() => items.filter((n) => n.related), [items]);
  const byRegion = useMemo(() => { const m = new Map<string, BidNotice[]>(); for (const n of (relatedOnly ? relatedItems : items)) { const l = m.get(n.region) ?? []; l.push(n); m.set(n.region, l); } return m; }, [items, relatedItems, relatedOnly]);
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return items.filter((n) => (!relatedOnly || n.related) && (!region || n.region === region) && (!kind || n.kind === kind) && (!method || n.method === method) && (!ql || `${n.title} ${n.demand} ${n.agency} ${n.no}`.toLowerCase().includes(ql)))
      .sort((a, b) => b.noticeAt.localeCompare(a.noticeAt));
  }, [items, relatedOnly, region, kind, method, q]);
  const closingSoon = relatedItems.filter((n) => n.closeAt && n.closeAt.slice(0, 10) >= today && new Date(n.closeAt.slice(0, 10)).getTime() - new Date(today).getTime() <= 3 * 86400_000);
  const all = summarize(relatedItems);
  const leadBidIds = useMemo(() => new Set(leads.map((l) => l.memo?.match(/\[공고 ([^\]]+)\]/)?.[1]).filter(Boolean)), [leads]);

  function toLead(n: BidNotice) {
    if (!leadsLoaded || leadBidIds.has(n.id)) return;
    const memo = `[공고 ${n.id}] ${n.title}${n.closeAt ? ` · 마감 ${n.closeAt}` : ""}${n.budget ? ` · 예산 ${formatWonShort(n.budget)}` : ""}${n.site ? ` · 현장 ${n.site}` : ""}${n.url ? `\n${n.url}` : ""}`;
    setLeads((prev) => [{ id: newId("l"), company: n.demand || n.agency, contact: n.contact || "담당자 확인 필요", phone: n.contactPhone, email: n.contactEmail, source: "입찰공고", status: "신규", product: n.keywords.slice(0, 4).join(", ") || undefined, memo, createdAt: today }, ...prev]);
    setMsg(`「${n.demand || n.agency}」 리드를 만들었습니다. 리드관리에서 담당자·연락처를 채워 주세요.`);
  }

  return (
    <>
      <PageHeader
        title="관급 발주 현황"
        description={`나라장터(조달청)에 올라온 ${label} 지자체 입찰공고를 지역별·발주 방식별로 나눠 봅니다. 우리 제품(흄관·맨홀·경계석·블록·수로관 등)과 관련 있는 공고만 골라 볼 수 있습니다.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={selectCls}>
              <option value={7}>최근 7일</option><option value={14}>최근 14일</option><option value={31}>최근 31일</option>
            </select>
            <button onClick={sync} disabled={syncing} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">{syncing ? "가져오는 중…" : "나라장터에서 가져오기"}</button>
          </div>
        }
      />
      {!file && <LoadingCard error={loadError} />}
      {file && (<>
        {file.hasKey === false && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-slate-700">
            <div className="font-semibold text-slate-800">아직 나라장터와 연결되지 않았습니다 (지금 보이는 것은 예시입니다)</div>
            <ol className="mt-1 list-decimal pl-5 space-y-0.5 text-xs text-slate-600">
              <li>공공데이터포털(data.go.kr)에 회원가입 → 「조달청_나라장터 입찰공고정보서비스」 검색 → 「활용신청」 (무료, 바로 승인)</li>
              <li>마이페이지에서 「일반 인증키(Decoding)」를 복사</li>
              <li>서버의 <code>~/hyundam/.env.production</code> 파일에 <code>DATA_GO_KR_KEY=복사한키</code> 한 줄을 넣고 <code>docker compose up -d</code> (내 컴퓨터에서 쓸 때는 <code>.env.local</code>)</li>
            </ol>
          </div>
        )}
        {bgSyncing && (
          <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary-soft/40 px-5 py-2.5 text-sm text-slate-700"><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />나라장터에서 새 공고를 받는 중입니다. 지금은 보관된 자료를 보여 주고, 끝나면 자동으로 바뀝니다.</div>
        )}
        {(file.autoError || file.error) && file.hasKey && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
            <div>나라장터 가져오기 문제: {file.autoError ?? file.error}</div>
            <button onClick={runProbe} disabled={probing} className="mt-2 rounded-full border border-red-300 bg-white px-4 py-1.5 text-xs font-semibold text-red-700 hover:border-red-500 disabled:opacity-60">{probing ? "확인 중…" : "연결 확인 (원인 찾기)"}</button>
          </div>
        )}
        {probe && (
          <div className={`rounded-2xl border px-5 py-3 text-sm ${probe.ok ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-slate-700"}`}>
            <div className="font-semibold">{explain(probe)}</div>
            <div className="mt-1 text-xs text-slate-500">상태코드 {probe.status} · 인증키 길이 {probe.keyLength}자{probe.url ? ` · 요청 주소 ${probe.url}` : ""}</div>
            {probe.body && <pre className="mt-1 whitespace-pre-wrap break-all rounded-xl bg-white/70 p-2 text-[11px] text-slate-600">{probe.body}</pre>}
          </div>
        )}
        {msg && <div className={`rounded-2xl border px-5 py-3 text-sm ${msg.startsWith("가져오기 실패") ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-800"}`}>{msg}</div>}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label={`${label} 공고`} value={`${items.length}건`} sub={file.fetchedAt ? `${file.fetchedFrom} ~ ${file.fetchedTo} · ${new Date(file.fetchedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 기준` : "예시 자료"} icon="◎" onClick={() => { setRelatedOnly(false); setRegion(""); setTab("list"); }} />
          <StatCard label="우리 제품 관련" value={`${relatedItems.length}건`} sub="공고명에 제품 키워드가 있는 것" icon="★" tone="green" onClick={() => { setRelatedOnly(true); setRegion(""); setTab("list"); }} />
          <StatCard label="마감 3일 이내" value={<span className={closingSoon.length ? "text-red-600" : ""}>{closingSoon.length}건</span>} sub="관련 공고 중 입찰 마감이 가까운 것" icon="!" highlight={closingSoon.length > 0} onClick={() => { setRelatedOnly(true); setRegion(""); setTab("list"); }} />
          <StatCard label="수의계약 비율" value={all.total ? `${Math.round((all.byMethod.수의계약 / all.total) * 100)}%` : "-"} sub={all.total ? `관련 공고 ${all.total}건 중 ${all.byMethod.수의계약}건` : "자료 없음"} icon="%" onClick={() => { setMethod("수의계약"); setTab("list"); }} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={tab} onChange={(v) => setTab(v as typeof tab)} tabs={[{ key: "regions", label: "지역별 현황" }, { key: "list", label: "공고 목록", n: filtered.length }, { key: "forecast", label: "발주 예측" }, { key: "deliveries", label: "납품 현황" }]} />
          {tab !== "forecast" && tab !== "deliveries" && <label className="inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={relatedOnly} onChange={(e) => setRelatedOnly(e.target.checked)} className="accent-primary" />우리 제품 관련만</label>}
        </div>

        {tab === "regions" && (
          <div className="space-y-4">
            {groups.map((g) => (
              <Card key={g.title} className="p-5">
                <div className="flex items-baseline justify-between"><h2 className="font-bold text-slate-800">{g.title}</h2><span className="text-xs text-slate-400">{g.regions.reduce((s, r) => s + (byRegion.get(r)?.length ?? 0), 0)}건</span></div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {g.regions.map((r) => {
                    const s = summarize(byRegion.get(r) ?? []);
                    return (
                      <button key={r} onClick={() => { setRegion(r); setTab("list"); }} className={`rounded-2xl border px-4 py-3 text-left transition hover:border-primary ${s.total ? "border-line bg-white" : "border-dashed border-line bg-slate-50/60"}`}>
                        <div className="flex items-baseline justify-between"><span className="font-semibold text-slate-800">{r}</span><span className={`text-sm font-bold ${s.total ? "text-primary" : "text-slate-300"}`}>{s.total}건</span></div>
                        {s.total ? (<>
                          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100">{methods.map((m) => s.byMethod[m] ? <span key={m} className={methodColor[m]} style={{ width: `${(s.byMethod[m] / s.total) * 100}%` }} title={`${m} ${s.byMethod[m]}건`} /> : null)}</div>
                          <div className="mt-1.5 flex flex-wrap gap-x-2 text-[11px] text-slate-500">{methods.filter((m) => s.byMethod[m]).map((m) => <span key={m}><span className={`inline-block h-2 w-2 rounded-full mr-1 align-middle ${methodColor[m]}`} />{m} {s.byMethod[m]}</span>)}</div>
                          <div className="mt-1 text-xs text-slate-500">주로 <b className="text-slate-700">{s.top}</b>{s.budget ? ` · 예산 합계 ${formatWonShort(s.budget)}` : ""}</div>
                        </>) : <div className="mt-2 text-xs text-slate-400">해당 기간 공고 없음</div>}
                      </button>
                    );
                  })}
                </div>
              </Card>
            ))}
            <p className="text-xs text-slate-400">발주 방식 읽는 법: <b>수의계약</b>은 금액이 작아 경쟁 없이 업체를 정하는 것(영업 담당자가 직접 찾아가는 것이 중요), <b>제한경쟁</b>은 지역·실적 조건을 갖춘 업체끼리 경쟁, <b>일반경쟁</b>은 누구나 참여, <b>지명경쟁</b>은 발주처가 지정한 업체끼리 경쟁입니다.</p>
          </div>
        )}

        {tab === "list" && (
          <Card className="p-0 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectCls}><option value="">모든 지역</option>{regionOrder.map((r) => <option key={r} value={r}>{r}</option>)}</select>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={selectCls}><option value="">공사·물품·용역</option><option>공사</option><option>물품</option><option>용역</option></select>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={selectCls}><option value="">모든 계약방법</option>{methods.map((m) => <option key={m}>{m}</option>)}</select>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="공고명·기관·공고번호 검색" className={`${selectCls} flex-1 min-w-[160px]`} />
              {(region || kind || method || q) && <button onClick={() => { setRegion(""); setKind(""); setMethod(""); setQ(""); }} className="text-xs text-slate-500 hover:text-primary">필터 지우기</button>}
            </div>
            {/* 휴대폰: 한 건씩 카드로 */}
            <ul className="md:hidden divide-y divide-line">
              {filtered.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-400">조건에 맞는 공고가 없습니다.</li>}
              {filtered.slice(0, 200).map((n) => {
                const soon = n.closeAt && n.closeAt.slice(0, 10) >= today && new Date(n.closeAt.slice(0, 10)).getTime() - new Date(today).getTime() <= 3 * 86400_000;
                const made = leadBidIds.has(n.id);
                return (
                  <li key={n.id} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className={`rounded-full px-2 py-0.5 ${kindBadge[n.kind]}`}>{n.kind}</span>
                      <span>{n.noticeAt.slice(0, 10)}</span>
                      <span className="text-slate-300">·</span>
                      <span>{n.region}</span>
                      {n.related && <span className="rounded-full bg-green-50 px-1.5 text-green-700">★ 관련</span>}
                    </div>
                    {n.url ? <a href={n.url} target="_blank" rel="noreferrer" className="block text-[15px] font-medium leading-snug text-slate-800 break-keep">{n.title}</a> : <div className="text-[15px] font-medium leading-snug text-slate-800 break-keep">{n.title}</div>}
                    <div className="text-xs text-slate-600">{n.demand || n.agency}{n.contact && <span className="text-slate-400"> · {n.contact}{n.contactPhone ? ` ${n.contactPhone}` : ""}</span>}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className={`rounded-full px-2 py-0.5 ${methodBadge[n.method]}`}>{n.methodRaw || n.method}</span>
                      <span className="text-slate-700">예산 {n.budget ? formatWonShort(n.budget) : n.estimate ? formatWonShort(n.estimate) : "-"}</span>
                      <span className={soon ? "font-semibold text-red-600" : "text-slate-600"}>마감 {n.closeAt ? n.closeAt.slice(5, 16) : "-"}</span>
                      <span className="ml-auto">{made ? <Link href="/dashboard/leads" className="text-slate-400">리드 있음</Link> : <button onClick={() => toLead(n)} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-600 active:bg-primary-soft">리드로</button>}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-2 text-left">공고일</th><th className="px-3 py-2 text-left">구분</th><th className="px-3 py-2 text-left">공고명</th><th className="px-3 py-2 text-left">수요기관</th><th className="px-3 py-2 text-left">지역</th><th className="px-3 py-2 text-left">계약방법</th><th className="px-3 py-2 text-right">예산</th><th className="px-3 py-2 text-left">마감</th><th className="px-3 py-2"></th></tr></thead>
                <tbody>
                  {filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">조건에 맞는 공고가 없습니다.</td></tr>}
                  {filtered.slice(0, 300).map((n) => {
                    const soon = n.closeAt && n.closeAt.slice(0, 10) >= today && new Date(n.closeAt.slice(0, 10)).getTime() - new Date(today).getTime() <= 3 * 86400_000;
                    const made = leadBidIds.has(n.id);
                    return (
                      <tr key={n.id} className="border-t border-line align-top hover:bg-primary-soft/40">
                        <td className="px-4 py-2 whitespace-nowrap text-slate-600">{n.noticeAt.slice(5, 10)}</td>
                        <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${kindBadge[n.kind]}`}>{n.kind}</span></td>
                        <td className="px-3 py-2 min-w-[220px] max-w-[420px]">
                          {n.url ? <a href={n.url} target="_blank" rel="noreferrer" className="font-medium text-slate-800 hover:text-primary hover:underline">{n.title}</a> : <span className="font-medium text-slate-800">{n.title}</span>}
                          <div className="mt-0.5 flex flex-wrap gap-1 text-[11px] text-slate-400">{n.related && <span className="rounded-full bg-green-50 px-1.5 text-green-700">★ 관련</span>}{n.keywords.slice(0, 4).map((k) => <span key={k} className="rounded-full bg-slate-100 px-1.5">{k}</span>)}{n.noticeKind && !/^(일반|등록공고|등록)$/.test(n.noticeKind) && <span className="rounded-full bg-amber-50 px-1.5 text-amber-700">{n.noticeKind}</span>}<span>{n.no}</span></div>
                        </td>
                        <td className="px-3 py-2 text-slate-700 min-w-[120px]">{n.demand || n.agency}{n.agency && n.demand && n.agency !== n.demand && <div className="text-[11px] text-slate-400">공고: {n.agency}</div>}{n.contact && <div className="text-[11px] text-slate-500">{n.contact}{n.contactPhone ? ` · ${n.contactPhone}` : ""}</div>}</td>

                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">{n.region}{n.site && <div className="text-[11px] text-slate-400">현장 {n.site.replace(/^(전라남도|광주광역시|광주전남통합특별시|전북특별자치도|전라북도)\s*/, "")}</div>}</td>
                        <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${methodBadge[n.method]}`}>{n.methodRaw || n.method}</span>{n.award && <div className="text-[11px] text-slate-400">{n.award}</div>}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-slate-700">{n.budget ? formatWonShort(n.budget) : n.estimate ? <span title="추정가격">{formatWonShort(n.estimate)}</span> : "-"}</td>
                        <td className={`px-3 py-2 whitespace-nowrap ${soon ? "text-red-600 font-semibold" : "text-slate-600"}`}>{n.closeAt ? n.closeAt.slice(5, 16) : "-"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{made ? <Link href="/dashboard/leads" className="text-xs text-slate-400 hover:text-primary">리드 있음</Link> : <button onClick={() => toLead(n)} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-600 hover:border-primary hover:text-primary">리드로</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > 300 && <div className="px-4 py-2 text-xs text-slate-400">최근 300건만 표시합니다. 검색이나 필터로 줄여 주세요.</div>}
          </Card>
        )}
        {tab === "deliveries" && <DeliveryPanel myCompany={companyName} regionKey={regionKey} />}
        {tab === "forecast" && <ForecastPanel items={items} hasKey={file.hasKey !== false} myCompany={companyName} regionKey={regionKey} onItems={(next) => setFile((f) => (f ? { ...f, items: next } : f))} />}
      </>)}
    </>
  );
}
