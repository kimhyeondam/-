"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, StatCard } from "@/components/Card";
import Tabs from "@/components/Tabs";
import { useServerState } from "@/lib/useServerState";
import { leads as initialLeads, type Lead } from "@/data/sample";
import { newId } from "@/lib/ids";
import { formatWonShort, todayIso } from "@/lib/format";
import { profileByKey, regionOrderOf } from "@/lib/bids/regions";
import { decodeText, normCompany, parseDeliveriesAsync, type DeliveriesFile, type Delivery } from "@/lib/bids/deliveries";
import { DEFAULT_EXCLUDE_WORDS, DEFAULT_INCLUDE_WORDS, EMPTY_RULES, isOurItem, type DeliveryRules } from "@/lib/bids/deliveryRules";
import type { AgencySummary, Summary } from "@/lib/bids/deliveryQuery";

type SummaryResp = Summary & { all: number; updatedAt?: string; files: { name: string; at: string; rows: number; added: number }[]; myCompany: string; error?: string; timing?: { ms: number; read: number; cached: boolean } };
/** 브라우저 임시 저장(탭을 닫으면 사라짐): 뒤로가기·탭 이동 뒤에도 마지막 결과를 바로 보여 주기 위해 */
const cacheGet = <T,>(k: string): T | null => { try { const v = sessionStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
const cacheSet = (k: string, v: unknown) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 공간 부족 등은 무시 */ } };
type ListResp = { items: Delivery[]; total: number; amount: number; page: number; size: number; error?: string };
const selectCls = "rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const palette = ["bg-primary", "bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-green-500", "bg-rose-400", "bg-slate-400"];

async function readJson<T>(r: Response): Promise<T> {
  const text = await r.text();
  try { return JSON.parse(text) as T; } catch { throw new Error(`서버 답이 이상합니다 (${r.status || "연결 끊김"}) ${text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)}`); }
}

