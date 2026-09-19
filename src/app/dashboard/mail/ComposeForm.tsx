"use client";

import { useState } from "react";
import type { PublicMailAccount } from "@/lib/mail/accounts";

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    r.readAsDataURL(file);
  });
}

export default function ComposeForm({
  accounts,
  defaultAccount,
  reply,
  preset,
  contacts,
  onDone,
  onCancel,
}: {
  accounts: PublicMailAccount[];
  defaultAccount: string;
  reply?: { to: string; subject: string; quote: string };
  preset?: { to?: string; subject?: string; text?: string; attachments?: { filename: string; contentBase64: string; contentType?: string }[] };
  contacts: { name: string; email: string }[];
  onDone: (msg: string) => void;
  onCancel: () => void;
}) {
  const [account, setAccount] = useState(defaultAccount);
  const [to, setTo] = useState(reply?.to ?? preset?.to ?? "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(reply ? (reply.subject.startsWith("Re:") ? reply.subject : `Re: ${reply.subject}`) : preset?.subject ?? "");
  const [text, setText] = useState(reply ? `\n\n----- 원본 메일 -----\n${reply.quote}` : preset?.text ?? "");
  const [ready, setReady] = useState(preset?.attachments ?? []); // 이미 만들어진 첨부(PDF 등)
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalBytes = files.reduce((s, f) => s + f.size, 0) + ready.reduce((s, a) => s + Math.floor((a.contentBase64.length * 3) / 4), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const attachments = [...ready, ...(await Promise.all(files.map(async (f) => ({ filename: f.name, contentBase64: await fileToBase64(f), contentType: f.type || undefined }))))];
      const res = await fetch("/api/mail/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account, to, cc, subject, text, attachments }) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "발송에 실패했습니다.");
      onDone(`${to}에게 메일을 보냈습니다.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl space-y-3 max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-slate-800">메일 쓰기</h2>
        <label className="block text-sm"><span className="text-slate-600">보내는 계정</span>
          <select value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label} · {a.email}</option>)}
          </select>
        </label>
        <label className="block text-sm"><span className="text-slate-600">받는 사람 * <span className="text-slate-400">(여러 명은 쉼표로)</span></span>
          <input list="contact-list" required value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} placeholder="예) order@oo-const.co.kr" />
          <datalist id="contact-list">{contacts.map((c) => <option key={c.email} value={c.email}>{c.name}</option>)}</datalist>
        </label>
        <label className="block text-sm"><span className="text-slate-600">참조</span><input value={cc} onChange={(e) => setCc(e.target.value)} className={inputCls} /></label>
        <label className="block text-sm"><span className="text-slate-600">제목 *</span><input required value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} placeholder="예) [현담토목] 흄관 D600 거래명세표 송부" /></label>
        <label className="block text-sm"><span className="text-slate-600">내용</span><textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} className={inputCls} /></label>
        <div className="text-sm">
          <span className="text-slate-600">첨부 파일 <span className="text-slate-400">(거래명세표·세금계산서·견적서 등, 합계 10MB까지)</span></span>
          <input type="file" multiple onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} className="mt-1 block text-xs text-slate-600" />
          {(files.length > 0 || ready.length > 0) && (
            <ul className="mt-2 space-y-1">
              {ready.map((a, i) => (
                <li key={`r${i}`} className="flex items-center justify-between rounded-lg bg-primary-soft/60 px-3 py-1.5 text-xs">
                  <span>📄 {a.filename} <span className="text-slate-400">({Math.round((a.contentBase64.length * 3) / 4 / 1024)}KB)</span></span>
                  <button type="button" onClick={() => setReady(ready.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600">×</button>
                </li>
              ))}
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-background px-3 py-1.5 text-xs">
                  <span>📎 {f.name} <span className="text-slate-400">({Math.round(f.size / 1024)}KB)</span></span>
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600">×</button>
                </li>
              ))}
              <li className={`text-[11px] ${totalBytes > 10 * 1024 * 1024 ? "text-red-600" : "text-slate-400"}`}>합계 {Math.round(totalBytes / 1024)}KB</li>
            </ul>
          )}
        </div>
        {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
          <button type="submit" disabled={busy || totalBytes > 10 * 1024 * 1024} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white">{busy ? "보내는 중..." : "보내기"}</button>
        </div>
      </form>
    </div>
  );
}
