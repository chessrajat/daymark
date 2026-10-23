import { memberGuard } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const auth = await memberGuard(req);
  if (auth.denied) return auth.denied;
  const tasks = await (await db()).query(`SELECT id,title,description,status,priority,
    to_char(target_date,'YYYY-MM-DD') AS target_date,dependency_reason,created_at,updated_at
    FROM tasks WHERE member_id=$1 ORDER BY updated_at DESC,id`, [auth.session!.id]);
  return Response.json({ tasks: tasks.rows }, { headers: { "Cache-Control": "private, no-store" } });
}
