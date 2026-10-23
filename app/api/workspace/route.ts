import { statusChange } from "@/lib/task-status";
import { authGuard } from "@/lib/auth";
import { db } from "@/lib/db";
import { commandSchema } from "@/lib/validation";
import { isPastTargetDateChange, targetDateChange } from "@/lib/target-date";
import { localDay } from "@/lib/types";
export const runtime = "nodejs";
export async function GET(req: Request) {
  const denied = await authGuard(req);
  if (denied) return denied;
  try {
    const p = await db();
    const [projects, teams, members, tasks, modules] = await Promise.all([
      p.query("SELECT * FROM projects ORDER BY position, created_at, id"),
      p.query("SELECT * FROM teams ORDER BY name"),
      p.query("SELECT m.*, a.username AS account_username FROM members m LEFT JOIN member_accounts a ON a.member_id=m.id ORDER BY m.name"),
      p.query(
        "SELECT t.*, to_char(t.target_date, 'YYYY-MM-DD') AS target_date, COALESCE((SELECT json_agg(to_char(day, 'YYYY-MM-DD')) FROM my_days WHERE task_id=t.id),'[]'::json) AS my_days FROM tasks t ORDER BY created_at DESC",
      ),
      p.query("SELECT * FROM modules ORDER BY position, created_at, id"),
    ]);
    return Response.json({
      projects: projects.rows,
      modules: modules.rows,
      teams: teams.rows,
      members: members.rows,
      tasks: tasks.rows,
    });
  } catch (e) {
    console.error(e);
    return Response.json(
      {
        error:
          "Cannot connect to the database. Check that PostgreSQL is running.",
      },
      { status: 503 },
    );
  }
}
export async function POST(req: Request) {
  const denied = await authGuard(req);
  if (denied) return denied;
  if (
    req.headers.get("origin") &&
    req.headers.get("origin") !== new URL(req.url).origin &&
    new URL(req.headers.get("origin")!).host !== req.headers.get("host")
  )
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = commandSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const d = parsed.data;
  const p = await db();
  const c = await p.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(748392)");
    let id: string | undefined;
    let message = "";
    let kind: string = d.action;
    if (d.action === "move_project" || d.action === "reorder_module" || d.action === "place_project" || d.action === "place_module") {
      id = d.id;
      const isModule = d.action === "reorder_module" || d.action === "place_module";
      const table = isModule ? "modules" : "projects";
      const item = (await c.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [id])).rows[0];
      if (!item) {
        await c.query("ROLLBACK");
        return Response.json({ error: "Item not found. Refresh and try again." }, { status: 404 });
      }
      const list = (await c.query(
        `SELECT id FROM ${table} ${isModule ? "WHERE project_id=$1" : ""} ORDER BY position,created_at,id FOR UPDATE`,
        isModule ? [item.project_id] : [],
      )).rows.map((row: { id: string }) => row.id);
      const index = list.indexOf(id!);
      let changed = false;
      if (d.action === "place_project" || d.action === "place_module") {
        if (!list.includes(d.target_id)) {
          await c.query("ROLLBACK");
          return Response.json({ error: "Choose an item from the same list." }, { status: 400 });
        }
        if (d.target_id !== d.id) {
          list.splice(index, 1);
          const target = list.indexOf(d.target_id) + (d.placement === "after" ? 1 : 0);
          list.splice(target, 0, d.id);
          changed = true;
        }
      } else {
        const next = index + (d.direction === "up" ? -1 : 1);
        if (next >= 0 && next < list.length) {
          [list[index], list[next]] = [list[next], list[index]];
          changed = true;
        }
      }
      if (changed) {
        await c.query(
          `UPDATE ${table} AS item SET position=ordered.position::integer
           FROM unnest($1::uuid[]) WITH ORDINALITY AS ordered(id,position) WHERE item.id=ordered.id`,
          [list],
        );
      }
    } else if (d.action === "project")
      id = (
        await c.query(
          "INSERT INTO projects(name,description,position) VALUES($1,$2,(SELECT COALESCE(MAX(position),0)+1 FROM projects)) RETURNING id",
          [d.name, d.description],
        )
      ).rows[0].id;
    else if (d.action === "team")
      id = (
        await c.query("INSERT INTO teams(name) VALUES($1) RETURNING id", [
          d.name,
        ])
      ).rows[0].id;
    else if (d.action === "member") {
      const duplicate = await c.query(
        "SELECT id FROM members WHERE lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) = lower(regexp_replace(btrim($1::text), '[[:space:]]+', ' ', 'g')) AND team_id IS NOT DISTINCT FROM $2::uuid",
        [d.name, d.team_id],
      );
      if (duplicate.rowCount) {
        await c.query("ROLLBACK");
        return Response.json(
          { error: "A member with this name already exists in this group." },
          { status: 409 },
        );
      }
      id = (
        await c.query(
          "INSERT INTO members(name,team_id) VALUES($1,$2) RETURNING id",
          [d.name, d.team_id],
        )
      ).rows[0].id;
    } else if (d.action === "delete_member") {
      id = d.id;
      const member = (
        await c.query("SELECT * FROM members WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (!member || member.team_id) {
        await c.query("ROLLBACK");
        return Response.json(
          {
            error: member
              ? "Remove this member from their team before deleting them."
              : "Member not found.",
          },
          { status: member ? 409 : 404 },
        );
      }
      const changed = await c.query(
        "UPDATE tasks SET member_id=NULL, assigned_at=CASE WHEN team_id IS NULL THEN NULL ELSE assigned_at END, updated_at=now() WHERE member_id=$1 RETURNING id,team_id",
        [id],
      );
      for (const task of changed.rows) {
        await c.query(
          "INSERT INTO events(task_id,kind,message) VALUES($1,'assign',$2)",
          [
            task.id,
            'Member "' +
              member.name +
              '" deleted. ' +
              (task.team_id
                ? "Team assignment retained."
                : "Task is now unassigned."),
          ],
        );
      }
      await c.query("DELETE FROM members WHERE id=$1", [id]);
    } else if (d.action === "remove_member" || d.action === "delete_team") {
      id = d.id;
      const teamId = d.action === "remove_member" ? d.team_id : d.id;
      const team = (
        await c.query("SELECT * FROM teams WHERE id=$1 FOR UPDATE", [teamId])
      ).rows[0];
      if (!team) {
        await c.query("ROLLBACK");
        return Response.json(
          { error: "Team not found. Refresh and try again." },
          { status: 404 },
        );
      }
      let memberName = "";
      if (d.action === "remove_member") {
        const member = (
          await c.query("SELECT * FROM members WHERE id=$1 FOR UPDATE", [d.id])
        ).rows[0];
        if (!member || member.team_id !== teamId) {
          await c.query("ROLLBACK");
          return Response.json(
            { error: "This member no longer belongs to the team." },
            { status: 409 },
          );
        }
        memberName = member.name;
        await c.query("UPDATE members SET team_id=NULL WHERE id=$1", [d.id]);
      } else {
        await c.query("UPDATE members SET team_id=NULL WHERE team_id=$1", [
          teamId,
        ]);
      }
      const changed = await c.query(
        "UPDATE tasks SET team_id=NULL, assigned_at=CASE WHEN member_id IS NULL THEN NULL ELSE assigned_at END, updated_at=now() WHERE team_id=$1" +
          (d.action === "remove_member" ? " AND member_id=$2" : "") +
          " RETURNING id, member_id",
        d.action === "remove_member" ? [teamId, d.id] : [teamId],
      );
      for (const task of changed.rows) {
        const note =
          d.action === "remove_member"
            ? memberName +
              ' removed from team "' +
              team.name +
              '". Task remains assigned to ' +
              memberName +
              "."
            : 'Team "' +
              team.name +
              '" deleted. ' +
              (task.member_id
                ? "Member assignment retained."
                : "Task is now unassigned.");
        await c.query(
          "INSERT INTO events(task_id,kind,message) VALUES($1,'assign',$2)",
          [task.id, note],
        );
      }
      if (d.action === "delete_team")
        await c.query("DELETE FROM teams WHERE id=$1", [teamId]);
    } else if (d.action === "module") {
      id = (
        await c.query(
          "INSERT INTO modules(project_id,name,position) VALUES($1,$2,(SELECT COALESCE(MAX(position),0)+1 FROM modules WHERE project_id=$1)) RETURNING id",
          [d.project_id, d.name],
        )
      ).rows[0].id;
    } else if (d.action === "rename_module" || d.action === "delete_module") {
      id = d.id;
      const module = (await c.query("SELECT * FROM modules WHERE id=$1 FOR UPDATE", [id])).rows[0];
      if (!module) {
        await c.query("ROLLBACK");
        return Response.json({ error: "Module not found. Refresh and try again." }, { status: 404 });
      }
      if (d.action === "rename_module") {
        await c.query("UPDATE modules SET name=$2 WHERE id=$1", [id, d.name]);
      } else {
        const moved = await c.query(
          "UPDATE tasks SET module_id=NULL, updated_at=now() WHERE module_id=$1 RETURNING id", [id],
        );
        for (const task of moved.rows) {
          await c.query("INSERT INTO events(task_id,kind,message) VALUES($1,'move_module',$2)", [
            task.id, "Module changed from " + module.name + " to No module (module deleted)",
          ]);
        }
        await c.query("DELETE FROM modules WHERE id=$1", [id]);
      }
    } else if (d.action === "delete_project") {
      id = d.id;
      const project = (
        await c.query("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (!project || project.name !== d.confirmation) {
        await c.query("ROLLBACK");
        return Response.json(
          {
            error: project
              ? "Enter the project name exactly to confirm deletion."
              : "Project not found.",
          },
          { status: project ? 400 : 404 },
        );
      }
      await c.query("DELETE FROM tasks WHERE project_id=$1", [id]);
      await c.query("DELETE FROM modules WHERE project_id=$1", [id]);
      await c.query("DELETE FROM projects WHERE id=$1", [id]);
    } else if (d.action === "delete_task") {
      id = d.id;
      const deleted = await c.query("DELETE FROM tasks WHERE id=$1 RETURNING id", [id]);
      if (!deleted.rowCount) {
        await c.query("ROLLBACK");
        return Response.json({ error: "Task not found. Refresh and try again." }, { status: 404 });
      }
    } else if (d.action === "task") {
      const assignee = d.member_id
        ? (await c.query("SELECT name FROM members WHERE id=$1", [d.member_id])).rows[0]
        : null;
      if (d.member_id && !assignee) {
        await c.query("ROLLBACK");
        return Response.json(
          { error: "Assignee not found. Refresh and try again." },
          { status: 400 },
        );
      }
      if (
        d.module_id &&
        !(
          await c.query(
            "SELECT id FROM modules WHERE id=$1 AND project_id=$2",
            [d.module_id, d.project_id],
          )
        ).rowCount
      ) {
        await c.query("ROLLBACK");
        return Response.json(
          { error: "Choose a module in this project." },
          { status: 400 },
        );
      }
      id = (
        await c.query(
          "INSERT INTO tasks(project_id,title,description,priority,module_id,target_date,member_id,assigned_at) VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $7::uuid IS NULL THEN NULL ELSE now() END) RETURNING id",
          [d.project_id, d.title, d.description, d.priority, d.module_id, d.target_date, d.member_id],
        )
      ).rows[0].id;
      const moduleName = d.module_id
        ? (await c.query("SELECT name FROM modules WHERE id=$1", [d.module_id]))
            .rows[0].name
        : null;
      message = moduleName
        ? "Task created in module: " + moduleName
        : "Task created";
      if (d.day) {
        await c.query("INSERT INTO my_days(task_id,day) VALUES($1,$2)", [id, d.day]);
        message += `\nAdded to My Day · ${d.day}`;
      }
      if (assignee) message += `\nAssigned to: ${assignee.name}`;
      if (d.target_date) message += `\nTarget date: ${d.target_date}`;
    } else {
      id = d.id;
      const t = (
        await c.query("SELECT *, to_char(target_date, 'YYYY-MM-DD') AS target_date FROM tasks WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (!t) {
        await c.query("ROLLBACK");
        return Response.json({ error: "Task not found" }, { status: 404 });
      }
      if (d.action === "move_module" && t.module_id !== d.module_id) {
        const module = d.module_id
          ? (
              await c.query(
                "SELECT * FROM modules WHERE id=$1 AND project_id=$2",
                [d.module_id, t.project_id],
              )
            ).rows[0]
          : null;
        if (d.module_id && !module) {
          await c.query("ROLLBACK");
          return Response.json(
            { error: "Choose a module in this project." },
            { status: 400 },
          );
        }
        const previous = t.module_id
          ? (
              await c.query("SELECT name FROM modules WHERE id=$1", [
                t.module_id,
              ])
            ).rows[0]?.name
          : null;
        await c.query("UPDATE tasks SET module_id=$2 WHERE id=$1", [
          id,
          d.module_id,
        ]);
        message =
          "Module changed from " +
          (previous || "No module") +
          " to " +
          (module?.name || "No module");
      }
      if (d.action === "edit") {
        await c.query(
          "UPDATE tasks SET title=$2,description=$3,priority=$4 WHERE id=$1",
          [id, d.title, d.description, d.priority],
        );
        message = `Task details updated · ${d.title} · ${d.priority} priority`;
      }
      if (
        d.action === "assign" &&
        (t.member_id !== d.member_id || t.team_id !== d.team_id)
      ) {
        const m = d.member_id
          ? (await c.query("SELECT * FROM members WHERE id=$1", [d.member_id]))
              .rows[0]
          : null;
        const team = d.team_id
          ? (await c.query("SELECT * FROM teams WHERE id=$1", [d.team_id]))
              .rows[0]
          : null;
        if (
          (d.member_id && !m) ||
          (d.team_id && !team) ||
          (m && team && m.team_id !== team.id)
        ) {
          await c.query("ROLLBACK");
          return Response.json(
            { error: "Choose a member belonging to the selected team." },
            { status: 400 },
          );
        }
        const oldM = t.member_id
          ? (
              await c.query("SELECT name FROM members WHERE id=$1", [
                t.member_id,
              ])
            ).rows[0]?.name
          : null;
        const oldT = t.team_id
          ? (await c.query("SELECT name FROM teams WHERE id=$1", [t.team_id]))
              .rows[0]?.name
          : null;
        await c.query(
          "UPDATE tasks SET member_id=$2,team_id=$3,assigned_at=CASE WHEN $2::uuid IS NULL AND $3::uuid IS NULL THEN NULL ELSE now() END WHERE id=$1",
          [id, d.member_id, d.team_id],
        );
        message = `Assignment changed from ${[oldM, oldT].filter(Boolean).join(" · ") || "Unassigned"} to ${[m?.name, team?.name].filter(Boolean).join(" · ") || "Unassigned"}`;
      }
      if (d.action === "update" && d.target_date !== undefined &&
        isPastTargetDateChange(t.target_date, d.target_date, localDay())) {
        await c.query("ROLLBACK");
        return Response.json({ error: "Target date cannot be earlier than today." }, { status: 400 });
      }
      if (d.action === "update") message = d.message;
      if (d.action === "status" || d.action === "update") {
        let change;
        try { change = statusChange(t, d); }
        catch (error) {
          await c.query("ROLLBACK");
          return Response.json({ error: (error as Error).message }, { status: 400 });
        }
        if (change.message) {
          await c.query("UPDATE tasks SET status=$2,dependency_reason=$3 WHERE id=$1", [id, change.status, change.reason]);
          message = [message, change.message].filter(Boolean).join("\n");
        }
      }
      if ((d.action === "edit" || d.action === "update") && d.target_date !== undefined) {
        const change = targetDateChange(t.target_date, d.target_date);
        if (change) {
          await c.query("UPDATE tasks SET target_date=$2 WHERE id=$1", [id, d.target_date]);
          message += `\n${change}`;
        }
      }
      if (d.action === "day") {
        const result = d.included
          ? await c.query(
              "INSERT INTO my_days(task_id,day) VALUES($1,$2) ON CONFLICT DO NOTHING",
              [id, d.day],
            )
          : await c.query("DELETE FROM my_days WHERE task_id=$1 AND day=$2", [
              id,
              d.day,
            ]);
        if (result.rowCount)
          message = `${d.included ? "Added to" : "Removed from"} My Day · ${d.day}`;
      }
    }
    if (message) {
      await c.query(
        "INSERT INTO events(task_id,kind,message) VALUES($1,$2,$3)",
        [id, kind, message],
      );
      await c.query("UPDATE tasks SET updated_at=now() WHERE id=$1", [id]);
    }
    await c.query("COMMIT");
    return Response.json({ id });
  } catch (e) {
    await c.query("ROLLBACK");
    console.error(e);
    return Response.json(
      { error: "Could not save. Check your selections and try again." },
      { status: 400 },
    );
  } finally {
    c.release();
  }
}
