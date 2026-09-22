"use client";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/store";
import { isOverdue } from "@/lib/target-date";
import { assignedDays, localDay, type Task } from "@/lib/types";
import { Check, Clock3, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

export function TaskRow({ task: t, day }: { task: Task; day: string }) {
  const s = useWorkspace((s) => s);
  const path = usePathname();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (body: unknown) => {
    setBusy(true);
    try {
      await s.command(body);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="task-row">
        <Link
          className="task-name"
          href={`/tasks/${t.id}?from=${encodeURIComponent(path + (params.size ? "?" + params.toString() : ""))}`}
        >
          <span
            className={`task-circle ${t.status === "Completed" ? "done" : ""}`}
          >
            {t.status === "Completed" && <Check size={12} />}
          </span>
          <span>
            <strong>{t.title}</strong>
            <small>
              {s.data.projects.find((p) => p.id === t.project_id)?.name}{" "}
              <span className={`priority priority-${t.priority.toLowerCase()}`}>
                · {t.priority}
              </span>
            </small>
            {t.target_date && (
              <small className={isOverdue(t.target_date, t.status, localDay()) ? "target-date overdue" : "target-date"}>
                Target: {t.target_date}{isOverdue(t.target_date, t.status, localDay()) && " - Overdue"}
              </small>
            )}
          </span>
        </Link>
        <span
          className={`badge status-${t.status.toLowerCase().replaceAll(" ", "-")}`}
        >
          {t.status}
        </span>
        <span className="assignee">
          {s.data.members.find((m) => m.id === t.member_id)?.name ||
            s.data.teams.find((m) => m.id === t.team_id)?.name || (
              <span className="muted">Unassigned</span>
            )}
        </span>
        <span className="age">
          {t.assigned_at ? (
            <>
              <Clock3 size={13} />
              {assignedDays(t.assigned_at)} days
            </>
          ) : (
            "—"
          )}
        </span>
        <Button
          aria-label={
            t.my_days.includes(day) ? "Remove from My Day" : "Add to My Day"
          }
          size="icon"
          variant="ghost"
          disabled={busy || !day}
          className={
            t.my_days.includes(day) ? "text-amber-600 bg-amber-50" : ""
          }
          onClick={() =>
            run({
              action: "day",
              id: t.id,
              day,
              included: !t.my_days.includes(day),
            })
          }
        >
          <Sun size={17} />
        </Button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
