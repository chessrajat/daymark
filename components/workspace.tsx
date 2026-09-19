"use client";
import { ModuleSidebar } from "./workspace/module-sidebar";
import { Overview } from "./workspace/overview";
import { PeopleTable } from "./workspace/people-table";
import { TaskFilterControls } from "./workspace/task-filter-controls";

import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/store";
import { localDay, statuses, type Task } from "@/lib/types";
import { Leaf, ListTodo, Loader2, Plus, Users } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CreateModal } from "./workspace/create-modal";
import { WorkspaceSidebar } from "./workspace/sidebar";
import { matchesFilters } from "./workspace/task-filters";
import { TaskRow } from "./workspace/task-row";
import { WorkspaceTopbar } from "./workspace/topbar";
const closed = (t: Task) => ["Completed", "Dropped"].includes(t.status);
export function Workspace() {
  const s = useWorkspace((s) => s);
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "project") next.delete("module");
    router.push("/tasks" + (next.size ? "?" + next.toString() : ""), {
      scroll: false,
    });
  }
  const section = path.split("/")[1] || "overview";
  const projectId = section === "projects" ? path.split("/")[2] : undefined;
  const moduleId =
    projectId && path.split("/")[3] === "modules"
      ? path.split("/")[4]
      : undefined;
  const [modal, setModal] = useState<string | null>(null);
  const [status, setStatus] = useState("All statuses");
  const [day, setDay] = useState("");
  useEffect(() => {
    setDay(localDay());
    void s.refresh();
  }, []); // store is scoped to this mounted workspace
  const project = s.data.projects.find((p) => p.id === projectId);
  const module = s.data.modules.find(
    (m) => m.id === moduleId && m.project_id === projectId,
  );
  const today = s.data.tasks.filter((t) => t.my_days.includes(day));
  const base =
    section === "my-day"
      ? today
      : projectId
        ? s.data.tasks.filter(
            (t) =>
              t.project_id === projectId &&
              (!moduleId ||
                (moduleId === "unfiled"
                  ? !t.module_id
                  : t.module_id === moduleId)),
          )
        : s.data.tasks;
  const tasks = base.filter(
    (t) =>
      (section === "tasks"
        ? !params.get("status") || t.status === params.get("status")
        : status === "All statuses" || t.status === status) &&
      (section !== "tasks" || matchesFilters(t, params, s.data.members)) &&
      `${t.title} ${t.description}`
        .toLowerCase()
        .includes(s.search.toLowerCase()),
  );
  const active = s.data.tasks.filter((t) => !closed(t));

  return (
    <div className="shell">
      <WorkspaceSidebar
        s={s}
        section={section}
        projectId={projectId}
        today={today}
        setModal={setModal}
      />{" "}
      <main>
        <WorkspaceTopbar s={s} section={section} project={project} />{" "}
        <div className="page">
          <div className="page-heading">
            <div>
              <p className="eyebrow">YOUR SPACE TO MAKE PROGRESS</p>
              <h1>
                {project?.name ||
                  {
                    overview: "A little more clarity.",
                    "my-day": "Make room for what matters.",
                    tasks: "Every task, in one place.",
                    teams: "Good work is a team effort.",
                  }[section] ||
                  "Projects"}
              </h1>
              <p className="subtitle">
                {project?.description ||
                  {
                    overview: "See the big picture. Take the next small step.",
                    "my-day":
                      "A focused plan for your day. One task at a time.",
                    tasks: "From the first idea to the final checkmark.",
                    teams: "Keep track of who’s doing what, and for how long.",
                  }[section]}
              </p>
            </div>
            <Button
              onClick={() =>
                setModal(
                  section === "teams"
                    ? "team"
                    : s.data.projects.length
                      ? "task"
                      : "project",
                )
              }
            >
              <Plus size={16} />
              {section === "teams"
                ? "New team"
                : s.data.projects.length
                  ? "New task"
                  : "New project"}
            </Button>
          </div>
          {s.error && (
            <div role="alert" className="error">
              {s.error}
              <Button variant="outline" size="sm" onClick={() => s.refresh()}>
                Retry
              </Button>
            </div>
          )}
          {s.loading ? (
            <div className="empty">
              <Loader2 className="animate-spin" />
              Loading your workspace…
            </div>
          ) : (
            <>
              {section === "overview" && (
                <Overview
                  s={s}
                  active={active}
                  today={today}
                  setModal={setModal}
                />
              )}
              {section === "teams" ? (
                <>
                  <div className="section-heading">
                    <h2>People & workload</h2>
                    <Button
                      variant="outline"
                      onClick={() => setModal("member")}
                    >
                      <Plus size={16} />
                      Add member
                    </Button>
                  </div>
                  <PeopleTable s={s} />
                  {!s.data.teams.length && !s.data.members.length && (
                    <div className="empty">
                      <Users size={30} />
                      <h3>Bring your people into the picture</h3>
                      <p>
                        Create a team, add members, then assign work from any
                        task.
                      </p>
                      <Button onClick={() => setModal("team")}>
                        Create your first team
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className={project ? "project-layout" : ""}>
                  {project && (
                    <ModuleSidebar
                      s={s}
                      project={project}
                      moduleId={moduleId}
                      setModal={setModal}
                    />
                  )}
                  <section className="project-task-content">
                    <div className="section-heading">
                      <h2>
                        {section === "my-day"
                          ? "Your daily focus"
                          : section === "overview"
                            ? "Recent tasks"
                            : module?.name ||
                              (moduleId === "unfiled"
                                ? "Tasks without a module"
                                : "Tasks")}{" "}
                        <span>{base.length}</span>
                      </h2>
                      <div className="toolbar">
                        {section === "my-day" && (
                          <>
                            <input
                              aria-label="Planning date"
                              type="date"
                              value={day}
                              onChange={(e) => setDay(e.target.value)}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setModal("plan")}
                            >
                              <Plus size={14} />
                              Add existing task
                            </Button>
                          </>
                        )}
                        <select
                          aria-label="Filter by status"
                          value={
                            section === "tasks"
                              ? params.get("status") || "All statuses"
                              : status
                          }
                          onChange={(e) =>
                            section === "tasks"
                              ? setFilter(
                                  "status",
                                  e.target.value === "All statuses"
                                    ? ""
                                    : e.target.value,
                                )
                              : setStatus(e.target.value)
                          }
                        >
                          <option>All statuses</option>
                          {statuses.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {section === "tasks" && (
                      <>
                        <TaskFilterControls
                          s={s}
                          params={params}
                          setFilter={setFilter}
                        />
                        <div className="filter-summary">
                          <span>
                            Showing {tasks.length} of {base.length} tasks
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              s.setSearch("");
                              router.push("/tasks", { scroll: false });
                            }}
                          >
                            Clear filters
                          </Button>
                        </div>
                      </>
                    )}
                    <div className="task-table">
                      <div className="task-row table-head">
                        <span>Task name</span>
                        <span>Status</span>
                        <span>Assigned to</span>
                        <span>Assigned for</span>
                        <span>My Day</span>
                      </div>
                      {tasks
                        .slice(0, section === "overview" ? 8 : undefined)
                        .map((t) => (
                          <TaskRow key={t.id} task={t} day={day} />
                        ))}
                      {!tasks.length && (
                        <div className="empty">
                          <ListTodo size={30} />
                          <h3>
                            {base.length
                              ? "No matching tasks"
                              : section === "my-day"
                                ? "A little breathing room."
                                : "Ready for a fresh start?"}
                          </h3>
                          <p>
                            {base.length
                              ? "Try another search or status."
                              : section === "my-day"
                                ? "Add tasks from your projects to shape your day."
                                : "Create a task and turn an idea into your next step."}
                          </p>
                          <Button
                            variant="outline"
                            onClick={() =>
                              setModal(
                                section === "my-day"
                                  ? "plan"
                                  : s.data.projects.length
                                    ? "task"
                                    : "project",
                              )
                            }
                          >
                            {section === "my-day"
                              ? "Choose tasks"
                              : s.data.projects.length
                                ? "Create a task"
                                : "Create a project"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
          <footer>
            Less noise. More forward motion.
            <Leaf size={13} />
          </footer>
        </div>
      </main>
      <CreateModal
        kind={modal}
        close={() => setModal(null)}
        projectId={projectId}
        moduleId={module?.id}
        day={day}
      />
    </div>
  );
}
