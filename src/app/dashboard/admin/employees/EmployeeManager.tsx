"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import type { PublicUser, UserRole } from "@/lib/users";
import { invalidateMembers } from "@/lib/useMembers";
import { createEmployee, updateEmployee, deleteEmployee, listEmployees, listWorkers, saveWorker, deleteWorker, promoteWorker } from "./actions";
import type { Worker } from "@/data/sample";
import { newId } from "@/lib/ids";

const inputCls = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary";

export default function EmployeeManager({ initial, initialWorkers = [], meId, storeKind }: { initial: PublicUser[]; initialWorkers?: Worker[]; meId: string; storeKind: string }) {
  const [users, setUsers] = useState(initial);
  const [workers, setWorkers] = useState(initialWorkers);
  const [workerEditing, setWorkerEditing] = useState<Worker | "new" | null>(null);
  const [promoting, setPromoting] = useState<Worker | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(result: { ok: boolean; message: string }) {
    setNotice(result);
    if (result.ok) {
      const [u, w] = await Promise.all([listEmployees(), listWorkers()]);
      setUsers(u);
      setWorkers(w.filter((x) => !u.some((a) => a.id === x.id)));
      invalidateMembers();
      setAdding(false);
      setEditing(null);
      setWorkerEditing(null);
      setPromoting(null);
    }
    setTimeout(() => setNotice(null), 4000);
  }

  const active = users.filter((u) => u.active);

  return (
    <>
      <PageHeader
        title="직원관리"
        description="직원 계정을 만들고 팀·권한을 관리합니다. 여기 등록된 직원이 할일·일정·프로젝트의 담당자 목록에 나옵니다."
        action={<button onClick={() => setAdding(true)} className="rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition">＋ 직원 추가</button>}
      />
      {notice && <div className={`rounded-xl border px-4 py-3 text-sm ${notice.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>{notice.message}</div>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="전체 직원" value={`${users.length + workers.filter((w) => w.active).length}명`} sub={`계정 ${users.length} · 현장 직원 ${workers.filter((w) => w.active).length}`} icon="☺" />
        <StatCard label="사용 중" value={`${active.length}명`} sub="로그인할 수 있는 계정" icon="✓" tone="green" />
        <StatCard label="관리자" value={`${active.filter((u) => u.role === "관리자").length}명`} sub="직원관리·설정 권한" icon="★" highlight />
        <StatCard label="저장소" value={storeKind === "postgres" ? "PostgreSQL" : "파일"} sub={storeKind === "postgres" ? "DATABASE_URL 연결됨" : "서버 data 폴더에 저장"} icon="▥" />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-line">
              <th className="px-5 py-3 font-medium">이름</th>
              <th className="px-3 py-3 font-medium">로그인 ID</th>
              <th className="px-3 py-3 font-medium">팀</th>
              <th className="px-3 py-3 font-medium">권한</th>
              <th className="px-3 py-3 font-medium">상태</th>
              <th className="px-3 py-3 font-medium">등록일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-primary-soft/30 transition">
                <td className="px-5 py-3 whitespace-nowrap">
                  <button onClick={() => setEditing(u)} className="font-medium text-slate-800 hover:text-primary truncate max-w-[18rem]">{u.name}</button>
                  {u.id === meId && <span className="ml-2 text-[11px] text-slate-400">(나)</span>}
                </td>
                <td className="px-3 py-3 text-slate-600 whitespace-nowrap font-mono text-xs">{u.loginId}</td>
                <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{u.team}</td>
                <td className="px-3 py-3 whitespace-nowrap"><span className={`rounded-full border px-2.5 py-0.5 text-xs ${u.role === "관리자" ? "bg-primary-soft text-primary border-primary/20" : "bg-white text-slate-600 border-line"}`}>{u.role}</span></td>
                <td className="px-3 py-3 whitespace-nowrap"><span className={`rounded-full border px-2.5 py-0.5 text-xs ${u.active ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>{u.active ? "사용 중" : "비활성"}</span></td>
                <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{u.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-line">
          <div><h2 className="font-bold text-slate-800">현장 직원 <span className="text-sm font-normal text-slate-500">(로그인 계정 없음 · 출근부·급여·생산일보에 나옵니다)</span></h2><p className="text-xs text-slate-400">직원출근부의 「직원 추가」와 같은 목록입니다. 프로그램에 들어와야 하는 직원은 「로그인 계정 만들기」를 누르면 기록이 그대로 이어집니다.</p></div>
          <button onClick={() => setWorkerEditing("new")} className="rounded-full border border-line bg-white text-slate-700 text-sm font-semibold px-4 py-2 hover:border-primary hover:text-primary">＋ 현장 직원 추가</button>
        </div>
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-line"><th className="px-5 py-3 font-medium">이름</th><th className="px-3 py-3 font-medium">팀</th><th className="px-3 py-3 font-medium">휴대폰</th><th className="px-3 py-3 font-medium">입사일</th><th className="px-3 py-3 font-medium">상태</th><th className="px-3 pr-5 py-3 font-medium text-right">계정</th></tr></thead>
          <tbody className="divide-y divide-line">
            {workers.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">현장 직원이 없습니다.</td></tr>}
            {workers.map((w) => (
              <tr key={w.id} className={`hover:bg-primary-soft/30 transition ${w.active ? "" : "opacity-60"}`}>
                <td className="px-5 py-3 whitespace-nowrap"><button onClick={() => setWorkerEditing(w)} className="font-medium text-slate-800 hover:text-primary">{w.name}</button></td>
                <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{w.team}</td>
                <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{w.phone ?? "-"}</td>
                <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{w.joinedAt ?? "-"}</td>
                <td className="px-3 py-3 whitespace-nowrap"><span className={`rounded-full border px-2.5 py-0.5 text-xs ${w.active ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-line"}`}>{w.active ? "재직" : "퇴사"}</span></td>
                <td className="px-3 pr-5 py-3 text-right whitespace-nowrap"><button onClick={() => setPromoting(w)} className="rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-700 hover:border-primary hover:text-primary">로그인 계정 만들기</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {adding && (
        <Modal title="직원 추가" onClose={() => setAdding(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              await refresh(await createEmployee({ loginId: String(f.get("loginId")), name: String(f.get("name")), team: String(f.get("team")), role: f.get("role") as UserRole, password: String(f.get("password")) }));
              setBusy(false);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-sm"><span className="text-slate-600">이름 *</span><input name="name" required autoFocus className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">로그인 ID *</span><input name="loginId" required className={inputCls} placeholder="예) kim.cs" /></label>
              <label className="block text-sm"><span className="text-slate-600">팀</span><input name="team" className={inputCls} placeholder="예) 생산1팀" /></label>
              <label className="block text-sm"><span className="text-slate-600">권한</span>
                <select name="role" defaultValue="직원" className={inputCls}><option value="직원">직원</option><option value="관리자">관리자</option></select>
              </label>
              <label className="block text-sm sm:col-span-2"><span className="text-slate-600">초기 비밀번호 * <span className="text-slate-400">(6자 이상, 첫 로그인 후 바꾸도록 안내)</span></span><input name="password" type="text" required minLength={6} className={inputCls} /></label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAdding(false)} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
              <button type="submit" disabled={busy} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white">만들기</button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`직원 정보 · ${editing.name}`} onClose={() => setEditing(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              await refresh(await updateEmployee(editing.id, { name: String(f.get("name")), team: String(f.get("team")), role: f.get("role") as UserRole, active: f.get("active") === "on", newPassword: String(f.get("newPassword") || "") || undefined }));
              setBusy(false);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-sm"><span className="text-slate-600">이름</span><input name="name" defaultValue={editing.name} className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">로그인 ID</span><input value={editing.loginId} disabled className={`${inputCls} bg-slate-50 text-slate-400`} /></label>
              <label className="block text-sm"><span className="text-slate-600">팀</span><input name="team" defaultValue={editing.team} className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">권한</span>
                <select name="role" defaultValue={editing.role} className={inputCls}><option value="직원">직원</option><option value="관리자">관리자</option></select>
              </label>
              <label className="block text-sm sm:col-span-2"><span className="text-slate-600">비밀번호 재설정 <span className="text-slate-400">(바꾸지 않으려면 비워 두세요)</span></span><input name="newPassword" type="text" minLength={6} className={inputCls} placeholder="새 비밀번호" /></label>
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2"><input name="active" type="checkbox" defaultChecked={editing.active} className="accent-primary" /> 사용 중 (체크를 풀면 로그인할 수 없고 담당자 목록에서도 빠집니다)</label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {editing.id === meId ? (
                <span className="text-xs text-slate-400">내 계정은 삭제할 수 없습니다.</span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (!confirm(`${editing.name} (${editing.loginId}) 계정을 완전히 삭제할까요?\n삭제하면 되돌릴 수 없습니다. 잠시 막아 두려면 삭제 대신 「사용 중」 체크를 푸세요.`)) return;
                    setBusy(true);
                    await refresh(await deleteEmployee(editing.id));
                    setBusy(false);
                  }}
                  className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  삭제
                </button>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button>
                <button type="submit" disabled={busy} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white">저장</button>
              </div>
            </div>
          </form>
        </Modal>
      )}
      {workerEditing && (
        <Modal title={workerEditing === "new" ? "현장 직원 추가" : `현장 직원 · ${workerEditing.name}`} onClose={() => setWorkerEditing(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const base = workerEditing === "new" ? { id: newId("w"), active: true } : workerEditing;
              setBusy(true);
              await refresh(await saveWorker({ ...base, name: String(f.get("name")), team: String(f.get("team")), phone: String(f.get("phone")), joinedAt: String(f.get("joinedAt")) || undefined, memo: String(f.get("memo")), active: f.get("active") === "on" }));
              setBusy(false);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-sm"><span className="text-slate-600">이름 *</span><input name="name" required autoFocus defaultValue={workerEditing === "new" ? "" : workerEditing.name} className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">팀</span><input name="team" defaultValue={workerEditing === "new" ? "생산1팀" : workerEditing.team} className={inputCls} /></label>
              <label className="block text-sm"><span className="text-slate-600">휴대폰</span><input name="phone" defaultValue={workerEditing === "new" ? "" : workerEditing.phone ?? ""} className={inputCls} placeholder="010-" /></label>
              <label className="block text-sm"><span className="text-slate-600">입사일</span><input type="date" name="joinedAt" defaultValue={workerEditing === "new" ? "" : workerEditing.joinedAt ?? ""} className={inputCls} /></label>
              <label className="block text-sm sm:col-span-2"><span className="text-slate-600">메모</span><input name="memo" defaultValue={workerEditing === "new" ? "" : workerEditing.memo ?? ""} className={inputCls} /></label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="active" defaultChecked={workerEditing === "new" ? true : workerEditing.active} className="accent-primary" /> 재직 중 (끄면 출근부에서 빠지고 기록은 남습니다)</label>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div>{workerEditing !== "new" && <button type="button" disabled={busy} onClick={async () => { if (!confirm(`${workerEditing.name} 님을 목록에서 지울까요?`)) return; setBusy(true); await refresh(await deleteWorker(workerEditing.id)); setBusy(false); }} className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">삭제</button>}</div>
              <div className="flex gap-2"><button type="button" onClick={() => setWorkerEditing(null)} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button><button type="submit" disabled={busy} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white">저장</button></div>
            </div>
          </form>
        </Modal>
      )}
      {promoting && (
        <Modal title={`로그인 계정 만들기 · ${promoting.name}`} onClose={() => setPromoting(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              await refresh(await promoteWorker(promoting.id, { loginId: String(f.get("loginId")), password: String(f.get("password")), role: f.get("role") as UserRole }));
              setBusy(false);
            }}
            className="space-y-4"
          >
            <p className="text-xs text-slate-500">{promoting.name} 님이 프로그램에 로그인할 수 있게 됩니다. 출근부·급여 기록은 그대로 이어집니다.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-sm"><span className="text-slate-600">로그인 ID *</span><input name="loginId" required autoFocus className={inputCls} placeholder="예) hong.gd" /></label>
              <label className="block text-sm"><span className="text-slate-600">권한</span><select name="role" defaultValue="직원" className={inputCls}><option value="직원">직원</option><option value="관리자">관리자</option></select></label>
              <label className="block text-sm sm:col-span-2"><span className="text-slate-600">초기 비밀번호 * <span className="text-slate-400">(6자 이상)</span></span><input name="password" type="text" required minLength={6} className={inputCls} /></label>
            </div>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setPromoting(null)} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">취소</button><button type="submit" disabled={busy} className="rounded-full bg-primary hover:bg-primary-dark disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white">계정 만들기</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-2xl bg-card p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-800 mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
