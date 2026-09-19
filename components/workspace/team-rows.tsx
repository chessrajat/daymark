"use client";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/store";
import { type Member, type Task } from "@/lib/types";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PersonRow } from "./person-row";
import { TeamAction } from "./team-action";
const closed = (t: Task) => ["Completed", "Dropped"].includes(t.status);
export function TeamRows({
  team,
  members,
  tasks,
  work,
  independent = false,
  expanded,
  onToggle,
}: {
  team: { id: string; name: string };
  members: Member[];
  tasks: Task[];
  work: Task[];
  independent?: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const setSearch = useWorkspace((s) => s.setSearch);
  return (
    <>
      <tr className="team-table-row">
        <th scope="row">
          <button
            type="button"
            className="flex items-center gap-2 text-left"
            aria-expanded={expanded}
            aria-label={(expanded ? "Collapse " : "Expand ") + team.name}
            onClick={onToggle}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span>
              {team.name}
              <small>{members.length} members</small>
            </span>
          </button>
        </th>
        <td>{independent ? "Independent group" : "Team"}</td>
        <td>{work.filter((t) => !closed(t)).length}</td>
        <td>{work.length}</td>
        <td>
          <div className="table-actions">
            {!independent && (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={"/tasks?team=" + team.id}
                  onClick={() => setSearch("")}
                  aria-label={"View tasks for team " + team.name}
                >
                  View tasks
                </Link>
              </Button>
            )}
            {!independent && <TeamAction id={team.id} name={team.name} />}
          </div>
        </td>
      </tr>
      {expanded &&
        members.map((m) => <PersonRow key={m.id} member={m} tasks={tasks} />)}
      {expanded && !members.length && (
        <tr>
          <td colSpan={5} className="muted">
            No members in this group.
          </td>
        </tr>
      )}
    </>
  );
}
