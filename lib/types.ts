export const statuses = [
  "To do",
  "In progress",
  "Blocked",
  "Dependent",
  "Completed",
  "Dropped",
] as const;
export type Project = {
  id: string;
  name: string;
  description: string;
  created_at: string;
};
export type Module = {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
};
export type Team = { id: string; name: string };
export type Member = { id: string; name: string; team_id: string | null };
export type Task = {
  id: string;
  project_id: string;
  module_id: string | null;
  title: string;
  description: string;
  status: (typeof statuses)[number];
  priority: string;
  target_date: string | null;
  dependency_reason: string | null;
  member_id: string | null;
  team_id: string | null;
  assigned_at: string | null;
  created_at: string;
  updated_at: string;
  my_days: string[];
};
export type Event = {
  id: string;
  task_id: string;
  message: string;
  kind: string;
  created_at: string;
  attachment_id: string | null;
  attachment_name: string | null;
  attachments: { id: string; name: string; size: number }[];
};
export type Data = {
  projects: Project[];
  modules: Module[];
  teams: Team[];
  members: Member[];
  tasks: Task[];
};
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function assignedDays(date: string | null) {
  return date
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(date).getTime()) / 86400000),
      )
    : 0;
}
