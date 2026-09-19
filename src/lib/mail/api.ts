// API 경로들이 함께 쓰는 도우미: 로그인 확인 + 계정 접근 권한 확인
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getMailAccounts, canUse, type MailAccount } from "./accounts";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  return { user };
}

export async function requireAccount(accountId: string | null, userId: string): Promise<{ account: MailAccount } | { error: NextResponse }> {
  if (!accountId) return { error: NextResponse.json({ error: "계정을 선택하세요." }, { status: 400 }) };
  const account = (await getMailAccounts()).find((a) => a.id === accountId);
  if (!account || !canUse(account, userId)) return { error: NextResponse.json({ error: "이 메일 계정을 사용할 권한이 없습니다." }, { status: 403 }) };
  return { account };
}

const providerHints: Record<string, string> = {
  naver: "네이버: ① 메일 환경설정 → POP3/IMAP 설정 → 「IMAP/SMTP 설정」 탭에서 '사용함' 저장 ② 2단계 인증을 켰다면 네이버 내정보 → 보안설정 → 애플리케이션 비밀번호에서 발급한 비밀번호 사용(안 켰으면 네이버 로그인 비밀번호) ③ 네이버 메일함에 '새로운 환경 로그인 차단' 안내가 왔으면 허용",
  gmail: "지메일: 2단계 인증을 켜고 '앱 비밀번호' 16자리를 넣으세요(띄어쓰기는 자동으로 지웁니다). 아이디는 전체 이메일 주소입니다.",
  daum: "다음: 메일 설정 → IMAP/POP3 에서 IMAP 사용을 켜세요.",
};

export function friendlyMailError(e: unknown, provider?: string) {
  const err = e as { message?: string; step?: "imap" | "smtp"; serverText?: string; authenticationFailed?: boolean; responseCode?: string };
  const msg = err?.message ?? String(e);
  const where = err?.step === "smtp" ? "보내기 서버(SMTP)" : err?.step === "imap" ? "받기 서버(IMAP)" : "메일 서버";
  const said = err?.serverText ? ` 서버 응답: "${err.serverText.slice(0, 160)}"` : "";
  const hint = provider && providerHints[provider] ? ` ${providerHints[provider]}` : "";
  const authFailed = err?.authenticationFailed || err?.responseCode === "EAUTH" || /auth|login|credential|invalid|535|AUTHENTICATIONFAILED/i.test(msg);
  if (authFailed) return `${where}가 로그인을 거절했습니다.${said}${hint}`;
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|timeout|ECONNRESET/i.test(msg)) return `${where}에 연결하지 못했습니다. 서버 주소·포트와 네트워크를 확인하세요.${said}`;
  return `${where} 처리 중 오류: ${msg.slice(0, 200)}${said}`;
}
