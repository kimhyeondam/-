import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { findUserById, toPublic, type PublicUser } from "@/lib/users";

/** 서버 컴포넌트/서버 액션/API에서 현재 로그인한 사용자를 가져옵니다. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const store = await cookies();
  const payload = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const u = await findUserById(payload.userId);
  return u ? toPublic(u) : null;
}
