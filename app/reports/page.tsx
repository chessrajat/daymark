import { authenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReportsPage } from "@/components/reports/reports-page";
export default async function Page() {
  if (!(await authenticated())) redirect("/login");
  return <ReportsPage />;
}
