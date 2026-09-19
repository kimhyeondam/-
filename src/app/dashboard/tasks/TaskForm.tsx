"use client";

import { useState } from "react";
import { projects as initialProjects, type Task, type TaskStatus, type Priority, type Project } from "@/data/sample";
import { useServerState } from "@/lib/useServerState";
import { useMembers } from "@/lib/useMembers";
import { statusOrder, statusMeta, priorityMeta } from "./taskMeta";

export type TaskInput = Omit<Task, "id" | "createdAt">;

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

export default function TaskForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Task;
  onSubmit: (data: TaskInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const members = useMembers();
  const [projects] = useServerState<Project[]>("projects", initialProjects, "jeil.projects");
  const [form, setForm] = useState<TaskInput>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    project: initial?.project ?? "",
    assignees: initial?.assignees ?? [],
    due: initial?.due ?? "",
    status: initial?.status ?? "todo",
    priority: initial?.priority ?? "medium",
  });

  function toggleAssignee(name: string) {
    setForm((f) => ({
      ...f,
      assignees: f.assignees.includes(name) ? f.assignees.filter((n) => n !== name) : [...f.assignees, name],
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title.trim()) return;
          onSubmit({
            ...form,
            title: form.title.trim(),
            description: form.description?.trim() || undefined,
            project: form.project || undefined,
            due: form.due || undefined,
          });
        }}
        className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-slate-800">{initial ? "할일 수정" : "할일 추가"}</h2>

        <label className="block text-sm">
          <span className="text-slate-600">할일명 *</span>
          <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="예) 흄관 D600 출하 준비" />
        </label>

        <label className="block text-sm">
          <span className="text-slate-600">설명</span>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={inputCls} placeholder="세부 내용, 참고 사항" />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-slate-600">프로젝트</span>
            <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} className={inputCls}>
              <option value="">프로젝트 미연결</option>
              {projects.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">마감일</span>
            <input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">우선순위</span>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })} className={inputCls}>
              {(Object.keys(priorityMeta) as Priority[]).map((p) => (
                <option key={p} value={p}>{priorityMeta[p].label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">상태</span>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })} className={inputCls}>
              {statusOrder.map((s) => (
                <option key={s} value={s}>{statusMeta[s].label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="text-sm">
          <span className="text-slate-600">담당자</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.map((m) => {
              const on = form.assignees.includes(m.name);
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => toggleAssignee(m.name)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${on ? "bg-primary border-primary text-white" : "border-line text-slate-600 hover:border-primary"}`}
                >
                  {m.name} <span className={on ? "text-white/70" : "text-slate-400"}>· {m.team}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            {onDelete && (
              <button type="button" onClick={onDelete} className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                삭제
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
              취소
            </button>
            <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark px-5 py-2 text-sm font-semibold text-white">
              {initial ? "저장" : "등록"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
