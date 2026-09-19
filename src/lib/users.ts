// 직원 계정 (서버 저장소에 보관, 비밀번호는 scrypt로 암호화)
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getStore, USERS_COLLECTION } from "@/lib/store";
import { members } from "@/data/sample";

export type UserRole = "관리자" | "직원";

export interface User {
  id: string; // 내부 고유번호
  loginId: string; // 로그인 ID
  name: string;
  team: string;
  role: UserRole;
  passwordHash: string; // "salt:hash"
  active: boolean;
  createdAt: string;
}

export type PublicUser = Omit<User, "passwordHash">;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 처음 실행 시 관리자 1명 + 예시 직원들을 만들어 둡니다. */
function seedUsers(): User[] {
  const now = new Date().toISOString();
  const adminId = process.env.ADMIN_ID ?? "admin";
  const adminPw = process.env.ADMIN_PASSWORD ?? "hyundam1234";
  const users: User[] = [{ id: "u_admin", loginId: adminId, name: "관리자", team: "경영지원", role: "관리자", passwordHash: hashPassword(adminPw), active: true, createdAt: now }];
  members
    .filter((m) => m.id !== "admin")
    .forEach((m, i) => users.push({ id: `u_${m.id}`, loginId: `staff${i + 1}`, name: m.name, team: m.team, role: "직원", passwordHash: hashPassword("hyundam1234"), active: true, createdAt: now }));
  return users;
}

export async function getUsers(): Promise<User[]> {
  const store = getStore();
  const row = await store.get<User[]>(USERS_COLLECTION);
  if (row) return row.data;
  const seeded = seedUsers();
  await store.set(USERS_COLLECTION, seeded);
  return seeded;
}

export async function saveUsers(users: User[]) {
  await getStore().set(USERS_COLLECTION, users);
}

export function toPublic(u: User): PublicUser {
  const { passwordHash: _omit, ...rest } = u; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
}

export async function findUserByLogin(loginId: string, password: string): Promise<User | null> {
  const users = await getUsers();
  const u = users.find((x) => x.loginId === loginId && x.active);
  if (!u || !verifyPassword(password, u.passwordHash)) return null;
  return u;
}

export async function findUserById(id: string): Promise<User | null> {
  return (await getUsers()).find((x) => x.id === id && x.active) ?? null;
}

/** 담당자 선택 목록에 쓰는 활성 직원 (이름·팀) */
export async function getMembers() {
  const accounts = (await getUsers()).filter((u) => u.active).map((u) => ({ id: u.id, name: u.name, team: u.team }));
  // 직원출근부에서 추가한 현장 직원(로그인 계정 없음)도 담당자·출근부·생산일보 인원에 포함
  try {
    const row = await getStore().get<{ id: string; name: string; team: string; active: boolean }[]>("workers");
    const extra = (Array.isArray(row?.data) ? row!.data : []).filter((w) => w.active && !accounts.some((a) => a.name === w.name)).map((w) => ({ id: w.id, name: w.name, team: w.team }));
    return [...accounts, ...extra];
  } catch { return accounts; }
}
