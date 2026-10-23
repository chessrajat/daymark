import { authGuard } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashMemberPassword } from "@/lib/member-password";
import { z } from "zod";

export const runtime = "nodejs";
const schema = z.object({
  member_id: z.uuid(),
  username: z.string().trim().regex(/^[A-Za-z0-9._-]{3,64}$/, "Use 3–64 letters, numbers, dots, underscores, or hyphens."),
  password: z.string().min(12, "Use at least 12 characters.").max(128),
});
export async function POST(req: Request) {
  const denied = await authGuard(req);
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { member_id, username, password } = parsed.data;
  if (username.toLowerCase() === process.env.AUTH_USERNAME?.toLowerCase())
    return Response.json({ error: "Choose a different username." }, { status: 409 });
  const p = await db();
  if (!(await p.query("SELECT 1 FROM members WHERE id=$1", [member_id])).rowCount)
    return Response.json({ error: "Member not found." }, { status: 404 });
  try {
    await p.query(`INSERT INTO member_accounts(member_id,username,password_hash) VALUES($1,$2,$3)
      ON CONFLICT (member_id) DO UPDATE SET username=EXCLUDED.username,password_hash=EXCLUDED.password_hash,credential_version=gen_random_uuid()`,
      [member_id, username, await hashMemberPassword(password)]);
    return Response.json({ ok: true });
  } catch (e) {
    if ((e as { code?: string }).code === "23505")
      return Response.json({ error: "Username is already in use." }, { status: 409 });
    throw e;
  }
}
export async function DELETE(req: Request) {
  const denied = await authGuard(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!z.uuid().safeParse(body?.member_id).success)
    return Response.json({ error: "Invalid member." }, { status: 400 });
  await (await db()).query("DELETE FROM member_accounts WHERE member_id=$1", [body.member_id]);
  return Response.json({ ok: true });
}
