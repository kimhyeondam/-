"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginForm({ returnTo, brand }: { returnTo: string; brand?: { name: string; shortName?: string; logo?: string; logoMark?: string } }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  // 비밀번호가 틀려 화면이 다시 그려져도 ID는 지워지지 않도록 값을 기억해 둡니다.
  const [id, setId] = useState("");

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(ellipse at 15% 10%, #aaffec 0%, transparent 55%), radial-gradient(ellipse at 85% 90%, #d3e5ff 0%, transparent 55%), #f5f5f5",
      }}
    >
      <form action={action} className="w-full max-w-md rounded-2xl bg-card/90 backdrop-blur border border-line shadow-xl px-10 py-10">
        <input type="hidden" name="returnTo" value={returnTo} />

        <div className="flex flex-col items-center">
          <div className="h-24 w-24 rounded-2xl bg-white shadow-md border border-line flex items-center justify-center overflow-hidden">
            {brand?.logoMark ? <img src={brand.logoMark} alt={brand.name} className="h-16 w-16 object-contain" /> : <span className="text-3xl font-black text-primary">{brand?.shortName ?? brand?.name?.slice(0, 2)}</span>}
          </div>
          {brand?.logo && <img src={brand.logo} alt={brand.name} className="mt-4 h-8 object-contain" />}
          <h1 className="mt-6 text-2xl font-bold text-slate-800">로그인</h1>
          <p className="mt-2 text-sm text-slate-500 text-center">사내 로그인 ID와 비밀번호를 입력해 업무 공간에 접속하세요.</p>
        </div>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">로그인 ID</span>
            <div className="mt-2 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">☺</span>
              <input
                name="id"
                value={id}
                onChange={(e) => setId(e.target.value)}
                autoFocus
                autoComplete="username"
                placeholder="예: hyundam.manager"
                className="w-full rounded-xl border border-line bg-white pl-11 pr-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">이메일이 아니라 사내 로그인 ID만 입력하면 됩니다.</p>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">비밀번호</span>
            <div className="mt-2 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔒</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="비밀번호를 입력해 주세요"
                className="w-full rounded-xl border border-line bg-white pl-11 pr-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </label>

          <label className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-sm text-slate-700 cursor-pointer">
            <span>로그인 상태 유지</span>
            <input name="remember" type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
          </label>

          {state.error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{state.error}</div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-semibold py-3.5 shadow-sm transition"
          >
            {pending ? "확인 중..." : "로그인"}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          처음 관리자 계정은 <b>admin</b> 이며, 비밀번호는 서버 설정(ADMIN_PASSWORD)에서 정한 값입니다. 직원 계정은 관리자가 「직원관리」에서 만듭니다.
        </p>
      </form>
    </div>
  );
}
