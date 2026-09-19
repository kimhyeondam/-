"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getUsers, saveUsers, hashPassword, toPublic, type User, type UserRole, type PublicUser } from "@/lib/users";
import { audit } from "@/lib/audit";
import { getStore } from "@/lib/store";
import type { Worker } from "@/data/sample";

export interface ActionResult {
  ok: boolean;
  message: string;
}

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me || me.role !== "관리자") throw new Error("관리자만 할 수 있습니다.");
  return me;
}

export async function listEmployees(): Promise<PublicUser[]> {
  await requireAdmin();
  return (await getUsers()).map(toPublic);
}

export async function createEmployee(input: { loginId: string; name: string; team: string; role: UserRole; password: string }): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const loginId = input.loginId.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(loginId)) return { ok: false, message: "로그인 ID는 영문 소문자·숫자·점·밑줄 3~30자로 입력하세요." };
    if (!input.name.trim()) return { ok: false, message: "이름을 입력하세요." };
    if (input.password.length < 6) return { ok: false, message: "비밀번호는 6자 이상이어야 합니다." };
    const users = await getUsers();
    if (users.some((u) => u.loginId === loginId)) return { ok: false, message: "이미 사용 중인 로그인 ID입니다." };
    const user: User = { id: `u_${Date.now()}`, loginId, name: input.name.trim(), team: input.team.trim() || "미지정", role: input.role, passwordHash: hashPassword(input.password), active: true, createdAt: new Date().toISOString() };
    await saveUsers([...users, user]);
    await audit({ user: me.name, userId: me.id, action: "직원 추가", target: `${user.name} (${user.loginId})`, detail: `${user.team} · ${user.role}` });
    revalidatePath("/dashboard/admin/employees");
    return { ok: true, message: `${user.name} 계정을 만들었습니다.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function updateEmployee(id: string, input: { name: string; team: string; role: UserRole; active: boolean; newPassword?: string }): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const users = await getUsers();
    const target = users.find((u) => u.id === id);
    if (!target) return { ok: false, message: "직원을 찾을 수 없습니다." };
    if (me.id === id && (!input.active || input.role !== "관리자")) return { ok: false, message: "자기 자신의 관리자 권한은 해제하거나 비활성화할 수 없습니다." };
    if (input.newPassword && input.newPassword.length < 6) return { ok: false, message: "새 비밀번호는 6자 이상이어야 합니다." };
    const updated: User = {
      ...target,
      name: input.name.trim() || target.name,
      team: input.team.trim() || target.team,
      role: input.role,
      active: input.active,
      passwordHash: input.newPassword ? hashPassword(input.newPassword) : target.passwordHash,
    };
    await saveUsers(users.map((u) => (u.id === id ? updated : u)));
    await audit({ user: me.name, userId: me.id, action: "직원 수정", target: `${updated.name} (${updated.loginId})`, detail: [input.newPassword ? "비밀번호 재설정" : "", updated.active !== target.active ? (updated.active ? "활성화" : "비활성화") : "", updated.role !== target.role ? `권한 ${updated.role}` : ""].filter(Boolean).join(", ") || "정보 수정" });
    revalidatePath("/dashboard/admin/employees");
    return { ok: true, message: `${updated.name} 정보를 저장했습니다.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const users = await getUsers();
    const target = users.find((u) => u.id === id);
    if (!target) return { ok: false, message: "직원을 찾을 수 없습니다." };
    if (me.id === id) return { ok: false, message: "자기 자신의 계정은 삭제할 수 없습니다." };
    if (target.role === "관리자" && users.filter((u) => u.role === "관리자" && u.active).length <= 1) return { ok: false, message: "마지막 관리자 계정은 삭제할 수 없습니다." };
    await saveUsers(users.filter((u) => u.id !== id));
    await audit({ user: me.name, userId: me.id, action: "직원 삭제", target: `${target.name} (${target.loginId})`, detail: `${target.team} · ${target.role}` });
    revalidatePath("/dashboard/admin/employees");
    return { ok: true, message: `${target.name} 계정을 삭제했습니다.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ───────── 현장 직원 (로그인 계정 없음, 직원출근부에서도 관리) ───────── */

async function loadWorkers(): Promise<Worker[]> {
  const row = await getStore().get<Worker[]>("workers");
  return Array.isArray(row?.data) ? row!.data : [];
}

export async function listWorkers(): Promise<Worker[]> {
  await requireAdmin();
  return loadWorkers();
}

export async function saveWorker(input: Worker): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    if (!input.name.trim()) return { ok: false, message: "이름을 입력하세요." };
    const list = await loadWorkers();
    const users = await getUsers();
    const isNew = !list.some((w) => w.id === input.id);
    if (isNew && (users.some((u) => u.name === input.name.trim()) || list.some((w) => w.name === input.name.trim()))) return { ok: false, message: "같은 이름의 직원이 이미 있습니다." };
    const rec: Worker = { ...input, name: input.name.trim(), team: input.team.trim() || "현장", phone: input.phone?.trim() || undefined, memo: input.memo?.trim() || undefined };
    await getStore().set("workers", isNew ? [...list, rec] : list.map((w) => (w.id === rec.id ? rec : w)));
    await audit({ user: me.name, userId: me.id, action: isNew ? "현장 직원 추가" : "현장 직원 수정", target: rec.name, detail: rec.team });
    revalidatePath("/dashboard/admin/employees");
    return { ok: true, message: `${rec.name} 님을 ${isNew ? "추가" : "저장"}했습니다.` };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

export async function deleteWorker(id: string): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const list = await loadWorkers();
    const w = list.find((x) => x.id === id);
    if (!w) return { ok: false, message: "없는 직원입니다." };
    await getStore().set("workers", list.filter((x) => x.id !== id));
    await audit({ user: me.name, userId: me.id, action: "현장 직원 삭제", target: w.name });
    revalidatePath("/dashboard/admin/employees");
    return { ok: true, message: `${w.name} 님을 목록에서 지웠습니다. 출근 기록은 남습니다.` };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}

/** 현장 직원에게 로그인 계정 만들어 주기. 같은 id를 써서 출근부·급여 기록이 그대로 이어집니다 */
export async function promoteWorker(id: string, input: { loginId: string; password: string; role: UserRole }): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const list = await loadWorkers();
    const w = list.find((x) => x.id === id);
    if (!w) return { ok: false, message: "없는 직원입니다." };
    const loginId = input.loginId.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(loginId)) return { ok: false, message: "로그인 ID는 영문 소문자·숫자·점·밑줄 3~30자로 입력하세요." };
    if (input.password.length < 6) return { ok: false, message: "비밀번호는 6자 이상이어야 합니다." };
    const users = await getUsers();
    if (users.some((u) => u.loginId === loginId)) return { ok: false, message: "이미 사용 중인 로그인 ID입니다." };
    if (users.some((u) => u.id === id)) return { ok: false, message: "이미 계정이 있는 직원입니다." };
    const user: User = { id, loginId, name: w.name, team: w.team, role: input.role, passwordHash: hashPassword(input.password), active: true, createdAt: new Date().toISOString() };
    await saveUsers([...users, user]);
    // 현장 직원 기록은 프로필(입사일·휴대폰)로 남겨 둡니다
    await getStore().set("workers", list.map((x) => (x.id === id ? { ...x, active: true } : x)));
    await audit({ user: me.name, userId: me.id, action: "직원 계정 만들기", target: `${w.name} (${loginId})`, detail: "현장 직원 → 로그인 계정" });
    revalidatePath("/dashboard/admin/employees");
    return { ok: true, message: `${w.name} 님의 로그인 계정(${loginId})을 만들었습니다.` };
  } catch (e) { return { ok: false, message: (e as Error).message }; }
}
