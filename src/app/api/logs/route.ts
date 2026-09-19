// 활동 기록 조회: 관리자는 전체, 직원은 본인 기록만
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getAuditLog } from "@/lib/audit";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 500, 2000);
  let log = await getAuditLog();
  if (user.role !== "관리자") log = log.filter((l) => l.userId === user.id);
  return NextResponse.json({ log: log.slice(0, limit), isAdmin: user.role === "관리자" });
}
