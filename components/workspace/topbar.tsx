"use client";
import { LogoutButton } from "@/components/logout-button";
import { useWorkspace } from "@/lib/store";
import { ChevronRight, Search } from "lucide-react";
function useWorkspaceState() {
  return useWorkspace((s) => s);
}
export function WorkspaceTopbar({
  s,
  section,
  project,
}: {
  s: ReturnType<typeof useWorkspaceState>;
  section: string;
  project?: import("@/lib/types").Project;
}) {
  return (
    <>
      <header className="topbar">
        <div className="breadcrumb">
          Workspace <ChevronRight size={14} />
          <span>
            {project?.name ||
              {
                overview: "Overview",
                "my-day": "My Day",
                tasks: "All tasks",
                teams: "People & teams",
              }[section] ||
              "Projects"}
          </span>
        </div>
        
        <LogoutButton />
      </header>
    </>
  );
}
