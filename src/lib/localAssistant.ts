// 내장 비서: API 키가 없어도 동작하는 규칙 기반 답변기.
// 질문에 들어 있는 낱말을 보고 회사 현황 요약(Snapshot)에서 답을 찾아 정리합니다.

import type { Snapshot } from "./assistantContext";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

export const suggestedQuestions = ["오늘 브리핑 해줘", "지연된 할일 알려줘", "이번 주 일정은?", "미수금 현황 알려줘", "이번 달 매출은?", "미지급금 알려줘", "진행 중인 견적은?"];

export function localAnswer(question: string, s: Snapshot): string {
  const q = question.replace(/\s+/g, "").toLowerCase();
  const parts: string[] = [];

  // 특정 고객 이름이 들어 있으면 그 고객 기준으로
  const customer = s.customers.list.find((c) => q.includes(c.name.replace(/\s+/g, "").toLowerCase()));
  if (customer) {
    parts.push(`**${customer.name}**\n- 연결 프로젝트 ${customer.projects}건, 누적 매출 ${won(customer.revenue)}\n- 미수금 ${won(customer.outstanding)}`);
    const dues = s.revenues.unpaid.filter((u) => u.customer === customer.name);
    if (dues.length) parts.push(dues.map((u) => `  · ${u.title}: 청구 ${won(u.amount)} / 입금 ${won(u.paid)} / 미수 ${won(u.due)}`).join("\n"));
    const ps = s.projects.active.filter((p) => p.client === customer.name);
    if (ps.length) parts.push(ps.map((p) => `  · 진행중 [${p.code}] ${p.name} ${p.progress}%${p.dueDate ? ` (납기 ${p.dueDate})` : ""}`).join("\n"));
    return parts.join("\n");
  }

  if (has(q, "브리핑", "요약", "정리해", "오늘어때", "상황")) return briefing(s);

  if (has(q, "지연", "밀린", "늦은")) {
    if (!s.tasks.overdue.length) return "마감이 지난 할일이 없습니다. 👍";
    return `마감이 지난 할일 ${s.tasks.overdue.length}건입니다.\n` + s.tasks.overdue.map((t) => `- ${t.title} (마감 ${t.due}, ${t.assignees.join(", ") || "미배정"})`).join("\n");
  }
  if (has(q, "할일", "할 일", "해야", "업무", "todo")) {
    const lines = [`오늘 마감 할일 ${s.tasks.today.length}건, 지연 ${s.tasks.overdue.length}건, 진행중 ${s.tasks.doing.length}건, 전체 미완료 ${s.tasks.open}건입니다.`];
    if (s.tasks.today.length) lines.push("**오늘 마감**\n" + s.tasks.today.map((t) => `- ${t.title} (${t.assignees.join(", ") || "미배정"})`).join("\n"));
    if (s.tasks.overdue.length) lines.push("**지연**\n" + s.tasks.overdue.map((t) => `- ${t.title} (마감 ${t.due})`).join("\n"));
    return lines.join("\n\n");
  }
  if (has(q, "일정", "스케줄", "미팅", "회의", "납품일", "이번주", "내일")) {
    const lines = [];
    lines.push(s.events.today.length ? "**오늘 일정**\n" + s.events.today.map((e) => `- ${e.time ?? "종일"} ${e.title}${e.location ? ` @${e.location}` : ""}`).join("\n") : "오늘 일정은 없습니다.");
    lines.push(s.events.upcoming.length ? "**앞으로 7일**\n" + s.events.upcoming.map((e) => `- ${e.date} ${e.time ?? "종일"} ${e.title} (${e.type})`).join("\n") : "앞으로 7일 동안 등록된 일정이 없습니다.");
    return lines.join("\n\n");
  }
  if (has(q, "미수", "수금", "못받", "안들어온", "입금안")) {
    if (!s.revenues.unpaid.length) return "미수금이 없습니다. 모든 매출이 입금 완료되었습니다. 👍";
    const byCustomer = s.customers.list.filter((c) => c.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
    return `누적 미수금은 **${won(s.revenues.outstanding)}** 입니다.\n\n**고객별**\n` + byCustomer.map((c) => `- ${c.name}: ${won(c.outstanding)}`).join("\n") +
      `\n\n**건별**\n` + s.revenues.unpaid.map((u) => `- ${u.title}${u.date ? ` (${u.date})` : " (날짜 미정)"}: 미수 ${won(u.due)}`).join("\n");
  }
  if (has(q, "미지급", "지급할", "줄돈", "매입")) {
    const p = s.purchases;
    const lines = [`이번 달 매입 **${won(p.monthTotal)}**, 올해 누적 매입 **${won(p.yearTotal)}** 입니다. 아직 지급하지 않은 미지급금은 **${won(p.payable)}** 입니다.`];
    if (p.unpaid.length) lines.push("**미지급 건**\n" + p.unpaid.map((u) => `- ${u.supplier} ${u.item}: 미지급 ${won(u.due)}${u.payDue ? ` (지급 예정 ${u.payDue})` : ""}`).join("\n"));
    return lines.join("\n\n");
  }
  if (has(q, "입금")) {
    return `이번 달 입금 ${won(s.deposits.monthTotal)}, 올해 입금 ${won(s.deposits.yearTotal)}입니다.` + (s.deposits.unlinked.length ? `\n매출에 연결되지 않은 입금 ${s.deposits.unlinked.length}건: ` + s.deposits.unlinked.map((d) => `${d.payer} ${won(d.amount)}`).join(", ") : "");
  }
  if (has(q, "매출", "실적", "얼마벌")) {
    return `이번 달 매출 **${won(s.revenues.monthTotal)}**, 올해 누적 매출 **${won(s.revenues.yearTotal)}** 입니다. 미수금은 ${won(s.revenues.outstanding)}입니다.`;
  }
  if (has(q, "견적")) {
    const st = Object.entries(s.quotes.byStatus).map(([k, v]) => `${k} ${v}건`).join(", ");
    return `견적 ${s.quotes.total}건 (${st}).` + (s.quotes.pending.length ? `\n\n**진행 중인 견적**\n` + s.quotes.pending.map((p) => `- ${p.number} ${p.recipient} ${won(p.total)} · ${p.status}`).join("\n") : "");
  }
  if (has(q, "프로젝트", "현장", "공사")) {
    return `진행중 ${s.projects.active.length}건, 진행예정 ${s.projects.planned.length}건, 보류 ${s.projects.onHold.length}건입니다.\n\n**진행중**\n` +
      s.projects.active.map((p) => `- [${p.code}] ${p.name} ${p.progress}%${p.dueDate ? ` · 납기 ${p.dueDate}` : ""} · ${p.assignees.join(", ") || "미배정"}`).join("\n");
  }
  if (has(q, "리드", "문의", "잠재")) {
    const st = Object.entries(s.leads.byStatus).map(([k, v]) => `${k} ${v}건`).join(", ");
    return `리드 ${s.leads.total}건 (${st}).` + (s.leads.open.length ? `\n\n**응대 중**\n` + s.leads.open.map((l) => `- ${l.company} (${l.contact}) · ${l.status}${l.product ? ` · ${l.product}` : ""}`).join("\n") : "");
  }
  if (has(q, "고객", "거래처")) {
    return `등록 고객 ${s.customers.count}곳입니다.\n` + s.customers.list.sort((a, b) => b.revenue - a.revenue).map((c) => `- ${c.name}: 프로젝트 ${c.projects}건, 매출 ${won(c.revenue)}${c.outstanding ? `, 미수 ${won(c.outstanding)}` : ""}`).join("\n");
  }
  if (has(q, "안녕", "hello", "하이")) return `안녕하세요, ${s.assistantName}입니다. 무엇을 도와드릴까요?`;

  return `아직 그 질문은 잘 이해하지 못했습니다. 이런 질문에 답할 수 있어요:\n` + suggestedQuestions.map((x) => `- ${x}`).join("\n") + `\n- "○○건설 미수금 얼마야?"처럼 고객 이름을 넣어 물어보셔도 됩니다.`;
}

export function briefing(s: Snapshot): string {
  const lines = [`**${s.today} 브리핑**`];
  lines.push(`- 할일: 오늘 마감 ${s.tasks.today.length}건, 지연 ${s.tasks.overdue.length}건, 진행중 ${s.tasks.doing.length}건`);
  if (s.tasks.overdue.length) lines.push(`  · 지연: ${s.tasks.overdue.map((t) => t.title).join(", ")}`);
  lines.push(s.events.today.length ? `- 오늘 일정: ${s.events.today.map((e) => `${e.time ?? "종일"} ${e.title}`).join(", ")}` : "- 오늘 일정 없음");
  lines.push(`- 생산: 오늘 ${s.production.todayQty.toLocaleString("ko-KR")}개${s.production.todayItems.length ? ` (${s.production.todayItems.map((i) => `${i.name} ${i.produced}${i.unit}`).join(", ")})` : " (일보 미작성)"}`);
  lines.push(`- 출근: ${s.attendance.today.working}명 출근${s.attendance.today.off ? `, ${s.attendance.today.offNames.join(", ")}` : ""}`);
  lines.push(`- 프로젝트: 진행중 ${s.projects.active.length}건` + (s.projects.active.length ? ` (${s.projects.active.map((p) => `${p.name.slice(0, 12)} ${p.progress}%`).join(", ")})` : ""));
  lines.push(`- 매출: 이번 달 ${won(s.revenues.monthTotal)}, 미수금 ${won(s.revenues.outstanding)}`);
  lines.push(`- 매입: 이번 달 ${won(s.purchases.monthTotal)}, 미지급금 ${won(s.purchases.payable)}`);
  if (s.quotes.pending.length) lines.push(`- 견적: 진행 중 ${s.quotes.pending.length}건 (${s.quotes.pending.map((p) => p.recipient).join(", ")})`);
  if (s.leads.open.length) lines.push(`- 리드: 응대 중 ${s.leads.open.length}건`);
  return lines.join("\n");
}
