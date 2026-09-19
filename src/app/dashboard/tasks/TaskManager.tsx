"use client";

import { todayIso } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import AssigneeFilter, { type AssigneeFilterValue } from "@/components/AssigneeFilter";
import { useServerState } from "@/lib/useServerState";
import { useMembers } from "@/lib/useMembers";
import LoadingCard from "@/components/LoadingCard";
import { tasks as initialTasks, isOpenTask, type Task, type TaskStatus } from "@/data/sample";
import { statusOrder, statusMeta, priorityMeta } from "./taskMeta";
import TaskForm, { type TaskInput } from "./TaskForm";

type StatusFilter = "all" | TaskStatus;

function nowIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}

type DueFilter = "all" | "today" | "overdue";
const dueMeta: Record<Exclude<DueFilter, "all">, { label: string; heading: string }> = {
  today: { label: "오늘 마감", heading: "오늘 마감 할일" },
  overdue: { label: "지연", heading: "지연된 할일" },
};

export default function TaskManager({ initialDue = "all", openId }: { initialDue?: DueFilter; openId?: string } = {}) {
  const [items, setItems, loaded, loadError] = useServerState<Task[]>("tasks", initialTasks, "jeil.tasks");
  const [today] = useState(todayIso);
  const [due, setDue] = useState<DueFilter>(initialDue);
  const members = useMembers();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [assignee, setAssignee] = useState<AssigneeFilterValue>("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [quick, setQuick] = useState("");
  // 대시보드에서 할일을 눌러 들어온 경우: 불러온 뒤 그 할일을 바로 엽니다
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (loaded && openId) { const t = items.find((x) => x.id === openId); if (t) setEditing(t); } }, [loaded, openId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 통계
  const count = (s: TaskStatus) => items.filter((t) => t.status === s).length;
  const openCount = items.filter(isOpenTask).length;
  const overdueCount = items.filter((t) => isOpenTask(t) && !!t.due && t.due < today).length;
  const todayCount = items.filter((t) => isOpenTask(t) && t.due === today).length;

  // 담당자별 건수
  const assigneeCounts = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((m) => map.set(m.name, 0));
    items.forEach((t) => t.assignees.forEach((n) => map.set(n, (map.get(n) ?? 0) + 1)));
    return map;
  }, [items, members]);
  const unassignedCount = items.filter((t) => t.assignees.length === 0).length;

  // 필터링 + 상태 순 정렬
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((t) => status === "all" || t.status === status)
      .filter((t) => {
        if (due === "all") return true;
        if (!isOpenTask(t) || !t.due) return false;
        return due === "today" ? t.due === today : t.due < today;
      })
      .filter((t) => {
        if (assignee === "all") return true;
        if (assignee === "unassigned") return t.assignees.length === 0;
        return t.assignees.includes(assignee);
      })
      .filter((t) => {
        if (!q) return true;
        const hay = [t.title, t.description ?? "", t.project ?? "", t.assignees.join(" "), priorityMeta[t.priority].label].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const s = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
        if (s !== 0) return s;
        return (a.due ?? "9999").localeCompare(b.due ?? "9999");
      });
  }, [items, query, status, assignee, due, today]);

  function addTask(data: TaskInput) {
    setItems((prev) => [{ ...data, id: `t${Date.now()}`, createdAt: nowIso() }, ...prev]);
    setAdding(false);
  }

  function quickAdd() {
    const title = quick.trim();
    if (!title) return;
    setItems((prev) => [{ id: `t${Date.now()}`, title, assignees: [], status: "todo", priority: "medium", createdAt: nowIso() }, ...prev]);
    setQuick("");
  }

  function updateTask(id: string, data: TaskInput) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    setEditing(null);
  }

  function removeTask(id: string) {
    setItems((prev) => prev.filter((t) => t.id !== id));
    setEditing(null);
  }

  function cycleStatus(t: Task) {
    // 상태 배지를 누르면 다음 단계로: 백로그 → 할 일 → 진행중 → 완료 → (취소는 그대로)
    const next: Partial<Record<TaskStatus, TaskStatus>> = { backlog: "todo", todo: "doing", doing: "done", done: "todo" };
    const ns = next[t.status];
    if (ns) setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: ns } : x)));
  }

  const tabs: { key: StatusFilter; label: string; n: number }[] = [
    { key: "all", label: "전체", n: items.length },
    ...statusOrder.map((s) => ({ key: s as StatusFilter, label: statusMeta[s].label, n: count(s) })),
  ];

  return (
    <>
      <PageHeader
        title="할일관리"
        description="할 일을 등록하고 담당자·마감일·진행 상태를 관리합니다."
        action={
          <button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">
            ＋ 할일 추가
          </button>
        }
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="전체 할일" value={items.length} sub={`미완료 ${openCount}건`} icon="▥" onClick={() => { setStatus("all"); setDue("all"); }} />
        <StatCard label="오늘 마감" value={todayCount} sub="오늘까지 끝낼 일" icon="☑" onClick={() => { setStatus("all"); setDue("today"); }} highlight={due === "today"} />
        <StatCard label="지연" value={<span className={overdueCount ? "text-red-600" : ""}>{overdueCount}</span>} sub="마감일이 지난 미완료" icon="!" onClick={() => { setStatus("all"); setDue("overdue"); }} highlight={due === "overdue"} />
        <StatCard label="할 일" value={count("todo")} sub="착수 대기" icon="▤" onClick={() => { setStatus("todo"); setDue("all"); }} />
        <StatCard label="진행중" value={count("doing")} sub="지금 하고 있는 일" icon="▷" tone="amber" onClick={() => { setStatus("doing"); setDue("all"); }} />
        <StatCard label="완료" value={count("done")} sub="누적 완료" icon="✓" tone="green" onClick={() => { setStatus("done"); setDue("all"); }} />
      </div>

      <Card className="p-4 space-y-3">
        <div className="relative max-w-md">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목, 설명, 담당자, 우선순위 검색"
            className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-full border border-line p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`rounded-full px-4 py-1.5 text-sm transition ${status === t.key ? "bg-primary text-white font-semibold" : "text-slate-600 hover:bg-primary-soft"}`}
            >
              {t.label} <span className={`ml-1 text-xs rounded-full px-1.5 ${status === t.key ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{t.n}</span>
            </button>
          ))}
        </div>
        {due !== "all" && (
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-primary text-white px-3 py-1 text-xs font-semibold">{dueMeta[due].label}만 보는 중</span>
            <button onClick={() => setDue("all")} className="text-xs text-slate-500 hover:text-primary underline">전체 보기</button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5 items-start">
        <AssigneeFilter value={assignee} onChange={setAssignee} total={items.length} unassigned={unassignedCount} counts={assigneeCounts} />

        {/* 할일 목록 */}
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-bold text-slate-800">
                {due !== "all" ? dueMeta[due].heading : status === "all" ? "전체 할일" : `${statusMeta[status].label} 할일`} <span className="text-sm font-normal text-slate-500">(총 {filtered.length}건)</span>
              </div>
              <div className="hidden sm:block text-xs text-slate-400">상태 기준으로 정렬된 할일 목록입니다. 상태 배지를 누르면 다음 단계로 넘어갑니다.</div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                value={quick}
                onChange={(e) => setQuick(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && quickAdd()}
                placeholder="빠른추가: 제목 입력 후 Enter"
                className="rounded-full border border-line bg-white px-4 py-2 text-xs outline-none focus:border-primary w-56"
              />
              <button onClick={quickAdd} className="rounded-full border border-line bg-white px-3 py-2 text-xs text-slate-700 hover:border-primary hover:text-primary">
                ✦ 빠른추가
              </button>
            </div>
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-line">
                  <th className="px-5 py-3 font-medium">할일명</th>
                  <th className="px-3 py-3 font-medium">우선순위</th>
                  <th className="px-3 py-3 font-medium">담당자</th>
                  <th className="px-3 py-3 font-medium">마감일</th>
                  <th className="px-3 py-3 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-400">표시할 할일이 없습니다.</td>
                  </tr>
                )}
                {filtered.map((t) => {
                  const overdue = isOpenTask(t) && !!t.due && t.due < today;
                  return (
                    <tr key={t.id} className="hover:bg-primary-soft/30 transition">
                      <td className="px-5 py-3">
                        <button onClick={() => setEditing(t)} className="text-left w-full">
                          <div className={`font-medium ${t.status === "cancelled" ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.title}</div>
                          <div className="mt-1 inline-block rounded-md border border-dashed border-line bg-background px-2 py-0.5 text-[11px] text-slate-500">
                            {t.project ? `▭ ${t.project}` : "▭ 프로젝트 미연결"}
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${priorityMeta[t.priority].badge}`}>{priorityMeta[t.priority].label}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{t.assignees.length ? t.assignees.join(", ") : <span className="text-slate-400">미배정</span>}</td>
                      <td className={`px-3 py-3 whitespace-nowrap ${overdue ? "text-red-600 font-semibold" : "text-slate-600"}`}>{t.due ?? "-"}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <button onClick={() => cycleStatus(t)} title="다음 상태로" className={`rounded-full border px-2.5 py-0.5 text-xs ${statusMeta[t.status].badge}`}>
                          {statusMeta[t.status].label}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      {adding && <TaskForm onSubmit={addTask} onCancel={() => setAdding(false)} />}
      {editing && (
        <TaskForm initial={editing} onSubmit={(d) => updateTask(editing.id, d)} onCancel={() => setEditing(null)} onDelete={() => removeTask(editing.id)} />
      )}
      </>)}
    </>
  );
}
