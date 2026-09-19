"use client";
import { Button } from "@/components/ui/button";
import { type Task } from "@/lib/types";
import {
  ArrowUpRight,
  CheckCheck,
  Folder,
  ListTodo,
  Plus,
  Sun,
} from "lucide-react";
import Link from "next/link";
const closed = (t: Task) => ["Completed", "Dropped"].includes(t.status);

import type { State } from "@/lib/store";
export function Overview({
  s,
  active,
  today,
  setModal,
}: {
  s: State;
  active: Task[];
  today: Task[];
  setModal: (value: string | null) => void;
}) {
  return (
    <>
      <div className="stats">
        {[
          [
            active.length,
            "Open tasks",
            "A little progress, every day",
            ListTodo,
          ],
          [
            today.filter((t) => !closed(t)).length,
            "On your agenda",
            "Your focus for today",
            Sun,
          ],
          [s.data.projects.length, "Projects", "Ideas moving forward", Folder],
          [
            s.data.tasks.filter((t) => t.status === "Completed").length,
            "Completed",
            "Take a moment to celebrate",
            CheckCheck,
          ],
        ].map(([n, label, sub, Icon]) => {
          const I = Icon as typeof Sun;
          return (
            <div className="stat" key={label as string}>
              <div className="stat-top">
                {label as string}
                <I size={18} />
              </div>
              <strong>{n as number}</strong>
              <small>{sub as string}</small>
            </div>
          );
        })}
      </div>
      <div className="focus-banner">
        <div className="sun-circle">
          <Sun size={29} />
        </div>
        <div>
          <h2>A good day starts with a little intention.</h2>
          <p>
            Choose a few tasks for My Day and give your attention a place to
            land.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/my-day">
            Plan my day <ArrowUpRight size={16} />
          </Link>
        </Button>
      </div>
      <div className="section-heading">
        <h2>
          Your projects <span>{s.data.projects.length}</span>
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setModal("project")}>
          <Plus size={15} />
          New project
        </Button>
      </div>
      <div className="project-grid">
        {s.data.projects.map((p, i) => {
          const pt = s.data.tasks.filter((t) => t.project_id === p.id);
          const done = pt.filter((t) => t.status === "Completed").length;
          return (
            <Link
              className="project-card"
              href={`/projects/${p.id}`}
              key={p.id}
            >
              <div className={`folder-icon folder-${i % 4}`}>
                <Folder size={22} />
              </div>
              <ArrowUpRight className="project-arrow" size={18} />
              <h3>{p.name}</h3>
              <p>{p.description || "A space for your next great idea."}</p>
              <div className="progress">
                <span
                  style={{
                    width: `${pt.length ? (done / pt.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="project-meta">
                <span>
                  {done} of {pt.length} tasks completed
                </span>
                <span>
                  {pt.length ? Math.round((done / pt.length) * 100) : 0}%
                </span>
              </div>
            </Link>
          );
        })}
        {!s.data.projects.length && (
          <button className="create-card" onClick={() => setModal("project")}>
            <Plus size={23} />
            <h3>Your next chapter starts here</h3>
            <p>Create a project to organize your tasks.</p>
          </button>
        )}
      </div>
    </>
  );
}
