"use client";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/store";
import { type Member, type Task } from "@/lib/types";
import Link from "next/link";
import { DeleteMember } from "./delete-member";
import { TeamAction } from "./team-action";
const closed = (t: Task) => ["Completed", "Dropped"].includes(t.status);
export function PersonRow({
  member: m,
  tasks,
}: {
  member: Member;
  tasks: Task[];
}) {
  const work = tasks.filter((t) => t.member_id === m.id);
  const setSearch = useWorkspace((s) => s.setSearch);
  return (
    <tr>
      <td>
        <span className="member-table-name">
          <span className="avatar" aria-hidden="true">
            {m.name.slice(0, 2).toUpperCase()}
          </span>
          {m.name}
        </span>
      </td>
      <td>{m.team_id ? "Member" : "Independent member"}</td>
      <td>{work.filter((t) => !closed(t)).length}</td>
      <td>{work.length}</td>
      <td>
        <div className="table-actions">
          <Button asChild variant="outline" size="sm">
            <Link
              onClick={() => setSearch("")}
              href={"/tasks?member=" + m.id}
              aria-label={"View tasks for " + m.name}
            >
              View tasks
            </Link>
          </Button>
          {m.team_id ? (
            <TeamAction id={m.id} name={m.name} teamId={m.team_id} />
          ) : (
            <DeleteMember id={m.id} name={m.name} />
          )}
        </div>
      </td>
    </tr>
  );
}
