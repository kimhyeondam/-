"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import Tabs from "@/components/Tabs";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { suggestions as initialSuggestions, type Suggestion, type SuggestionCategory, type SuggestionStatus } from "@/data/sample";

const categories: SuggestionCategory[] = ["업무 개선", "설비·안전", "복지·근무", "기타"];
const statuses: SuggestionStatus[] = ["접수", "검토중", "반영", "보류"];
const statusBadge: Record<SuggestionStatus, string> = {
  접수: "bg-sky-50 text-sky-700 border-sky-200",
  검토중: "bg-amber-50 text-amber-700 border-amber-200",
  반영: "bg-green-50 text-green-700 border-green-200",
  보류: "bg-slate-100 text-slate-500 border-slate-200",
};
const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
const nowIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19); };
const fmt = (iso: string) => iso.slice(0, 10).replace(/-/g, ". ");

type Me = { id: string; name: string; role: string };

export default function SuggestionBoard() {
  const [items, setItems, loaded, loadError] = useServerState<Suggestion[]>("suggestions", initialSuggestions);
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<"all" | SuggestionStatus>("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Suggestion | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => {}); }, []);
  const isAdmin = me?.role === "관리자";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...items]
      .filter((s) => status === "all" || s.status === status)
      .filter((s) => !q || [s.title, s.content, s.category, s.anonymous && !isAdmin ? "" : s.author].join(" ").toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [items, status, query, isAdmin]);

  const count = (s: SuggestionStatus) => items.filter((x) => x.status === s).length;
  const displayAuthor = (s: Suggestion) => (s.anonymous && !isAdmin ? "익명" : s.anonymous ? `${s.author} (익명 제출)` : s.author);
  function flash(t: string) { setNotice(t); setTimeout(() => setNotice(null), 4000); }

  function add(data: { title: string; content: string; category: SuggestionCategory; anonymous: boolean }) {
    if (!me) return;
    setItems((prev) => [{ id: `s${Date.now()}`, ...data, status: "접수", author: me.name, authorId: me.id, createdAt: nowIso() }, ...prev]);
    setAdding(false);
    flash("건의사항을 등록했습니다. 검토 후 답변드리겠습니다.");
  }
  function reply(id: string, data: { status: SuggestionStatus; reply: string }) {
    if (!me) return;
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, status: data.status, reply: data.reply.trim() || s.reply, repliedBy: data.reply.trim() ? me.name : s.repliedBy, repliedAt: data.reply.trim() ? nowIso() : s.repliedAt } : s)));
    setOpen(null);
    flash("답변과 상태를 저장했습니다.");
  }
  function remove(id: string) {
    if (!confirm("이 건의사항을 삭제할까요?")) return;
    setItems((prev) => prev.filter((s) => s.id !== id));
    setOpen(null);
  }

  return (
    <>
      <PageHeader
        title="건의사항"
        description="현장·사무실에서 느낀 불편이나 개선 아이디어를 남기면 대표가 확인하고 답변합니다."
        action={<button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">＋ 건의하기</button>}
      />
      {notice && <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">{notice}</div>}
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="전체" value={`${items.length}건`} sub="등록된 건의사항" icon="◇" />
            <StatCard label="접수" value={`${count("접수")}건`} sub="아직 답변 전" icon="●" highlight={count("접수") > 0} />
            <StatCard label="검토중" value={`${count("검토중")}건`} sub="확인·검토 진행 중" icon="…" tone="amber" />
            <StatCard label="반영" value={`${count("반영")}건`} sub="실제로 반영된 건의" icon="✓" tone="green" />
          </div>

          <Card className="p-4 space-y-3">
            <Tabs value={status} onChange={(v) => setStatus(v as "all" | SuggestionStatus)} tabs={[{ key: "all", label: "전체", n: items.length }, ...statuses.map((s) => ({ key: s, label: s, n: count(s) }))]} />
            <div className="relative max-w-md">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제목, 내용, 분류 검색" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary" />
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card className="p-12 text-center text-sm text-slate-400">건의사항이 없습니다.</Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((s) => (
                <Card key={s.id} className="p-5">
                  <button onClick={() => setOpen(s)} className="w-full text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs ${statusBadge[s.status]}`}>{s.status}</span>
                      <span className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs text-slate-500">{s.category}</span>
                      <span className="font-bold text-slate-800">{s.title}</span>
                      <span className="ml-auto text-xs text-slate-400">{displayAuthor(s)} · {fmt(s.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 line-clamp-2">{s.content}</p>
                    {s.reply && (
                      <div className="mt-3 rounded-xl bg-primary-soft/60 border border-primary/10 px-4 py-2.5 text-sm text-slate-700">
                        <span className="font-semibold text-primary">답변</span> <span className="text-xs text-slate-400">{s.repliedBy} · {s.repliedAt ? fmt(s.repliedAt) : ""}</span>
                        <div className="mt-1 line-clamp-2">{s.reply}</div>
                      </div>
                    )}
                  </button>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {adding && <SuggestForm onSubmit={add} onCancel={() => setAdding(false)} />}
      {open && (
        <DetailModal
          s={open}
          isAdmin={isAdmin}
          mine={open.authorId === me?.id}
          authorLabel={displayAuthor(open)}
          onReply={(d) => reply(open.id, d)}
          onDelete={() => remove(open.id)}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function SuggestForm({ onSubmit, onCancel }: { onSubmit: (d: { title: string; content: string; category: SuggestionCategory; anonymous: boolean }) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ title: "", content: "", category: "업무 개선" as SuggestionCategory, anonymous: false });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!form.title.trim() || !form.content.trim()) return; onSubmit({ ...form, title: form.title.trim(), content: form.content.trim() }); }} className="w-full max-w-xl rounded-2xl bg-card p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-slate-800">건의하기</h2>
        <label className="block text-sm"><span className="text-slate-600">분류</span>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as SuggestionCategory })} className={inputCls}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </label>
        <label className="block text-sm"><span className="text-slate-600">제목 *</span><input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="예) 야적장 조명 추가 요청" /></label>
        <label className="block text-sm"><span className="text-slate-600">내용 *</span><textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} className={inputCls} placeholder="어떤 점이 불편한지, 어떻게 바뀌면 좋을지 편하게 적어 주세요." /></label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.anonymous} onChange={(e) => setForm({ ...form, anonymous: e.target.checked })} className="accent-primary" /> 익명으로 제출 (다른 직원에게는 이름이 보이지 않고, 관리자에게만 보입니다)</label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
          <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark px-5 py-2 text-sm font-semibold text-white">등록</button>
        </div>
      </form>
    </div>
  );
}

