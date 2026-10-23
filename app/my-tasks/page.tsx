import { currentSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MemberTasks } from "@/components/member/member-tasks";

export default async function MyTasksPage() {
  const session = await currentSession();
  if (!session) redirect("/login");
  if (session.role !== "member") redirect("/");
  return <MemberTasks name={session.name} />;
}
