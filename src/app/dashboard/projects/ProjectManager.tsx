"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { movesForRevenue, replaceMovesByRef } from "@/lib/inventory/stock";
import { guessRegion } from "@/lib/projects/region";
import { products as initialProducts, stockMoves as initialMoves, type Product, type StockMove } from "@/data/sample";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import AssigneeFilter, { type AssigneeFilterValue } from "@/components/AssigneeFilter";
import Tabs from "@/components/Tabs";
import SortTh, { useSort, compareValues } from "@/components/SortTh";
import { useServerState } from "@/lib/useServerState";
import { useMembers } from "@/lib/useMembers";
import LoadingCard from "@/components/LoadingCard";
import { projects as initialProjects, formDocs as initialDocs, revenues as initialRevenues, type Project, type ProjectType, type ProjectStatus, type FormDoc, type Revenue, type Shipment } from "@/data/sample";
import ShipmentDialog, { type ShipmentInput } from "./ShipmentDialog";
import { nextDocNumber } from "@/lib/documents/calc";
import { todayIso } from "@/lib/format";
import { revenueFromDoc } from "@/lib/sales/revenueDoc";
import { newId } from "@/lib/ids";
import { projectTypes, projectStatuses, statusBadge, statusHint, formatWon } from "./projectMeta";
import ProjectForm, { type ProjectInput } from "./ProjectForm";
import OrderUpload, { type DraftOrder } from "./OrderUpload";
import { attachOrder, mergeProjects, orderTotals, deliveryProgress } from "@/lib/projects/orders";
import type { DeliveryOrder } from "@/data/sample";

type SortKey = "code" | "name" | "client" | "type" | "status" | "assignees" | "revenue" | "dueDate";

/** 올해 기준 새 프로젝트 번호: 26-1, 26-2 ... */
function nextCode(items: Project[]) {
  const yy = String(new Date().getFullYear()).slice(2);
  const nums = items.filter((p) => p.code.startsWith(yy + "-")).map((p) => parseInt(p.code.split("-")[1], 10) || 0);
  return `${yy}-${(nums.length ? Math.max(...nums) : 0) + 1}`;
}

