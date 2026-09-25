import type { Event } from "./types";

export type ActivityChange =
  | { kind: "status"; from: string; to: string }
  | { kind: "dependency"; value: string | null }
  | { kind: "targetDate"; from: string; to: string };

function parseChange(line: string): ActivityChange | null {
  const status = /^Status changed from (.+?) to (.+)$/.exec(line);
  if (status) return { kind: "status", from: status[1], to: status[2] };
  if (line.startsWith("Dependency: "))
    return { kind: "dependency", value: line.slice("Dependency: ".length) };
  if (line === "Dependency cleared")
    return { kind: "dependency", value: null };
  const date = /^Target date changed from (.+?) to (.+)$/.exec(line);
  if (date) return { kind: "targetDate", from: date[1], to: date[2] };
  return null;
}

export function parseTaskActivity(event: Pick<Event, "kind" | "message">) {
  const lines = event.message.split("\n");
  const note: string[] = [];
  const changes: ActivityChange[] = [];
  const structured = ["update", "status", "edit"].includes(event.kind);
  for (const [index, line] of lines.entries()) {
    const change = structured && (index > 0 || event.kind === "status")
      ? parseChange(line)
      : null;
    const previous = changes[changes.length - 1];
    if (change) {
      changes.push(change);
    } else if (previous?.kind === "dependency" && previous.value) {
      previous.value += "\n" + line;
    } else {
      note.push(line);
    }
  }
  return { note: note.join("\n").trim(), changes };
}