/** 「납품 현황」 탭: 나라장터 종합쇼핑몰 납품요구를 올려 누가 어디에 무엇을 납품했는지 봅니다 (집계는 서버가, 화면은 결과만) */
export default function DeliveryPanel({ myCompany, regionKey = "gj" }: { myCompany: string; regionKey?: string }) {
  const profile = profileByKey(regionKey);
  const regionOrder = regionOrderOf(profile);
  const label = profile.label;
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [keepAll, setKeepAll] = useState(false);
  const [view, setView] = useState<"region" | "company" | "list">("region");
  const [year, setYear] = useState("");
  const [region, setRegion] = useState("");
  const [company, setCompany] = useState("");
  const [relatedOnly, setRelatedOnly] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<SummaryResp | null>(null);
  const [list, setList] = useState<ListResp | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [leads, setLeads, leadsLoaded] = useServerState<Lead[]>("leads", initialLeads, "jeil.leads");
  const [today] = useState(todayIso);
  const me = normCompany(myCompany);
  const isMe = (c: string) => me.length >= 2 && normCompany(c).includes(me);

  type Settings = { deliveryRules?: Partial<DeliveryRules> };
  const [settings, setSettings, settingsLoaded] = useServerState<Settings>("settings", {});
  const rules = useMemo<DeliveryRules>(() => ({ ...EMPTY_RULES, ...(settings.deliveryRules ?? {}) }), [settings.deliveryRules]);
  const [showRules, setShowRules] = useState(false);
  const [ruleQ, setRuleQ] = useState("");
  const [pruning, setPruning] = useState(false);

  const params = (extra: Record<string, string | undefined> = {}) => { const p = new URLSearchParams(); const all = { year, related: relatedOnly ? "1" : "", region, company, ...extra }; for (const [k, v] of Object.entries(all)) if (v) p.set(k, v); return p.toString(); };

  // 집계 (필터가 바뀔 때마다 서버에서 작은 결과만 받아옵니다). 지난번 결과가 있으면 먼저 보여 주고 뒤에서 새로 받습니다
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let alive = true;
    const key = `deliv-summary:${params()}`;
    const prev = cacheGet<SummaryResp>(key);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadErr(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (prev) { setSummary(prev); setStale(true); }
    fetch(`/api/bids/deliveries/summary?${params()}`).then(readJson<SummaryResp>).then((j) => { if (!alive) return; if (j.error) throw new Error(j.error); setSummary(j); setStale(false); cacheSet(key, j); })
      .catch((e) => { if (!alive) return; if (!prev) setLoadErr(e instanceof Error ? e.message : String(e)); setStale(false); });
    return () => { alive = false; };
  }, [year, relatedOnly, region, company, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // 목록 (목록 화면일 때만)
  useEffect(() => {
    if (view !== "list") return;
    let alive = true;
    const key = `deliv-list:${params({ q, page: String(page) })}`;
    const prev = cacheGet<ListResp>(key);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (prev) setList(prev);
    const t = setTimeout(() => {
      fetch(`/api/bids/deliveries/list?${params({ q, page: String(page) })}`).then(readJson<ListResp>).then((j) => { if (!alive) return; if (j.error) throw new Error(j.error); setList(j); cacheSet(key, j); }).catch((e) => alive && !prev && setMsg(`목록 불러오기 실패: ${e instanceof Error ? e.message : String(e)}`));
    }, q ? 300 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [view, year, relatedOnly, region, company, q, page, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => setReloadKey((k) => k + 1);

  function saveRules(next: DeliveryRules) {
    setSettings((prev) => ({ ...prev, deliveryRules: next }));
    setTimeout(refresh, 1200); // 서버가 새 규칙으로 다시 판정한 결과를 받아옵니다
  }
  const addTo = (key: keyof DeliveryRules, value: string) => { const v = value.trim(); if (!v) return; const others: (keyof DeliveryRules)[] = key === "includeExact" ? ["excludeExact"] : key === "excludeExact" ? ["includeExact"] : []; const next = { ...rules, [key]: [...new Set([...rules[key], v])] } as DeliveryRules; for (const o of others) next[o] = next[o].filter((x) => x !== v); saveRules(next); };
  const removeFrom = (key: keyof DeliveryRules, value: string) => saveRules({ ...rules, [key]: rules[key].filter((x) => x !== value) });

  async function pruneUnrelated() {
    if (!confirm("우리 품목이 아닌 납품요구를 저장소에서 지울까요? (화면 규칙 기준. 다시 CSV 를 올리면 복구됩니다)")) return;
    setPruning(true);
    try { const r = await fetch("/api/bids/deliveries?mode=unrelated", { method: "DELETE" }); const j = await readJson<{ removed: number; kept: number; error?: string }>(r); if (!r.ok) throw new Error(j.error ?? "실패"); setMsg(`우리 품목 아닌 ${j.removed.toLocaleString("ko-KR")}건을 지우고 ${j.kept.toLocaleString("ko-KR")}건을 남겼습니다.`); refresh(); }
    catch (e) { setMsg(`정리 실패: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setPruning(false); }
  }
  async function clearAll() {
    if (!confirm("올려 둔 납품요구 자료를 모두 지울까요? (다시 CSV 를 올리면 복구됩니다)")) return;
    const r = await fetch("/api/bids/deliveries", { method: "DELETE" });
    if (r.ok) { setMsg("모두 지웠습니다."); refresh(); } else setMsg("지우지 못했습니다 (관리자만 가능)");
  }

  /** CSV 를 브라우저에서 읽어 우리 지역 것만 골라 10,000건씩 서버에 보냅니다 */
  async function upload(f: File) {
    setUploading(true); setMsg(null); setProgress("파일 읽는 중…");
    try {
      if (/\.xlsx?$/i.test(f.name)) throw new Error("엑셀(xlsx) 파일은 아직 읽지 못합니다. 엑셀에서 「다른 이름으로 저장 → CSV(쉼표로 분리)」로 저장한 뒤 올려 주세요.");
      const text = decodeText(await f.arrayBuffer());
      setProgress(`${(text.length / 1_000_000).toFixed(1)}MB 읽음 · 줄 나누는 중…`);
      await new Promise((r) => setTimeout(r, 30));
      const parsed = await parseDeliveriesAsync(text, (rows, found) => { setProgress(`${rows.toLocaleString("ko-KR")}줄 읽음 · ${label} ${found.toLocaleString("ko-KR")}건 찾음`); }, 20000, rules, profile);
      if (parsed.missing.length) throw new Error(`파일에서 이 칸을 찾지 못했습니다: ${parsed.missing.join(", ")}${parsed.header ? `\n파일의 칸 이름: ${parsed.header.join(" | ")}` : ""}${parsed.preview ? `\n\n[파일 앞부분 — 이 화면을 캡처해서 보내 주세요]\n${parsed.preview}` : ""}`);
      const toSave = keepAll ? parsed.items : parsed.items.filter((d) => d.related);
      const CH = 10000; const chunks = Math.max(1, Math.ceil(toSave.length / CH));
      const uploadId = newId("up");
      let last: (DeliveriesFile & { added?: number }) | null = null;
      for (let i = 0; i < chunks; i++) {
        const body = JSON.stringify({ items: toSave.slice(i * CH, (i + 1) * CH), fileName: f.name, rows: parsed.rows, uploadId, index: i, chunks, last: i === chunks - 1 });
        let j: DeliveriesFile & { error?: string; added?: number } | null = null;
        for (let attempt = 1; attempt <= 4; attempt++) {
          setProgress(`${parsed.rows.toLocaleString("ko-KR")}줄 중 ${label} ${parsed.items.length.toLocaleString("ko-KR")}건, 보관 대상 ${toSave.length.toLocaleString("ko-KR")}건 · 서버에 저장 ${Math.min((i + 1) * CH, toSave.length).toLocaleString("ko-KR")}건째${attempt > 1 ? ` (다시 시도 ${attempt - 1})` : ""}`);
          const r = await fetch("/api/bids/deliveries", { method: "POST", headers: { "Content-Type": "application/json" }, body }).catch(() => null);
          if (r && r.ok) { j = await readJson(r); break; }
          if (r && r.status < 500) { const e = await readJson<{ error?: string }>(r).catch(() => ({ error: undefined })); throw new Error(e.error ?? `올리기 실패 (${r.status})`); }
          if (attempt === 4) throw new Error(`서버가 계속 응답하지 않습니다 (${r ? r.status : "연결 안 됨"}). 잠시 뒤 같은 파일을 다시 올리면 이어서 저장됩니다.`);
          await new Promise((res) => setTimeout(res, 3000 * attempt));
        }
        last = j;
      }
      setMsg(`「${f.name}」 ${parsed.rows.toLocaleString("ko-KR")}줄을 읽어 ${label} 납품요구 ${parsed.items.length.toLocaleString("ko-KR")}건을 찾았고, 그중 ${keepAll ? "전부를" : `우리 제품 관련 ${toSave.length.toLocaleString("ko-KR")}건을`} 보냈습니다. 새로 ${(last?.added ?? 0).toLocaleString("ko-KR")}건 보관. (모두 ${(last?.items?.length ?? 0).toLocaleString("ko-KR")}건)`);
      refresh();
    } catch (e) { setMsg(`올리기 실패: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setUploading(false); setProgress(null); if (inputRef.current) inputRef.current.value = ""; }
  }

  const leadKeys = useMemo(() => new Set(leads.map((l) => l.memo?.match(/\[납품요구 ([^\]]+)\]/)?.[1]).filter(Boolean)), [leads]);
  async function toLead(agency: string, digest?: AgencySummary) {
    if (!leadsLoaded || leadKeys.has(agency)) return;
    let d = digest;
    if (!d) { try { d = await readJson<AgencySummary>(await fetch(`/api/bids/deliveries/agency?${params({ name: agency })}`)); } catch { return; } }
    const top = d.top.map((c) => `${c.name} ${formatWonShort(c.amount)}`).join(", ");
    setLeads((prev) => [{ id: newId("l"), company: agency, contact: "담당자 확인 필요", source: "입찰공고", status: "신규", product: d!.items.join(", ") || undefined, memo: `[납품요구 ${agency}] 쇼핑몰 납품 ${d!.count}건 ${formatWonShort(d!.amount)} · 납품업체: ${top}`, createdAt: today }, ...prev]);
    setMsg(`「${agency}」 리드를 만들었습니다. 이 기관이 누구에게서 무엇을 샀는지 메모에 적혀 있습니다.`);
  }

  const itemNames = useMemo(() => (summary?.itemNames ?? []).map((it) => ({ ...it, ours: isOurItem(it.name, it.detail, rules) })), [summary, rules]);
  const total = summary?.total ?? 0;
  const hasData = (summary?.all ?? 0) > 0;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-bold text-slate-800">나라장터 종합쇼핑몰 납품요구 (누가 어디에 무엇을 납품했나)</h2>
            <p className="mt-1 text-xs text-slate-500">조달데이터허브에서 「나라장터쇼핑몰 납품요구 물품 내역」을 CSV 로 내려받아 올리면, {label} 기관이 어느 업체에서 무엇을 얼마에 샀는지 지역별·업체별로 정리합니다. 같은 자료를 여러 번 올려도 겹치지 않습니다. 우리 회사(<b>{myCompany}</b>)는 색으로 표시됩니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={inputRef} type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            <label className="inline-flex items-center gap-1 text-xs text-slate-500" title="레미콘·시멘트·아스콘·사무용품처럼 우리 제품과 관련 없는 품목까지 보관합니다. 자료가 크게 늘어 서버가 느려질 수 있습니다"><input type="checkbox" checked={keepAll} onChange={(e) => setKeepAll(e.target.checked)} className="accent-primary" />관련 없는 품목도 보관</label>
            <button onClick={() => inputRef.current?.click()} disabled={uploading} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 shadow-sm">{uploading ? "읽는 중…" : "CSV 올리기"}</button>
            {hasData && <button onClick={clearAll} className="rounded-full border border-line bg-white px-3 py-2 text-xs text-slate-500 hover:border-red-300 hover:text-red-600">모두 지우기</button>}
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-dashed border-line px-4 py-3 text-xs text-slate-500" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}>
          내려받는 법: 조달데이터허브(data.g2b.go.kr) → 「나라장터쇼핑몰 납품요구 물품 내역」 → 기간과 수요기관 지역({label})을 고르고 CSV 내려받기 → 여기에 끌어다 놓기. 엑셀로 열어 저장했다면 「CSV(쉼표로 분리)」로 저장해 주세요.
          {summary?.files?.length ? <div className="mt-1 text-slate-400">최근 올린 파일: {summary.files.slice(0, 3).map((f) => `${f.name} (${new Date(f.at).toLocaleDateString("ko-KR")}, ${f.rows.toLocaleString("ko-KR")}줄)`).join(" · ")}</div> : null}
        </div>
        {progress && <div className="mt-3 rounded-xl border border-primary/30 bg-primary-soft/50 px-4 py-2 text-sm text-slate-700">{progress}</div>}
        {msg && <div className={`mt-3 whitespace-pre-wrap break-all rounded-xl border px-4 py-2 text-sm ${/실패/.test(msg) ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-800"}`}>{msg}</div>}
      </Card>

      {!summary && !loadErr && <Card className="p-8 text-center text-sm text-slate-400">보관된 납품요구를 정리하는 중…</Card>}
      {summary && stale && <div className="text-xs text-slate-400">지난번 결과를 먼저 보여 드리고 있습니다. 최신 자료로 갱신 중…</div>}
      {summary?.timing && !stale && summary.timing.ms > 1500 && <div className="text-xs text-amber-700">서버 집계 {(summary.timing.ms / 1000).toFixed(1)}초 (자료 읽기 {(summary.timing.read / 1000).toFixed(1)}초{summary.timing.cached ? "" : ", 처음 읽음"}). 「우리 품목 아닌 것 지우기」로 자료를 줄이면 빨라집니다.</div>}
      {loadErr && <Card className="p-6 text-sm text-red-700"><div>보관된 납품요구를 불러오지 못했습니다: {loadErr}</div><div className="mt-1 text-xs text-slate-500">자료가 없어진 것이 아니라 서버가 잠깐 답을 못 한 것일 수 있습니다.</div><button onClick={refresh} className="mt-2 rounded-full border border-red-300 bg-white px-4 py-1.5 text-xs font-semibold text-red-700 hover:border-red-500">다시 불러오기</button></Card>}
      {summary && !hasData && !uploading && <Card className="p-6 text-center text-sm text-slate-400">아직 올린 납품요구가 없습니다. 위에서 CSV 를 올려 주세요.</Card>}

      {summary && hasData && summary.unrelated > 2000 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-slate-700 sm:flex-row sm:items-center">
          <div className="flex-1">우리 품목이 아닌 자료 <b>{summary.unrelated.toLocaleString("ko-KR")}건</b>이 함께 저장되어 있어 불러오기가 느립니다. 지워도 집계에는 영향이 없고, CSV 를 다시 올리면 복구됩니다.</div>
          <button onClick={pruneUnrelated} disabled={pruning} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2 shadow-sm disabled:opacity-60">{pruning ? "정리 중…" : "지금 정리하기"}</button>
        </div>
      )}
      {summary && hasData && settingsLoaded && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-800">품명 정리 (우리 품목 / 제외)</h3>
              <p className="mt-0.5 text-xs text-slate-500">「우리 제품 관련」은 품명으로 판단합니다. 아스팔트콘크리트·자연석경계석처럼 이름만 비슷한 것은 「제외」, 빠진 우리 품목은 「우리 품목」을 눌러 주세요. 저장하면 모든 직원 화면에 적용됩니다.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowRules((v) => !v)} className="rounded-full border border-line bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-primary hover:text-primary">{showRules ? "접기" : `품명 목록 보기 (${itemNames.length}개)`}</button>
              <button onClick={pruneUnrelated} disabled={pruning} className="rounded-full border border-line bg-white px-4 py-1.5 text-xs text-slate-500 hover:border-red-300 hover:text-red-600 disabled:opacity-60">{pruning ? "정리 중…" : "우리 품목 아닌 것 지우기"}</button>
            </div>
          </div>
          {showRules && (
            <div className="mt-3 space-y-3">
              <input value={ruleQ} onChange={(e) => setRuleQ(e.target.value)} placeholder="품명 검색" className={selectCls} />
              <div className="max-h-80 overflow-y-auto rounded-xl border border-line">
                <table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-1.5 text-left">품명</th><th className="px-3 py-1.5 text-right">건수</th><th className="px-3 py-1.5 text-right">금액</th><th className="px-3 py-1.5 text-left">판정</th><th className="px-3 py-1.5"></th></tr></thead>
                  <tbody>{itemNames.filter((it) => !ruleQ || it.name.includes(ruleQ)).slice(0, 300).map((it) => { const inc = rules.includeExact.includes(it.name); const exc = rules.excludeExact.includes(it.name); return (
                    <tr key={it.name} className={`border-t border-line ${it.ours ? "" : "text-slate-400"}`}>
                      <td className="px-3 py-1.5">{it.name}{it.detail && it.detail !== it.name ? <span className="ml-1 text-[11px] text-slate-400">{it.detail}</span> : null}</td>
                      <td className="px-3 py-1.5 text-right">{it.n.toLocaleString("ko-KR")}</td><td className="px-3 py-1.5 text-right whitespace-nowrap">{formatWonShort(it.amount)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{it.ours ? <span className="rounded-full bg-green-50 px-2 text-xs text-green-700">우리 품목{inc ? " (직접 지정)" : ""}</span> : <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-500">제외{exc ? " (직접 지정)" : ""}</span>}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-right">
                        {it.ours ? <button onClick={() => addTo("excludeExact", it.name)} className="rounded-full border border-line bg-white px-2 py-0.5 text-xs text-slate-600 hover:border-red-300 hover:text-red-600">제외</button> : <button onClick={() => addTo("includeExact", it.name)} className="rounded-full border border-line bg-white px-2 py-0.5 text-xs text-slate-600 hover:border-primary hover:text-primary">우리 품목</button>}
                        {(inc || exc) && <button onClick={() => removeFrom(inc ? "includeExact" : "excludeExact", it.name)} className="ml-1 text-[11px] text-slate-400 hover:text-primary">지정 취소</button>}
                      </td>
                    </tr>); })}</tbody></table>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-line p-3">
                  <div className="font-semibold text-slate-700">제외어 (품명에 이 말이 있으면 제외)</div>
                  <div className="mt-1 text-slate-400">기본: {DEFAULT_EXCLUDE_WORDS.join(", ")}</div>
                  <div className="mt-1 flex flex-wrap gap-1">{rules.excludeWords.map((w) => <span key={w} className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">{w} <button onClick={() => removeFrom("excludeWords", w)}>✕</button></span>)}</div>
                  <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget.elements.namedItem("w") as HTMLInputElement; addTo("excludeWords", f.value); f.value = ""; }} className="mt-2 flex gap-1"><input name="w" placeholder="제외어 추가" className={`${selectCls} flex-1`} /><button className="rounded-full bg-primary px-3 text-white">추가</button></form>
                </div>
                <div className="rounded-xl border border-line p-3">
                  <div className="font-semibold text-slate-700">포함어 (품명에 이 말이 있으면 우리 품목)</div>
                  <div className="mt-1 text-slate-400">기본: {DEFAULT_INCLUDE_WORDS.join(", ")}</div>
                  <div className="mt-1 flex flex-wrap gap-1">{rules.includeWords.map((w) => <span key={w} className="rounded-full bg-green-50 px-2 py-0.5 text-green-700">{w} <button onClick={() => removeFrom("includeWords", w)}>✕</button></span>)}</div>
                  <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget.elements.namedItem("w") as HTMLInputElement; addTo("includeWords", f.value); f.value = ""; }} className="mt-2 flex gap-1"><input name="w" placeholder="포함어 추가" className={`${selectCls} flex-1`} /><button className="rounded-full bg-primary px-3 text-white">추가</button></form>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {summary && hasData && (<>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="납품요구 금액" value={formatWonShort(total)} sub={`${summary.count.toLocaleString("ko-KR")}건 · ${year || "전체 기간"}${relatedOnly ? " · 우리 품목" : ""}`} icon="₩" />
          <StatCard label="우리 회사 몫" value={total ? `${Math.round((summary.mine / total) * 100)}%` : "-"} sub={summary.mine ? formatWonShort(summary.mine) : `${myCompany} 납품 없음`} icon="★" tone="green" />
          <StatCard label="납품 업체 수" value={`${summary.companies}곳`} sub="경쟁사 포함" icon="▣" />
          <StatCard label="수요기관 수" value={`${summary.agencies}곳`} sub={label} icon="◎" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={view} onChange={(v) => { setView(v as typeof view); setPage(1); }} tabs={[{ key: "region", label: "지역별" }, { key: "company", label: "업체별", n: summary.byCompany.length }, { key: "list", label: "목록", n: list?.total }]} />
          <select value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }} className={selectCls}><option value="">전체 기간</option>{summary.years.map((y) => <option key={y} value={y}>{y}년</option>)}</select>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={relatedOnly} onChange={(e) => { setRelatedOnly(e.target.checked); setPage(1); }} className="accent-primary" />우리 제품 관련만</label>
          {company && <button onClick={() => { setCompany(""); setPage(1); }} className="rounded-full bg-primary-soft px-3 py-1 text-xs text-primary">업체: {summary.byCompany.find((c) => c.key === company)?.name ?? company} ✕</button>}
          {region && <button onClick={() => { setRegion(""); setPage(1); }} className="rounded-full bg-primary-soft px-3 py-1 text-xs text-primary">지역: {region} ✕</button>}
        </div>

        {view === "region" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {summary.byRegion.map((r) => (
              <Card key={r.region} className="p-5">
                <div className="flex items-baseline justify-between"><h3 className="font-bold text-slate-800">{r.region}</h3><span className="text-sm text-slate-500">{r.count.toLocaleString("ko-KR")}건 · <b className="text-primary">{formatWonShort(r.amount)}</b></span></div>
                <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100">{r.top.map((c, i) => <span key={c.key} className={isMe(c.name) ? "bg-green-500" : palette[i % palette.length]} style={{ width: `${r.amount ? (c.amount / r.amount) * 100 : 0}%` }} title={`${c.name} ${formatWonShort(c.amount)}`} />)}</div>
                <ul className="mt-2 space-y-0.5 text-sm">
                  {r.top.map((c, i) => <li key={c.key} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${isMe(c.name) ? "bg-green-500" : palette[i % palette.length]}`} /><button onClick={() => { setCompany(c.key); setView("list"); setPage(1); }} className={`flex-1 truncate text-left hover:text-primary ${isMe(c.name) ? "font-semibold text-green-700" : "text-slate-700"}`}>{c.name}{isMe(c.name) ? " (우리)" : ""}</button><span className="text-slate-500">{formatWonShort(c.amount)} · {r.amount ? Math.round((c.amount / r.amount) * 100) : 0}%</span></li>)}
                </ul>
                <div className="mt-3 text-xs text-slate-500">수요기관 {r.agencyCount}곳: {r.agencies.slice(0, 4).map((a) => <span key={a.name} className="mr-2 inline-flex items-center gap-1">{a.name} {formatWonShort(a.amount)}{!leadKeys.has(a.name) && <button onClick={() => toLead(a.name, a)} className="rounded-full border border-line bg-white px-1.5 text-[10px] text-slate-500 hover:border-primary hover:text-primary">리드</button>}</span>)}{r.agencyCount > 4 ? "…" : ""}</div>
                <button onClick={() => { setRegion(r.region); setView("list"); setPage(1); }} className="mt-2 text-xs text-primary hover:underline">이 지역 목록 보기 →</button>
              </Card>
            ))}
          </div>
        )}

        {view === "company" && (
          <Card className="p-0 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-2 text-left">업체</th><th className="px-3 py-2 text-right">금액</th><th className="px-3 py-2 text-right">비중</th><th className="px-3 py-2 text-right">건수</th><th className="px-3 py-2 text-right">기관 수</th><th className="px-3 py-2 text-left">주요 품목</th><th className="px-3 py-2 text-left">주요 지역</th></tr></thead>
            <tbody>{summary.byCompany.map((c) => (
              <tr key={c.key} className={`border-t border-line ${isMe(c.name) ? "bg-green-50/60" : ""}`}>
                <td className="px-4 py-2"><button onClick={() => { setCompany(c.key); setView("list"); setPage(1); }} className={`text-left hover:text-primary ${isMe(c.name) ? "font-semibold text-green-700" : "font-medium text-slate-800"}`}>{c.name}{isMe(c.name) ? " (우리)" : ""}</button></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatWonShort(c.amount)}</td><td className="px-3 py-2 text-right">{total ? Math.round((c.amount / total) * 100) : 0}%</td><td className="px-3 py-2 text-right">{c.count.toLocaleString("ko-KR")}</td><td className="px-3 py-2 text-right">{c.agencies}</td>
                <td className="px-3 py-2 text-slate-600 min-w-[200px]">{c.items.join(", ")}</td><td className="px-3 py-2 text-slate-600 whitespace-nowrap">{c.regions.join(", ")}</td>
              </tr>))}</tbody>
          </table></div></Card>
        )}

        {view === "list" && (
          <Card className="p-0 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <select value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }} className={selectCls}><option value="">모든 지역</option>{regionOrder.map((r) => <option key={r} value={r}>{r}</option>)}</select>
              <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="기관·업체·품명·납품요구명 검색" className={`${selectCls} flex-1 min-w-[160px]`} />
              {list && <span className="text-xs text-slate-400">{list.total.toLocaleString("ko-KR")}건 · 합계 {formatWonShort(list.amount)}</span>}
            </div>
            <ul className="md:hidden divide-y divide-line">
              {!list && <li className="px-4 py-10 text-center text-sm text-slate-400">불러오는 중…</li>}
              {list && list.items.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-400">조건에 맞는 납품요구가 없습니다.</li>}
              {list?.items.map((d) => (
                <li key={d.id} className={`px-4 py-3 space-y-1 ${isMe(d.company) ? "bg-green-50/60" : ""}`}>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500"><span>{d.date}</span><span className="text-slate-300">·</span><span>{d.region}</span>{d.related && <span className="rounded-full bg-green-50 px-1.5 text-green-700">★</span>}</div>
                  <div className="text-[15px] font-medium leading-snug text-slate-800 break-keep">{d.item}{d.detail && d.detail !== d.item ? ` · ${d.detail}` : ""}</div>
                  {d.spec && <div className="text-[11px] text-slate-400">{d.spec.slice(0, 60)}</div>}
                  <div className="text-xs text-slate-700">{d.agency}{d.reqName ? <span className="text-slate-400"> · {d.reqName.slice(0, 40)}</span> : null}</div>
                  <div className="flex flex-wrap items-center gap-x-3 text-xs"><span className={isMe(d.company) ? "font-semibold text-green-700" : "text-slate-700"}>{d.company}</span><span className="text-slate-600">{d.qty !== undefined ? `${d.qty.toLocaleString("ko-KR")}${d.unit ?? ""}` : ""}</span><span className="font-semibold text-slate-800">{d.amount !== undefined ? formatWonShort(d.amount) : "-"}</span><span className="ml-auto">{leadKeys.has(d.agency) ? <Link href="/dashboard/leads" className="text-slate-400">리드 있음</Link> : <button onClick={() => toLead(d.agency)} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-600 active:bg-primary-soft">리드로</button>}</span></div>
                </li>
              ))}
            </ul>
            <div className="hidden md:block overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-2 text-left">요구일</th><th className="px-3 py-2 text-left">수요기관</th><th className="px-3 py-2 text-left">지역</th><th className="px-3 py-2 text-left">업체</th><th className="px-3 py-2 text-left">품명 · 규격</th><th className="px-3 py-2 text-right">수량</th><th className="px-3 py-2 text-right">금액</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>
                {!list && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">불러오는 중…</td></tr>}
                {list && list.items.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">조건에 맞는 납품요구가 없습니다.</td></tr>}
                {list?.items.map((d) => (
                  <tr key={d.id} className={`border-t border-line align-top ${isMe(d.company) ? "bg-green-50/60" : ""}`}>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-600">{d.date.slice(2)}</td>
                    <td className="px-3 py-2 min-w-[160px] text-slate-800">{d.agency}{d.reqName && <div className="text-[11px] text-slate-400">{d.reqName.slice(0, 40)}</div>}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">{d.region}</td>
                    <td className={`px-3 py-2 min-w-[120px] ${isMe(d.company) ? "font-semibold text-green-700" : "text-slate-700"}`}>{d.company}</td>
                    <td className="px-3 py-2 min-w-[200px]"><span className="text-slate-800">{d.item}{d.detail && d.detail !== d.item ? ` · ${d.detail}` : ""}</span>{d.spec && <div className="text-[11px] text-slate-400">{d.spec.slice(0, 60)}</div>}{d.related && <span className="ml-1 rounded-full bg-green-50 px-1.5 text-[10px] text-green-700">★</span>}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-slate-600">{d.qty !== undefined ? `${d.qty.toLocaleString("ko-KR")}${d.unit ?? ""}` : "-"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-slate-800">{d.amount !== undefined ? formatWonShort(d.amount) : "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{leadKeys.has(d.agency) ? <Link href="/dashboard/leads" className="text-xs text-slate-400 hover:text-primary">리드 있음</Link> : <button onClick={() => toLead(d.agency)} className="rounded-full border border-line bg-white px-2 py-0.5 text-xs text-slate-600 hover:border-primary hover:text-primary">리드로</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {list && list.total > list.size && (
              <div className="flex items-center justify-between px-4 py-2 text-xs text-slate-500">
                <span>{(list.page - 1) * list.size + 1}~{Math.min(list.page * list.size, list.total)} / {list.total.toLocaleString("ko-KR")}건</span>
                <span className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-line bg-white px-3 py-1 disabled:opacity-40">이전</button><button disabled={page * list.size >= list.total} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-line bg-white px-3 py-1 disabled:opacity-40">다음</button></span>
              </div>
            )}
          </Card>
        )}
      </>)}
    </div>
  );
}
