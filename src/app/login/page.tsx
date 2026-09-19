import LoginForm from "./LoginForm";
import { safeReturnTo } from "@/lib/auth";
import { brandOf, loadCompany } from "@/lib/branding";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  const company = await loadCompany();
  return <LoginForm returnTo={safeReturnTo(returnTo)} brand={{ name: company.name, shortName: brandOf(company).shortName, logoMark: company.logoMark, logo: company.logo }} />;
}
