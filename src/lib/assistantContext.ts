// 현담비서가 답변할 때 참고하는 "회사 현황 요약"을 만듭니다.
// 서버 저장소의 데이터를 받아 자주 쓰는 계산을 미리 해 둡니다. (서버/브라우저 어디서나 사용 가능한 순수 함수)

import { todayIso } from "@/lib/format";
import {
  tasks as sampleTasks, events as sampleEvents, projects as sampleProjects, customers as sampleCustomers, leads as sampleLeads,
  quotations as sampleQuotes, revenues as sampleRevenues, deposits as sampleDeposits, purchases as samplePurchases, purchaseTotal, isOpenTask, quoteTotal, company,
  products as sampleProducts, stockMoves as sampleMoves, productions as sampleProductions, attendance as sampleAttendance,
  type Task, type Event, type Project, type Customer, type Lead, type Quotation, type Revenue, type Deposit, type Purchase,
  type Product, type StockMove, type ProductionReport, type Attendance,
} from "@/data/sample";
import { lowStock } from "@/lib/inventory/stock";

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export interface Collections {
  tasks: Task[];
  events: Event[];
  projects: Project[];
  customers: Customer[];
  leads: Lead[];
  quotations: Quotation[];
  revenues: Revenue[];
  deposits: Deposit[];
  purchases: Purchase[];
  products: Product[];
  stockMoves: StockMove[];
  productions: ProductionReport[];
  attendance: Attendance[];
}

export const sampleCollections: Collections = {
  tasks: sampleTasks, events: sampleEvents, projects: sampleProjects, customers: sampleCustomers, leads: sampleLeads,
  quotations: sampleQuotes, revenues: sampleRevenues, deposits: sampleDeposits, purchases: samplePurchases,
  products: sampleProducts, stockMoves: sampleMoves, productions: sampleProductions, attendance: sampleAttendance,
};

export interface Snapshot {
  company: string;
  assistantName: string;
  today: string;
  tasks: { total: number; open: number; today: Task[]; overdue: Task[]; doing: Task[]; backlog: number };
  events: { today: Event[]; upcoming: Event[] };
  projects: { active: Project[]; planned: Project[]; onHold: Project[]; totalRevenue: number };
  customers: { count: number; list: { name: string; projects: number; revenue: number; outstanding: number }[] };
  leads: { total: number; byStatus: Record<string, number>; open: Lead[] };
  quotes: { total: number; byStatus: Record<string, number>; pending: { number: string; recipient: string; total: number; status: string; date: string }[] };
  revenues: { yearTotal: number; monthTotal: number; outstanding: number; unpaid: { title: string; customer?: string; amount: number; paid: number; due: number; date?: string }[] };
  deposits: { monthTotal: number; yearTotal: number; unlinked: Deposit[] };
  purchases: { monthTotal: number; yearTotal: number; payable: number; unpaid: { item: string; supplier: string; total: number; paid: number; due: number; payDue?: string }[] };
  production: { todayQty: number; todayItems: { name: string; produced: number; defect: number; unit: string }[]; monthQty: number; monthDefect: number };
  stock: { low: { name: string; spec?: string; qty: number; safety: number; unit: string }[]; list: { name: string; qty: number; unit: string }[] };
  attendance: { today: { working: number; off: number; unrecorded: number; offNames: string[] }; monthOvertime: number };
}

