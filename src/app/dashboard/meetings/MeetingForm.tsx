"use client";

import { useEffect, useRef, useState } from "react";
import type { Meeting, MeetingAction, Project, Customer } from "@/data/sample";
import { useMembers } from "@/lib/useMembers";

export type MeetingInput = Omit<Meeting, "id" | "createdBy">;

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

/** 미팅명 자동 생성: 미팅 2026. 9. 9. 오후 03:26 */
export function autoTitle(at: string) {
  const d = new Date(at);
  const h = d.getHours();
  return `미팅 ${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${h < 12 ? "오전" : "오후"} ${String(h % 12 === 0 ? 12 : h % 12).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function nowLocal() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

type SpeechRecognitionLike = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

export default function MeetingForm({
  initial,
  projects,
  customers,
  onSubmit,
  onCancel,
  onDelete,
  onRegisterTasks,
}: {
  initial?: Meeting;
  projects: Project[];
  customers: Customer[];
  onSubmit: (data: MeetingInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onRegisterTasks?: (actions: MeetingAction[], meeting: MeetingInput) => MeetingAction[];
}) {
  const members = useMembers();
  const [form, setForm] = useState<MeetingInput>({
    title: initial?.title ?? "",
    at: initial?.at ?? nowLocal(),
    project: initial?.project ?? "",
    customer: initial?.customer ?? "",
    attendees: initial?.attendees ?? [],
    location: initial?.location ?? "",
    notes: initial?.notes ?? "",
    summary: initial?.summary ?? "",
    decisions: initial?.decisions ?? [],
    actions: initial?.actions ?? [],
  });
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [speechOk, setSpeechOk] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSpeechOk(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => recRef.current?.stop();
  }, []);

  function toggleListen() {
    if (listening) { recRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "ko-KR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript.trim() + "\n";
        else interimText += r[0].transcript;
      }
      if (finalText) setForm((f) => ({ ...f, notes: (f.notes ? f.notes.replace(/\n?$/, "\n") : "") + finalText }));
      setInterim(interimText);
    };
    rec.onerror = (e) => { setMsg({ ok: false, text: e.error === "not-allowed" ? "마이크 사용이 허용되지 않았습니다. 브라우저 주소창의 마이크 권한을 확인하세요." : `음성 인식 오류: ${e.error}` }); };
    rec.onend = () => { setListening(false); setInterim(""); };
    recRef.current = rec;
    rec.start();
    setListening(true);
    setMsg({ ok: true, text: "듣고 있습니다. 말씀하시면 회의록에 적힙니다. 끝나면 '기록 중지'를 누르세요." });
  }

  async function summarize() {
    if (!form.notes.trim()) return setMsg({ ok: false, text: "회의록 내용을 먼저 적어 주세요." });
    setAiBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/meetings/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.title || autoTitle(form.at), notes: form.notes, attendees: form.attendees }) });
      const data = (await res.json()) as { result?: { summary: string; decisions: string[]; actions: { title: string; assignee: string; due: string }[] }; error?: string };
      if (!res.ok || !data.result) throw new Error(data.error ?? "정리에 실패했습니다.");
      setForm((f) => ({
        ...f,
        summary: data.result!.summary,
        decisions: data.result!.decisions,
        actions: [...f.actions, ...data.result!.actions.map((a) => ({ title: a.title, assignee: a.assignee || undefined, due: a.due || undefined }))],
      }));
      setMsg({ ok: true, text: "AI가 요약·결정사항·할 일을 정리했습니다. 내용을 확인하고 저장하세요." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setAiBusy(false);
    }
  }

  const setAction = (i: number, patch: Partial<MeetingAction>) => setForm((f) => ({ ...f, actions: f.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const toggleAttendee = (name: string) => setForm((f) => ({ ...f, attendees: f.attendees.includes(name) ? f.attendees.filter((n) => n !== name) : [...f.attendees, name] }));

  function registerTasks() {
    if (!onRegisterTasks) return;
    const pending = form.actions.filter((a) => a.title.trim() && !a.taskId);
    if (!pending.length) return setMsg({ ok: false, text: "등록할 할 일이 없습니다. (이미 등록된 항목은 제외)" });
    const updated = onRegisterTasks(form.actions, form);
    setForm((f) => ({ ...f, actions: updated }));
    setMsg({ ok: true, text: `할 일 ${pending.length}건을 할일관리에 등록했습니다. 저장을 눌러 미팅에도 반영하세요.` });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.at) return;
          recRef.current?.stop();
          onSubmit({
            ...form,
            title: form.title.trim() || autoTitle(form.at),
            project: form.project || undefined,
            customer: form.customer?.trim() || undefined,
            location: form.location?.trim() || undefined,
            summary: form.summary?.trim() || undefined,
            decisions: (form.decisions ?? []).map((d) => d.trim()).filter(Boolean),
            actions: form.actions.filter((a) => a.title.trim()).map((a) => ({ ...a, title: a.title.trim(), assignee: a.assignee || undefined, due: a.due || undefined })),
          });
        }}
        className="w-full max-w-3xl rounded-2xl bg-card p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-slate-800">{initial ? "미팅 기록" : "미팅 추가"}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm"><span className="text-slate-600">미팅명 <span className="text-slate-400">(비우면 일시로 자동)</span></span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder={autoTitle(form.at)} /></label>
          <label className="block text-sm"><span className="text-slate-600">미팅 일시 *</span><input type="datetime-local" value={form.at} onChange={(e) => setForm({ ...form, at: e.target.value })} className={inputCls} /></label>
          <label className="block text-sm"><span className="text-slate-600">연결 프로젝트</span>
            <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} className={inputCls}>
              <option value="">프로젝트 미연결</option>
              {projects.map((p) => <option key={p.id} value={p.name}>[{p.code}] {p.name}</option>)}
            </select>
          </label>
          <label className="block text-sm"><span className="text-slate-600">연결 고객</span>
            <input list="meeting-customer-list" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} className={inputCls} placeholder="고객명 입력 또는 선택" />
            <datalist id="meeting-customer-list">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          </label>
          <label className="block text-sm sm:col-span-2"><span className="text-slate-600">장소</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} placeholder="예) 본사 회의실, ○○지구 현장" /></label>
        </div>

        <div className="text-sm">
          <span className="text-slate-600">참석자</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.map((m) => {
              const on = form.attendees.includes(m.name);
              return <button type="button" key={m.id} onClick={() => toggleAttendee(m.name)} className={`rounded-full border px-3 py-1.5 text-xs transition ${on ? "bg-primary border-primary text-white" : "border-line text-slate-600 hover:border-primary"}`}>{m.name} <span className={on ? "text-white/70" : "text-slate-400"}>· {m.team}</span></button>;
            })}
          </div>
        </div>

        <div className="text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">회의록</span>
            <div className="flex items-center gap-2">
              {speechOk ? (
                <button type="button" onClick={toggleListen} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${listening ? "bg-red-600 text-white animate-pulse" : "border border-line bg-white text-slate-700 hover:border-primary hover:text-primary"}`}>{listening ? "■ 기록 중지" : "🎙 말로 기록"}</button>
              ) : (
                <span className="text-[11px] text-slate-400" title="크롬 브라우저에서 지원됩니다">🎙 음성 기록은 크롬에서 지원</span>
              )}
              <button type="button" onClick={summarize} disabled={aiBusy} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-primary hover:text-primary disabled:opacity-50">{aiBusy ? "정리 중..." : "✦ AI 정리"}</button>
            </div>
          </div>
          <textarea ref={notesRef} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={8} className={inputCls} placeholder="회의 내용을 적거나, 🎙 말로 기록을 눌러 말씀하세요." />
          {interim && <div className="mt-1 text-xs text-slate-400 italic">인식 중: {interim}</div>}
        </div>

        {msg && <div className={`rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>{msg.text}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm"><span className="text-slate-600">요약</span><textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={3} className={inputCls} placeholder="AI 정리를 누르면 채워집니다. 직접 적어도 됩니다." /></label>
          <label className="block text-sm"><span className="text-slate-600">결정 사항 <span className="text-slate-400">(한 줄에 하나)</span></span><textarea value={(form.decisions ?? []).join("\n")} onChange={(e) => setForm({ ...form, decisions: e.target.value.split("\n") })} rows={3} className={inputCls} /></label>
        </div>

        <div className="text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">할 일 <span className="text-slate-400">(후속 조치)</span></span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm((f) => ({ ...f, actions: [...f.actions, { title: "" }] }))} className="text-xs text-primary hover:underline">＋ 항목 추가</button>
              {onRegisterTasks && <button type="button" onClick={registerTasks} className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-white">☑ 할일관리에 등록</button>}
            </div>
          </div>
          {form.actions.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">아직 할 일이 없습니다. AI 정리를 누르거나 항목을 추가하세요.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {form.actions.map((a, i) => (
                <li key={i} className="grid grid-cols-[1fr_130px_140px_auto] gap-2 items-center">
                  <input value={a.title} onChange={(e) => setAction(i, { title: e.target.value })} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-primary" placeholder="할 일" />
                  <select value={a.assignee ?? ""} onChange={(e) => setAction(i, { assignee: e.target.value || undefined })} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-primary">
                    <option value="">담당자</option>
                    {members.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                  <input type="date" value={a.due ?? ""} onChange={(e) => setAction(i, { due: e.target.value || undefined })} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-primary" />
                  <div className="flex items-center gap-1">
                    {a.taskId ? <span className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] text-green-700">등록됨</span> : null}
                    <button type="button" onClick={() => setForm((f) => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }))} className="text-slate-400 hover:text-red-600" title="삭제">×</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>{onDelete && <button type="button" onClick={onDelete} className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">삭제</button>}</div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
            <button type="submit" className="rounded-full bg-primary hover:bg-primary-dark px-5 py-2 text-sm font-semibold text-white">{initial ? "저장" : "등록"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
