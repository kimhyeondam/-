"use client";

import { useMemo, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { useMembers, invalidateMembers } from "@/lib/useMembers";
import WorkerManager from "./WorkerManager";
import { workers as initialWorkers, type Worker } from "@/data/sample";
import { attendance as initialAttendance, type Attendance, type AttendanceStatus } from "@/data/sample";
import { newId } from "@/lib/ids";
import { todayIso } from "@/lib/format";
import { statusMeta, tapCycle } from "./attendanceMeta";
import AttendanceForm, { type AttendanceInput } from "./AttendanceForm";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => {
    const iso = `${month}-${String(i + 1).padStart(2, "0")}`;
    const dow = new Date(y, m - 1, i + 1).getDay();
    return { iso, day: i + 1, dow };
  });
}
function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AttendanceManager({ initialMonth }: { initialMonth?: string } = {}) {
  const [items, setItems, loaded, loadError] = useServerState<Attendance[]>("attendance", initialAttendance);
  const members = useMembers();
  const [workers, setWorkers, workersLoaded] = useServerState<Worker[]>("workers", initialWorkers);
  const [showWorkers, setShowWorkers] = useState(false);
  const [overtimeMode, setOvertimeMode] = useState(false);
  const [otTarget, setOtTarget] = useState<{ memberId: string; name: string; date: string } | null>(null);
  const [editingPerson, setEditingPerson] = useState<{ id: string; name: string; team: string; joinedAt?: string; phone?: string } | null>(null);
  /** 이름을 눌러 고친 내용 저장: 현장 직원은 그 기록을, 계정 직원은 같은 id로 프로필(입사일·휴대폰·팀)을 저장 */
  function savePerson(p: { id: string; name: string; team: string; joinedAt?: string; phone?: string; active: boolean; memo?: string }) {
    if (!workersLoaded) return;
    setWorkers((prev) => {
      const isAccount = members.some((m) => m.id === p.id) && !prev.some((w) => w.id === p.id && !members.some((m) => m.id === w.id && w.name !== m.name));
      const existing = prev.find((w) => w.id === p.id);
      const rec: Worker = { ...(existing ?? { id: p.id, active: true }), name: p.name, team: p.team, joinedAt: p.joinedAt || undefined, phone: p.phone || undefined, active: isAccount ? true : p.active, memo: p.memo || undefined };
      return existing ? prev.map((w) => (w.id === p.id ? rec : w)) : [...prev, rec];
    });
    // 이름을 바꾼 출근 기록도 같이 맞춤
    setItems((prev) => prev.map((a) => (a.memberId === p.id && a.name !== p.name ? { ...a, name: p.name } : a)));
    invalidateMembers();
    setEditingPerson(null);
  }
  const [today] = useState(todayIso);
  const [month, setMonth] = useState(initialMonth ?? today.slice(0, 7));
  const [editing, setEditing] = useState<{ memberId: string; name: string; date: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  function flash(msg: string) { setNotice(msg); setTimeout(() => setNotice(null), 4000); }
  // 길게 누르기(0.5초) → 상세 창. 길게 누른 뒤 손을 떼면 짧게 누른 것으로 처리하지 않습니다.
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  function pressStart(target: { memberId: string; name: string; date: string }) {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => { longPressed.current = true; setEditing(target); }, 500);
  }
  function pressEnd() { if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; } }

  const days = useMemo(() => daysInMonth(month), [month]);
  const byKey = useMemo(() => {
    const m = new Map<string, Attendance>();
    items.forEach((a) => m.set(`${a.memberId}|${a.date}`, a));
    return m;
  }, [items]);
  const get = (memberId: string, date: string) => byKey.get(`${memberId}|${date}`);

  // 직원 목록: 직원관리 + 기록에만 있는 이름(퇴사자 등)
  const people = useMemo(() => {
    const list = members.map((m) => { const prof = workers.find((w) => w.id === m.id); return { id: m.id, name: m.name, team: prof?.team || m.team, joinedAt: prof?.joinedAt, phone: prof?.phone }; });
    workers.filter((w) => w.active && !list.some((p) => p.id === w.id || p.name === w.name)).forEach((w) => list.push({ id: w.id, name: w.name, team: w.team, joinedAt: w.joinedAt, phone: w.phone }));
    const inactive = new Set(workers.filter((w) => !w.active).map((w) => w.id));
    for (let i = list.length - 1; i >= 0; i--) if (inactive.has(list[i].id)) list.splice(i, 1);
    items.filter((a) => a.date.startsWith(month) && !list.some((p) => p.id === a.memberId)).forEach((a) => { if (!list.some((p) => p.id === a.memberId)) list.push({ id: a.memberId, name: a.name, team: "", joinedAt: undefined, phone: undefined }); });
    return list;
  }, [members, workers, items, month]);

  const todayRecords = items.filter((a) => a.date === today);
  const todayWorking = todayRecords.filter((a) => statusMeta[a.status].working).length;
  const todayOff = todayRecords.filter((a) => !statusMeta[a.status].working).length;
  const monthRecords = items.filter((a) => a.date.startsWith(month));
  const monthWorkDays = monthRecords.filter((a) => statusMeta[a.status].working).length;
  const monthOvertime = monthRecords.reduce((s, a) => s + (a.overtime ?? 0), 0);

  function setStatus(memberId: string, name: string, date: string, status: AttendanceStatus | null, extra: Partial<Attendance> = {}) {
    setItems((prev) => {
      const rest = prev.filter((a) => !(a.memberId === memberId && a.date === date));
      if (!status) return rest;
      const old = prev.find((a) => a.memberId === memberId && a.date === date);
      return [...rest, { id: old?.id ?? newId("at"), memberId, name, date, status, checkIn: old?.checkIn, checkOut: old?.checkOut, overtime: old?.overtime, memo: old?.memo, ...extra }];
    });
  }
  /** 잔업 시간 저장: 기록이 없으면 출근으로 만들고 시간을 넣습니다 */
  function setOvertime(memberId: string, name: string, date: string, hours: number) {
    const cur = get(memberId, date);
    setStatus(memberId, name, date, cur?.status ?? "출근", { overtime: hours > 0 ? hours : undefined });
    setOtTarget(null);
  }
  /** 칸을 누르면 출근 → 휴가 → 결근 → 외근 → 빈칸 순서로 바뀝니다 (잔업 입력 모드에서는 시간 입력 창) */
  function tap(memberId: string, name: string, date: string) {
    if (overtimeMode) { setOtTarget({ memberId, name, date }); return; }
    const cur = get(memberId, date)?.status ?? null;
    const idx = tapCycle.indexOf(cur);
    const next = tapCycle[(idx + 1) % tapCycle.length];
    setStatus(memberId, name, date, next);
  }
  function markAllToday() {
    const targets = people.filter((p) => !get(p.id, today));
    if (!targets.length) { flash("오늘은 이미 전원 기록되어 있습니다."); return; }
    setItems((prev) => [...prev, ...targets.map((p) => ({ id: newId("at"), memberId: p.id, name: p.name, date: today, status: "출근" as const }))]);
    flash(`오늘 ${targets.length}명을 출근으로 기록했습니다. 휴가·결근인 분은 칸을 눌러 바꿔 주세요.`);
  }
  function saveDetail(d: AttendanceInput) {
    if (!editing) return;
    setStatus(editing.memberId, editing.name, editing.date, d.status, { checkIn: d.checkIn, checkOut: d.checkOut, overtime: d.overtime, memo: d.memo });
    setEditing(null);
  }

  const monthLabel = `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;

  return (
    <>
      <PageHeader
        title="직원출근부"
        description="칸을 톡 누르면 출근 → 휴가 → 결근 → 외근 순으로 바뀌고, 길게 누르면 출퇴근 시간과 메모를 적을 수 있습니다."
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowWorkers(true)} className="rounded-full border border-line bg-white text-slate-700 text-sm font-semibold px-4 py-2.5 hover:border-primary hover:text-primary transition">＋ 직원 추가</button>
            <button onClick={markAllToday} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">오늘 전원 출근 처리</button>
          </div>
        }
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>
      {notice && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="오늘 출근" value={`${todayWorking}명`} sub={`전체 ${people.length}명 중`} icon="○" tone="green" onClick={() => setMonth(today.slice(0, 7))} />
        <StatCard label="오늘 휴가·결근" value={<span className={todayOff ? "text-red-600" : ""}>{todayOff}명</span>} sub={todayRecords.length < people.length ? `미기록 ${people.length - todayRecords.length}명` : "전원 기록됨"} icon="!" />
        <StatCard label={`${Number(month.slice(5, 7))}월 출근 연일수`} value={`${monthWorkDays}일`} sub="직원별 출근일 합계" icon="▤" />
        <StatCard label={`${Number(month.slice(5, 7))}월 연장근무`} value={`${monthOvertime}시간`} sub="기록된 연장 시간 합계" icon="◷" />
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-full border border-line overflow-hidden">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="px-3 py-1.5 text-slate-600 hover:bg-primary-soft">‹</button>
          <button onClick={() => setMonth(today.slice(0, 7))} className="px-3 py-1.5 text-sm font-semibold text-slate-700 hover:text-primary border-x border-line">이번 달</button>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="px-3 py-1.5 text-slate-600 hover:bg-primary-soft">›</button>
        </div>
        <span className="font-bold text-slate-800">{monthLabel}</span>
        <button onClick={() => setOvertimeMode((v) => !v)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${overtimeMode ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-line text-slate-700 hover:border-amber-400"}`}>{overtimeMode ? "잔업 입력 중 · 끝내기" : "잔업 시간 입력"}</button>
        <div className="ml-auto flex flex-wrap gap-1.5 text-[11px]">
          {(Object.keys(statusMeta) as AttendanceStatus[]).map((s) => <span key={s} className={`rounded-full border px-2 py-0.5 ${statusMeta[s].badge}`}>{statusMeta[s].short} {s}</span>)}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr className="text-slate-500 border-b border-line">
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium min-w-[6.5rem] border-r border-line">직원</th>
              {days.map((d) => (
                <th key={d.iso} className={`px-0 py-1.5 font-medium w-8 min-w-8 text-center ${d.iso === today ? "bg-primary-soft text-primary" : d.dow === 0 ? "text-red-500" : d.dow === 6 ? "text-blue-500" : ""}`}>
                  <div>{d.day}</div>
                  <div className="text-[10px] font-normal">{DAYS[d.dow]}</div>
                </th>
              ))}
              <th className="px-2 py-2 font-medium text-center whitespace-nowrap border-l border-line">출근</th>
              <th className="px-2 py-2 font-medium text-center whitespace-nowrap">휴가</th>
              <th className="px-2 py-2 font-medium text-center whitespace-nowrap">결근</th>
              <th className="px-2 py-2 font-medium text-center whitespace-nowrap">연장</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {people.length === 0 && <tr><td colSpan={days.length + 5} className="px-5 py-12 text-center text-slate-400">직원이 없습니다. 위 「직원 추가」로 현장 직원을 넣거나, 관리자 메뉴 「직원관리」에서 계정을 만드세요.</td></tr>}
            {people.map((p) => {
              const recs = days.map((d) => get(p.id, d.iso));
              const cnt = (f: (a: Attendance) => boolean) => recs.filter((a) => a && f(a)).length;
              return (
                <tr key={p.id} className="hover:bg-primary-soft/20">
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5 border-r border-line whitespace-nowrap">
                    <button onClick={() => setEditingPerson(p)} title="누르면 입사일·팀·연락처를 고칠 수 있습니다" className="text-left font-medium text-slate-800 text-sm hover:text-primary">{p.name} <span className="text-[10px] text-slate-300">✎</span></button>
                    <div className="text-[10px] text-slate-400">{[p.team, p.joinedAt ? `입사 ${p.joinedAt}` : ""].filter(Boolean).join(" · ")}</div>
                  </td>
                  {days.map((d, i) => {
                    const a = recs[i];
                    const weekend = d.dow === 0 || d.dow === 6;
                    return (
                      <td key={d.iso} className={`p-0.5 text-center ${weekend && !a ? "bg-slate-50" : ""}`}>
                        <button
                          onClick={() => { if (longPressed.current) { longPressed.current = false; return; } tap(p.id, p.name, d.iso); }}
                          onPointerDown={() => pressStart({ memberId: p.id, name: p.name, date: d.iso })}
                          onPointerUp={pressEnd}
                          onPointerLeave={pressEnd}
                          onContextMenu={(e) => { e.preventDefault(); pressEnd(); setEditing({ memberId: p.id, name: p.name, date: d.iso }); }}
                          title={a ? `${a.status}${a.checkIn ? ` ${a.checkIn}~${a.checkOut ?? ""}` : ""}${a.memo ? ` · ${a.memo}` : ""} (길게 누르면 상세)` : "누르면 출근으로 기록"}
                          style={{ touchAction: "manipulation", WebkitTouchCallout: "none", userSelect: "none" }}
                          className={`relative h-7 w-7 rounded-md text-xs font-semibold transition ${overtimeMode ? "ring-1 ring-amber-300" : ""} ${a ? statusMeta[a.status].cell : "text-slate-200 hover:bg-primary-soft hover:text-primary"} ${d.iso === today ? "ring-1 ring-primary/40" : ""}`}
                        >
                          {a ? statusMeta[a.status].short : "·"}
                          {a?.overtime ? <span className="absolute -top-1 -right-1 rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-3 text-white">+{a.overtime}</span> : null}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-center tabular-nums text-green-700 font-semibold border-l border-line">{cnt((a) => statusMeta[a.status].working)}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums text-blue-700">{cnt((a) => a.status === "휴가" || a.status === "병가")}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums text-red-600">{cnt((a) => a.status === "결근")}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums text-slate-700">{recs.reduce((s, a) => s + (a?.overtime ?? 0), 0) || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-400">잔업(연장근무)은 「잔업 시간 입력」을 켠 뒤 칸을 누르면 시간을 넣을 수 있고, 칸 모서리에 +2 처럼 표시됩니다. 휴대폰에서는 표를 옆으로 밀어 보세요. 칸을 길게 누르면(PC에서는 오른쪽 클릭도 가능) 출퇴근 시간·연장근무·메모를 적는 창이 열립니다.</p>
      </>)}

      {otTarget && <OvertimeDialog name={otTarget.name} date={otTarget.date} current={get(otTarget.memberId, otTarget.date)?.overtime ?? 0} onSubmit={(h) => setOvertime(otTarget.memberId, otTarget.name, otTarget.date, h)} onCancel={() => setOtTarget(null)} />}
      {editingPerson && <PersonForm person={editingPerson} isAccount={members.some((m) => m.id === editingPerson.id) && !workers.some((w) => w.id === editingPerson.id && w.name === editingPerson.name && !members.some((m) => m.id === w.id))} worker={workers.find((w) => w.id === editingPerson.id)} onSubmit={savePerson} onCancel={() => setEditingPerson(null)} />}
      {showWorkers && <WorkerManager workers={workers} loaded={workersLoaded} accountNames={members.filter((m) => !workers.some((w) => w.id === m.id)).map((m) => m.name)} onChange={(fn) => { setWorkers(fn); invalidateMembers(); }} onClose={() => setShowWorkers(false)} />}
      {editing && <AttendanceForm name={editing.name} date={editing.date} initial={get(editing.memberId, editing.date)} onSubmit={saveDetail} onClear={() => { setStatus(editing.memberId, editing.name, editing.date, null); setEditing(null); }} onCancel={() => setEditing(null)} />}
    </>
  );
}

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";
/** 직원 정보 수정 창 (이름을 눌렀을 때) */
function PersonForm({ person, isAccount, worker, onSubmit, onCancel }: { person: { id: string; name: string; team: string; joinedAt?: string; phone?: string }; isAccount: boolean; worker?: Worker; onSubmit: (p: { id: string; name: string; team: string; joinedAt?: string; phone?: string; active: boolean; memo?: string }) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: person.name, team: person.team, joinedAt: person.joinedAt ?? "", phone: person.phone ?? "", active: worker?.active ?? true, memo: worker?.memo ?? "" });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return; onSubmit({ id: person.id, name: form.name.trim(), team: form.team.trim(), joinedAt: form.joinedAt, phone: form.phone.trim(), active: form.active, memo: form.memo.trim() }); }} className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-line shadow-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">직원 정보 수정</h2>
        {isAccount && <p className="text-xs text-slate-500">로그인 계정이 있는 직원입니다. 이름·팀은 여기서 고쳐도 출근부에서만 바뀌고, 계정 이름은 관리자 메뉴 「직원관리」에서 바꿉니다.</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm col-span-2"><span className="text-slate-600">이름 *</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required disabled={isAccount} /></label>
          <label className="block text-sm"><span className="text-slate-600">팀</span><input value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} className={inputCls} placeholder="생산1팀" /></label>
          <label className="block text-sm"><span className="text-slate-600">입사일</span><input type="date" value={form.joinedAt} onChange={(e) => setForm({ ...form, joinedAt: e.target.value })} className={inputCls} /></label>
          <label className="block text-sm col-span-2"><span className="text-slate-600">휴대폰</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} placeholder="010-" /></label>
          <label className="block text-sm col-span-2"><span className="text-slate-600">메모</span><input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className={inputCls} placeholder="예) 지게차 면허, 주 5일" /></label>
          {!isAccount && <label className="flex items-center gap-2 text-sm col-span-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-primary" /> 재직 중 (끄면 출근부에서 빠지고 기록은 남습니다)</label>}
        </div>
        <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">취소</button><button type="submit" className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2">저장</button></div>
      </form>
    </div>
  );
}

