// 연동된 메일 계정 (서버 저장소 "mailAccounts" 컬렉션, 화면 데이터 API에는 노출되지 않음)
import { getStore } from "@/lib/store";
import { encrypt, decrypt } from "./crypto";

import { providerPresets, type MailProvider, type PublicMailAccount } from "./presets";
export { providerPresets, type MailProvider, type PublicMailAccount };

export interface MailAccount extends PublicMailAccount {
  user: string; // 로그인 아이디 (보통 이메일 또는 네이버 아이디)
  passwordEnc: string; // 암호화된 비밀번호
}



const COLLECTION = "mailAccounts";

export async function getMailAccounts(): Promise<MailAccount[]> {
  const row = await getStore().get<MailAccount[]>(COLLECTION);
  return Array.isArray(row?.data) ? row.data : [];
}

export async function saveMailAccounts(list: MailAccount[]) {
  await getStore().set(COLLECTION, list);
}

export function toPublic(a: MailAccount): PublicMailAccount {
  const { passwordEnc: _p, user: _u, ...rest } = a; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
}

/** 이 직원이 볼 수 있는 계정: 공용 계정 + 본인 계정 */
export function visibleTo(accounts: MailAccount[], userId: string) {
  return accounts.filter((a) => a.shared || a.ownerId === userId);
}

export function canUse(a: MailAccount, userId: string) {
  return a.shared || a.ownerId === userId;
}

export function credentialsOf(a: MailAccount) {
  return { user: a.user, pass: decrypt(a.passwordEnc) };
}

export function encryptPassword(p: string) {
  return encrypt(p);
}
