"use client";
import { statuses, localDay, type Task } from "@/lib/types";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarDays, Paperclip, Send, X } from "lucide-react";

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
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [dateDraft, setDateDraft] = useState<string | undefined>();
  const selectedStatus = statusDraft ?? status;
  const today = localDay();
  const visibleDate = dateDraft === undefined ? targetDate : dateDraft || null;

  return (
    <form
      className="update-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        if (dateDraft && dateDraft !== targetDate && dateDraft < localDay()) {
          setFormError("Target date cannot be earlier than today.");
          return;
        }
        setBusy(true);
        setError("");
        setFormError("");
        try {
          const form = new FormData();
          form.set("message", message);
          if (statusDraft !== undefined) form.set("status", statusDraft);
          if (selectedStatus === "Dependent")
            form.set("dependency_reason", reasonDraft ?? dependencyReason ?? "");
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
          setFormError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <textarea
        className="update-message"
        aria-label="Task update"
        placeholder="What changed? What should your team know?"
        required
        maxLength={10000}
        rows={2}
        value={message}
        disabled={busy}
        onChange={(e) => setMessage(e.target.value)}
      />
      {selectedStatus === "Dependent" && (
        <label className="update-field">
          What are you blocked on?
          <textarea
            required
            maxLength={2000}
            rows={2}
            placeholder="Who or which task are you waiting on, and why?"
            value={reasonDraft ?? dependencyReason ?? ""}
            disabled={busy}
            onChange={(e) => setReasonDraft(e.target.value)}
          />
        </label>
      )}
      {formError && <p className="update-form-error" role="alert">{formError}</p>}
      {files.length > 0 && (
        <ul className="attachment-chips" aria-label="Selected attachments">
          {files.map((f, i) => (
            <li key={i} title={`${f.name} (${Math.ceil(f.size / 1024)} KB)`}>
              <Paperclip size={14} />
              <span className="attachment-chip-name">{f.name}</span>
              <Button type="button" variant="ghost" size="icon"
                aria-label={"Remove attachment " + f.name} disabled={busy}
                onClick={() => setFiles(files.filter((_, index) => index !== i))}>
                <X size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="update-actions">
        <div className="update-actions-left">
          <label className="update-status-control">
            <span className="sr-only">Status with update</span>
            <select
              aria-label="Status with update"
              value={selectedStatus}
              disabled={busy}
              onChange={(e) => setStatusDraft(e.target.value as Task["status"])}
            >
              {statuses.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="upload update-action">
            <Paperclip size={17} aria-hidden="true" />
            <span>Add attachment</span>
            <input aria-label="Attach files" type="file" multiple disabled={busy}
              onChange={(e) => {
                const next = [...files, ...Array.from(e.target.files || [])];
                e.target.value = "";
                if (next.length > 10 || next.some((f) => !f.size || f.size > 10 * 1024 * 1024)) {
                  setError("Select up to 10 non-empty files, each no larger than 10 MB.");
                  return;
                }
                if (next.reduce((sum, f) => sum + f.size, 0) > 25 * 1024 * 1024) {
                  setError("Maximum combined attachment size is 25 MB.");
                  return;
                }
                setFormError("");
                setFiles(next);
              }}
            />
          </label>
          <label className="update-date-chip">
            <CalendarDays size={15} aria-hidden="true" />
            <span>
              {visibleDate
                ? `Target date · ${new Date(`${visibleDate}T00:00:00`).toLocaleDateString(undefined, {
                    day: "numeric", month: "short", year: "numeric",
                  })}`
                : "Set target date"}
            </span>
            <input
              className="update-date-picker"
              aria-label="Target date"
              type="date"
              min={today}
              max="9999-12-31"
              value={dateDraft ?? (targetDate && targetDate >= today ? targetDate : "")}
              disabled={busy}
              onClick={(e) => {
                try { e.currentTarget.showPicker(); } catch { /* Use the native date control. */ }
              }}
              onChange={(e) => {
                setDateDraft(e.target.value);
                setFormError("");
              }}
            />
          </label>
          {visibleDate && (
            <button type="button" className="update-date-clear" disabled={busy}
              onClick={() => {
                setDateDraft("");
                setFormError("");
              }}>
              Clear
            </button>
          )}
        </div>
        <Button disabled={busy || !message.trim()}>
          <Send size={15} aria-hidden="true" />
          {busy ? "Posting…" : "Post update"}
        </Button>
      </div>
      <small className="muted">Up to 10 files · 10 MB each · 25 MB total</small>
    </form>
  );
}
