"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import { providerPresets, type PublicMailAccount } from "@/lib/mail/presets";
import type { MailSummary, MailDetail } from "@/lib/mail/service";
import type { MailLogEntry } from "@/lib/mail/log";
import type { Customer, Lead, BusinessCard } from "@/data/sample";
import AccountForm from "./AccountForm";
import ComposeForm from "./ComposeForm";

type Folder = "inbox" | "sent" | "log";

function fmt(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function MailClient() {
  const [accounts, setAccounts] = useState<PublicMailAccount[] | null>(null);
  const [me, setMe] = useState<{ id: string; isAdmin: boolean }>({ id: "", isAdmin: false });
  const [current, setCurrent] = useState<string>("");
  const [folder, setFolder] = useState<Folder>("inbox");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<MailSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<MailDetail | null>(null);
  const [log, setLog] = useState<MailLogEntry[]>([]);
  const [adding, setAdding] = useState(false);
  const [compose, setCompose] = useState<null | { reply?: { to: string; subject: string; quote: string } }>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [contacts, setContacts] = useState<{ name: string; email: string; kind: string }[]>([]);

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/mail/accounts");
    const data = (await res.json()) as { accounts: PublicMailAccount[]; me: string; isAdmin: boolean };
    setAccounts(data.accounts);
    setMe({ id: data.me, isAdmin: data.isAdmin });
    setCurrent((c) => c || data.accounts[0]?.id || "");
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  // 고객·리드·명함의 이메일을 모아 두고 보낸 사람과 자동으로 맞춥니다.
  useEffect(() => {
    (async () => {
      const get = async <T,>(c: string) => ((await (await fetch(`/api/data/${c}`)).json()) as { data: T[] | null }).data ?? [];
      const [customers, leads, cards] = await Promise.all([get<Customer>("customers"), get<Lead>("leads"), get<BusinessCard>("businessCards")]);
      const list: { name: string; email: string; kind: string }[] = [];
      customers.forEach((c) => c.email && list.push({ name: c.name, email: c.email.toLowerCase(), kind: "고객" }));
      leads.forEach((l) => l.email && list.push({ name: `${l.company} ${l.contact}`, email: l.email.toLowerCase(), kind: "리드" }));
      cards.forEach((b) => b.email && list.push({ name: `${b.company} ${b.name}`, email: b.email.toLowerCase(), kind: "명함" }));
      setContacts(list);
    })().catch(() => {});
  }, []);

  const contactOf = (addr: string) => contacts.find((c) => c.email === addr.toLowerCase());

  const loadMessages = useCallback(async () => {
    if (!current || folder === "log") return;
    setLoading(true);
    setError(null);
    setDetail(null);
    try {
      const res = await fetch(`/api/mail/messages?account=${current}&folder=${folder}&q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as { messages?: MailSummary[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "불러오지 못했습니다.");
      setMessages(data.messages ?? []);
    } catch (e) {
      setError((e as Error).message);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [current, folder, query]);

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { loadMessages(); }, [current, folder]);

  useEffect(() => {
    if (folder !== "log") return;
    fetch("/api/mail/log").then((r) => r.json()).then((d: { log?: MailLogEntry[] }) => setLog(d.log ?? [])).catch(() => {});
  }, [folder, notice]);

  async function open(m: MailSummary) {
    setDetail(null);
    const res = await fetch(`/api/mail/message?account=${current}&folder=${folder}&uid=${m.uid}`);
    const data = (await res.json()) as { message?: MailDetail; error?: string };
    if (!res.ok || !data.message) return setError(data.error ?? "메일을 열지 못했습니다.");
    setDetail(data.message);
    setMessages((prev) => prev.map((x) => (x.uid === m.uid ? { ...x, seen: true } : x)));
  }

  async function removeAccount(a: PublicMailAccount) {
    if (!confirm(`${a.label} (${a.email}) 연동을 해제할까요? 메일 자체는 삭제되지 않습니다.`)) return;
    await fetch(`/api/mail/accounts?id=${a.id}`, { method: "DELETE" });
    setCurrent("");
    await loadAccounts();
  }

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  }

  const account = accounts?.find((a) => a.id === current);
  const shared = useMemo(() => (accounts ?? []).filter((a) => a.shared), [accounts]);
  const mine = useMemo(() => (accounts ?? []).filter((a) => !a.shared), [accounts]);
  const unread = messages.filter((m) => !m.seen).length;

  return (
    <>
      <PageHeader
        title="메일관리"
        description="직원 업무 메일(네이버·지메일 등)을 연동해 한곳에서 확인하고, 담당자가 자리를 비워도 대신 보낼 수 있습니다."
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setAdding(true)} className="rounded-full border border-line bg-white text-slate-700 text-sm px-4 py-2.5 hover:border-primary hover:text-primary transition">＋ 계정 연동</button>
            <button onClick={() => setCompose({})} disabled={!account} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">✎ 메일 쓰기</button>
          </div>
        }
      />
      {notice && <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">{notice}</div>}

      {accounts === null ? (
        <Card className="p-12 text-center text-sm text-slate-400">연동 계정을 불러오는 중...</Card>
      ) : accounts.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="text-4xl">✉</div>
          <div className="mt-3 font-semibold text-slate-800">아직 연동된 메일 계정이 없습니다</div>
          <p className="mt-2 text-sm text-slate-500 max-w-lg mx-auto">직원 업무용 네이버 메일을 「공용」으로 등록하면 모든 직원이 확인하고 대신 보낼 수 있습니다. 대표 메일은 「비공개」로 등록해 본인만 봅니다.</p>
          <button onClick={() => setAdding(true)} className="mt-4 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5">＋ 첫 계정 연동하기</button>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
            {[["🔍", "메일 조회 및 검색", "받은편지함·보낸편지함을 확인하고 제목·보낸 사람·본문으로 검색합니다."], ["👥", "고객 메일 자동 연결", "보낸 사람 주소를 고객·리드·명함과 맞춰 누구인지 바로 보여줍니다."], ["📤", "대신 보내기와 발송 기록", "담당자 부재 시 다른 직원이 거래명세표·견적서를 보내고, 누가 보냈는지 기록이 남습니다."]].map(([i, t, d]) => (
              <div key={t} className="rounded-xl border border-line bg-white p-4"><div className="text-xl">{i}</div><div className="mt-1 font-semibold text-sm text-slate-800">{t}</div><p className="mt-1 text-xs text-slate-500">{d}</p></div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5 items-start">
          {/* 계정 목록 */}
          <Card className="p-3">
            {shared.length > 0 && <div className="px-2 pb-1 text-[11px] font-semibold tracking-widest text-slate-400">공용 (직원 모두)</div>}
            <ul className="space-y-1">
              {shared.map((a) => <AccountRow key={a.id} a={a} active={current === a.id} onClick={() => { setCurrent(a.id); setFolder("inbox"); }} />)}
            </ul>
            {mine.length > 0 && <div className="mt-3 px-2 pb-1 text-[11px] font-semibold tracking-widest text-slate-400">비공개 (나만)</div>}
            <ul className="space-y-1">
              {mine.map((a) => <AccountRow key={a.id} a={a} active={current === a.id} onClick={() => { setCurrent(a.id); setFolder("inbox"); }} />)}
            </ul>
            {account && (
              <div className="mt-3 border-t border-line pt-3 px-2 text-xs text-slate-500 space-y-1">
                <div>{providerPresets[account.provider].name} · {account.email}</div>
                <div>{account.shared ? "공용 계정" : "비공개 계정"}{account.ownerId === me.id ? " · 내가 등록" : ""}</div>
                {(account.ownerId === me.id || me.isAdmin) && <button onClick={() => removeAccount(account)} className="text-red-600 hover:underline">연동 해제</button>}
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="현재 계정" value={account?.label ?? "-"} sub={account?.email ?? ""} icon="✉" />
              <StatCard label="읽지 않은 메일" value={`${unread}건`} sub="불러온 목록 기준" icon="●" highlight={unread > 0} />
              <StatCard label="연동 계정" value={`${accounts.length}개`} sub={`공용 ${shared.length} · 비공개 ${mine.length}`} icon="▥" />
            </div>

            <Card className="p-3 flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border border-line p-1">
                {([["inbox", "받은편지함"], ["sent", "보낸편지함"], ["log", "발송 기록"]] as [Folder, string][]).map(([k, l]) => (
                  <button key={k} onClick={() => setFolder(k)} className={`rounded-full px-4 py-1.5 text-sm ${folder === k ? "bg-primary text-white font-semibold" : "text-slate-600 hover:bg-primary-soft"}`}>{l}</button>
                ))}
              </div>
              {folder !== "log" && (
                <form onSubmit={(e) => { e.preventDefault(); loadMessages(); }} className="ml-auto flex items-center gap-2">
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제목, 보낸 사람, 본문 검색" className="w-64 rounded-full border border-line bg-background px-4 py-2 text-sm outline-none focus:border-primary" />
                  <button type="submit" className="rounded-full border border-line bg-white px-3 py-2 text-sm text-slate-700 hover:border-primary hover:text-primary">검색</button>
                  <button type="button" onClick={() => { setQuery(""); loadMessages(); }} className="rounded-full border border-line bg-white px-3 py-2 text-sm text-slate-700 hover:border-primary hover:text-primary" title="새로 고침">↻</button>
                </form>
              )}
            </Card>

            {error && <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">{error}</div>}

            {folder === "log" ? (
              <Card className="overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead><tr className="text-left text-xs text-slate-500 border-b border-line"><th className="px-5 py-3 font-medium">시각</th><th className="px-3 py-3 font-medium">보낸 직원</th><th className="px-3 py-3 font-medium">계정</th><th className="px-3 py-3 font-medium">받는 사람</th><th className="px-3 py-3 font-medium">제목</th><th className="px-3 py-3 font-medium">첨부</th><th className="px-3 py-3 font-medium">결과</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {log.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">발송 기록이 없습니다.</td></tr>}
                    {log.map((l, i) => (
                      <tr key={i} className="hover:bg-primary-soft/30">
                        <td className="px-5 py-2.5 text-slate-600 whitespace-nowrap">{fmt(l.at)}</td>
                        <td className="px-3 py-2.5 text-slate-800 whitespace-nowrap">{l.sentBy}</td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{l.accountEmail}</td>
                        <td className="px-3 py-2.5 text-slate-600">{l.to}</td>
                        <td className="px-3 py-2.5 text-slate-800 max-w-[280px] truncate">{l.subject}</td>
                        <td className="px-3 py-2.5 text-slate-600">{l.attachments ? `📎 ${l.attachments}` : "-"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{l.ok ? <span className="rounded-full bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-xs">성공</span> : <span title={l.error} className="rounded-full bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 text-xs">실패</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 items-start">
                <Card className="overflow-hidden">
                  {loading ? (
                    <div className="p-10 text-center text-sm text-slate-400">메일 서버에서 불러오는 중...</div>
                  ) : messages.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-400">메일이 없습니다.</div>
                  ) : (
                    <ul className="divide-y divide-line max-h-[640px] overflow-y-auto">
                      {messages.map((m) => {
                        const who = folder === "inbox" ? m.from : m.to;
                        const addr = folder === "inbox" ? m.fromAddress : "";
                        const c = addr ? contactOf(addr) : undefined;
                        return (
                          <li key={m.uid}>
                            <button onClick={() => open(m)} className={`w-full text-left px-4 py-3 hover:bg-primary-soft/30 ${detail?.uid === m.uid ? "bg-primary-soft/40" : ""}`}>
                              <div className="flex items-center gap-2">
                                {!m.seen && folder === "inbox" && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                                <span className={`truncate text-sm ${m.seen ? "text-slate-600" : "font-semibold text-slate-800"}`}>{who || "(알 수 없음)"}</span>
                                {c && <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] text-primary">{c.kind} · {c.name}</span>}
                                <span className="ml-auto shrink-0 text-[11px] text-slate-400">{fmt(m.date)}</span>
                              </div>
                              <div className={`mt-0.5 truncate text-sm ${m.seen ? "text-slate-500" : "text-slate-800"}`}>{m.hasAttachment ? "📎 " : ""}{m.subject}</div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>

                <Card className="p-5 min-h-[300px]">
                  {!detail ? (
                    <div className="h-full flex items-center justify-center text-sm text-slate-400 py-20">왼쪽 목록에서 메일을 선택하세요.</div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-lg font-bold text-slate-800">{detail.subject}</h2>
                        {folder === "inbox" && (
                          <button onClick={() => setCompose({ reply: { to: detail.fromAddress || detail.from, subject: detail.subject, quote: detail.text.slice(0, 2000) } })} className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-primary hover:text-primary">↩ 답장</button>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                        <div>보낸 사람: {detail.from} {contactOf(detail.fromAddress) && <span className="ml-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] text-primary">{contactOf(detail.fromAddress)!.kind} · {contactOf(detail.fromAddress)!.name}</span>}</div>
                        <div>받는 사람: {detail.to}</div>
                        {detail.cc && <div>참조: {detail.cc}</div>}
                        <div>{new Date(detail.date).toLocaleString("ko-KR")}</div>
                      </div>
                      {detail.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {detail.attachments.map((a, i) => <span key={i} className="rounded-lg bg-background border border-line px-3 py-1 text-xs text-slate-600">📎 {a.filename} <span className="text-slate-400">({Math.round(a.size / 1024)}KB)</span></span>)}
                        </div>
                      )}
                      <div className="mt-4 border-t border-line pt-4">
                        {detail.html ? (
                          <iframe title="메일 본문" sandbox="" srcDoc={detail.html} className="w-full min-h-[420px] rounded-lg border border-line bg-white" />
                        ) : (
                          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">{detail.text}</pre>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {adding && <AccountForm isAdmin={me.isAdmin} onDone={async () => { setAdding(false); await loadAccounts(); flash("메일 계정을 연동했습니다."); }} onCancel={() => setAdding(false)} />}
      {compose && account && (
        <ComposeForm
          accounts={accounts ?? []}
          defaultAccount={account.id}
          reply={compose.reply}
          contacts={contacts}
          onDone={(msg) => { setCompose(null); flash(msg); if (folder === "sent") loadMessages(); }}
          onCancel={() => setCompose(null)}
        />
      )}
    </>
  );
}

function AccountRow({ a, active, onClick }: { a: PublicMailAccount; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${active ? "bg-primary text-white" : "text-slate-700 hover:bg-primary-soft"}`}>
        <div className="font-medium truncate">{a.label}</div>
        <div className={`text-[11px] truncate ${active ? "text-white/70" : "text-slate-400"}`}>{a.email}</div>
      </button>
    </li>
  );
}
