"use client";
import { LogoutButton } from "@/components/logout-button";
import { useWorkspace } from "@/lib/store";
import { localDay } from "@/lib/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { TaskDetail } from "./task-detail";
export function TaskPage({ id }: { id: string }) {
  const s = useWorkspace((s) => s);
  const params = useSearchParams();
  const [day, setDay] = useState("");
  useEffect(() => {
    setDay(localDay());
    void s.refresh();
  }, [id]);
  const task = s.data.tasks.find((t) => t.id === id);
  const from = params.get("from");
  const back =
    from &&
    /^\/(tasks|projects|my-day|teams)(\/|\?|$)/.test(from) &&
    !from.includes("\\")
      ? from
      : "/tasks";
  return (
    <main className="task-page">
      <header className="topbar">
        <Link href={back}>← Back to tasks</Link>
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </header>
      <div className="task-page-content">
        {s.loading ? (
          <p>Loading task…</p>
        ) : s.error ? (
          <div role="alert" className="error">
            {s.error}
            <button onClick={() => s.refresh()}>Retry</button>
          </div>
        ) : task ? (
          <TaskDetail key={task.id} task={task} day={day} />
        ) : (
          <div className="empty">
            <h1>Task not found</h1>
            <p>This task may have been deleted.</p>
            <Link href="/tasks">View all tasks</Link>
          </div>
        )}
      </div>
    </main>
  );
}