function DetailModal({ s, isAdmin, mine, authorLabel, onReply, onDelete, onClose }: { s: Suggestion; isAdmin: boolean; mine: boolean; authorLabel: string; onReply: (d: { status: SuggestionStatus; reply: string }) => void; onDelete: () => void; onClose: () => void }) {
  const [status, setStatus] = useState<SuggestionStatus>(s.status);
  const [reply, setReply] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs ${statusBadge[s.status]}`}>{s.status}</span>
          <span className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs text-slate-500">{s.category}</span>
          <span className="ml-auto text-xs text-slate-400">{authorLabel} · {fmt(s.createdAt)}</span>
        </div>
        <h2 className="text-xl font-bold text-slate-800">{s.title}</h2>
        <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">{s.content}</p>
        {s.reply && (
          <div className="rounded-xl bg-primary-soft/60 border border-primary/10 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-primary">답변</span> <span className="text-xs text-slate-400">{s.repliedBy} · {s.repliedAt ? fmt(s.repliedAt) : ""}</span>
            <div className="mt-1 whitespace-pre-wrap">{s.reply}</div>
          </div>
        )}
        {isAdmin && (
          <form onSubmit={(e) => { e.preventDefault(); onReply({ status, reply }); }} className="rounded-xl border border-line bg-background p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-800">관리자 답변 / 상태 변경</div>
            <div className="flex flex-wrap gap-2">
              {statuses.map((st) => <button type="button" key={st} onClick={() => setStatus(st)} className={`rounded-full border px-3 py-1.5 text-xs ${status === st ? "bg-primary border-primary text-white" : "border-line bg-white text-slate-600 hover:border-primary"}`}>{st}</button>)}
            </div>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} className={inputCls} placeholder={s.reply ? "답변을 추가로 쓰면 기존 답변을 대체합니다." : "답변을 적어 주세요."} />
            <div className="flex justify-end"><button type="submit" className="rounded-full bg-primary hover:bg-primary-dark px-5 py-2 text-sm font-semibold text-white">저장</button></div>
          </form>
        )}
        <div className="flex items-center justify-between">
          <div>{(isAdmin || (mine && !s.reply)) && <button onClick={onDelete} className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">삭제</button>}</div>
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">닫기</button>
        </div>
      </div>
    </div>
  );
}
