"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import Tabs from "@/components/Tabs";
import type { AuditEntry } from "@/lib/audit";

const actionTone: Record<string, string> = {
  "로그인": "bg-green-50 text-green-700 border-green-200",
  "로그인 실패": "bg-red-50 text-red-600 border-red-200",
  "로그아웃": "bg-slate-100 text-slate-600 border-slate-200",
  "저장": "bg-primary-soft text-primary border-primary/20",
  "직원 추가": "bg-amber-50 text-amber-700 border-amber-200",
  "직원 수정": "bg-amber-50 text-amber-700 border-amber-200",
  "메일 발송": "bg-sky-50 text-sky-700 border-sky-200",
  "메일 계정 연동": "bg-sky-50 text-sky-700 border-sky-200",
  "메일 계정 해제": "bg-sky-50 text-sky-700 border-sky-200",
  "PDF 생성": "bg-purple-50 text-purple-700 border-purple-200",
  "AI 비서 질문": "bg-purple-50 text-purple-700 border-purple-200",
};

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export default function LogView() {
  const [log, setLog] = useState<AuditEntry[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [action, setAction] = useState("all");
  const [user, setUser] = useState("all");
  const [query, setQuery] = useState("");

  async function load() {
    const res = await fetch("/api/logs?limit=1000");
    const data = (await res.json()) as { log?: AuditEntry[]; isAdmin?: boolean };
    setLog(data.log ?? []);
    setIsAdmin(!!data.isAdmin);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const actions = useMemo(() => [...new Set((log ?? []).map((l) => l.action))], [log]);
  const users = useMemo(() => [...new Set((log ?? []).map((l) => l.user))], [log]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (log ?? [])
      .filter((l) => action === "all" || l.action === action)
      .filter((l) => user === "all" || l.user === user)
      .filter((l) => !q || [l.user, l.action, l.target ?? "", l.detail ?? ""].join(" ").toLowerCase().includes(q));
  }, [log, action, user, query]);

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = (log ?? []).filter((l) => l.at.startsWith(today)).length;
  const failCount = (log ?? []).filter((l) => l.action === "로그인 실패").length;

  return (
    <>
      <PageHeader
        title="로그"
        description={isAdmin ? "누가 언제 무엇을 했는지 기록입니다. 로그인, 데이터 저장, 직원 변경, 메일 발송, PDF 생성, AI 질문이 자동으로 남습니다." : "내 활동 기록입니다. (전체 기록은 관리자만 볼 수 있습니다)"}
        action={<button onClick={load} className="rounded-full border border-line bg-white text-slate-700 text-sm px-4 py-2.5 hover:border-primary hover:text-primary transition">↻ 새로 고침</button>}
      />
      {log === null ? (
        <Card className="p-12 text-center text-sm text-slate-400">기록을 불러오는 중...</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="전체 기록" value={`${log.length}건`} sub="최근 5,000건까지 보관" icon="≡" />
            <StatCard label="오늘" value={`${todayCount}건`} sub="오늘 발생한 활동" icon="●" highlight />
            <StatCard label="활동 종류" value={`${actions.length}가지`} sub="로그인·저장·메일 등" icon="▤" />
            <StatCard label="로그인 실패" value={`${failCount}건`} sub={failCount > 0 ? "비밀번호 오류 등 확인 필요" : "이상 없음"} icon="!" tone={failCount > 0 ? "amber" : "green"} />
          </div>

          <Card className="p-4 space-y-3">
            <Tabs value={action} onChange={setAction} tabs={[{ key: "all", label: "전체", n: log.length }, ...actions.map((a) => ({ key: a, label: a, n: log.filter((l) => l.action === a).length }))]} />
            <div className="flex flex-wrap items-center gap-3">
              {isAdmin && (
                <select value={user} onChange={(e) => setUser(e.target.value)} className="rounded-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary">
                  <option value="all">모든 직원</option>
                  {users.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              )}
              <div className="relative w-full sm:w-72">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="대상, 내용 검색" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <span className="ml-auto text-xs text-slate-400">{filtered.length}건 표시 중</span>
            </div>
          </Card>

          <Card className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-line">
                  <th className="px-5 py-3 font-medium">시각</th>
                  <th className="px-3 py-3 font-medium">직원</th>
                  <th className="px-3 py-3 font-medium">활동</th>
                  <th className="px-3 py-3 font-medium">대상</th>
                  <th className="px-3 py-3 font-medium">내용</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">기록이 없습니다.</td></tr>}
                {filtered.map((l, i) => (
                  <tr key={i} className="hover:bg-primary-soft/30">
                    <td className="px-5 py-2.5 text-slate-600 whitespace-nowrap tabular-nums">{fmt(l.at)}</td>
                    <td className="px-3 py-2.5 text-slate-800 whitespace-nowrap">{l.user}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className={`rounded-full border px-2.5 py-0.5 text-xs ${actionTone[l.action] ?? "bg-white text-slate-600 border-line"}`}>{l.action}</span></td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{l.target ?? "-"}</td>
                    <td className="px-3 py-2.5 text-slate-500 max-w-[380px] truncate" title={l.detail}>{l.detail ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
