import { previewType } from "@/lib/attachment-preview";
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
    ).query(
      "SELECT name,content FROM attachments WHERE id=$1 UNION ALL SELECT name,content FROM note_attachments WHERE id=$1",
      [id],
    )
  ).rows[0];
  if (!a) return new Response("Not found", { status: 404 });

  const type =
    new URL(req.url).searchParams.get("preview") === "1"
      ? previewType(a.name)
      : null;
  const content = new Uint8Array(a.content);
  const headers: Record<string, string> = {
    "Content-Type": type || "application/octet-stream",
    "Content-Disposition":
      (type ? "inline" : "attachment") +
      "; filename*=UTF-8''" +
      encodeURIComponent(a.name),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
  };
  const range = req.headers.get("range");
  if (range && type) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    let start = 0,
      end = content.length - 1;
    if (match && (match[1] || match[2])) {
      if (!match[1]) start = Math.max(0, content.length - Number(match[2]));
      else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(end, Number(match[2]));
      }
    } else
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": "bytes */" + content.length },
      });
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end ||
      start >= content.length
    )
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": "bytes */" + content.length },
      });
    headers["Content-Range"] =
      "bytes " + start + "-" + end + "/" + content.length;
    headers["Content-Length"] = String(end - start + 1);
    return new Response(content.slice(start, end + 1), {
      status: 206,
      headers,
    });
  }
  headers["Content-Length"] = String(content.length);
  return new Response(content, { headers });
}
