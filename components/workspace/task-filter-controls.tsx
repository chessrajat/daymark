"use client";
import { useSearchParams } from "next/navigation";

import type { State } from "@/lib/store";
export function TaskFilterControls({
  s,
  params,
  setFilter,
}: {
  s: State;
  params: ReturnType<typeof useSearchParams>;
  setFilter: (key: string, value: string) => void;
}) {
  return (
    <div className="task-filters">
      <label>
        Project
        <select
          aria-label="Filter by project"
          value={params.get("project") || ""}
          onChange={(e) => setFilter("project", e.target.value)}
        >
          <option value="">All projects</option>
          {s.data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Module
        <select
          aria-label="Filter by module"
          value={params.get("module") || ""}
          onChange={(e) => setFilter("module", e.target.value)}
        >
          <option value="">All modules</option>
          <option value="none">No module</option>
          {s.data.modules
            .filter(
              (m) =>
                !params.get("project") ||
                m.project_id === params.get("project"),
            )
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Team
        <select
          aria-label="Filter by team"
          value={params.get("team") || ""}
          onChange={(e) => setFilter("team", e.target.value)}
        >
          <option value="">All teams</option>
          <option value="none">No team</option>
          {s.data.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Member
        <select
          aria-label="Filter by member"
          value={params.get("member") || ""}
          onChange={(e) => setFilter("member", e.target.value)}
        >
          <option value="">All members</option>
          <option value="none">No member assigned</option>
          {s.data.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Priority
        <select
          aria-label="Filter by priority"
          value={params.get("priority") || ""}
          onChange={(e) => setFilter("priority", e.target.value)}
        >
          <option value="">All priorities</option>
          {["Low", "Medium", "High"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        Assigned for
        <select
          aria-label="Filter by assignment age"
          value={params.get("age") || ""}
          onChange={(e) => setFilter("age", e.target.value)}
        >
          <option value="">Any duration</option>
          <option value="7">7+ days</option>
          <option value="14">14+ days</option>
          <option value="30">30+ days</option>
        </select>
      </label>
    </div>
  );
}