export default function ProjectManager({ initialStatus = "all", openId }: { initialStatus?: "all" | ProjectStatus; openId?: string } = {}) {
  const [items, setItems, loaded, loadError] = useServerState<Project[]>("projects", initialProjects, "jeil.projects");
  const members = useMembers();
  const [docs, setDocs] = useServerState<FormDoc[]>("documents", initialDocs);
  const [revenues, setRevenues] = useServerState<Revenue[]>("revenues", initialRevenues, "jeil.revenues");
  const [products, , productsLoaded] = useServerState<Product[]>("products", initialProducts);
  const [, setMoves, movesLoaded] = useServerState<StockMove[]>("stockMoves", initialMoves);
  const [issuing, setIssuing] = useState<{ projectId: string; orderId: string } | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | ProjectType>("all");
  const [status, setStatus] = useState<"all" | ProjectStatus>(initialStatus);
  const [assignee, setAssignee] = useState<AssigneeFilterValue>("all");
  const { sort, toggle: toggleSort } = useSort<SortKey>({ key: "code", dir: -1 });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [me, setMe] = useState<{ name?: string } | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => {}); }, []);
  const [notice, setNotice] = useState<string | null>(null);
  function flash(msg: string) { setNotice(msg); setTimeout(() => setNotice(null), 5000); }
  // 대시보드에서 프로젝트를 눌러 들어온 경우 바로 엽니다
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (loaded && openId) { const p = items.find((x) => x.id === openId); if (p) setEditing(p); } }, [loaded, openId]); // eslint-disable-line react-hooks/exhaustive-deps

  const doing = items.filter((p) => p.status === "진행중").length;
  const unassigned = items.filter((p) => p.assignees.length === 0).length;
  const regionOf = (p: Project) => p.region?.trim() || guessRegion(p.client, p.name, ...(p.orders ?? []).flatMap((o) => [o.agency, o.site, o.projectName])) || "지역 미정";
  const regions = useMemo(() => { const m = new Map<string, number>(); items.forEach((p) => m.set(regionOf(p), (m.get(regionOf(p)) ?? 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]); }, [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const [region, setRegion] = useState<string>("all");
  const [groupByRegion, setGroupByRegion] = useState(false);
  const orderAmount = items.reduce((s, p) => s + orderTotals(p.orders).amount, 0); // 납품요구서 금액 합계
  const doingRevenue = items.filter((p) => p.status === "진행중").reduce((s, p) => s + p.revenue, 0);
  const totalRevenue = items.reduce((sum, p) => sum + p.revenue, 0);

  const assigneeCounts = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((m) => map.set(m.name, 0));
    items.forEach((p) => p.assignees.forEach((n) => map.set(n, (map.get(n) ?? 0) + 1)));
    return map;
  }, [items, members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items
      .filter((p) => type === "all" || p.type === type)
      .filter((p) => status === "all" || p.status === status)
      .filter((p) => (assignee === "all" ? true : assignee === "unassigned" ? p.assignees.length === 0 : p.assignees.includes(assignee)))
      .filter((p) => region === "all" || regionOf(p) === region)
      .filter((p) => !q || [p.code, p.name, p.client ?? "", p.type, p.status, p.assignees.join(" "), p.memo ?? "", regionOf(p)].join(" ").toLowerCase().includes(q));

    const val = (p: Project): string | number => {
      switch (sort.key) {
        case "code": {
          const [y, n] = p.code.split("-");
          return Number(y) * 1000 + Number(n);
        }
        case "revenue": return p.revenue;
        case "status": return projectStatuses.indexOf(p.status);
        case "assignees": return p.assignees.join(", ");
        case "client": return p.client ?? "";
        case "dueDate": return p.dueDate ?? "";
        default: return p[sort.key] ?? "";
      }
    };
    return [...list].sort((a, b) => compareValues(val(a), val(b)) * sort.dir);
  }, [items, query, type, status, assignee, sort, region]); // eslint-disable-line react-hooks/exhaustive-deps

  function add(data: ProjectInput) {
    setItems((prev) => [{ ...data, id: `p${Date.now()}`, code: nextCode(prev) }, ...prev]);
    setAdding(false);
  }
  function update(id: string, data: ProjectInput) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    setEditing(null);
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
    setEditing(null);
  }
  /** 문서 읽기 결과로 새 프로젝트 만들기 */
  function createFromOrder(input: { name: string; client?: string; type: ProjectType; order: DraftOrder }) {
    setItems((prev) => {
      const now = Date.now();
      const order: DeliveryOrder = { ...input.order, id: `do${now}`, uploadedAt: new Date(now).toISOString() };
      const base: Project = { id: `p${now}`, code: nextCode(prev), name: input.name, client: input.client, type: input.type, status: "진행중", assignees: [], progress: 0, revenue: 0, region: guessRegion(input.client, input.name, order.agency, order.site, order.projectName), orders: [] };
      return [attachOrder(base, order), ...prev];
    });
    flash(`「${input.name}」 프로젝트를 만들고 ${input.order.kind}(품목 ${input.order.items.length}건, 수량 ${input.order.totalQty})를 넣었습니다.`);
  }
  /** 문서를 기존 프로젝트에 붙이기 (같은 번호는 교체) */
  function attachToProject(projectId: string, draft: DraftOrder) {
    let name = "";
    setItems((prev) => {
      const now = Date.now();
      const order: DeliveryOrder = { ...draft, id: `do${now}`, uploadedAt: new Date(now).toISOString() };
      return prev.map((p) => { if (p.id !== projectId) return p; name = p.name; return attachOrder(p, order); });
    });
    flash(`「${name}」에 ${draft.kind}(품목 ${draft.items.length}건, 수량 ${draft.totalQty})를 합쳤습니다.`);
  }
  /** 납품요구서 품목으로 거래명세표 + 매출 발행 */
  function issueShipment(projectId: string, orderId: string, input: ShipmentInput) {
    const project = items.find((p) => p.id === projectId);
    const order = project?.orders?.find((o) => o.id === orderId);
    if (!project || !order) return;
    const lines = order.items.map((it, i) => ({ name: it.name, spec: it.spec, unit: it.unit || "EA", qty: input.qtys[i] || 0, unitPrice: input.unitPrices[i] || 0 })).filter((l) => l.qty > 0);
    const nth = (order.shipments?.length ?? 0) + 1;
    const doc: FormDoc = {
      id: newId("fd"), type: "거래명세표", number: nextDocNumber(docs, "거래명세표", input.date), date: input.date,
      customer: input.customer, project: project.name, site: input.site, items: lines, vatIncluded: input.vatIncluded,
      memo: input.memo, createdBy: me?.name, createdAt: todayIso(),
    };
    const rev: Revenue = { ...revenueFromDoc(doc), id: newId("r"), title: `${project.name} ${nth}차 납품 (${doc.number})` };
    doc.revenueId = rev.id;
    const shipment: Shipment = { id: newId("sh"), date: input.date, docId: doc.id, docNumber: doc.number, revenueId: rev.id, qtys: input.qtys, amount: rev.amount };
    setDocs((prev) => [doc, ...prev]);
    setRevenues((prev) => [rev, ...prev]);
    if (productsLoaded && movesLoaded) setMoves((prev) => replaceMovesByRef(prev, rev.id, movesForRevenue(rev, products, me?.name).moves));
    setItems((prev) => prev.map((p) => {
      if (p.id !== projectId) return p;
      const orders = (p.orders ?? []).map((o) => (o.id === orderId ? { ...o, shipments: [...(o.shipments ?? []), shipment] } : o));
      const next = { ...p, orders, revenue: (p.revenue || 0) + rev.amount, status: p.status === "진행예정" ? "진행중" as const : p.status };
      const prog = deliveryProgress(next);
      return prog === null ? next : { ...next, progress: prog };
    }));
    setIssuing(null);
    flash(`거래명세표 ${doc.number}와 매출 「${rev.title}」(${formatWon(rev.amount)})을 등록했습니다. 프로젝트 누적 매출과 진행률도 갱신됩니다.`);
  }
  /** 프로젝트 두 개를 하나로 */
  function mergeInto(fromId: string, intoId: string) {
    setItems((prev) => {
      const from = prev.find((p) => p.id === fromId);
      const into = prev.find((p) => p.id === intoId);
      if (!from || !into) return prev;
      const merged = mergeProjects(into, from);
      flash(`「${from.name}」을(를) 「${into.name}」에 합쳤습니다. 문서 ${(merged.orders ?? []).length}건, 매출 ${formatWon(merged.revenue)}.`);
      return prev.filter((p) => p.id !== fromId).map((p) => (p.id === intoId ? merged : p));
    });
    setEditing(null);
  }

  const count = <T,>(list: Project[], key: keyof Project, v: T) => list.filter((p) => p[key] === v).length;

  return (
    <>
      <PageHeader
        title="프로젝트 관리"
        description="현장(공사)별 납품 프로젝트의 진행 상태, 담당자, 매출을 관리합니다."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {loaded && <OrderUpload projects={items} userName={me?.name} onCreate={createFromOrder} onAttach={attachToProject} />}
            <Link href="/dashboard/schedule" className="rounded-full border border-line bg-white text-slate-700 text-sm px-4 py-2.5 hover:border-primary hover:text-primary transition">
              일정관리
            </Link>
            <button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">
              ＋ 프로젝트 추가
            </button>
          </div>
        }
      />
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (<>
      {notice && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="전체 프로젝트" value={`${items.length}건`} sub="현재 등록된 전체 프로젝트" icon="▭" onClick={() => { setStatus("all"); setAssignee("all"); }} />
        <StatCard label="진행중" value={`${doing}건`} sub="실행 단계에 있는 프로젝트" icon="▷" highlight={status === "진행중"} onClick={() => setStatus("진행중")} />
        <StatCard label="프로젝트 총매출" value={formatWon(totalRevenue)} sub={`진행중 ${formatWon(doingRevenue)} · ${regions.length}개 지역`} icon="₩" tone="green" onClick={() => setGroupByRegion(true)} />
        <StatCard label="납품요구 금액" value={formatWon(orderAmount)} sub="납품요구서·거래명세표 합계 (매출 전 포함)" icon="▤" tone="amber" />
      </div>

      <Card className="p-4 space-y-3">
        <div className="relative max-w-md">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="프로젝트명, 고객, 상태, 담당자로 검색" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary" />
        </div>
        <Tabs
          value={type}
          onChange={(v) => setType(v as "all" | ProjectType)}
          tabs={[{ key: "all", label: "전체", n: items.length }, ...projectTypes.map((t) => ({ key: t, label: t, n: count(items, "type", t) }))]}
        />
        <Tabs
          value={status}
          onChange={(v) => setStatus(v as "all" | ProjectStatus)}
          tabs={[{ key: "all", label: "전체", n: items.length }, ...projectStatuses.map((s) => ({ key: s, label: s, n: count(items, "status", s) }))]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">지역</span>
          <Tabs value={region} onChange={setRegion} tabs={[{ key: "all", label: "전체" }, ...regions.map(([r, n]) => ({ key: r, label: r, n }))]} />
          <label className="ml-auto inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm text-slate-700"><input type="checkbox" checked={groupByRegion} onChange={(e) => setGroupByRegion(e.target.checked)} className="accent-primary" /> 지역별로 묶어 보기</label>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5 items-start">
        <AssigneeFilter value={assignee} onChange={setAssignee} total={items.length} unassigned={unassigned} counts={assigneeCounts} showTeam />

        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-line">
                <SortTh label="프로젝트명" k="name" sort={sort} onSort={toggleSort} className="px-5" />
                <SortTh label="고객" k="client" sort={sort} onSort={toggleSort} />
                <SortTh label="유형" k="type" sort={sort} onSort={toggleSort} />
                <SortTh label="상태" k="status" sort={sort} onSort={toggleSort} />
                <SortTh label="담당자" k="assignees" sort={sort} onSort={toggleSort} />
                <SortTh label="납기" k="dueDate" sort={sort} onSort={toggleSort} />
                <th className="px-3 py-3 font-medium whitespace-nowrap">납품문서</th>
                <th className="px-3 py-3 font-medium whitespace-nowrap">진행률</th>
                <SortTh label="누적 매출" k="revenue" sort={sort} onSort={toggleSort} className="text-right pr-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">표시할 프로젝트가 없습니다.</td></tr>
              )}
              {(groupByRegion ? [...new Set(filtered.map(regionOf))] : ["__all"]).map((g) => {
                const rows = g === "__all" ? filtered : filtered.filter((p) => regionOf(p) === g);
                return (
                  <Fragment key={g}>
                    {g !== "__all" && (
                      <tr className="bg-background">
                        <td colSpan={9} className="px-5 py-2 text-sm">
                          <span className="font-bold text-slate-800">📍 {g}</span>
                          <span className="ml-2 text-xs text-slate-500">{rows.length}건 · 진행중 {rows.filter((p) => p.status === "진행중").length} · 매출 {formatWon(rows.reduce((a, p) => a + p.revenue, 0))} · 요구금액 {formatWon(rows.reduce((a, p) => a + orderTotals(p.orders).amount, 0))}</span>
                        </td>
                      </tr>
                    )}
                    {rows.map((p) => (
                <tr key={p.id} className="hover:bg-primary-soft/30 transition">
                      <td className="px-5 py-3">
                        <button onClick={() => setEditing(p)} title={p.name} className="block max-w-[20rem] truncate text-left font-medium text-slate-800 hover:text-primary">
                          <span className="text-slate-500">[{p.code}]</span> {p.name}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{p.client ?? "-"}<div className="text-[11px] text-slate-400">📍 {regionOf(p)}</div></td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{p.type}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span title={statusHint[p.status]} className={`rounded-full border px-2.5 py-0.5 text-xs ${statusBadge[p.status]}`}>{p.status}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{p.assignees.length ? p.assignees.join(", ") : "-"}</td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{p.dueDate ?? "-"}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-slate-600">
                        {p.orders?.length ? <span className="rounded-full border border-primary/20 bg-primary-soft px-2.5 py-0.5 text-primary">{p.orders.length}건 · 수량 {orderTotals(p.orders).qty.toLocaleString("ko-KR")}</span> : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${p.status === "완료" ? "bg-green-500" : p.status === "진행중" ? "bg-primary" : "bg-slate-400"}`} style={{ width: `${p.progress}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 w-8">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="px-3 pr-5 py-3 text-right text-slate-700 whitespace-nowrap tabular-nums">{p.revenue ? p.revenue.toLocaleString("ko-KR") : "-"}</td>
                    </tr>
        ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      {adding && <ProjectForm regions={regions.map(([r]) => r)} onSubmit={add} onCancel={() => setAdding(false)} />}
      {editing && <ProjectForm regions={regions.map(([r]) => r)} initial={editing} others={items.filter((p) => p.id !== editing.id)} onSubmit={(d) => update(editing.id, d)} onCancel={() => setEditing(null)} onDelete={() => remove(editing.id)} onMergeInto={(intoId) => mergeInto(editing.id, intoId)} onIssue={(orderId) => { setEditing(null); setIssuing({ projectId: editing.id, orderId }); }} />}
      {issuing && (() => { const pr = items.find((p) => p.id === issuing.projectId); const od = pr?.orders?.find((o) => o.id === issuing.orderId); return pr && od ? <ShipmentDialog project={pr} order={od} today={todayIso()} onCancel={() => setIssuing(null)} onIssue={(input) => issueShipment(issuing.projectId, issuing.orderId, input)} /> : null; })()}
      </>)}
    </>
  );
}
