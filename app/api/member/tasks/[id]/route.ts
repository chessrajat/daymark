import { memberGuard } from "@/lib/auth";
import { db } from "@/lib/db";
import { statusChange, statusUpdateSchema } from "@/lib/task-status";
import { z } from "zod";

const updateSchema = statusUpdateSchema.extend({ message: z.string().trim().min(1).max(10000) });
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await memberGuard(req);
  if (auth.denied) return auth.denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Invalid task." }, { status: 400 });
  const p = await db();
  const task = (await p.query(`SELECT id,title,description,status,priority,
    to_char(target_date,'YYYY-MM-DD') AS target_date,dependency_reason,created_at,updated_at
    FROM tasks WHERE id=$1 AND member_id=$2`, [id, auth.session!.id])).rows[0];
  if (!task) return Response.json({ error: "Task not found." }, { status: 404 });
  const before = new URL(req.url).searchParams.get("before");
  if (before && !z.uuid().safeParse(before).success)
    return Response.json({ error: "Invalid activity cursor." }, { status: 400 });
  const events = (await p.query(`SELECT e.*, a.name AS attachment_name,
    COALESCE((SELECT json_agg(json_build_object('id',f.id,'name',f.name,'size',octet_length(f.content)) ORDER BY f.created_at,f.id)
      FROM event_attachments ea JOIN attachments f ON f.id=ea.attachment_id WHERE ea.event_id=e.id),'[]'::json) AS attachments
    FROM events e LEFT JOIN attachments a ON a.id=e.attachment_id WHERE e.task_id=$1
    ${before ? "AND (e.created_at,e.id) < (SELECT created_at,id FROM events WHERE id=$2 AND task_id=$1)" : ""}
    ORDER BY e.created_at DESC,e.id DESC LIMIT 26`, before ? [id,before] : [id])).rows;
  const page = events.slice(0,25).reverse();
  return Response.json({ task, events: page, nextCursor: events.length > 25 ? page[0].id : null }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await memberGuard(req);
  if (auth.denied) return auth.denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Invalid task." }, { status: 400 });
  if (Number(req.headers.get("content-length")) > 12000) return Response.json({ error: "Update is too large." }, { status: 413 });
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const c = await (await db()).connect();
  try {
    await c.query("BEGIN");
    const task = (await c.query("SELECT status,dependency_reason FROM tasks WHERE id=$1 AND member_id=$2 FOR UPDATE", [id, auth.session!.id])).rows[0];
    if (!task) {
      await c.query("ROLLBACK");
      return Response.json({ error: "Task not found." }, { status: 404 });
    }
    let change;
    try { change = statusChange(task, parsed.data); }
    catch (e) {
      await c.query("ROLLBACK");
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }
    await c.query("UPDATE tasks SET status=$2,dependency_reason=$3,updated_at=now() WHERE id=$1", [id,change.status,change.reason]);
    const event = (await c.query("INSERT INTO events(task_id,kind,message) VALUES($1,'update',$2) RETURNING id", [
      id, [`Update from ${auth.session!.name}: ${parsed.data.message}`,change.message].filter(Boolean).join("\n"),
    ])).rows[0];
    await c.query("COMMIT");
    return Response.json({ id: event.id });
  } catch (e) {
    await c.query("ROLLBACK");
    console.error(e);
    return Response.json({ error: "Update could not be saved." }, { status: 500 });
  } finally { c.release(); }
}
