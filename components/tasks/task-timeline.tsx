"use client";
import { AttachmentStrip } from "./attachment-strip";

import { type Event } from "@/lib/types";
import { Circle, MessageSquare, Paperclip } from "lucide-react";
const stamp = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
export function TaskTimeline({
  events,
  loading,
}: {
  events: Event[];
  loading: boolean;
}) {
  return (
    <>
      {" "}
      <div className="timeline-heading">
        <h3>Activity timeline</h3>
        <span>{events.length} events</span>
      </div>
      <div className="timeline">
        {loading && <p className="muted">Loading timeline…</p>}
        {events.map((e) => (
          <div className="event" key={e.id}>
            <span
              className={`event-dot ${e.kind === "update" ? "comment-dot" : ""}`}
            >
              {e.kind === "update" ? (
                <MessageSquare size={12} />
              ) : e.kind === "attachment" ? (
                <Paperclip size={12} />
              ) : (
                <Circle size={7} />
              )}
            </span>
            <div>
              <div className={e.kind === "update" ? "update-entry" : ""}>
                <p>{e.message}</p>
                {e.attachments?.length || e.attachment_id ? (
                  <AttachmentStrip
                    attachments={
                      e.attachments?.length
                        ? e.attachments
                        : [
                            {
                              id: e.attachment_id!,
                              name: e.attachment_name || "Attachment",
                            },
                          ]
                    }
                  />
                ) : null}
              </div>
              <time>{stamp(e.created_at)}</time>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
