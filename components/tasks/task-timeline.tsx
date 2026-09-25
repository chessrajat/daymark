"use client";
import { AttachmentStrip } from "./attachment-strip";
import { parseTaskActivity, type ActivityChange } from "@/lib/task-activity";
import { type Event } from "@/lib/types";
import { ArrowRight, CalendarDays, CheckCircle2, Link2, MessageSquare, Plus, Settings2 } from "lucide-react";

const timeLabel = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  const day = date.toDateString() === today.toDateString()
    ? "Today"
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `${day}, ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
};
const displayValue = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  : value;

type TimelineItem = {
  key: string;
  event: Event;
  type: "created" | "update" | "changes" | "system";
  title: string;
  note: string;
  changes: ActivityChange[];
  showAttachments: boolean;
};

function timelineItems(events: Event[]): TimelineItem[] {
  return events.flatMap((event) => {
    const { note, changes } = parseTaskActivity(event);
    const isUpdate = event.kind === "update";
    const created = event.kind === "task";
    const base = { event, note, changes };
    const item: TimelineItem = {
      ...base,
      key: event.id,
      type: created ? "created" : isUpdate ? "update" : changes.length ? "changes" : "system",
      title: created ? "Task created" : isUpdate ? "Update posted" : changes.length ? "Changes made" :
        event.kind === "day" ? "My Day updated" : event.kind === "assign" ? "Assignment updated" : "Task updated",
      note: created
        ? note.replace(/^Task created in module: /, "Created in module: ").replace(/^Task created\n?/, "")
        : note,
      showAttachments: true,
    };
    if (isUpdate && changes.length) {
      return [
        { ...item, changes: [] },
        { ...base, key: `${event.id}-changes`, type: "changes" as const, title: "Changes made", note: "", showAttachments: false },
      ];
    }
    return [item];
  });
}

function ChangeRow({ change }: { change: ActivityChange }) {
  const isStatus = change.kind === "status";
  const isDependency = change.kind === "dependency";
  const label = isStatus ? "Status changed" : isDependency
    ? change.value ? "Dependency added" : "Dependency cleared"
    : "Target date changed";
  return (
    <div className="activity-change-row">
      <span className={`activity-change-icon activity-change-${change.kind}`}>
        {isStatus ? <CheckCircle2 size={16} /> : isDependency ? <Link2 size={16} /> : <CalendarDays size={16} />}
      </span>
      <span className="activity-change-label">{label}</span>
      <span className="activity-change-values">
        {isDependency ? (
          change.value ? <span className="activity-dependency-value">{change.value}</span> : null
        ) : (
          <>
            <span className="activity-value-old">{displayValue(change.from)}</span>
            <ArrowRight size={15} aria-hidden="true" />
            <span className="activity-value-new">{displayValue(change.to)}</span>
          </>
        )}
      </span>
    </div>
  );
}

export function TaskTimeline({ events, loading }: { events: Event[]; loading: boolean }) {
  const items = timelineItems(events);
  return (
    <>
      <div className="timeline-heading">
        <h3>Activity</h3>
        <p>Updates and changes to this task</p>
      </div>
      <div className="timeline" aria-label="Task activity timeline">
        {loading && <p className="muted">Loading timeline…</p>}
        {!loading && !items.length && <p className="muted">No activity yet.</p>}
        {items.map((item) => {
          const attachments = item.event.attachments?.length
            ? item.event.attachments
            : item.event.attachment_id
              ? [{ id: item.event.attachment_id, name: item.event.attachment_name || "Attachment" }]
              : [];
          return (
            <article className="activity-item" key={item.key}>
              <span className={`activity-marker activity-marker-${item.type}`} aria-hidden="true">
                {item.type === "created" ? <Plus size={18} /> : item.type === "update"
                  ? <MessageSquare size={17} /> : <Settings2 size={17} />}
              </span>
              <time className="activity-time" dateTime={item.event.created_at}>
                {timeLabel(item.event.created_at)}
              </time>
              <div className={`activity-card activity-card-${item.type}`}>
                <h4>{item.title}</h4>
                {item.type === "changes" && item.changes.length > 1 && (
                  <p className="activity-card-subtitle">{item.changes.length} changes at the same time</p>
                )}
                {item.note && (
                  <p className={item.type === "update" ? "activity-note" : "activity-card-note"}>{item.note}</p>
                )}
                {!!item.changes.length && (
                  <div className="activity-changes">
                    {item.changes.map((change, index) => <ChangeRow key={`${change.kind}-${index}`} change={change} />)}
                  </div>
                )}
                {item.showAttachments && !!attachments.length && <AttachmentStrip attachments={attachments} />}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
