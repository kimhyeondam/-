// 메일 서버와 실제로 통신하는 부분: IMAP(읽기) / SMTP(보내기)
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { simpleParser } from "mailparser";
import { credentialsOf, type MailAccount } from "./accounts";

export type Folder = "inbox" | "sent";

export interface MailSummary {
  uid: number;
  subject: string;
  from: string; // "이름 <주소>"
  fromAddress: string;
  to: string;
  date: string; // ISO
  seen: boolean;
  hasAttachment: boolean;
}

export interface MailDetail extends MailSummary {
  text: string;
  html?: string;
  cc?: string;
  attachments: { filename: string; size: number; contentType: string }[];
}

export interface Attachment {
  filename: string;
  contentBase64: string;
  contentType?: string;
}

function imapClient(a: MailAccount) {
  const { user, pass } = credentialsOf(a);
  return new ImapFlow({
    host: a.imapHost,
    port: a.imapPort,
    secure: a.imapPort === 993,
    auth: { user, pass },
    logger: false,
    // 검사용 로컬 서버(암호화 없음)를 위해: 993이 아니면 STARTTLS 자동 시도를 끕니다
    ...(a.imapPort === 993 ? {} : { disableAutoIdle: true }),
  });
}

function fmtAddr(list?: { name?: string; address?: string }[]) {
  return (list ?? []).map((x) => (x.name ? `${x.name} <${x.address ?? ""}>` : x.address ?? "")).join(", ");
}

/** 보낸 편지함 이름 찾기 (네이버/지메일/다음마다 다름) */
async function sentFolder(client: ImapFlow) {
  const boxes = await client.list();
  const special = boxes.find((b) => b.specialUse === "\\Sent");
  if (special) return special.path;
  const candidates = ["Sent", "Sent Messages", "Sent Items", "보낸편지함", "보낸 편지함", "[Gmail]/Sent Mail"];
  const found = boxes.find((b) => candidates.includes(b.path) || candidates.includes(b.name));
  return found?.path ?? "Sent";
}

async function withImap<T>(a: MailAccount, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = imapClient(a);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => {});
  }
}

export class MailStepError extends Error {
  step: "imap" | "smtp";
  serverText?: string;
  authenticationFailed?: boolean;
  constructor(step: "imap" | "smtp", cause: unknown) {
    const c = cause as { message?: string; responseText?: string; response?: string; authenticationFailed?: boolean; responseCode?: string | number; serverResponseCode?: string };
    super(c?.message ?? String(cause));
    this.step = step;
    this.serverText = (c?.responseText ?? c?.response ?? "").toString().trim() || undefined;
    this.authenticationFailed = !!c?.authenticationFailed || c?.responseCode === "EAUTH" || c?.responseCode === 535 || c?.serverResponseCode === "AUTHENTICATIONFAILED";
  }
}

export async function testConnection(a: MailAccount) {
  try {
    await withImap(a, async (client) => {
      await client.mailboxOpen("INBOX", { readOnly: true });
    });
  } catch (e) {
    throw new MailStepError("imap", e);
  }
  const { user, pass } = credentialsOf(a);
  const transport = nodemailer.createTransport({ host: a.smtpHost, port: a.smtpPort, secure: a.smtpPort === 465, auth: { user, pass } });
  try {
    await transport.verify();
  } catch (e) {
    throw new MailStepError("smtp", e);
  }
}

export async function listMessages(a: MailAccount, folder: Folder, opts: { limit?: number; q?: string } = {}): Promise<MailSummary[]> {
  const limit = opts.limit ?? 50;
  return withImap(a, async (client) => {
    const path = folder === "inbox" ? "INBOX" : await sentFolder(client);
    const box = await client.mailboxOpen(path, { readOnly: true });
    if (!box.exists) return [];
    let uids: number[];
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      uids = (await client.search({ or: [{ subject: q }, { from: q }, { to: q }, { body: q }] }, { uid: true })) as number[];
    } else {
      uids = (await client.search({ all: true }, { uid: true })) as number[];
    }
    uids = uids.sort((x, y) => y - x).slice(0, limit);
    if (!uids.length) return [];
    const out: MailSummary[] = [];
    for await (const msg of client.fetch(uids, { uid: true, envelope: true, flags: true, bodyStructure: true }, { uid: true })) {
      const env = msg.envelope;
      const struct = msg.bodyStructure as { childNodes?: { disposition?: string }[] } | undefined;
      out.push({
        uid: msg.uid,
        subject: env?.subject ?? "(제목 없음)",
        from: fmtAddr(env?.from),
        fromAddress: env?.from?.[0]?.address ?? "",
        to: fmtAddr(env?.to),
        date: env?.date ? new Date(env.date).toISOString() : "",
        seen: msg.flags?.has("\\Seen") ?? false,
        hasAttachment: !!struct?.childNodes?.some((n) => n.disposition === "attachment"),
      });
    }
    return out.sort((x, y) => y.uid - x.uid);
  });
}

export async function getMessage(a: MailAccount, folder: Folder, uid: number): Promise<MailDetail | null> {
  return withImap(a, async (client) => {
    const path = folder === "inbox" ? "INBOX" : await sentFolder(client);
    await client.mailboxOpen(path, { readOnly: false });
    const msg = await client.fetchOne(String(uid), { uid: true, envelope: true, flags: true, source: true }, { uid: true });
    if (!msg || !msg.source) return null;
    const parsed = await simpleParser(msg.source);
    if (folder === "inbox" && !msg.flags?.has("\\Seen")) await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }).catch(() => {});
    const env = msg.envelope;
    return {
      uid,
      subject: parsed.subject ?? env?.subject ?? "(제목 없음)",
      from: fmtAddr(env?.from),
      fromAddress: env?.from?.[0]?.address ?? "",
      to: fmtAddr(env?.to),
      cc: fmtAddr(env?.cc) || undefined,
      date: (parsed.date ?? (env?.date ? new Date(env.date) : new Date())).toISOString(),
      seen: true,
      hasAttachment: (parsed.attachments?.length ?? 0) > 0,
      text: parsed.text ?? "",
      html: typeof parsed.html === "string" ? parsed.html : undefined,
      attachments: (parsed.attachments ?? []).map((at) => ({ filename: at.filename ?? "첨부파일", size: at.size, contentType: at.contentType })),
    };
  });
}

export async function sendMail(a: MailAccount, input: { to: string; cc?: string; subject: string; text: string; attachments?: Attachment[]; fromName?: string }) {
  const { user, pass } = credentialsOf(a);
  const mail = {
    from: input.fromName ? `"${input.fromName}" <${a.email}>` : a.email,
    to: input.to,
    cc: input.cc || undefined,
    subject: input.subject,
    text: input.text,
    attachments: (input.attachments ?? []).map((at) => ({ filename: at.filename, content: Buffer.from(at.contentBase64, "base64"), contentType: at.contentType })),
  };
  const raw = await new MailComposer(mail).compile().build();
  const transport = nodemailer.createTransport({ host: a.smtpHost, port: a.smtpPort, secure: a.smtpPort === 465, auth: { user, pass } });
  const info = await transport.sendMail({ envelope: { from: a.email, to: [input.to, input.cc].filter(Boolean).flatMap((s) => String(s).split(",").map((x) => x.trim())) }, raw });
  // 보낸 편지함에도 남겨 두기 (실패해도 발송은 완료된 것)
  await withImap(a, async (client) => {
    const path = await sentFolder(client);
    await client.append(path, raw, ["\\Seen"]).catch(() => {});
  }).catch(() => {});
  return { messageId: info.messageId };
}
