import { assignedDays, type Member, type Task } from "@/lib/types";
export function matchesFilters(
  t: Task,
  params: { get: (key: string) => string | null },
  members: Member[],
) {
  const project = params.get("project"),
    module = params.get("module"),
    team = params.get("team"),
    member = params.get("member"),
    assignment = params.get("assignment"),
    priority = params.get("priority"),
    age = params.get("age");
  const memberTeam = members.find((m) => m.id === t.member_id)?.team_id;
  return (
    (!project || t.project_id === project) &&
    (!module || (module === "none" ? !t.module_id : t.module_id === module)) &&
    (!team ||
      (team === "none"
        ? !t.team_id && !memberTeam
        : t.team_id === team || memberTeam === team)) &&
    (!member || (member === "none" ? !t.member_id : t.member_id === member)) &&
    (assignment !== "unassigned" || (!t.member_id && !t.team_id)) &&
    (!priority || t.priority === priority) &&
    (!age || (!!t.assigned_at && assignedDays(t.assigned_at) >= Number(age)))
  );
}
