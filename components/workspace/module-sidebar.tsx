"use client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { DeleteProject } from "./delete-project";

import type { State } from "@/lib/store";
export function ModuleSidebar({
  s,
  project,
  moduleId,
  setModal,
}: {
  s: State;
  project: import("@/lib/types").Project;
  moduleId?: string;
  setModal: (value: string | null) => void;
}) {
  return (
    <aside className="module-sidebar" aria-label="Project modules">
      <div className="section-heading">
        <h2>Modules</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Create module"
          onClick={() => setModal("module")}
        >
          <Plus size={16} />
        </Button>
      </div>
      <Link
        className={"module-link " + (!moduleId ? "selected" : "")}
        href={"/projects/" + project.id}
      >
        All project tasks{" "}
        <span>
          {s.data.tasks.filter((t) => t.project_id === project.id).length}
        </span>
      </Link>
      <Link
        className={"module-link " + (moduleId === "unfiled" ? "selected" : "")}
        href={"/projects/" + project.id + "/modules/unfiled"}
      >
        No module{" "}
        <span>
          {
            s.data.tasks.filter(
              (t) => t.project_id === project.id && !t.module_id,
            ).length
          }
        </span>
      </Link>
      {s.data.modules
        .filter((m) => m.project_id === project.id)
        .map((m) => {
          const items = s.data.tasks.filter((t) => t.module_id === m.id);
          return (
            <Link
              key={m.id}
              className={"module-link " + (moduleId === m.id ? "selected" : "")}
              href={"/projects/" + project.id + "/modules/" + m.id}
            >
              <span className="module-name">
                {m.name}
                <small>
                  {items.filter((t) => t.status === "Completed").length}/
                  {items.length} completed
                </small>
              </span>
              <span>{items.length}</span>
            </Link>
          );
        })}
      <Button
        variant="outline"
        size="sm"
        className="mt-4 w-full"
        onClick={() => setModal("module")}
      >
        <Plus size={14} />
        New module
      </Button>
      <div className="mt-8 border-t border-stone-200 pt-4">
        <DeleteProject id={project.id} />
      </div>
    </aside>
  );
}
