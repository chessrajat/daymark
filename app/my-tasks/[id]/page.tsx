import { currentSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MemberTaskDetail } from "@/components/member/member-task-detail";

export default async function MyTaskDetailPage() {
  const session = await currentSession();
  if (!session) redirect("/login");
  if (session.role !== "member") redirect("/");
  return <MemberTaskDetail />;
}
