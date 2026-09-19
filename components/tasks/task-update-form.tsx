"use client";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";
export function TaskUpdateForm({
  taskId,
  busy,
  setBusy,
  setError,
  run,
  refresh,
  refreshWorkspace,
}: {
  taskId: string;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string) => void;
  run: (body: unknown) => Promise<boolean>;
  refresh: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
}) {
  return (
    <form
      className="update-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const message = new FormData(form).get("message");
        if (await run({ action: "update", id: taskId, message })) form.reset();
      }}
    >
      <textarea
        aria-label="Task update"
        name="message"
        placeholder="Add an update, a thought, or a small win…"
        required
        maxLength={10000}
        rows={3}
      />
      <div>
        <label className="upload">
          <Paperclip size={16} />
          <span>Attach file</span>
          <input
            aria-label="Attach file"
            type="file"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 10 * 1024 * 1024) {
                setError("Maximum attachment size is 10 MB.");
                return;
              }
              setBusy(true);
              setError("");
              try {
                const form = new FormData();
                form.set("file", file);
                const r = await fetch(`/api/tasks/${taskId}`, {
                  method: "POST",
                  body: form,
                });
                if (!r.ok) throw Error((await r.json()).error);
                await refresh();
                await refreshWorkspace();
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
        <Button size="sm" disabled={busy}>
          Post update
        </Button>
      </div>
      <small className="muted">
        Attachments up to 10 MB · saved with your task
      </small>
    </form>
  );
}
