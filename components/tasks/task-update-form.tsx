"use client";
import { statuses, type Task } from "@/lib/types";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X } from "lucide-react";
export function TaskUpdateForm({
  taskId,
  targetDate,
  status,
  dependencyReason,
  busy,
  setBusy,
  setError,
  refresh,
  refreshWorkspace,
}: {
  taskId: string;
  targetDate: string | null;
  status: Task["status"];
  dependencyReason: string | null;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
  refresh: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
}) {
  const [statusDraft, setStatusDraft] = useState<Task["status"] | undefined>();
  const [reasonDraft, setReasonDraft] = useState<string | undefined>();
  const selectedStatus = statusDraft ?? status;
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [dateDraft, setDateDraft] = useState<string | undefined>(undefined);
  return (
    <form
      className="update-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          const form = new FormData();
          form.set("message", message);
          if (statusDraft !== undefined) form.set("status", statusDraft);
          if (selectedStatus === "Dependent") form.set("dependency_reason", reasonDraft ?? dependencyReason ?? "");
          if (dateDraft !== undefined) form.set("target_date", dateDraft);
          files.forEach((f) => form.append("files", f));
          const r = await fetch("/api/tasks/" + taskId, {
            method: "POST",
            body: form,
          });
          const result = await r.json();
          if (!r.ok) throw Error(result.error);
          setMessage("");
          setFiles([]);
          setDateDraft(undefined);
          setStatusDraft(undefined);
          setReasonDraft(undefined);
          await refresh();
          await refreshWorkspace();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="update-target-date">
        Status
        <select
          aria-label="Status with update"
          value={selectedStatus}
          disabled={busy}
          onChange={(e) => setStatusDraft(e.target.value as Task["status"])}
        >
          {statuses.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      {selectedStatus === "Dependent" && (
        <label className="update-target-date">
          Dependency reason
          <textarea
            required
            maxLength={2000}
            placeholder="Who or which task are you waiting on, and why?"
            value={reasonDraft ?? dependencyReason ?? ""}
            disabled={busy}
            onChange={(e) => setReasonDraft(e.target.value)}
          />
        </label>
      )}
      <textarea
        aria-label="Task update"
        placeholder="Write an update and attach supporting files…"
        required
        maxLength={10000}
        rows={3}
        value={message}
        disabled={busy}
        onChange={(e) => setMessage(e.target.value)}
      />
      <label className="update-target-date">
        Target date (optional)
        <input
          type="date"
          max="9999-12-31"
          value={dateDraft ?? targetDate ?? ""}
          disabled={busy}
          onChange={(e) => setDateDraft(e.target.value)}
        />
        <small className="muted">Change or clear the task's target date with this update. Explain changes in your update.</small>
      </label>
      {files.length > 0 && (
        <ul className="attachment-chips" aria-label="Selected attachments">
          {files.map((f, i) => (
            <li key={i} title={`${f.name} (${Math.ceil(f.size / 1024)} KB)`}>
              <Paperclip size={14} />
              <span className="attachment-chip-name">{f.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={"Remove attachment " + f.name}
                disabled={busy}
                onClick={() =>
                  setFiles(files.filter((_, index) => index !== i))
                }
              >
                <X size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <label className="upload">
          <Paperclip size={16} />
          <span>Add attachments</span>
          <input
            aria-label="Attach files"
            type="file"
            multiple
            disabled={busy}
            onChange={(e) => {
              const next = [...files, ...Array.from(e.target.files || [])];
              e.target.value = "";
              if (
                next.length > 10 ||
                next.some((f) => !f.size || f.size > 10 * 1024 * 1024)
              ) {
                setError(
                  "Select up to 10 non-empty files, each no larger than 10 MB.",
                );
                return;
              }
              if (next.reduce((sum, f) => sum + f.size, 0) > 25 * 1024 * 1024) {
                setError("Maximum combined attachment size is 25 MB.");
                return;
              }
              setError("");
              setFiles(next);
            }}
          />
        </label>
        <Button size="sm" disabled={busy || !message.trim()}>
          {busy ? "Posting…" : "Post update"}
        </Button>
      </div>
      <small className="muted">
        Up to 10 files · 10 MB each · 25 MB total · uploaded when you post
      </small>
    </form>
  );
}
