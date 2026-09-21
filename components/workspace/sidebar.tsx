"use client";
import { APP_VERSION } from "@/version";
import { useWorkspace } from "@/lib/store";
import { type Task } from "@/lib/types";
import {
  FileText,
  LayoutGrid,
  Leaf,
  ListTodo,
  Plus,
  Sun,
  Users,
} from "lucide-react";
import Link from "next/link";
const closed = (t: Task) => ["Completed", "Dropped"].includes(t.status);
function useWorkspaceState() {
  return useWorkspace((s) => s);
}
export function WorkspaceSidebar({
  s,
  section,
  projectId,
  today,
  setModal,
}: {
  s: ReturnType<typeof useWorkspaceState>;
  section: string;
  projectId?: string;
  today: Task[];
  setModal: (value: string | null) => void;
}) {
  return (
    <>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Leaf size={23} />
          </span>
          daymark<span className="brand-dot">.</span>
        </Link>
        <nav>
          {[
            ["overview", "/", "Overview", LayoutGrid],
            ["my-day", "/my-day", "My Day", Sun],
            ["tasks", "/tasks", "All tasks", ListTodo],
            ["teams", "/teams", "People & teams", Users],
            ["notes", "/notes", "Notes", FileText],
          ].map(([key, href, label, Icon]) => {
            const I = Icon as typeof Sun;
            return (
              <Link
                key={key as string}
                className={`nav-link ${section === key ? "active" : ""}`}
                href={href as string}
              >
                <I size={18} />
                {label as string}
                {key === "my-day" && (
                  <span className="nav-count">
                    {today.filter((t) => !closed(t)).length}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="project-heading">
          <p className="nav-label">PROJECTS</p>
          <button
            aria-label="Create project"
            onClick={() => setModal("project")}
          >
            <Plus size={16} />
          </button>
        </div>
        <nav>
          {s.data.projects.map((p, i) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className={`nav-link ${projectId === p.id ? "active" : ""}`}
            >
              <span className={`project-dot dot-${i % 4}`} />
              <span className="truncate">{p.name}</span>
            </Link>
          ))}
          {!s.data.projects.length && (
            <p className="sidebar-hint">
              A fresh start. Create your first project.
            </p>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="online-dot" />
          Personal mode <span>Signed in securely</span>
          <span aria-label="App version">Version {APP_VERSION}</span>
        </div>
      </aside>
    </>
  );
}
