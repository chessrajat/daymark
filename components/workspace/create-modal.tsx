"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/store";
import { type Task } from "@/lib/types";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { TaskRow } from "./task-row";
const closed = (t: Task) => ["Completed", "Dropped"].includes(t.status);
export function CreateModal({
  kind,
  close,
  projectId,
  moduleId,
  day,
}: {
  kind: string | null;
  close: () => void;
  projectId?: string;
  moduleId?: string;
  day: string;
}) {
  const s = useWorkspace((s) => s);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [chosenProject, setChosenProject] = useState(projectId || "");
  const [chosenModule, setChosenModule] = useState(moduleId || "");
  useEffect(() => {
    setError("");
    setChosenProject(projectId || s.data.projects[0]?.id || "");
    setChosenModule(moduleId || "");
  }, [kind, projectId, moduleId]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await s.command({
        action: kind,
        ...f,
        ...(kind === "module" ? { project_id: projectId } : {}),
        ...(kind === "task" ? { module_id: chosenModule || null, target_date: f.target_date || null } : {}),
        ...(kind === "member" ? { team_id: f.team_id || null } : {}),
      });
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={!!kind}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent>
        <DialogTitle className="text-xl font-semibold">
          {kind === "plan"
            ? "Make a little space for progress"
            : `Create ${kind === "member" ? "a member" : `a ${kind}`}`}
        </DialogTitle>
        <DialogDescription className="mt-2 mb-6 text-sm text-stone-500">
          {kind === "plan"
            ? `Choose tasks for ${day}. Your projects stay organized.`
            : "Start with the essentials. You can take it from there."}
        </DialogDescription>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {kind === "plan" ? (
          <div className="plan-list">
            {s.data.tasks
              .filter((t) => !closed(t) || t.my_days.includes(day))
              .map((t) => (
                <TaskRow key={t.id} task={t} day={day} />
              ))}
            {!s.data.tasks.length && <p>Create a project and a task first.</p>}
          </div>
        ) : (
          <form onSubmit={submit} className="form-stack">
            <label>
              {kind === "task" ? "Task title" : "Name"}
              <input
                name={kind === "task" ? "title" : "name"}
                required
                maxLength={200}
                placeholder={
                  kind === "project"
                    ? "e.g. Website refresh"
                    : kind === "task"
                      ? "What needs to get done?"
                      : "Give it a name"
                }
                autoFocus
              />
            </label>
            {(kind === "task" || kind === "project") && (
              <label>
                Description
                <textarea
                  name="description"
                  maxLength={10000}
                  placeholder="A little context goes a long way…"
                  rows={3}
                />
              </label>
            )}
            {kind === "task" && (
              <>
                <label>
                  Project
                  <select
                    name="project_id"
                    value={chosenProject}
                    onChange={(e) => {
                      setChosenProject(e.target.value);
                      setChosenModule("");
                    }}
                    required
                  >
                    {s.data.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Module
                  <select
                    name="module_id"
                    value={chosenModule}
                    onChange={(e) => setChosenModule(e.target.value)}
                  >
                    <option value="">No module</option>
                    {s.data.modules
                      .filter((m) => m.project_id === chosenProject)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Target date (optional)
                  <input type="date" name="target_date" max="9999-12-31" />
                </label>
                <label>
                  Priority
                  <select name="priority" defaultValue="Medium">
                    {["Low", "Medium", "High"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {kind === "member" && (
              <label>
                Team
                <select name="team_id">
                  <option value="">Independent member</option>
                  {s.data.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button disabled={busy}>
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              Create {kind}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