/** 잔업 시간 입력 (0.5시간 단위) */
function OvertimeDialog({ name, date, current, onSubmit, onCancel }: { name: string; date: string; current: number; onSubmit: (hours: number) => void; onCancel: () => void }) {
  const [hours, setHours] = useState(current);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); onSubmit(Math.max(0, Number(hours) || 0)); }} className="w-full max-w-xs rounded-2xl bg-card border border-line shadow-2xl p-5 space-y-4">
        <div><h2 className="text-lg font-bold text-slate-800">{name} 잔업</h2><div className="text-sm text-slate-500">{date}</div></div>
        <div className="flex flex-wrap gap-1.5">{[1, 2, 3, 4].map((h) => <button key={h} type="button" onClick={() => setHours(h)} className={`rounded-full border px-3 py-1.5 text-sm ${hours === h ? "bg-amber-500 border-amber-500 text-white font-semibold" : "border-line bg-white text-slate-700 hover:border-amber-400"}`}>{h}시간</button>)}<button type="button" onClick={() => setHours(0)} className={`rounded-full border px-3 py-1.5 text-sm ${hours === 0 ? "bg-slate-600 border-slate-600 text-white" : "border-line bg-white text-slate-500"}`}>없음</button></div>
        <label className="block text-sm"><span className="text-slate-600">직접 입력 (시간)</span><input type="number" min={0} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} className={inputCls} autoFocus /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">취소</button><button type="submit" className="rounded-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2">저장</button></div>
      </form>
    </div>
  );
}