export function buildSnapshot(c: Collections, brand?: { name: string; assistantName: string }): Snapshot {
  const today = todayIso();
  const { tasks, events, projects, customers, leads, revenues, deposits, purchases } = c;
  const quotes = c.quotations;

  const weekEnd = addDays(today, 7);
  const paidOf = (r: Revenue) => deposits.filter((d) => d.revenueId === r.id).reduce((s, d) => s + d.amount, 0);
  const unpaid = revenues
    .map((r) => ({ title: r.title, customer: r.customer, amount: r.amount, paid: paidOf(r), due: Math.max(r.amount - paidOf(r), 0), date: r.date }))
    .filter((x) => x.due > 0);

  const countBy = <T,>(list: T[], key: (t: T) => string) => list.reduce<Record<string, number>>((acc, x) => ((acc[key(x)] = (acc[key(x)] ?? 0) + 1), acc), {});

  return {
    company: brand?.name ?? company.name,
    assistantName: brand?.assistantName ?? company.assistantName,
    today,
    tasks: {
      total: tasks.length,
      open: tasks.filter(isOpenTask).length,
      today: tasks.filter((t) => t.due === today && isOpenTask(t)),
      overdue: tasks.filter((t) => !!t.due && t.due < today && isOpenTask(t)),
      doing: tasks.filter((t) => t.status === "doing"),
      backlog: tasks.filter((t) => t.status === "backlog").length,
    },
    events: {
      today: events.filter((e) => e.date <= today && (e.endDate ?? e.date) >= today),
      upcoming: events.filter((e) => e.date > today && e.date <= weekEnd).sort((a, b) => a.date.localeCompare(b.date)),
    },
    projects: {
      active: projects.filter((p) => p.status === "진행중"),
      planned: projects.filter((p) => p.status === "진행예정"),
      onHold: projects.filter((p) => p.status === "보류"),
      totalRevenue: projects.reduce((s, p) => s + p.revenue, 0),
    },
    customers: {
      count: customers.length,
      list: customers.map((c) => {
        const ps = projects.filter((p) => p.client === c.name && p.status !== "취소");
        return { name: c.name, projects: ps.length, revenue: ps.reduce((s, p) => s + p.revenue, 0), outstanding: unpaid.filter((u) => u.customer === c.name).reduce((s, u) => s + u.due, 0) };
      }),
    },
    leads: { total: leads.length, byStatus: countBy(leads, (l) => l.status), open: leads.filter((l) => ["신규", "상담중", "견적발송"].includes(l.status)) },
    quotes: {
      total: quotes.length,
      byStatus: countBy(quotes, (q) => q.status),
      pending: quotes.filter((q) => q.status === "작성중" || q.status === "발송완료").map((q) => ({ number: q.number, recipient: q.recipient, total: quoteTotal(q), status: q.status, date: q.date })),
    },
    revenues: {
      yearTotal: revenues.filter((r) => r.date?.startsWith(today.slice(0, 4))).reduce((s, r) => s + r.amount, 0),
      monthTotal: revenues.filter((r) => r.date?.startsWith(today.slice(0, 7))).reduce((s, r) => s + r.amount, 0),
      outstanding: unpaid.reduce((s, u) => s + u.due, 0),
      unpaid,
    },
    deposits: {
      monthTotal: deposits.filter((d) => d.date.startsWith(today.slice(0, 7))).reduce((s, d) => s + d.amount, 0),
      yearTotal: deposits.filter((d) => d.date.startsWith(today.slice(0, 4))).reduce((s, d) => s + d.amount, 0),
      unlinked: deposits.filter((d) => !d.revenueId),
    },
    purchases: {
      monthTotal: purchases.filter((p) => p.date.startsWith(today.slice(0, 7))).reduce((s, p) => s + purchaseTotal(p), 0),
      yearTotal: purchases.filter((p) => p.date.startsWith(today.slice(0, 4))).reduce((s, p) => s + purchaseTotal(p), 0),
      payable: purchases.reduce((s, p) => s + Math.max(purchaseTotal(p) - p.paid, 0), 0),
      unpaid: purchases
        .map((p) => ({ item: p.item, supplier: p.supplier, total: purchaseTotal(p), paid: p.paid, due: Math.max(purchaseTotal(p) - p.paid, 0), payDue: p.payDue }))
        .filter((x) => x.due > 0),
    },
    production: (() => {
      const todayRs = c.productions.filter((r) => r.date === today);
      const monthRs = c.productions.filter((r) => r.date.startsWith(today.slice(0, 7)));
      const sum = (rs: ProductionReport[], key: "produced" | "defect") => rs.reduce((s, r) => s + r.items.reduce((a, i) => a + (i[key] ?? 0), 0), 0);
      return { todayQty: sum(todayRs, "produced"), todayItems: todayRs.flatMap((r) => r.items.map((i) => ({ name: i.name, produced: i.produced, defect: i.defect ?? 0, unit: i.unit }))), monthQty: sum(monthRs, "produced"), monthDefect: sum(monthRs, "defect") };
    })(),
    stock: (() => {
      const totals = new Map<string, number>();
      c.stockMoves.forEach((m) => totals.set(m.productId, (totals.get(m.productId) ?? 0) + m.qty));
      return {
        low: lowStock(c.products, c.stockMoves).map(({ product, qty }) => ({ name: product.name, spec: product.spec, qty, safety: product.safetyStock ?? 0, unit: product.unit })),
        list: c.products.map((p) => ({ name: p.name, qty: totals.get(p.id) ?? 0, unit: p.unit })),
      };
    })(),
    attendance: (() => {
      const working = new Set(["출근", "지각", "조퇴", "반차", "외근"]);
      const todayA = c.attendance.filter((a) => a.date === today);
      const off = todayA.filter((a) => !working.has(a.status));
      return { today: { working: todayA.length - off.length, off: off.length, unrecorded: 0, offNames: off.map((a) => `${a.name}(${a.status})`) }, monthOvertime: c.attendance.filter((a) => a.date.startsWith(today.slice(0, 7))).reduce((s, a) => s + (a.overtime ?? 0), 0) };
    })(),
  };
}
/**
 * Claude 에게 보내는 요약본: 화면·내장 비서가 쓰는 전체 Snapshot 에서 꼭 필요한 칸만 남기고 목록 길이를 자릅니다.
 * (품목 340종 전체·프로젝트의 납품요구서 품목까지 다 보내면 질문 한 번에 5만 토큰이 나갑니다)
 */
