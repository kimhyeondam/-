"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import SortTh, { useSort, compareValues } from "@/components/SortTh";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { todayIso, formatWon } from "@/lib/format";
import { contracts as initialContracts, contractTemplates as initialTemplates, customers as initialCustomers, companyProfile as defaults, type Contract, type ContractStatus, type ContractTemplate, type Customer, type CompanyProfile } from "@/data/sample";
import type { PublicMailAccount } from "@/lib/mail/presets";
import ContractForm, { type ContractInput } from "./ContractForm";

type SortKey = "title" | "customer" | "status" | "createdAt" | "amount";
const statuses: ContractStatus[] = ["작성중", "발송완료", "서명완료", "취소"];
const badge: Record<ContractStatus, string> = { 작성중: "bg-slate-100 text-slate-600 border-slate-200", 발송완료: "bg-sky-50 text-sky-700 border-sky-200", 서명완료: "bg-green-50 text-green-700 border-green-200", 취소: "bg-red-50 text-red-500 border-red-200" };
const fmtDate = (d: string) => d.slice(0, 10).replace(/-0?/g, ". ") + ".";

export default function ContractManager() {
  const [items, setItems, loaded, loadError] = useServerState<Contract[]>("contracts", initialContracts);
  const [templates] = useServerState<ContractTemplate[]>("contractTemplates", initialTemplates);
  const [customers] = useServerState<Customer[]>("customers", initialCustomers, "jeil.customers");
  const [settings] = useServerState<{ company?: CompanyProfile }>("settings", {});
  const company = { ...defaults, ...(settings.company ?? {}) };
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ContractStatus>("all");
  const { sort, toggle } = useSort<SortKey>({ key: "createdAt", dir: -1 });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [open, setOpen] = useState<Contract | null>(null);
  const [sending, setSending] = useState<Contract | null>(null);
  const [accounts, setAccounts] = useState<PublicMailAccount[]>([]);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => {});
    fetch("/api/mail/accounts").then((r) => r.json()).then((d: { accounts?: PublicMailAccount[] }) => setAccounts(d.accounts ?? [])).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((c) => status === "all" || c.status === status)
      .filter((c) => !q || [c.title, c.customer, c.customerEmail ?? "", c.customerRef ?? "", c.items ?? ""].join(" ").toLowerCase().includes(q))
      .sort((a, b) => {
        const v = (c: Contract): string | number => (sort.key === "status" ? statuses.indexOf(c.status) : sort.key === "amount" ? c.amount : c[sort.key]);
        return compareValues(v(a), v(b)) * sort.dir;
      });
  }, [items, query, status, sort]);
  const count = (s: ContractStatus) => items.filter((c) => c.status === s).length;
  function flash(ok: boolean, text: string) { setNotice({ ok, text }); setTimeout(() => setNotice(null), 5000); }

  function add(d: ContractInput) { setItems((prev) => [{ ...d, id: `k${Date.now()}`, status: "작성중", createdBy: me?.name, createdAt: todayIso() }, ...prev]); setAdding(false); }
  function update(id: string, d: ContractInput) { setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...d } : c))); setEditing(null); }
  function setStatusOf(id: string, s: ContractStatus) { setItems((prev) => prev.map((c) => (c.id === id ? { ...c, status: s } : c))); setOpen(null); }
  function remove(id: string) { if (confirm("이 계약을 삭제할까요?")) { setItems((prev) => prev.filter((c) => c.id !== id)); setOpen(null); } }

  async function reloadFromServer() {
    const r = await fetch("/api/data/contracts");
    const d = (await r.json()) as { data: Contract[] | null };
    if (d.data) setItems(d.data);
  }

  async function downloadPdf(c: Contract) {
    setBusy(true);
    try {
      const r = await fetch("/api/contracts/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contract: c }) });
      if (!r.ok) throw new Error("PDF를 만들지 못했습니다.");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a"); a.href = url; a.download = `${c.title}.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { flash(false, (e as Error).message); } finally { setBusy(false); }
  }

  async function send(c: Contract, accountId: string, to: string, message: string) {
    setBusy(true);
    try {
      // 서버가 최신 본문으로 발송하도록 먼저 저장 시간을 줍니다.
      await new Promise((r) => setTimeout(r, 700));
      const r = await fetch("/api/contracts/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, accountId: accountId || undefined, to, message }) });
      const d = (await r.json()) as { ok?: boolean; link?: string; mailed?: boolean; error?: string };
      if (!r.ok) throw new Error(d.error ?? "발송에 실패했습니다.");
      await reloadFromServer();
      setSending(null); setOpen(null);
      flash(true, d.mailed ? `${to}로 계약서와 서명 링크를 보냈습니다.` : `서명 링크를 만들었습니다: ${d.link}`);
      if (!d.mailed && d.link) { try { await navigator.clipboard.writeText(d.link); } catch {} }
    } catch (e) { flash(false, (e as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader
        title="계약 관리"
        description="계약서를 템플릿으로 작성하고, 고객에게 보내 전자서명을 받습니다."
        action={<button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">＋ 계약 작성</button>}
      />
      {notice && <div className={`rounded-xl border px-4 py-3 text-sm break-all ${notice.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>{notice.text}</div>}
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="전체 계약" value={`${items.length}건`} sub="현재 조회된 계약 수" icon="▤" />
            <StatCard label="작성중" value={`${count("작성중")}건`} sub="초안 작성 또는 내부 검토 단계" icon="✎" tone="amber" />
            <StatCard label="발송완료" value={`${count("발송완료")}건`} sub="고객 서명을 기다리는 계약" icon="✉" highlight />
            <StatCard label="서명완료" value={`${count("서명완료")}건`} sub="최종 완료된 계약" icon="✓" tone="green" />
          </div>

          <Card className="p-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-80">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="계약 제목, 고객명, 이메일을 검색하세요" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary" />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value as "all" | ContractStatus)} className="rounded-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-primary">
              <option value="all">전체</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={reloadFromServer} className="ml-auto rounded-full border border-line bg-white px-4 py-2.5 text-sm text-slate-700 hover:border-primary hover:text-primary">새로고침</button>
          </Card>

          <Card className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-line">
                  <SortTh label="제목" k="title" sort={sort} onSort={toggle} className="px-5" />
                  <SortTh label="고객" k="customer" sort={sort} onSort={toggle} />
                  <SortTh label="계약금액" k="amount" sort={sort} onSort={toggle} className="text-right" />
                  <SortTh label="상태" k="status" sort={sort} onSort={toggle} />
                  <SortTh label="생성일" k="createdAt" sort={sort} onSort={toggle} />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">계약이 없습니다.</td></tr>}
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-primary-soft/30 transition">
                    <td className="px-5 py-3"><button onClick={() => setOpen(c)} className="text-left font-medium text-slate-800 hover:text-primary">{c.title}</button>{c.items && <div className="text-xs text-slate-400 truncate max-w-[360px]">{c.items}</div>}</td>
                    <td className="px-3 py-3"><div className="text-slate-800">{c.customer}</div><div className="text-xs text-slate-400">{c.customerEmail ?? c.customerRef ?? ""}</div></td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700 whitespace-nowrap">{c.amount ? c.amount.toLocaleString("ko-KR") : "-"}</td>
                    <td className="px-3 py-3 whitespace-nowrap"><span className={`rounded-full border px-2.5 py-0.5 text-xs ${badge[c.status]}`}>{c.status}</span></td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {adding && <ContractForm templates={templates} customers={customers} company={company} onSubmit={add} onCancel={() => setAdding(false)} />}
      {editing && <ContractForm initial={editing} templates={templates} customers={customers} company={company} onSubmit={(d) => update(editing.id, d)} onCancel={() => setEditing(null)} />}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setOpen(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl my-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card border border-line px-4 py-3">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs ${badge[open.status]}`}>{open.status}</span>
              <span className="font-semibold text-slate-800">{open.title}</span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button onClick={() => downloadPdf(open)} disabled={busy} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-primary hover:text-primary disabled:opacity-50">📄 PDF</button>
                {open.status !== "서명완료" && open.status !== "취소" && <button onClick={() => { setEditing(open); setOpen(null); }} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-primary">수정</button>}
                {open.status !== "서명완료" && open.status !== "취소" && <button onClick={() => setSending(open)} className="rounded-full bg-primary hover:bg-primary-dark px-3 py-1.5 text-xs font-semibold text-white">✉ {open.status === "발송완료" ? "다시 발송" : "발송 / 서명 요청"}</button>}
                {open.status === "발송완료" && open.signToken && <button onClick={async () => { const link = `${location.origin}/sign/${open.signToken}`; try { await navigator.clipboard.writeText(link); } catch {} flash(true, `서명 링크를 복사했습니다: ${link}`); }} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-primary">🔗 링크 복사</button>}
                {open.status !== "서명완료" && open.status !== "취소" && <button onClick={() => setStatusOf(open.id, "취소")} className="rounded-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">취소 처리</button>}
                {(open.status === "작성중" || open.status === "취소") && <button onClick={() => remove(open.id)} className="rounded-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">삭제</button>}
                <button onClick={() => setOpen(null)} className="rounded-full px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">닫기</button>
              </div>
            </div>
            <Card className="p-6 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><div className="text-xs text-slate-400">고객</div><div className="text-slate-800">{open.customer}</div><div className="text-xs text-slate-500">{open.customerRef} {open.customerEmail}</div></div>
                <div><div className="text-xs text-slate-400">계약금액</div><div className="text-slate-800 tabular-nums">{formatWon(open.amount)}</div></div>
                <div><div className="text-xs text-slate-400">기간</div><div className="text-slate-800">{open.startDate ?? "-"} ~ {open.endDate ?? "-"}</div></div>
                <div><div className="text-xs text-slate-400">진행</div><div className="text-slate-800 text-xs">작성 {open.createdAt}{open.sentAt ? ` · 발송 ${open.sentAt}` : ""}{open.signedAt ? ` · 서명 ${open.signedAt.slice(0, 10)} (${open.signerName})` : ""}</div></div>
              </div>
              {open.signature && <div className="rounded-xl border border-line bg-white p-3 inline-block"><div className="text-[11px] text-slate-400 mb-1">고객 전자서명</div><img src={open.signature} alt="서명" className="h-16 object-contain" /></div>}
              <pre className="whitespace-pre-wrap rounded-xl border border-line bg-slate-50 p-5 text-[13px] leading-relaxed text-slate-800 font-sans">{open.body}</pre>
            </Card>
          </div>
        </div>
      )}

      {sending && <SendModal c={sending} accounts={accounts} busy={busy} onSend={(a, to, m) => send(sending, a, to, m)} onCancel={() => setSending(null)} />}
    </>
  );
}

function SendModal({ c, accounts, busy, onSend, onCancel }: { c: Contract; accounts: PublicMailAccount[]; busy: boolean; onSend: (accountId: string, to: string, message: string) => void; onCancel: () => void }) {
  const [account, setAccount] = useState(accounts[0]?.id ?? "");
  const [to, setTo] = useState(c.customerEmail ?? "");
  const [message, setMessage] = useState("");
  const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); onSend(account, to, message); }} className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-slate-800">계약서 발송 · 서명 요청</h2>
        <p className="text-sm text-slate-600">고객에게 계약서 PDF와 <b>서명 링크</b>가 전달됩니다. 고객은 로그인 없이 링크에서 내용을 확인하고 서명할 수 있습니다.</p>
        {accounts.length > 0 ? (
          <label className="block text-sm"><span className="text-slate-600">보내는 계정</span>
            <select value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls}>
              <option value="">메일 없이 링크만 만들기</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.label} · {a.email}</option>)}
            </select>
          </label>
        ) : (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">연동된 메일 계정이 없어 메일은 보낼 수 없습니다. 서명 링크만 만들어 복사한 뒤 카카오톡 등으로 전달하세요. (메일관리에서 계정을 연동하면 자동 발송됩니다)</div>
        )}
        <label className="block text-sm"><span className="text-slate-600">받는 사람 이메일{account ? " *" : ""}</span><input type="email" value={to} onChange={(e) => setTo(e.target.value)} required={!!account} className={inputCls} /></label>
        <label className="block text-sm"><span className="text-slate-600">추가 안내문</span><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className={inputCls} placeholder="예) 9월 20일까지 서명 부탁드립니다." /></label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
          <button type="submit" disabled={busy} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white">{busy ? "보내는 중..." : account ? "메일로 발송" : "링크 만들기"}</button>
        </div>
      </form>
    </div>
  );
}
