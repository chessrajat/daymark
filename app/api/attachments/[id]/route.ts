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
    return new Response("Invalid attachment", { status: 400 });
  const a = (
    await (
      await db()
    ).query("SELECT name,content FROM attachments WHERE id=$1", [id])
  ).rows[0];
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(a.content), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(a.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