export function slimSnapshot(s: Snapshot, limit = 25) {
  const cut = <T,>(list: T[]) => list.slice(0, limit);
  const money = (n: number) => Math.round(n);
  return {
    company: s.company, assistantName: s.assistantName, today: s.today,
    tasks: {
      total: s.tasks.total, open: s.tasks.open, backlog: s.tasks.backlog,
      today: cut(s.tasks.today).map((t) => ({ title: t.title, project: t.project, assignees: t.assignees, priority: t.priority })),
      overdue: cut(s.tasks.overdue).map((t) => ({ title: t.title, project: t.project, assignees: t.assignees, due: t.due })),
      doing: cut(s.tasks.doing).map((t) => ({ title: t.title, project: t.project, assignees: t.assignees, due: t.due })),
    },
    events: {
      today: cut(s.events.today).map((e) => ({ title: e.title, time: e.time, type: e.type, location: e.location, attendees: e.attendees })),
      upcoming: cut(s.events.upcoming).map((e) => ({ title: e.title, date: e.date, time: e.time, type: e.type, location: e.location })),
    },
    projects: {
      totalRevenue: money(s.projects.totalRevenue), plannedCount: s.projects.planned.length, onHoldCount: s.projects.onHold.length,
      active: cut(s.projects.active).map((p) => ({ code: p.code, name: p.name, client: p.client, region: p.region, progress: p.progress, revenue: money(p.revenue), dueDate: p.dueDate, assignees: p.assignees, orders: p.orders?.length ?? 0 })),
      planned: cut(s.projects.planned).map((p) => ({ code: p.code, name: p.name, client: p.client, region: p.region, startDate: p.startDate })),
      onHold: cut(s.projects.onHold).map((p) => ({ code: p.code, name: p.name, client: p.client })),
    },
    customers: { count: s.customers.count, top: cut(s.customers.list.filter((c) => c.projects > 0 || c.outstanding > 0).sort((a, b) => b.revenue - a.revenue)).map((c) => ({ ...c, revenue: money(c.revenue), outstanding: money(c.outstanding) })) },
    leads: { total: s.leads.total, byStatus: s.leads.byStatus, open: cut(s.leads.open).map((l) => ({ company: l.company, contact: l.contact, status: l.status, product: l.product, assignee: l.assignee })) },
    quotes: { total: s.quotes.total, byStatus: s.quotes.byStatus, pending: cut(s.quotes.pending) },
    revenues: { yearTotal: money(s.revenues.yearTotal), monthTotal: money(s.revenues.monthTotal), outstanding: money(s.revenues.outstanding), unpaidCount: s.revenues.unpaid.length, unpaid: cut([...s.revenues.unpaid].sort((a, b) => b.due - a.due)).map((u) => ({ title: u.title, customer: u.customer, due: money(u.due), date: u.date })) },
    deposits: { monthTotal: money(s.deposits.monthTotal), yearTotal: money(s.deposits.yearTotal), unlinkedCount: s.deposits.unlinked.length, unlinked: cut(s.deposits.unlinked).map((d) => ({ date: d.date, payer: d.payer, amount: d.amount })) },
    purchases: { monthTotal: money(s.purchases.monthTotal), yearTotal: money(s.purchases.yearTotal), payable: money(s.purchases.payable), unpaidCount: s.purchases.unpaid.length, unpaid: cut([...s.purchases.unpaid].sort((a, b) => b.due - a.due)).map((u) => ({ item: u.item, supplier: u.supplier, due: money(u.due), payDue: u.payDue })) },
    production: { todayQty: s.production.todayQty, monthQty: s.production.monthQty, monthDefect: s.production.monthDefect, todayItems: cut(s.production.todayItems) },
    stock: {
      productCount: s.stock.list.length, inStockCount: s.stock.list.filter((p) => p.qty > 0).length,
      low: cut(s.stock.low), // 안전재고 이하 (안전재고를 정한 품목만)
      inStock: cut(s.stock.list.filter((p) => p.qty > 0).sort((a, b) => b.qty - a.qty)), // 재고가 있는 품목 위주
      note: "재고 0인 품목은 생략. 특정 품목 재고는 재고관리 화면에서 확인하라고 안내",
    },
    attendance: s.attendance,
  };
}
