"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, SESSION_COOKIE, safeReturnTo } from "@/lib/auth";
import { findUserByLogin } from "@/lib/users";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/session";

export interface LoginState {
  error?: string;
}

const ONE_DAY = 60 * 60 * 24;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const id = String(formData.get("id") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));

  if (!id || !password) return { error: "로그인 ID와 비밀번호를 모두 입력해 주세요." };

  const user = await findUserByLogin(id, password);
  if (!user) {
    await audit({ user: id, action: "로그인 실패", detail: "ID 또는 비밀번호 불일치" });
    return { error: "로그인 ID 또는 비밀번호가 올바르지 않습니다." };
  }
  await audit({ user: user.name, userId: user.id, action: "로그인", detail: remember ? "로그인 상태 유지" : "" });

  const maxAge = remember ? ONE_DAY * 30 : ONE_DAY;
  const token = await createSessionToken(user.id, maxAge);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge } : {}), // 유지 안 함 → 브라우저를 닫으면 로그아웃
  });

  redirect(returnTo);
}

export async function logout() {
  const me = await getCurrentUser();
  if (me) await audit({ user: me.name, userId: me.id, action: "로그아웃" });
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
