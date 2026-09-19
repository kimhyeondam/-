"use client";

import { useState } from "react";
import type { Project, ProjectType, ProjectStatus, DeliveryOrder } from "@/data/sample";
import { orderTotals, deliveredQtys, remainingQtys } from "@/lib/projects/orders";
import { useMembers } from "@/lib/useMembers";
import { projectTypes, projectStatuses } from "./projectMeta";

export type ProjectInput = Omit<Project, "id" | "code">;

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

export default function ProjectForm({
  initial,
  others = [],
  onSubmit,
  onCancel,
  onDelete,
  onMergeInto,
  onIssue, regions }: { regions?: string[];
  initial?: Project;
  others?: Project[];
  onSubmit: (data: ProjectInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onMergeInto?: (intoId: string) => void;
  onIssue?: (orderId: string) => void;
}) {
  const [mergeTarget, setMergeTarget] = useState("");
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const members = useMembers();
  const [form, setForm] = useState<ProjectInput>({
    name: initial?.name ?? "",
    client: initial?.client ?? "",
    type: initial?.type ?? "민간",
    status: initial?.status ?? "진행예정",
    assignees: initial?.assignees ?? [],
    startDate: initial?.startDate ?? "",
    dueDate: initial?.dueDate ?? "",
    progress: initial?.progress ?? 0,
    revenue: initial?.revenue ?? 0,
    memo: initial?.memo ?? "",
    region: initial?.region ?? "",
    orders: initial?.orders ?? [],
  });
  const orders = form.orders ?? [];
  const totals = orderTotals(orders);
  function removeOrder(id: string) {
    if (!confirm("이 문서를 프로젝트에서 뺄까요? 품목 내역도 함께 지워집니다.")) return;
    setForm((f) => ({ ...f, orders: (f.orders ?? []).filter((o) => o.id !== id) }));
  }

  function toggle(name: string) {
    setForm((f) => ({ ...f, assignees: f.assignees.includes(name) ? f.assignees.filter((n) => n !== name) : [...f.assignees, name] }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return;
          onSubmit({
            ...form,
            name: form.name.trim(),
            client: form.type === "내부" ? undefined : form.client?.trim() || undefined,
            region: form.region?.trim() || undefined,
            startDate: form.startDate || undefined,
            dueDate: form.dueDate || undefined,
            progress: Math.max(0, Math.min(100, Number(form.progress) || 0)),
            revenue: Math.max(0, Number(form.revenue) || 0),
            memo: form.memo?.trim() || undefined,
            orders: form.orders?.length ? form.orders : undefined,
          });
        }}
        className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold text-slate-800">
          {initial ? `프로젝트 수정 [${initial.code}]` : "프로젝트 추가"}
        </h2>

        <label className="block text-sm">
          <span className="text-slate-600">프로젝트명 *</span>
          <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="예) ○○지구 우수관로 흄관 납품" />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-slate-600">유형</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ProjectType })} className={inputCls}>
              {projectTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">고객(거래처)</span>
            <input value={form.client} disabled={form.type === "내부"} onChange={(e) => setForm({ ...form, client: e.target.value })} className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`} placeholder={form.type === "내부" ? "내부 프로젝트는 고객 없음" : "예) ○○건설, □□시청"} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">지역 <span className="text-xs text-slate-400">(시·군·구)</span></span>
            <input list="project-regions" value={form.region ?? ""} onChange={(e) => setForm({ ...form, region: e.target.value })} className={inputCls} placeholder="예) 고흥군, 광주 북구" />
            <datalist id="project-regions">{(regions ?? []).map((r) => <option key={r} value={r} />)}</datalist>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">상태</span>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })} className={inputCls}>
              {projectStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">진행률 (%)</span>
            <input type="number" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">시작일</span>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">납기(완료 목표일)</span>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputCls} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">누적 매출 (원)</span>
            <input type="number" min={0} step={10000} value={form.revenue} onChange={(e) => setForm({ ...form, revenue: Number(e.target.value) })} className={inputCls} />
            <span className="mt-1 block text-xs text-slate-400">{form.revenue ? `${Number(form.revenue).toLocaleString("ko-KR")}원` : "매출이 없으면 0"}</span>
          </label>
        </div>

        <div className="text-sm">
          <span className="text-slate-600">담당자</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.map((m) => {
              const on = form.assignees.includes(m.name);
              return (
                <button type="button" key={m.id} onClick={() => toggle(m.name)} className={`rounded-full border px-3 py-1.5 text-xs transition ${on ? "bg-primary border-primary text-white" : "border-line text-slate-600 hover:border-primary"}`}>
                  {m.name} <span className={on ? "text-white/70" : "text-slate-400"}>· {m.team}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-slate-600">메모</span>
          <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} rows={3} className={inputCls} placeholder="제품 규격·수량, 특이 사항" />
        </label>

        {initial && (
          <div className="text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">납품 문서 <span className="text-slate-400">(분할납품요구서·거래명세표)</span></span>
              {orders.length > 0 && <span className="text-xs text-slate-500">{totals.count}건 · 수량 합계 {totals.qty.toLocaleString("ko-KR")}{totals.amount ? ` · ${totals.amount.toLocaleString("ko-KR")}원` : ""}</span>}
            </div>
            {orders.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400">아직 없습니다. 프로젝트 목록 위의 「📄 납품요구서 올리기」로 사진이나 PDF를 올리면 여기에 정리됩니다.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {orders.map((o) => <OrderRow key={o.id} order={o} open={openOrder === o.id} onToggle={() => setOpenOrder(openOrder === o.id ? null : o.id)} onRemove={() => removeOrder(o.id)} onIssue={onIssue ? () => onIssue(o.id) : undefined} />)}
              </ul>
            )}
          </div>
        )}

        {initial && onMergeInto && others.length > 0 && (
          <details className="rounded-xl border border-line bg-background p-3 text-sm">
            <summary className="cursor-pointer text-slate-700">이 프로젝트를 다른 프로젝트와 하나로 합치기</summary>
            <p className="mt-2 text-xs text-slate-500">같은 현장이 두 번 등록됐을 때 씁니다. 이 프로젝트의 문서·매출·담당자가 선택한 프로젝트로 옮겨지고, 이 프로젝트는 사라집니다.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
                <option value="">합칠 대상 선택…</option>
                {others.map((p) => <option key={p.id} value={p.id}>[{p.code}] {p.name}{p.client ? ` · ${p.client}` : ""}</option>)}
              </select>
              <button type="button" disabled={!mergeTarget} onClick={() => { const t = others.find((p) => p.id === mergeTarget); if (t && confirm(`「${initial.name}」을(를) 「${t.name}」에 합칠까요? 되돌릴 수 없습니다.`)) onMergeInto(mergeTarget); }} className="rounded-full border border-primary px-4 py-2 text-sm text-primary hover:bg-primary-soft disabled:opacity-40">합치기</button>
            </div>
          </details>
        )}

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

function OrderRow({ order, open, onToggle, onRemove, onIssue }: { order: DeliveryOrder; open: boolean; onToggle: () => void; onRemove: () => void; onIssue?: () => void }) {
  const delivered = deliveredQtys(order);
  const remaining = remainingQtys(order);
  const deliveredTotal = delivered.reduce((s, q) => s + q, 0);
  const remainingTotal = remaining.reduce((s, q) => s + q, 0);
  return (
    <li className="px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onToggle} className="flex-1 text-left">
          <span className="rounded-full border border-primary/20 bg-primary-soft px-2 py-0.5 text-xs text-primary">{order.kind}</span>
          <span className="ml-2 font-medium text-slate-800">{order.orderNo ? `No. ${order.orderNo}` : "번호 없음"}</span>
          <span className="ml-2 text-xs text-slate-500">{order.date ?? ""}{order.projectName ? ` · ${order.projectName}` : order.site ? ` · ${order.site}` : ""} · 품목 {order.items.length}건 · 수량 {order.totalQty.toLocaleString("ko-KR")}{order.totalAmount ? ` · ${order.totalAmount.toLocaleString("ko-KR")}원` : ""}</span>
          <span className="ml-2 text-xs text-slate-400">{open ? "▲ 접기" : "▼ 품목 보기"}</span>
        </button>
        <span className={`text-xs ${remainingTotal === 0 ? "text-green-700" : "text-slate-500"}`}>납품 {deliveredTotal.toLocaleString("ko-KR")} / 잔여 {remainingTotal.toLocaleString("ko-KR")}</span>
        {onIssue && remainingTotal > 0 && <button type="button" onClick={onIssue} className="rounded-full border border-primary px-3 py-1 text-xs text-primary hover:bg-primary-soft">거래명세표 발행</button>}
        <button type="button" onClick={onRemove} className="text-xs text-slate-400 hover:text-red-600">빼기</button>
      </div>
      {open && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs min-w-[520px]">
            <thead className="text-slate-500"><tr><th className="px-2 py-1 text-left">품명</th><th className="px-2 py-1 text-left">규격</th><th className="px-2 py-1 text-left">단위</th><th className="px-2 py-1 text-right">요구</th><th className="px-2 py-1 text-right">납품</th><th className="px-2 py-1 text-right">잔여</th><th className="px-2 py-1 text-left">비고</th></tr></thead>
            <tbody className="divide-y divide-line">
              {order.items.map((it, i) => (
                <tr key={i}><td className="px-2 py-1 text-slate-800">{it.name}</td><td className="px-2 py-1 text-slate-600">{it.spec ?? ""}</td><td className="px-2 py-1 text-slate-600">{it.unit ?? ""}</td><td className="px-2 py-1 text-right tabular-nums">{it.qty.toLocaleString("ko-KR")}</td><td className="px-2 py-1 text-right tabular-nums text-green-700">{delivered[i] ? delivered[i].toLocaleString("ko-KR") : "-"}</td><td className={`px-2 py-1 text-right tabular-nums ${remaining[i] === 0 ? "text-slate-400" : "font-medium"}`}>{remaining[i].toLocaleString("ko-KR")}</td><td className="px-2 py-1 text-slate-500">{it.note ?? ""}</td></tr>
              ))}
            </tbody>
          </table>
          {(order.shipments ?? []).length > 0 && (
            <div className="mt-1 text-[11px] text-slate-500">발행: {(order.shipments ?? []).map((sh, k) => `${k + 1}차 ${sh.date} ${sh.docNumber} (${sh.qtys.reduce((a, b) => a + b, 0)}개)`).join(" · ")}</div>
          )}
          <div className="mt-1 text-[11px] text-slate-400">{order.agency ? `발주처 ${order.agency} · ` : ""}{order.dueDate ? `납품기한 ${order.dueDate} · ` : ""}{order.fileName ? `파일 ${order.fileName} · ` : ""}{order.uploadedBy ? `${order.uploadedBy} 등록` : ""}{order.memo ? ` · ${order.memo}` : ""}</div>
        </div>
      )}
    </li>
  );
}
