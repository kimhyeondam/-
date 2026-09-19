import DriverClient from "./DriverClient";

export const metadata = { title: "납품 확인" };

export default async function DeliverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <DriverClient token={token} />;
}
