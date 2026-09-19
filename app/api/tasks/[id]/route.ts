import { authGuard } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await authGuard(req);
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: "Invalid task" }, { status: 400 });
  const p = await db();
  const events = await p.query(
    "SELECT e.*, a.name AS attachment_name FROM events e LEFT JOIN attachments a ON a.id=e.attachment_id WHERE e.task_id=$1 ORDER BY e.created_at, e.id",
    [id],
  );
  return Response.json(events.rows);
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await authGuard(req);
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: "Invalid task" }, { status: 400 });
  if (
    req.headers.get("origin") &&
    new URL(req.headers.get("origin")!).host !== req.headers.get("host")
  )
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  if (Number(req.headers.get("content-length")) > 11 * 1024 * 1024)
    return Response.json(
      { error: "Maximum attachment size is 10 MB." },
      { status: 413 },
    );
  const form = await req.formData();
  const file = form.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 10 * 1024 * 1024
  )
    return Response.json(
      { error: "Choose a non-empty file up to 10 MB." },
      { status: 400 },
    );
  const p = await db();
  const c = await p.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT id FROM tasks WHERE id=$1 FOR UPDATE", [id]);
    const name = file.name.replace(/[\r\n]/g, "").slice(0, 255);
    const a = await c.query(
      "INSERT INTO attachments(task_id,name,content) VALUES($1,$2,$3) RETURNING id",
      [id, name, Buffer.from(await file.arrayBuffer())],
    );
    await c.query(
      "INSERT INTO events(task_id,kind,message,attachment_id) VALUES($1,'attachment',$2,$3)",
      [id, `Attachment added · ${name}`, a.rows[0].id],
    );
    await c.query("UPDATE tasks SET updated_at=now() WHERE id=$1", [id]);
    await c.query("COMMIT");
    return Response.json({ ok: true });
  } catch (e) {
    await c.query("ROLLBACK");
    console.error(e);
    return Response.json(
      { error: "Attachment could not be saved." },
      { status: 400 },
    );
  } finally {
    c.release();
  }
}
