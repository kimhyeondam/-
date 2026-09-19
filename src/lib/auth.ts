// 로그인 상태를 쿠키(브라우저에 저장되는 작은 출입증)에 담고 확인하는 기능입니다.
// 출입증 위조를 막기 위해 비밀키로 서명(HMAC)해 둡니다.
// Web Crypto만 사용하므로 서버와 proxy(출입 검사) 양쪽에서 동작합니다.

export const SESSION_COOKIE = "jeil_session";

const SECRET = process.env.AUTH_SECRET ?? "dev-secret-change-me-in-production";

function toBase64Url(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toBase64Url(new Uint8Array(sig));
}

export interface SessionPayload {
  userId: string;
  exp: number; // 만료 시각 (초 단위 UNIX time)
}

export async function createSessionToken(userId: string, maxAgeSeconds: number) {
  const payload: SessionPayload = { userId, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if ((await hmac(body)) !== sig) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

/** 로그인 후 돌아갈 주소. 외부 사이트로 튕기지 않도록 우리 사이트 내부 경로만 허용합니다. */
export function safeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}
