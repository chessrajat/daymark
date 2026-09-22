"use client";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/store";
import { assignedDays, statuses, type Event, type Task } from "@/lib/types";
import { isOverdue } from "@/lib/target-date";
import { Folder, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { TaskTimeline } from "./task-timeline";
import { TaskUpdateForm } from "./task-update-form";
const stamp = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
export function TaskDetail({ task: t, day }: { task: Task; day: string }) {
  const s = useWorkspace((s) => s);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [team, setTeam] = useState(t.team_id || "");
  const [member, setMember] = useState(t.member_id || "");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  async function refresh() {
    const r = await fetch(`/api/tasks/${t.id}`);
    if (!r.ok) throw Error("Could not load the timeline.");
    setEvents(await r.json());
    setLoading(false);
  }
  useEffect(() => {
    refresh().catch((e) => {
      setError(e.message);
      setLoading(false);
    });
  }, [t.id]);
  async function run(body: unknown) {
    setBusy(true);
    setError("");
    try {
      await s.command(body);
      await refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="task-detail-layout">
      <section className="task-detail-panel" aria-label="Task details">
        <div className="detail-project">
          <Folder size={14} />
          {s.data.projects.find((p) => p.id === t.project_id)?.name}
        </div>
        <h1 className="mt-3 pr-4 text-2xl font-semibold tracking-tight">
          {t.title}
        </h1>
        <p className="mt-2 mb-5 text-xs text-stone-500">
          Created {stamp(t.created_at)}
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <label className="module-select">
          Module
          <select
            aria-label="Task module"
            value={t.module_id || ""}
            disabled={busy}
            onChange={(e) =>
              run({
                action: "move_module",
                id: t.id,
                module_id: e.target.value || null,
              })
            }
          >
            <option value="">No module</option>
            {s.data.modules
              .filter((m) => m.project_id === t.project_id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </label>
        <div className="detail-actions">
          <select
            aria-label="Task status"
            value={t.status}
            disabled={busy}
            onChange={(e) =>
              run({ action: "status", id: t.id, status: e.target.value })
            }
          >
            {statuses.map((st) => (
              <option key={st}>{st}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              run({
                action: "day",
                id: t.id,
                day,
                included: !t.my_days.includes(day),
              })
            }
          >
            <Sun size={14} />
            {t.my_days.includes(day) ? "Remove from My Day" : "Add to My Day"}
          </Button>
        </div>
        <p className={isOverdue(t.target_date, t.status, day) ? "target-date overdue" : "target-date"}>
          Target date: {t.target_date || "Not set"}
          {isOverdue(t.target_date, t.status, day) && " - Overdue"}
        </p>
        {editing ? (
          <form
            className="form-stack mt-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const fields = Object.fromEntries(new FormData(e.currentTarget));
              if (await run({ action: "edit", id: t.id, ...fields, target_date: fields.target_date || null }))
                setEditing(false);
            }}
          >
            <label>
              Title
              <input
                name="title"
                defaultValue={t.title}
                required
                maxLength={200}
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                defaultValue={t.description}
                maxLength={10000}
              />
            </label>
            <label>
              Target date (optional)
              <input type="date" name="target_date" defaultValue={t.target_date || ""} max="9999-12-31" disabled={busy} />
            </label>
            <label>
              Priority
              <select name="priority" defaultValue={t.priority}>
                {["Low", "Medium", "High"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <Button disabled={busy}>Save details</Button>
          </form>
        ) : (
          <div className="description">
            <p>{t.description || "No description yet."}</p>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit details · {t.priority} priority
            </Button>
          </div>
        )}
        <form
          className="assignment"
          onSubmit={(e) => {
            e.preventDefault();
            run({
              action: "assign",
              id: t.id,
              team_id: team || null,
              member_id: member || null,
            });
          }}
        >
          <h3>
            Assignment{" "}
            <small>
              {t.assigned_at
                ? `${assignedDays(t.assigned_at)} days · since ${stamp(t.assigned_at)}`
                : "Not assigned yet"}
            </small>
          </h3>
          <div className="assignment-fields">
            <label>
              Team
              <select
                value={team}
                onChange={(e) => {
                  setTeam(e.target.value);
                  setMember("");
                }}
              >
                <option value="">No team</option>
                {s.data.teams.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Member
              <select
                value={member}
                onChange={(e) => setMember(e.target.value)}
              >
                <option value="">Unassigned</option>
                {s.data.members
                  .filter((m) => !team || m.team_id === team)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <Button size="sm" variant="outline" disabled={busy}>
            Save assignment
          </Button>
        </form>
      </section>
      <aside className="task-activity-panel" aria-label="Timeline and updates">
        <TaskTimeline events={events} loading={loading} />
        <TaskUpdateForm
          taskId={t.id}
          targetDate={t.target_date}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          refresh={refresh}
          refreshWorkspace={s.refresh}
        />
      </aside>
    </div>
  );
}
