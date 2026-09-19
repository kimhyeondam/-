"use client";

import { todayIso } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import AssigneeFilter, { type AssigneeFilterValue } from "@/components/AssigneeFilter";
import { useServerState } from "@/lib/useServerState";
import { useMembers } from "@/lib/useMembers";
import LoadingCard from "@/components/LoadingCard";
import { events as initialEvents, type Event } from "@/data/sample";
import { eventMeta } from "./eventMeta";
import EventForm, { type EventInput } from "./EventForm";
import { WEEKDAYS, addDays, addMonths, monthGrid, weekDays, sameMonth, formatMonth, formatDateLong, formatDateShort, startOfWeek } from "./dateUtils";

type View = "month" | "week" | "day";

/** 일정이 특정 날짜에 걸쳐 있는지 (여러 날 일정 포함) */
function onDate(e: Event, iso: string) {
  return e.date <= iso && (e.endDate ?? e.date) >= iso;
}

function inRange(e: Event, from: string, to: string) {
  return e.date <= to && (e.endDate ?? e.date) >= from;
}

export default function ScheduleManager({ initialView, openId }: { initialView?: View; openId?: string } = {}) {
  const [items, setItems, loaded, loadError] = useServerState<Event[]>("events", initialEvents, "jeil.events");
  const [today] = useState(todayIso);
  const members = useMembers();
  const [view, setView] = useState<View>(initialView ?? "month");
  const [cursor, setCursor] = useState(today); // 현재 보고 있는 기준 날짜
  const [assignee, setAssignee] = useState<AssigneeFilterValue>("all");
  const [adding, setAdding] = useState<string | null>(null); // 등록 창 (기본 날짜)
  const [editing, setEditing] = useState<Event | null>(null);
  const [notice, setNotice] = useState(false);
  // 대시보드에서 일정을 눌러 들어온 경우: 그 날짜로 이동해 바로 엽니다
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (loaded && openId) { const e = items.find((x) => x.id === openId); if (e) { setCursor(e.date); setEditing(e); } } }, [loaded, openId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 현재 보기 범위
  const range = useMemo(() => {
    if (view === "day") return { from: cursor, to: cursor };
    if (view === "week") {
      const s = startOfWeek(cursor);
      return { from: s, to: addDays(s, 6) };
    }
    const first = cursor.slice(0, 7) + "-01";
    return { from: first, to: addDays(addMonths(first, 1), -1) };
  }, [view, cursor]);

  const inView = useMemo(() => items.filter((e) => inRange(e, range.from, range.to)), [items, range]);

  const filtered = useMemo(
    () =>
      inView.filter((e) => {
        if (assignee === "all") return true;
        if (assignee === "unassigned") return e.attendees.length === 0;
        return e.attendees.includes(assignee);
      }),
    [inView, assignee],
  );

  const attendeeCounts = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((m) => map.set(m.name, 0));
    inView.forEach((e) => e.attendees.forEach((n) => map.set(n, (map.get(n) ?? 0) + 1)));
    return map;
  }, [inView, members]);
  const unassignedCount = inView.filter((e) => e.attendees.length === 0).length;

  // 이동
  function move(n: number) {
    if (view === "month") setCursor(addMonths(cursor, n));
    else if (view === "week") setCursor(addDays(cursor, 7 * n));
    else setCursor(addDays(cursor, n));
  }

  // 키보드 단축키: M 월 / W 주 / D 일 / ← → 이동
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || adding !== null || editing) return;
      const k = ev.key.toLowerCase();
      if (k === "m") setView("month");
      else if (k === "w") setView("week");
      else if (k === "d") setView("day");
      else if (ev.key === "ArrowLeft") move(-1);
      else if (ev.key === "ArrowRight") move(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cursor, adding, editing]);

  function addEvent(data: EventInput) {
    setItems((prev) => [...prev, { ...data, id: `e${Date.now()}` }]);
    setAdding(null);
  }
  function updateEvent(id: string, data: EventInput) {
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));
    setEditing(null);
  }
  function removeEvent(id: string) {
    setItems((prev) => prev.filter((e) => e.id !== id));
    setEditing(null);
  }

  const eventsOf = (iso: string) => filtered.filter((e) => onDate(e, iso)).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

  const rangeLabel = view === "month" ? formatMonth(cursor) : view === "week" ? `${formatDateShort(range.from)} ~ ${formatDateShort(range.to)}` : formatDateLong(cursor);

  return (
    <>
      <PageHeader
        title="일정관리"
        description="납품·생산·회의·점검 일정을 달력으로 관리합니다."
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setNotice((v) => !v)} className="rounded-full border border-line bg-white text-slate-700 text-sm px-4 py-2.5 hover:border-primary hover:text-primary transition">
              🔔 알림설정
            </button>
            <button onClick={() => setAdding(cursor)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">
              ＋ 일정 등록
            </button>
          </div>
        }
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>
      {notice && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          알림(카카오톡·이메일)은 AI 비서 단계에서 연결할 예정입니다. 지금은 화면에서만 일정을 관리합니다.
        </div>
      )}

      {/* 이동/보기 도구 */}
      <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center rounded-full border border-line bg-white">
          <button onClick={() => move(-1)} className="px-3 py-1.5 text-slate-500 hover:text-primary" aria-label="이전">‹</button>
          <button onClick={() => setCursor(today)} className="px-3 py-1.5 text-sm font-semibold text-slate-700 hover:text-primary border-x border-line">오늘</button>
          <button onClick={() => move(1)} className="px-3 py-1.5 text-slate-500 hover:text-primary" aria-label="다음">›</button>
        </div>
        <span className="rounded-full bg-primary-soft text-primary text-sm font-semibold px-4 py-1.5">▤ {rangeLabel}</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center rounded-full border border-line bg-white p-1">
            {(["month", "week", "day"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-full px-3 py-1 text-sm ${view === v ? "bg-primary text-white font-semibold" : "text-slate-600 hover:text-primary"}`}>
                {v === "month" ? "월" : v === "week" ? "주" : "일"}
              </button>
            ))}
          </div>
          <span className="hidden lg:inline rounded-full border border-line bg-white px-3 py-1.5 text-[11px] text-slate-400">
            <kbd>M</kbd> 월 · <kbd>W</kbd> 주 · <kbd>D</kbd> 일 · <kbd>←</kbd><kbd>→</kbd> 이동
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="현재 범위 일정" value={`${inView.length}건`} sub="선택한 월/주/일 범위에 포함된 일정" icon="▤" />
        <StatCard label="필터 적용" value={`${filtered.length}건`} sub="현재 담당자 필터 기준 표시되는 일정" icon="▤" highlight />
        <StatCard label="참여 직원" value={`${members.length}명`} sub="필터에서 선택 가능한 팀원 수" icon="☺" />
        <StatCard label="미배정" value={`${unassignedCount}건`} sub="참석자가 연결되지 않은 일정" icon="☺" tone="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5 items-start">
        <AssigneeFilter value={assignee} onChange={setAssignee} total={inView.length} unassigned={unassignedCount} counts={attendeeCounts} showTeam />

        {view === "month" && (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7 border-b border-line bg-background text-center text-xs text-slate-500">
              {WEEKDAYS.map((d, i) => (
                <div key={d} className={`py-2 ${i === 5 ? "text-sky-600" : i === 6 ? "text-red-500" : ""}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthGrid(cursor).map((iso, i) => {
                const cur = sameMonth(iso, cursor);
                const dow = i % 7;
                const isToday = iso === today;
                const evs = eventsOf(iso);
                return (
                  <div
                    key={iso}
                    onClick={() => setAdding(iso)}
                    className={`min-h-[92px] border-b border-r border-line p-1.5 cursor-pointer hover:bg-primary-soft/30 transition ${cur ? "" : "bg-background/60"}`}
                  >
                    <div className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday ? "bg-primary text-white font-bold" : !cur ? "text-slate-300" : dow === 5 ? "text-sky-600" : dow === 6 ? "text-red-500" : "text-slate-700"
                    }`}>
                      {parseInt(iso.slice(8), 10)}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {evs.slice(0, 3).map((e) => (
                        <button
                          key={e.id}
                          onClick={(ev) => { ev.stopPropagation(); setEditing(e); }}
                          className={`block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] ${eventMeta[e.type].chip}`}
                          title={e.title}
                        >
                          {e.time ? `${e.time} ` : ""}{e.title}
                        </button>
                      ))}
                      {evs.length > 3 && <div className="text-[11px] text-slate-400 pl-1">+{evs.length - 3}건 더</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {view === "week" && (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7 divide-x divide-line">
              {weekDays(cursor).map((iso, i) => {
                const evs = eventsOf(iso);
                const isToday = iso === today;
                return (
                  <div key={iso} className="min-h-[360px] flex flex-col">
                    <button onClick={() => { setCursor(iso); setView("day"); }} className={`border-b border-line py-2 text-center text-xs ${i === 5 ? "text-sky-600" : i === 6 ? "text-red-500" : "text-slate-500"}`}>
                      {WEEKDAYS[i]}
                      <div className={`mx-auto mt-1 h-7 w-7 flex items-center justify-center rounded-full text-sm ${isToday ? "bg-primary text-white font-bold" : "text-slate-800"}`}>{parseInt(iso.slice(8), 10)}</div>
                    </button>
                    <div onClick={() => setAdding(iso)} className="flex-1 p-1.5 space-y-1 cursor-pointer hover:bg-primary-soft/20">
                      {evs.map((e) => (
                        <button key={e.id} onClick={(ev) => { ev.stopPropagation(); setEditing(e); }} className={`block w-full rounded-lg border px-2 py-1.5 text-left text-xs ${eventMeta[e.type].chip}`}>
                          <div className="font-semibold truncate">{e.title}</div>
                          <div className="opacity-70">{e.time ? `${e.time}${e.endTime ? `~${e.endTime}` : ""}` : "종일"}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {view === "day" && (
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">{formatDateLong(cursor)}</h2>
              <button onClick={() => setAdding(cursor)} className="text-xs text-primary hover:underline">＋ 이 날짜에 일정 등록</button>
            </div>
            <ul className="mt-4 divide-y divide-line">
              {eventsOf(cursor).length === 0 && <li className="py-10 text-center text-sm text-slate-400">이 날짜에 일정이 없습니다.</li>}
              {eventsOf(cursor).map((e) => (
                <li key={e.id}>
                  <button onClick={() => setEditing(e)} className="flex w-full items-start gap-4 py-3 text-left hover:bg-primary-soft/20 rounded-lg px-2">
                    <div className="w-24 shrink-0 text-sm text-slate-500">{e.time ? `${e.time}${e.endTime ? ` ~ ${e.endTime}` : ""}` : "종일"}</div>
                    <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${eventMeta[e.type].dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800">{e.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {e.type}{e.location ? ` · ${e.location}` : ""} · {e.attendees.length ? e.attendees.join(", ") : "미배정"}
                        {e.endDate ? ` · ${formatDateShort(e.date)} ~ ${formatDateShort(e.endDate)}` : ""}
                      </div>
                      {e.memo && <div className="text-xs text-slate-500 mt-1">{e.memo}</div>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {adding !== null && <EventForm defaultDate={adding} onSubmit={addEvent} onCancel={() => setAdding(null)} />}
      {editing && <EventForm initial={editing} defaultDate={editing.date} onSubmit={(d) => updateEvent(editing.id, d)} onCancel={() => setEditing(null)} onDelete={() => removeEvent(editing.id)} />}
      </>)}
    </>
  );
}
