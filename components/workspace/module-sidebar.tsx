"use client";
import { ReorderableList, ReorderableRow } from "./reorderable-row";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ModuleOptions } from "./module-options";
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
  const modules = s.data.modules.filter((m) => m.project_id === project.id);
  return (
    <aside className="module-sidebar" aria-label="Project modules">
      <div className="section-heading">
        <h2>Modules</h2>
        <div className="module-heading-actions">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Create module"
          onClick={() => setModal("module")}
        >
          <Plus size={16} />
        </Button>
        <DeleteProject id={project.id} />
        </div>
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
      <ReorderableList kind="module">
      {modules.map((m, i) => {
          const items = s.data.tasks.filter((t) => t.module_id === m.id);
          return (
            <ReorderableRow key={m.id} id={m.id} name={m.name} kind="module"
              first={i === 0} last={i === modules.length - 1}>
            <Link
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
            </Link>
            <ModuleOptions module={m} taskCount={items.length} active={moduleId === m.id} />
            </ReorderableRow>
          );
        })}
      </ReorderableList>
    </aside>
  );
}
