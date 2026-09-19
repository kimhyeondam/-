"use client";

import { useState } from "react";
import { providerPresets, type MailProvider } from "@/lib/mail/presets";

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

export default function AccountForm({ isAdmin, onDone, onCancel }: { isAdmin: boolean; onDone: () => void; onCancel: () => void }) {
  const [provider, setProvider] = useState<MailProvider>("naver");
  const [form, setForm] = useState({ label: "", email: "", user: "", password: "", shared: true, imapHost: "", imapPort: "", smtpHost: "", smtpPort: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preset = providerPresets[provider];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mail/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, provider }) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "등록에 실패했습니다.");
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-xl rounded-2xl bg-card p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-slate-800">메일 계정 연동</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(providerPresets) as MailProvider[]).map((p) => (
            <button type="button" key={p} onClick={() => setProvider(p)} className={`rounded-full border px-3 py-1.5 text-sm ${provider === p ? "bg-primary border-primary text-white" : "border-line text-slate-600 hover:border-primary"}`}>{providerPresets[p].name}</button>
          ))}
        </div>
        <p className="rounded-xl bg-background border border-line px-4 py-3 text-xs text-slate-600 leading-relaxed">{preset.help}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm sm:col-span-2"><span className="text-slate-600">표시 이름</span><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={inputCls} placeholder="예) 영업팀 이영희, 대표 메일" /></label>
          <label className="block text-sm"><span className="text-slate-600">이메일 주소 *</span><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} placeholder="예) jeil.sales@naver.com" /></label>
          <label className="block text-sm"><span className="text-slate-600">로그인 아이디 <span className="text-slate-400">(비우면 이메일 사용)</span></span><input value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} className={inputCls} placeholder={provider === "naver" ? "네이버 아이디" : "이메일 주소"} /></label>
          <label className="block text-sm sm:col-span-2"><span className="text-slate-600">비밀번호 (애플리케이션 비밀번호) *</span><input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} /></label>
          {provider === "custom" && (
            <>
              <label className="block text-sm"><span className="text-slate-600">IMAP 서버</span><input value={form.imapHost} onChange={(e) => setForm({ ...form, imapHost: e.target.value })} className={inputCls} placeholder="imap.example.com" /></label>
              <label className="block text-sm"><span className="text-slate-600">IMAP 포트</span><input value={form.imapPort} onChange={(e) => setForm({ ...form, imapPort: e.target.value })} className={inputCls} placeholder="993" /></label>
              <label className="block text-sm"><span className="text-slate-600">SMTP 서버</span><input value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} className={inputCls} placeholder="smtp.example.com" /></label>
              <label className="block text-sm"><span className="text-slate-600">SMTP 포트</span><input value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: e.target.value })} className={inputCls} placeholder="465" /></label>
            </>
          )}
          <div className="sm:col-span-2 rounded-xl border border-line bg-white p-3 text-sm space-y-2">
            <label className="flex items-start gap-2 cursor-pointer"><input type="radio" name="shared" checked={form.shared} onChange={() => setForm({ ...form, shared: true })} className="mt-1 accent-primary" /><span><b>공용 (직원 모두 사용)</b><br /><span className="text-xs text-slate-500">담당자가 자리를 비워도 다른 직원이 확인하고 대신 보낼 수 있습니다. 업무 전용 메일에 적합합니다.</span></span></label>
            <label className={`flex items-start gap-2 ${isAdmin ? "cursor-pointer" : "opacity-50"}`}><input type="radio" name="shared" disabled={!isAdmin} checked={!form.shared} onChange={() => setForm({ ...form, shared: false })} className="mt-1 accent-primary" /><span><b>비공개 (나만 사용)</b><br /><span className="text-xs text-slate-500">대표 메일처럼 본인만 보는 계정. 관리자만 등록할 수 있습니다.</span></span></label>
          </div>
        </div>

        {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        <p className="text-xs text-slate-400">등록하면 곧바로 메일 서버에 접속해 아이디·비밀번호를 확인합니다. 비밀번호는 암호화해 저장하며 다시 표시하지 않습니다.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
          <button type="submit" disabled={busy} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white">{busy ? "연결 확인 중..." : "연동하기"}</button>
        </div>
      </form>
    </div>
  );
}
