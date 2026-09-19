import { authenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TaskPage } from "@/components/tasks/task-page";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await authenticated())) redirect("/login");
  const { id } = await params;
  return <TaskPage id={id} />;
}
