"use client";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/store";
import { type Member, type Task } from "@/lib/types";
import Link from "next/link";
import { PersonRow } from "./person-row";
import { TeamAction } from "./team-action";
const closed = (t: Task) => ["Completed", "Dropped"].includes(t.status);
export function TeamRows({
  team,
  members,
  tasks,
  work,
}: {
  team: { id: string; name: string };
  members: Member[];
  tasks: Task[];
  work: Task[];
}) {
  const setSearch = useWorkspace((s) => s.setSearch);
  return (
    <>
      <tr className="team-table-row">
        <th scope="row">
          {team.name}
          <small>{members.length} members</small>
        </th>
        <td>Team</td>
        <td>{work.filter((t) => !closed(t)).length}</td>
        <td>{work.length}</td>
        <td>
          <div className="table-actions">
            <Button asChild variant="outline" size="sm">
              <Link
                href={"/tasks?team=" + team.id}
                onClick={() => setSearch("")}
                aria-label={"View tasks for team " + team.name}
              >
                View tasks
              </Link>
            </Button>
            <TeamAction id={team.id} name={team.name} />
          </div>
        </td>
      </tr>
      {members.map((m) => (
        <PersonRow key={m.id} member={m} tasks={tasks} />
      ))}
    </>
  );
}
