"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import SortTh, { useSort, compareValues } from "@/components/SortTh";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { meetings as initialMeetings, projects as initialProjects, customers as initialCustomers, tasks as initialTasks, type Meeting, type MeetingAction, type Project, type Customer, type Task } from "@/data/sample";
import MeetingForm, { type MeetingInput } from "./MeetingForm";

type SortKey = "at" | "title" | "project" | "customer" | "lines";

function fmtAt(at: string) {
  const d = new Date(at);
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const lines = (m: Meeting) => (m.notes ? m.notes.split("\n").filter((l) => l.trim()).length : 0);

export default function MeetingManager() {
  const [items, setItems, loaded, loadError] = useServerState<Meeting[]>("meetings", initialMeetings);
  const [projects] = useServerState<Project[]>("projects", initialProjects, "jeil.projects");
  const [customers] = useServerState<Customer[]>("customers", initialCustomers, "jeil.customers");
  const [, setTasks] = useServerState<Task[]>("tasks", initialTasks, "jeil.tasks");
  const [query, setQuery] = useState("");
  const { sort, toggle } = useSort<SortKey>({ key: "at", dir: -1 });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const codeOf = (name?: string) => projects.find((p) => p.name === name)?.code ?? "";
    return items
      .filter((m) => !q || [m.title, m.project ?? "", codeOf(m.project), m.customer ?? "", m.notes, m.attendees.join(" ")].join(" ").toLowerCase().includes(q))
      .sort((a, b) => {
        const v = (m: Meeting): string | number => (sort.key === "lines" ? lines(m) : m[sort.key] ?? "");
        return compareValues(v(a), v(b)) * sort.dir;
      });
  }, [items, projects, query, sort]);

  const totalLines = items.reduce((s, m) => s + lines(m), 0);

  function add(data: MeetingInput) { setItems((prev) => [{ ...data, id: `m${Date.now()}` }, ...prev]); setAdding(false); }
  function update(id: string, data: MeetingInput) { setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m))); setEditing(null); }
  function remove(id: string) { setItems((prev) => prev.filter((m) => m.id !== id)); setEditing(null); }

  /** 할 일 항목을 할일관리에 등록하고 taskId를 채워 돌려줍니다. */
  function registerTasks(actions: MeetingAction[], meeting: MeetingInput): MeetingAction[] {
    const now = new Date();
    const createdAt = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    const newTasks: Task[] = [];
    const updated = actions.map((a, i) => {
      if (!a.title.trim() || a.taskId) return a;
      const id = `t${Date.now()}${i}`;
      newTasks.push({ id, title: a.title.trim(), description: `미팅 "${meeting.title || "미팅"}"에서 정한 할 일`, project: meeting.project, assignees: a.assignee ? [a.assignee] : [], due: a.due, status: "todo", priority: "medium", createdAt });
      return { ...a, taskId: id };
    });
    if (newTasks.length) setTasks((prev) => [...newTasks, ...prev]);
    return updated;
  }

  return (
    <>
      <PageHeader
        title="미팅 관리"
        description="회의 내용을 기록하고(말로도 가능) AI로 요약해 할 일까지 연결합니다."
        action={<button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">🎙 미팅 추가</button>}
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="전체 미팅" value={`${items.length}건`} sub="등록된 미팅 기록" icon="▤" />
            <StatCard label="프로젝트 연결" value={`${items.filter((m) => m.project).length}건`} sub="프로젝트와 연결된 미팅" icon="⇄" highlight />
            <StatCard label="고객 연결" value={`${items.filter((m) => m.customer).length}건`} sub="고객과 연결된 미팅" icon="⇄" highlight />
            <StatCard label="기록 줄 수" value={`${totalLines}줄`} sub="누적 회의록 줄 수" icon="≡" tone="green" />
          </div>

          <Card className="p-4 flex items-center justify-between gap-3">
            <div className="relative max-w-md flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="미팅명, 프로젝트명, 프로젝트 번호, 고객, 회의록 검색" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary" />
            </div>
            <span className="text-xs text-slate-400 whitespace-nowrap">{filtered.length}건 표시 중</span>
          </Card>

          <Card className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-line">
                  <SortTh label="미팅 일시" k="at" sort={sort} onSort={toggle} className="px-5" />
                  <SortTh label="미팅명" k="title" sort={sort} onSort={toggle} />
                  <SortTh label="연결 프로젝트" k="project" sort={sort} onSort={toggle} />
                  <SortTh label="연결 고객" k="customer" sort={sort} onSort={toggle} />
                  <th className="px-3 py-3 font-medium">참석자</th>
                  <SortTh label="회의록" k="lines" sort={sort} onSort={toggle} className="text-right" />
                  <th className="px-3 py-3 font-medium text-right pr-5">할 일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">표시할 미팅이 없습니다.</td></tr>}
                {filtered.map((m) => {
                  const code = projects.find((p) => p.name === m.project)?.code;
                  return (
                    <tr key={m.id} className="hover:bg-primary-soft/30 transition">
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{fmtAt(m.at)}</td>
                      <td className="px-3 py-3">
                        <button onClick={() => setEditing(m)} className="text-left font-medium text-slate-800 hover:text-primary">{m.title}</button>
                        {m.summary && <div className="text-xs text-slate-400 max-w-[320px] truncate">{m.summary}</div>}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{m.project ? <><span className="text-xs text-slate-400 mr-1">{code}</span>{m.project}</> : "-"}</td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{m.customer ?? "-"}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{m.attendees.join(", ") || "-"}</td>
                      <td className="px-3 py-3 text-right text-slate-600 whitespace-nowrap">{lines(m) ? `${lines(m)}줄` : "-"}</td>
                      <td className="px-3 py-3 pr-5 text-right whitespace-nowrap">{m.actions.length ? <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">{m.actions.filter((a) => a.taskId).length}/{m.actions.length} 등록</span> : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {adding && <MeetingForm projects={projects} customers={customers} onSubmit={add} onCancel={() => setAdding(false)} onRegisterTasks={registerTasks} />}
      {editing && <MeetingForm initial={editing} projects={projects} customers={customers} onSubmit={(d) => update(editing.id, d)} onCancel={() => setEditing(null)} onDelete={() => remove(editing.id)} onRegisterTasks={registerTasks} />}
    </>
  );
}
