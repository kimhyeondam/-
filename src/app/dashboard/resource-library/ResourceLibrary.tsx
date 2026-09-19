"use client";

import { useMemo, useState } from "react";
import { useServerState } from "@/lib/useServerState";
import LoadingCard from "@/components/LoadingCard";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import { resources as initialResources, type Resource } from "@/data/sample";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const ampm = h < 12 ? "오전" : "오후";
  const hh = h % 12 === 0 ? 12 : h % 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${ampm} ${hh}:${mm}`;
}

// 본문 미리보기: 마크다운 기호(#, -, [ ])를 걷어내고 한 줄로 보여줍니다.
function preview(content: string) {
  return content
    .replace(/^#+\s*/gm, "")
    .replace(/^- \[ \]\s*/gm, "")
    .replace(/^-\s*/gm, "")
    .replace(/\n+/g, " · ")
    .slice(0, 160);
}

export default function ResourceLibrary() {
  const [items, setItems, loaded, loadError] = useServerState<Resource[]>("resources", initialResources, "jeil.resources");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Resource | null>(null);
  const [form, setForm] = useState({ title: "", content: "", author: "관리자" });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!q) return sorted;
    return sorted.filter(
      (r) => r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q) || r.author.toLowerCase().includes(q),
    );
  }, [items, query]);

  const latest = items.reduce<string | null>((acc, r) => (!acc || r.createdAt > acc ? r.createdAt : acc), null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    setItems((prev) => [
      { id: `r${Date.now()}`, title: form.title.trim(), content: form.content.trim(), author: form.author.trim() || "관리자", createdAt: local },
      ...prev,
    ]);
    setForm({ title: "", content: "", author: "관리자" });
    setShowForm(false);
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id));
    setSelected(null);
  }

  return (
    <>
      <PageHeader
        title="자료실"
        description="업무 자료를 게시판 형태로 관리합니다."
        action={
          <button
            onClick={() => setShowForm(true)}
            className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition"
          >
            ＋ 자료 추가
          </button>
        }
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <StatCard label="등록 자료" value={`${items.length}건`} sub="현재 자료실에 등록된 게시물 수" icon="▥" />
        <StatCard label="최근 등록" value={latest ? formatDateTime(latest) : "-"} sub="가장 최근에 등록된 자료 시점" icon="▥" highlight />
      </div>

      <Card className="p-4">
        <div className="relative max-w-md">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목, 내용, 작성자로 검색"
            className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm text-slate-400">검색 결과가 없습니다.</Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <Card key={r.id} className="p-6 cursor-pointer hover:border-primary/50 transition">
              <button onClick={() => setSelected(r)} className="w-full text-left">
                <div className="text-lg font-bold text-slate-800">{r.title}</div>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed line-clamp-2">{preview(r.content)}</p>
                <div className="mt-4 text-xs text-slate-400">
                  작성자 {r.author} <span className="ml-3">등록 {formatDateTime(r.createdAt)}</span>
                </div>
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* 자료 추가 창 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowForm(false)}>
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl bg-card p-6 shadow-xl space-y-4"
          >
            <h2 className="text-lg font-bold text-slate-800">자료 추가</h2>
            <label className="block text-sm">
              <span className="text-slate-600">제목</span>
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-primary"
                placeholder="예) 흄관 규격표 2026"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">내용</span>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={8}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-primary"
                placeholder="자료 내용을 적어 주세요."
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">작성자</span>
              <input
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-primary"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
                취소
              </button>
              <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark px-5 py-2 text-sm font-semibold text-white">
                등록
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 자료 상세 보기 창 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{selected.title}</h2>
                <div className="mt-1 text-xs text-slate-400">
                  작성자 {selected.author} <span className="ml-3">등록 {formatDateTime(selected.createdAt)}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 text-xl" aria-label="닫기">
                ×
              </button>
            </div>
            <pre className="mt-5 whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed max-h-[60vh] overflow-y-auto">
              {selected.content}
            </pre>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => remove(selected.id)} className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                삭제
              </button>
              <button onClick={() => setSelected(null)} className="rounded-full bg-primary hover:bg-primary-dark px-5 py-2 text-sm font-semibold text-white">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      </>)}
    </>
  );
}
