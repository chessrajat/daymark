"use client";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/store";
import { isOverdue } from "@/lib/target-date";
import { assignedDays, localDay, statuses, type Task } from "@/lib/types";
import { Check, Clock3, Sun, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

export function TaskRow({ task: t, day }: { task: Task; day: string }) {
  const s = useWorkspace((s) => s);
  const path = usePathname();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"dependency" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const run = async (body: unknown) => {
    setBusy(true);
    setError("");
    try {
      await s.command(body);
      setError("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
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
        <select
          className={`badge task-list-status status-${t.status.toLowerCase().replaceAll(" ", "-")}`}
          aria-label={`Status for ${t.title}`}
          value={t.status}
          disabled={busy}
          onChange={(event) => {
            const status = event.target.value as Task["status"];
            if (status === "Dependent") {
              setReason(t.dependency_reason || "");
              setError("");
              setDialog("dependency");
            } else void run({ action: "status", id: t.id, status });
          }}
        >
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
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
        <div className="task-row-actions">
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
        <Button size="icon" variant="ghost" className="task-delete-button"
          aria-label={`Delete ${t.title}`} title="Delete task" disabled={busy}
          onClick={() => { setError(""); setDialog("delete"); }}>
          <Trash2 size={16} aria-hidden="true" />
        </Button>
        </div>
      </div>
      {!dialog && error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open && !busy) setDialog(null); }}>
        <DialogContent>
          <DialogTitle className="text-xl font-semibold">
            {dialog === "delete" ? "Delete task?" : "Set task as dependent"}
          </DialogTitle>
          <DialogDescription className="my-4 text-sm text-stone-500">
            {dialog === "delete" ? `Permanently delete “${t.title}” and its updates, attachments, and My Day entries? This cannot be undone.` :
              "Explain who or which task you are waiting on and why."}
          </DialogDescription>
          <form className="form-stack" onSubmit={async (event) => {
            event.preventDefault();
            if (busy || !dialog) return;
            const saved = await run(dialog === "delete" ? { action: "delete_task", id: t.id } :
              { action: "status", id: t.id, status: "Dependent", dependency_reason: reason });
            if (saved) setDialog(null);
          }}>
            {dialog === "dependency" && <label>
              Dependency reason
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} required disabled={busy} />
            </label>}
            {error && <p role="alert" className="error">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setDialog(null)}>Cancel</Button>
              <Button disabled={busy || (dialog === "dependency" && !reason.trim())}
                className={dialog === "delete" ? "bg-red-700 hover:bg-red-800" : undefined}>
                {busy ? "Saving…" : dialog === "delete" ? "Delete task" : "Update status"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
