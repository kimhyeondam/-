// 메일 비밀번호를 서버에 저장할 때 쓰는 암호화(AES-256-GCM).
// 열쇠는 AUTH_SECRET에서 만들어지므로, AUTH_SECRET을 바꾸면 저장된 비밀번호를 다시 등록해야 합니다.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const SECRET = process.env.AUTH_SECRET ?? "dev-secret-change-me-in-production";
const KEY = scryptSync(SECRET, "jeil-mail-credentials", 32);

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decrypt(stored: string) {
  const [iv, tag, enc] = stored.split(".").map((s) => Buffer.from(s, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
