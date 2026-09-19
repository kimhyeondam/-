import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import Briefing from "@/components/Briefing";
import SmartInbox from "@/components/inbox/SmartInbox";
import { isOpenTask, type Task, type Event } from "@/data/sample";
import { brandOf, loadCompany } from "@/lib/branding";
import { todayIso } from "@/lib/format";
import { loadCollections } from "@/lib/loadCollections";

const priorityLabel: Record<Task["priority"], { text: string; cls: string }> = {
  high: { text: "높음", cls: "bg-red-50 text-red-600" },
  medium: { text: "보통", cls: "bg-amber-50 text-amber-700" },
  low: { text: "낮음", cls: "bg-slate-100 text-slate-500" },
};

const statusLabel: Record<Task["status"], { text: string; cls: string }> = {
  backlog: { text: "백로그", cls: "bg-slate-100 text-slate-500" },
  todo: { text: "할 일", cls: "bg-amber-50 text-amber-700" },
  doing: { text: "진행 중", cls: "bg-primary-soft text-primary" },
  done: { text: "완료", cls: "bg-green-50 text-green-700" },
  cancelled: { text: "취소", cls: "bg-slate-100 text-slate-400" },
};

const eventColor: Record<Event["type"], string> = {
  납품: "bg-primary",
  회의: "bg-purple-500",
  생산: "bg-green-500",
  점검: "bg-amber-500",
  기타: "bg-slate-400",
};

function formatKoreanDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

function formatShortDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between px-6 py-4 border-b border-line">
        <h2 className="font-bold text-slate-800">{title}</h2>
        {href && (
          <Link href={href} className="text-xs text-primary hover:underline">
            전체 보기 →
          </Link>
        )}
      </div>
      <div className="p-6">{children}</div>
    </Card>
  );
}

export default async function DashboardPage() {
  const company = brandOf(await loadCompany());
  const { tasks, projects, events } = await loadCollections();
  const today = todayIso();
  const todayTasks = tasks.filter((t) => t.due === today && isOpenTask(t));
  const overdue = tasks.filter((t) => !!t.due && t.due < today && isOpenTask(t));
  const activeProjects = projects.filter((p) => p.status === "진행중");
  const upcoming = events.filter((e) => e.date >= today).slice(0, 5);
  const openTasks = tasks
    .filter((t) => isOpenTask(t) && t.due)
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));

  return (
    <>
      <PageHeader
        title={`안녕하세요, ${company.ownerName} 👋`}
        description={`${formatKoreanDate(today)} · 오늘 처리할 일 ${todayTasks.length}건, 지연된 일 ${overdue.length}건이 있습니다.`}
      />
      <SmartInbox />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard label="오늘 할일" value={`${todayTasks.length}건`} sub="오늘 마감 · 미완료" icon="☑" href="/dashboard/tasks?due=today" />
        <StatCard label="지연된 할일" value={<span className="text-red-600">{overdue.length}건</span>} sub="마감일이 지난 일" icon="!" highlight={overdue.length > 0} href="/dashboard/tasks?due=overdue" />
        <StatCard label="진행 중 프로젝트" value={`${activeProjects.length}건`} sub={`전체 ${projects.length}건 중`} icon="▭" href="/dashboard/projects?status=진행중" />
        <StatCard label="다가오는 일정" value={`${upcoming.length}건`} sub="오늘부터 순서대로" icon="▤" href="/dashboard/schedule?view=week" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <Section title="할일 현황" href="/dashboard/tasks">
            <ul className="divide-y divide-line">
              {openTasks.length === 0 && <li className="py-6 text-center text-sm text-slate-400">미완료 할일이 없습니다.</li>}
              {openTasks.map((t) => {
                const isOverdue = !!t.due && t.due < today;
                return (
                  <li key={t.id}>
                  <Link href={`/dashboard/tasks?open=${t.id}`} className="flex items-center gap-2 sm:gap-4 py-3 -mx-2 px-2 rounded-xl hover:bg-primary-soft/40 transition">
                    <span className={`h-4 w-4 rounded border ${t.status === "doing" ? "border-primary bg-primary-soft" : "border-slate-300"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{t.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {t.project ?? "프로젝트 미연결"} · {t.assignees.length ? t.assignees.join(", ") : "미배정"}
                      </div>
                    </div>
                    <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${priorityLabel[t.priority].cls}`}>{priorityLabel[t.priority].text}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${statusLabel[t.status].cls}`}>{statusLabel[t.status].text}</span>
                    <span className={`text-xs w-14 sm:w-16 shrink-0 text-right ${isOverdue ? "text-red-600 font-semibold" : "text-slate-500"}`}>{t.due ? formatShortDate(t.due) : "-"}</span>
                  </Link>
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>

        <div className="space-y-5">
          <Section title={`${company.assistantName} 브리핑`}>
            <Briefing />
          </Section>

          <Section title="다가오는 일정" href="/dashboard/schedule">
            <ul className="space-y-3">
              {upcoming.length === 0 && <li className="py-4 text-center text-sm text-slate-400">다가오는 일정이 없습니다.</li>}
              {upcoming.map((e) => (
                <li key={e.id}>
                  <Link href={`/dashboard/schedule?open=${e.id}`} className="flex items-start gap-3 -mx-2 px-2 py-1 rounded-xl hover:bg-primary-soft/40 transition">
                    <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${eventColor[e.type]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-800 truncate">{e.title}</div>
                      <div className="text-xs text-slate-400">
                        {formatShortDate(e.date)} {e.time ?? "종일"} · {e.type}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>

      <Section title="프로젝트 진행 현황" href="/dashboard/projects">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {projects.filter((p) => p.status !== "취소").map((p) => (
            <Link key={p.id} href={`/dashboard/projects?open=${p.id}`} className="block -mx-2 px-2 py-1 rounded-xl hover:bg-primary-soft/40 transition">
              <div className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-slate-800">{p.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{p.client ?? "내부"}</span>
                </div>
                <span className="text-xs text-slate-500 shrink-0">{p.dueDate ? `납기 ${formatShortDate(p.dueDate)}` : "납기 미정"}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${p.status === "완료" ? "bg-green-500" : p.status === "진행중" ? "bg-primary" : "bg-slate-400"}`}
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-700 w-10 text-right">{p.progress}%</span>
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
