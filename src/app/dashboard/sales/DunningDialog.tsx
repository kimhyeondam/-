"use client";

import { useEffect, useState } from "react";
import type { Customer, Revenue } from "@/data/sample";
import { company as defaultCompany } from "@/data/sample";
import { formatWon } from "@/lib/format";

type Tone = "정중" | "보통" | "강경";

/** 미수금 독촉 문안: 문자·메일로 바로 보내거나 복사합니다 */
export default function DunningDialog({ rev, paid, customer, onClose }: { rev: Revenue; paid: number; customer?: Customer; onClose: () => void }) {
  const due = Math.max(rev.amount - paid, 0);
  const [tone, setTone] = useState<Tone>("정중");
  const [co, setCo] = useState<{ name: string; phone?: string; bank?: string; ceo?: string }>({ name: defaultCompany.name });
  const [edited, setEdited] = useState<string | null>(null); // 사용자가 손으로 고친 문안 (톤을 바꾸면 초기화)
  const [copied, setCopied] = useState(false);
  useEffect(() => { fetch("/api/data/settings").then((r) => r.json()).then((j) => { if (j?.data?.company) setCo(j.data.company); }).catch(() => {}); }, []);
  const text = edited ?? compose(tone, rev, due, paid, co);

  const phone = (customer?.phone ?? "").replace(/[^\d]/g, "");
  const ios = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);
  async function copy() { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt("복사하세요", text); } }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-line shadow-2xl p-5 sm:p-6 space-y-4">
        <div><h2 className="text-lg font-bold text-slate-800">수금 안내 문안</h2><div className="text-sm text-slate-500">{rev.customer ?? "거래처"} · {rev.title} · 미수금 <b className="text-red-600">{formatWon(due)}</b></div></div>
        <div className="flex gap-1 rounded-full border border-line p-1 w-fit">{(["정중", "보통", "강경"] as Tone[]).map((t) => <button key={t} onClick={() => { setTone(t); setEdited(null); }} className={`rounded-full px-4 py-1.5 text-sm ${tone === t ? "bg-primary text-white font-semibold" : "text-slate-600 hover:bg-primary-soft"}`}>{t}</button>)}</div>
        <textarea value={text} onChange={(e) => setEdited(e.target.value)} rows={11} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary" />
        <div className="flex flex-wrap gap-2">
          <a href={`sms:${phone}${ios ? "&" : "?"}body=${encodeURIComponent(text)}`} className={`rounded-full px-4 py-2 text-sm font-semibold ${phone ? "bg-primary text-white hover:bg-primary-dark" : "bg-slate-100 text-slate-400 pointer-events-none"}`} title={phone ? "" : "고객관리에 연락처가 없습니다"}>문자로 보내기</a>
          <a href={`mailto:${customer?.email ?? ""}?subject=${encodeURIComponent(`[${co.name}] ${rev.title} 대금 안내`)}&body=${encodeURIComponent(text)}`} className={`rounded-full border px-4 py-2 text-sm ${customer?.email ? "border-line bg-white text-slate-700 hover:border-primary" : "border-line bg-slate-100 text-slate-400 pointer-events-none"}`} title={customer?.email ? "" : "고객관리에 이메일이 없습니다"}>메일로 보내기</a>
          <button onClick={copy} className="rounded-full border border-line bg-white px-4 py-2 text-sm text-slate-700 hover:border-primary">{copied ? "복사됨 ✓" : "복사"}</button>
          <button onClick={onClose} className="ml-auto rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">닫기</button>
        </div>
        <p className="text-[11px] text-slate-400">문자·메일 버튼은 이 기기의 문자 앱·메일 앱을 엽니다(휴대폰에서 가장 편합니다). 입금 계좌는 시스템 설정의 「입금 계좌」를 씁니다.</p>
      </div>
    </div>
  );
}

function compose(tone: Tone, rev: Revenue, due: number, paid: number, co: { name: string; phone?: string; bank?: string; ceo?: string }) {
  const who = rev.customer ? `${rev.customer} 담당자님` : "담당자님";
  const item = `${rev.date ? `${rev.date} ` : ""}${rev.title}${rev.docNumber ? ` (거래명세표 ${rev.docNumber})` : ""}`;
  const money = `청구 ${formatWon(rev.amount)}${paid ? `, 입금 ${formatWon(paid)}` : ""} → 미수금 ${formatWon(due)}`;
  const bank = co.bank ? `\n입금 계좌: ${co.bank}` : "";
  const sign = `\n\n${co.name}${co.phone ? ` ${co.phone}` : ""}`;
  if (tone === "정중") return `${who}, 안녕하세요. ${co.name}입니다.\n늘 거래에 감사드립니다.\n\n아래 납품 건의 대금이 아직 입금 확인되지 않아 안내드립니다.\n- ${item}\n- ${money}${bank}\n\n확인하시고 입금 예정일을 알려주시면 감사하겠습니다. 이미 송금하셨다면 이 문자는 무시해 주세요.${sign}`;
  if (tone === "보통") return `${who}, ${co.name}입니다.\n\n아래 건 미수금 입금을 부탁드립니다.\n- ${item}\n- ${money}${bank}\n\n이번 주 중으로 입금 부탁드리며, 일정이 어려우시면 회신 부탁드립니다.${sign}`;
  return `${who}, ${co.name}입니다.\n\n아래 건 대금이 장기간 미입금 상태입니다.\n- ${item}\n- ${money}${bank}\n\n3일 이내 입금 또는 입금 계획 회신이 없으면 추가 납품을 보류하고 내용증명 등 절차를 검토하겠습니다. 원만한 처리를 부탁드립니다.${sign}`;
}
