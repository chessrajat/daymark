"use client";
import { PersonRow } from "./person-row";
import { TeamRows } from "./team-rows";

import type { State } from "@/lib/store";
export function PeopleTable({ s }: { s: State }) {
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
                team={team}
                members={members}
                tasks={s.data.tasks}
                work={work}
              />
            );
          })}
          {s.data.members
            .filter((m) => !m.team_id)
            .map((m) => (
              <PersonRow key={m.id} member={m} tasks={s.data.tasks} />
            ))}
        </tbody>
      </table>
    </div>
  );
}
