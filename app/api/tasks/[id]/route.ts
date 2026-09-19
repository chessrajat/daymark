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
    "SELECT e.*, a.name AS attachment_name, COALESCE((SELECT json_agg(json_build_object('id', f.id, 'name', f.name, 'size', octet_length(f.content)) ORDER BY f.created_at,f.id) FROM event_attachments ea JOIN attachments f ON f.id=ea.attachment_id WHERE ea.event_id=e.id), '[]'::json) AS attachments FROM events e LEFT JOIN attachments a ON a.id=e.attachment_id WHERE e.task_id=$1 ORDER BY e.created_at, e.id",
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

  if (Number(req.headers.get("content-length")) > 26 * 1024 * 1024)
    return Response.json(
      { error: "Maximum combined attachment size is 25 MB." },
      { status: 413 },
    );
  const form = await req.formData().catch(() => null);
  if (!form)
    return Response.json({ error: "Invalid update form." }, { status: 400 });
  const message = form.get("message");
  const files = form.getAll("files");
  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.trim().length > 10000
  )
    return Response.json(
      { error: "Enter an update message (up to 10,000 characters)." },
      { status: 400 },
    );
  if (
    files.length > 10 ||
    files.some(
      (f) => !(f instanceof File) || !f.size || f.size > 10 * 1024 * 1024,
    )
  )
    return Response.json(
      { error: "Select up to 10 non-empty files, each no larger than 10 MB." },
      { status: 400 },
    );
  const attachments = files as File[];
  if (attachments.reduce((sum, f) => sum + f.size, 0) > 25 * 1024 * 1024)
    return Response.json(
      { error: "Maximum combined attachment size is 25 MB." },
      { status: 413 },
    );
  const c = await (await db()).connect();
  try {
    await c.query("BEGIN");
    const task = await c.query("SELECT id FROM tasks WHERE id=$1 FOR UPDATE", [
      id,
    ]);
    if (!task.rowCount) {
      await c.query("ROLLBACK");
      return Response.json({ error: "Task not found." }, { status: 404 });
    }
    const event = (
      await c.query(
        "INSERT INTO events(task_id,kind,message) VALUES($1,'update',$2) RETURNING id",
        [id, message.trim()],
      )
    ).rows[0];
    for (const file of attachments) {
      const name =
        file.name.replace(/[\r\n]/g, "").slice(0, 255) || "attachment";
      const attachment = (
        await c.query(
          "INSERT INTO attachments(task_id,name,content) VALUES($1,$2,$3) RETURNING id",
          [id, name, Buffer.from(await file.arrayBuffer())],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO event_attachments(event_id,attachment_id) VALUES($1,$2)",
        [event.id, attachment.id],
      );
    }
    await c.query("UPDATE tasks SET updated_at=now() WHERE id=$1", [id]);
    await c.query("COMMIT");
    return Response.json({ id: event.id });
  } catch (e) {
    await c.query("ROLLBACK");
    console.error(e);
    return Response.json(
      {
        error:
          "Update could not be saved. Your message and files have not been posted.",
      },
      { status: 500 },
    );
  } finally {
    c.release();
  }
}
