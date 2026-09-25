import { z } from "zod";
import { statuses, type Task } from "./types";

export const statusUpdateSchema = z.object({
  status: z.enum(statuses).optional(),
  dependency_reason: z.string().trim().max(2000).optional(),
});

export function statusChange(
  task: Pick<Task, "status" | "dependency_reason">,
  update: z.infer<typeof statusUpdateSchema>,
) {
  const status = update.status ?? task.status;
  const reason = status === "Dependent"
    ? (update.dependency_reason ?? task.dependency_reason ?? "").trim()
    : null;
  if (status === "Dependent" && !reason) {
    throw Error("Explain who or which task you are waiting on and why.");
  }
  const messages: string[] = [];
  if (status !== task.status) messages.push(`Status changed from ${task.status} to ${status}`);
  if (reason !== (task.dependency_reason ?? null)) {
    messages.push(reason ? "Dependency: " + reason : "Dependency cleared");
  }
  return { status, reason, message: messages.join("\n") };
}
