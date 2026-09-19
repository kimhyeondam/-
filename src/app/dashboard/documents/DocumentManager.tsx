"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import Tabs from "@/components/Tabs";
import SortTh, { useSort, compareValues } from "@/components/SortTh";
import LoadingCard from "@/components/LoadingCard";
import { useServerState } from "@/lib/useServerState";
import { formatWon, todayIso } from "@/lib/format";
import { docTotal, nextDocNumber } from "@/lib/documents/calc";
import { formDocs as initialDocs, customers as initialCustomers, projects as initialProjects, quotations as initialQuotes, revenues as initialRevenues, companyProfile as defaultProfile, type FormDoc, type DocType, type Customer, type Project, type Quotation, type CompanyProfile, type Revenue } from "@/data/sample";
import { revenueFromDoc, syncRevenueWithDoc } from "@/lib/sales/revenueDoc";
import { newId } from "@/lib/ids";
import type { PublicMailAccount } from "@/lib/mail/presets";
import DocForm, { type DocInput } from "./DocForm";
import DocPreview from "./DocPreview";
import ComposeForm from "../mail/ComposeForm";

type SortKey = "date" | "number" | "type" | "customer" | "total";
const docTypes: DocType[] = ["견적서", "거래명세표", "납품확인서"];

function bufToBase64(buf: ArrayBuffer) {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export default function DocumentManager() {
  const [items, setItems, loaded, loadError] = useServerState<FormDoc[]>("documents", initialDocs);
  const [customers] = useServerState<Customer[]>("customers", initialCustomers, "jeil.customers");
  const [projects] = useServerState<Project[]>("projects", initialProjects, "jeil.projects");
  const [quotations] = useServerState<Quotation[]>("quotations", initialQuotes, "jeil.quotations");
  const [settings] = useServerState<{ company?: CompanyProfile }>("settings", {});
  const [revenues, setRevenues] = useServerState<Revenue[]>("revenues", initialRevenues, "jeil.revenues");
  const company = { ...defaultProfile, ...(settings.company ?? {}) };

  const [type, setType] = useState<"all" | DocType>("all");
  const [query, setQuery] = useState("");
  const { sort, toggle } = useSort<SortKey>({ key: "date", dir: -1 });
  const [adding, setAdding] = useState<DocType | null>(null);
  const [editing, setEditing] = useState<FormDoc | null>(null);
  const [preview, setPreview] = useState<FormDoc | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [mail, setMail] = useState<{ accounts: PublicMailAccount[]; preset: { to?: string; subject: string; text: string; attachments: { filename: string; contentBase64: string; contentType: string }[] } } | null>(null);
  const contacts = useMemo(() => customers.filter((c) => c.email).map((c) => ({ name: c.name, email: c.email! })), [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((d) => type === "all" || d.type === type)
      .filter((d) => !q || [d.number, d.customer, d.project ?? "", d.site ?? "", d.items.map((i) => i.name).join(" ")].join(" ").toLowerCase().includes(q))
      .sort((a, b) => {
        const v = (d: FormDoc): string | number => (sort.key === "total" ? docTotal(d) : d[sort.key]);
        return compareValues(v(a), v(b)) * sort.dir;
      });
  }, [items, type, query, sort]);

  const count = (t: DocType) => items.filter((d) => d.type === t).length;
  const monthDocs = items.filter((d) => d.date.startsWith(todayIso().slice(0, 7)));

  function flash(ok: boolean, text: string) { setNotice({ ok, text }); setTimeout(() => setNotice(null), 4500); }
  /** 문서 만들기: 거래명세표면 같은 내용의 매출도 자동 등록 */
  function add(data: DocInput) {
    const doc: FormDoc = { ...data, id: newId("fd"), number: nextDocNumber(items, data.type, data.date), createdAt: todayIso() };
    if (doc.type === "거래명세표") {
      const rev = revenueFromDoc(doc);
      doc.revenueId = rev.id;
      setRevenues((prevRev) => [rev, ...prevRev]);
      flash(true, `거래명세표 ${doc.number}와 매출 「${rev.title}」(${formatWon(rev.amount)})을 함께 등록했습니다. 매출관리에서 입금과 비교할 수 있습니다.`);
    }
    setItems((prev) => [doc, ...prev]);
    setPreview(doc);
    setAdding(null);
  }
  /** 문서 수정: 연결된 매출의 품목·금액·날짜도 같이 맞춤 */
  function update(id: string, data: DocInput) {
    const current = items.find((d) => d.id === id);
    if (!current) return;
    const next: FormDoc = { ...current, ...data };
    if (next.type === "거래명세표") {
      const linked = revenues.find((r) => r.id === next.revenueId || r.docId === next.id);
      if (linked) {
        setRevenues((prevRev) => prevRev.map((r) => (r.id === linked.id ? syncRevenueWithDoc(r, next) : r)));
      } else {
        const rev = revenueFromDoc(next);
        next.revenueId = rev.id;
        setRevenues((prevRev) => [rev, ...prevRev]);
      }
    }
    setItems((prev) => prev.map((d) => (d.id === id ? next : d)));
    setEditing(null);
  }
  /** 문서 삭제: 거래명세표면 연결된 매출도 함께 삭제 */
  function remove(id: string) {
    const target = items.find((d) => d.id === id);
    const linked = target ? revenues.find((r) => r.id === target.revenueId || r.docId === target.id) : undefined;
    if (!confirm(`${target?.type ?? "문서"} ${target?.number ?? ""}을(를) 삭제할까요?${linked ? ` 연결된 매출 「${linked.title}」도 함께 지워집니다.` : ""}`)) return;
    if (linked) setRevenues((prevRev) => prevRev.filter((r) => r.id !== linked.id));
    setItems((prev) => prev.filter((d) => d.id !== id));
    setEditing(null);
    setPreview(null);
  }

  async function fetchPdf(doc: FormDoc) {
    const res = await fetch("/api/documents/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc }) });
    if (!res.ok) { const d = (await res.json().catch(() => ({}))) as { error?: string }; throw new Error(d.error ?? "PDF를 만들지 못했습니다."); }
    return res.arrayBuffer();
  }

  async function downloadPdf(doc: FormDoc) {
    setBusy("pdf");
    try {
      const buf = await fetchPdf(doc);
      const url = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = `${doc.type}_${doc.number}_${doc.customer}.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { flash(false, (e as Error).message); } finally { setBusy(null); }
  }

  async function sendByMail(doc: FormDoc) {
    setBusy("mail");
    try {
      const accRes = await fetch("/api/mail/accounts");
      const accData = (await accRes.json()) as { accounts?: PublicMailAccount[] };
      if (!accData.accounts?.length) throw new Error("연동된 메일 계정이 없습니다. 메일관리에서 먼저 계정을 연동하세요.");
      const buf = await fetchPdf(doc);
      const cust = customers.find((c) => c.name === doc.customer);
      setMail({
        accounts: accData.accounts,
        preset: {
          to: cust?.email,
          subject: `[${company.name}] ${doc.type} 송부 (${doc.number})`,
          text: `${doc.customer} ${doc.customerRef ?? "담당자"}님, 안녕하세요.\n\n${doc.type}(${doc.number})를 첨부하여 보내드립니다. 확인 부탁드립니다.\n\n합계금액: ${formatWon(docTotal(doc))} (${doc.vatIncluded ? "부가세 포함" : "부가세 별도"})\n\n감사합니다.\n${company.name} 드림\n${company.phone}`,
          attachments: [{ filename: `${doc.type}_${doc.number}.pdf`, contentBase64: bufToBase64(buf), contentType: "application/pdf" }],
        },
      });
    } catch (e) { flash(false, (e as Error).message); } finally { setBusy(null); }
  }

  return (
    <>
      <PageHeader
        title="양식 문서 작성"
        description="견적서·거래명세표·납품확인서를 만들어 인쇄하거나 PDF로 저장하고, 바로 메일에 첨부해 보냅니다."
        action={
          <div className="flex items-center gap-2">
            {docTypes.map((t) => <button key={t} onClick={() => setAdding(t)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2.5 shadow-sm transition">＋ {t}</button>)}
          </div>
        }
      />
      {notice && <div className={`rounded-xl border px-4 py-3 text-sm ${notice.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>{notice.text}</div>}
      {!loaded && <LoadingCard error={loadError} />}
      {loaded && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="전체 문서" value={`${items.length}건`} sub={`이번 달 ${monthDocs.length}건 작성`} icon="▤" />
            <StatCard label="견적서" value={`${count("견적서")}건`} sub="견적관리와 연결해 작성" icon="✎" highlight />
            <StatCard label="거래명세표" value={`${count("거래명세표")}건`} sub="납품·청구 시 발행" icon="≡" tone="green" />
            <StatCard label="납품확인서" value={`${count("납품확인서")}건`} sub="현장 인수 서명용" icon="✓" tone="amber" />
          </div>

          <Card className="p-4 space-y-3">
            <Tabs value={type} onChange={(v) => setType(v as "all" | DocType)} tabs={[{ key: "all", label: "전체", n: items.length }, ...docTypes.map((t) => ({ key: t, label: t, n: count(t) }))]} />
            <div className="relative max-w-md">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="문서번호, 거래처, 건명, 품명 검색" className="w-full rounded-full border border-line bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary" />
            </div>
          </Card>

          <Card className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-line">
                  <SortTh label="일자" k="date" sort={sort} onSort={toggle} className="px-5" />
                  <SortTh label="문서번호" k="number" sort={sort} onSort={toggle} />
                  <SortTh label="종류" k="type" sort={sort} onSort={toggle} />
                  <SortTh label="거래처" k="customer" sort={sort} onSort={toggle} />
                  <th className="px-3 py-3 font-medium">품목</th>
                  <SortTh label="합계금액" k="total" sort={sort} onSort={toggle} className="text-right" />
                  <th className="px-3 py-3 font-medium text-right pr-5">동작</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">문서가 없습니다. 위의 버튼으로 만들어 보세요.</td></tr>}
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-primary-soft/30 transition">
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{d.date}</td>
                    <td className="px-3 py-3 whitespace-nowrap"><button onClick={() => setPreview(d)} className="font-medium text-slate-800 hover:text-primary truncate max-w-[18rem]">{d.number}</button></td>
                    <td className="px-3 py-3 whitespace-nowrap"><span className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs text-slate-600">{d.type}</span></td>
                    <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{d.customer}</td>
                    <td className="px-3 py-3 text-xs text-slate-500 max-w-[260px] truncate">{d.items.map((i) => `${i.name} ${i.qty}${i.unit}`).join(", ")}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-800 whitespace-nowrap">{docTotal(d).toLocaleString("ko-KR")}</td>
                    <td className="px-3 py-3 pr-5 text-right whitespace-nowrap space-x-2">
                      <button onClick={() => setPreview(d)} className="text-xs text-primary hover:underline">보기</button>
                      <button onClick={() => setEditing(d)} className="text-xs text-slate-600 hover:underline">수정</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {adding && <DocForm defaultType={adding} defaultDate={todayIso()} customers={customers} projects={projects} quotations={quotations} onSubmit={add} onCancel={() => setAdding(null)} />}
      {editing && <DocForm initial={editing} defaultType={editing.type} defaultDate={todayIso()} customers={customers} projects={projects} quotations={quotations} onSubmit={(d) => update(editing.id, d)} onCancel={() => setEditing(null)} onDelete={() => remove(editing.id)} />}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setPreview(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl space-y-3 my-4">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card border border-line px-4 py-3 print:hidden">
              <span className="font-semibold text-slate-800">{preview.type} {preview.number}</span>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => window.print()} className="rounded-full border border-line bg-white px-4 py-2 text-sm text-slate-700 hover:border-primary hover:text-primary">🖨 인쇄</button>
                <button onClick={() => downloadPdf(preview)} disabled={busy !== null} className="rounded-full border border-line bg-white px-4 py-2 text-sm text-slate-700 hover:border-primary hover:text-primary disabled:opacity-50">{busy === "pdf" ? "만드는 중..." : "📄 PDF 저장"}</button>
                <button onClick={() => sendByMail(preview)} disabled={busy !== null} className="rounded-full bg-primary hover:bg-primary-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === "mail" ? "준비 중..." : "✉ 메일로 보내기"}</button>
                <button onClick={() => { setEditing(preview); setPreview(null); }} className="rounded-full border border-line bg-white px-4 py-2 text-sm text-slate-700 hover:border-primary">수정</button>
                <button onClick={() => setPreview(null)} className="rounded-full px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">닫기</button>
              </div>
            </div>
            <div className="doc-print-root">
              <DocPreview doc={preview} company={company} />
            </div>
          </div>
        </div>
      )}

      {mail && (
        <ComposeForm
          accounts={mail.accounts}
          defaultAccount={mail.accounts[0].id}
          preset={mail.preset}
          contacts={contacts}
          onDone={(msg) => { setMail(null); flash(true, msg); }}
          onCancel={() => setMail(null)}
        />
      )}
    </>
  );
}
