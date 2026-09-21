import { authGuard } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
export async function GET(req: Request) {
  const denied = await authGuard(req);
  if (denied) return denied;
  try {
    const p = await db();
    const result = await p.query(
      "SELECT n.*, COALESCE((SELECT json_agg(json_build_object('id',a.id,'name',a.name,'size',octet_length(a.content)) ORDER BY a.created_at,a.id) FROM note_attachments a WHERE a.note_id=n.id),'[]'::json) AS attachments FROM notes n ORDER BY updated_at DESC",
    );
    return Response.json(result.rows);
  } catch {
    return Response.json({ error: "Could not load notes." }, { status: 503 });
  }
}
export async function POST(req: Request) {
  const denied = await authGuard(req);
  if (denied) return denied;
  if (Number(req.headers.get("content-length")) > 26 * 1024 * 1024)
    return Response.json(
      { error: "Maximum attachment total is 25 MB." },
      { status: 413 },
    );
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Invalid form." }, { status: 400 });
  const parsed = z
    .object({
      id: z.uuid().optional(),
      title: z.string().trim().min(1).max(200),
      body: z.string().max(50000),
      is_question: z.enum(["true", "false"]),
    })
    .safeParse({
      id: form.get("id") || undefined,
      title: form.get("title"),
      body: form.get("body"),
      is_question: form.get("is_question"),
    });
  const removed = z.array(z.uuid()).safeParse(form.getAll("remove"));
  const files = form.getAll("files");
  if (!parsed.success || !removed.success)
    return Response.json(
      { error: "Enter a title and valid note details." },
      { status: 400 },
    );
  if (
    files.length > 10 ||
    files.some(
      (f) => !(f instanceof File) || !f.size || f.size > 10 * 1024 * 1024,
    )
  )
    return Response.json(
      { error: "Choose up to 10 non-empty files, each up to 10 MB." },
      { status: 400 },
    );
  const uploads = files as File[];
  if (uploads.reduce((n, f) => n + f.size, 0) > 25 * 1024 * 1024)
    return Response.json(
      { error: "Maximum attachment total is 25 MB." },
      { status: 413 },
    );
  const d = parsed.data;
  const c = await (await db()).connect();
  try {
    await c.query("BEGIN");
    let id = d.id;
    if (id) {
      const result = await c.query(
        "UPDATE notes SET title=$2,body=$3,is_question=$4,updated_at=now() WHERE id=$1 RETURNING id",
        [id, d.title, d.body, d.is_question === "true"],
      );
      if (!result.rowCount) {
        await c.query("ROLLBACK");
        return Response.json({ error: "Note not found." }, { status: 404 });
      }
    } else {
      id = (
        await c.query(
          "INSERT INTO notes(title,body,is_question) VALUES($1,$2,$3) RETURNING id",
          [d.title, d.body, d.is_question === "true"],
        )
      ).rows[0].id;
    }
    await c.query(
      "DELETE FROM note_attachments WHERE note_id=$1 AND id=ANY($2::uuid[])",
      [id, removed.data],
    );
    for (const f of uploads)
      await c.query(
        "INSERT INTO note_attachments(note_id,name,content) VALUES($1,$2,$3)",
        [
          id,
          f.name.replace(/[\r\n]/g, "").slice(0, 255) || "attachment",
          Buffer.from(await f.arrayBuffer()),
        ],
      );
    await c.query("COMMIT");
    return Response.json({ id });
  } catch (e) {
    await c.query("ROLLBACK");
    console.error(e);
    return Response.json({ error: "Could not save note." }, { status: 500 });
  } finally {
    c.release();
  }
}
export async function DELETE(req: Request) {
  const denied = await authGuard(req);
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id");
  if (!z.uuid().safeParse(id).success)
    return Response.json({ error: "Invalid note." }, { status: 400 });
  const r = await (await db()).query("DELETE FROM notes WHERE id=$1", [id]);
  return r.rowCount
    ? Response.json({ ok: true })
    : Response.json({ error: "Note not found." }, { status: 404 });
}
