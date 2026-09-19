"use client";
import { useState } from "react";
import { TeamRows } from "./team-rows";

import type { State } from "@/lib/store";
export function PeopleTable({ s }: { s: State }) {
  const [openGroup, setOpenGroup] = useState<string | null>(
    s.data.teams[0]?.id || "independent",
  );
  const toggle = (id: string) =>
    setOpenGroup((current) => (current === id ? null : id));
  return (
    <div className="people-table-wrap">
      <table className="people-table">
        <caption className="sr-only">
          Teams, members, and assigned workload
        </caption>
        <thead>
          <tr>
            <th>Team / member</th>
            <th>Type</th>
            <th>Open tasks</th>
            <th>Total tasks</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {s.data.teams.map((team) => {
            const members = s.data.members.filter((m) => m.team_id === team.id);
            const work = s.data.tasks.filter(
              (t) =>
                t.team_id === team.id ||
                members.some((m) => m.id === t.member_id),
            );
            return (
              <TeamRows
                key={team.id}
                expanded={openGroup === team.id}
                onToggle={() => toggle(team.id)}
                team={team}
                members={members}
                tasks={s.data.tasks}
                work={work}
              />
            );
          })}
          <TeamRows
            team={{ id: "independent", name: "Independent members" }}
            independent
            expanded={openGroup === "independent"}
            onToggle={() => toggle("independent")}
            members={s.data.members.filter((m) => !m.team_id)}
            tasks={s.data.tasks}
            work={s.data.tasks.filter((t) =>
              s.data.members.some((m) => !m.team_id && m.id === t.member_id),
            )}
          />
        </tbody>
      </table>
    </div>
  );
}
