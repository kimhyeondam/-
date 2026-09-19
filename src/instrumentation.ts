// Next.js 가 서버를 켤 때 한 번 실행하는 파일. 첫 실행 준비(회사 이름·예시 자료 여부)를 여기서 합니다.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureBootstrap } = await import("@/lib/bootstrap");
  await ensureBootstrap();
}
