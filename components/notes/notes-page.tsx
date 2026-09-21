"use client";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/store";
import { localDay } from "@/lib/types";
import { WorkspaceSidebar } from "@/components/workspace/sidebar";
import { CreateModal } from "@/components/workspace/create-modal";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AttachmentStrip } from "@/components/tasks/attachment-strip";
type Note = {
  id: string;
  title: string;
  body: string;
  is_question: boolean;
  updated_at: string;
  attachments: { id: string; name: string; size: number }[];
};
export function NotesPage() {
  const s = useWorkspace((s) => s);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [questions, setQuestions] = useState(false);
  const [editing, setEditing] = useState<Note | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<string | null>(null);
  const [day, setDay] = useState("");
  async function reload() {
    const r = await fetch("/api/notes");
    const data = await r.json();
    if (!r.ok) throw Error(data.error);
    setNotes(data);
    setLoading(false);
  }
  useEffect(() => {
    setDay(localDay());
    void s.refresh();
    reload().catch((e) => {
      setError(e.message);
      setLoading(false);
    });
  }, []);
  const visible = notes.filter(
    (n) =>
      (!questions || n.is_question) &&
      (n.title + " " + n.body).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="shell">
      <WorkspaceSidebar
        s={s}
        section="notes"
        today={s.data.tasks.filter((t) => t.my_days.includes(day))}
        setModal={setModal}
      />
      <main>
        <header className="topbar">
          <span>Workspace / Notes</span>
          <div className="ml-auto">
            <LogoutButton />
          </div>
        </header>
        <div className="page">
          <div className="page-heading">
            <div>
              <h1>Notes & questions</h1>
              <p className="subtitle">
                Keep ideas, references, and open questions together.
              </p>
            </div>
            <Button onClick={() => setEditing(null)}>New note</Button>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
              <Button
                variant="outline"
                onClick={() =>
                  reload()
                    .then(() => setError(""))
                    .catch((e) => setError(e.message))
                }
              >
                Retry
              </Button>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <input
              aria-label="Search notes"
              placeholder="Search notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={questions}
                onChange={(e) => setQuestions(e.target.checked)}
              />
              Questions only
            </label>
            <span className="muted">{visible.length} notes</span>
          </div>
          {loading ? (
            <p>Loading notes…</p>
          ) : !visible.length ? (
            <div className="empty">
              {notes.length ? "No matching notes." : "Create your first note."}
            </div>
          ) : (
            <div className="notes-list">
              {visible.map((n) => (
                <article className="note-card" key={n.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2>{n.title}</h2>
                    <div className="flex items-center gap-2">
                      {n.is_question && <span className="badge">Question</span>}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(n)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-700"
                        onClick={() => setDeleting(n)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <p className="note-body">{n.body}</p>
                  <AttachmentStrip attachments={n.attachments} />
                  <small className="muted">
                    Updated {new Date(n.updated_at).toLocaleString()}
                  </small>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
      <CreateModal kind={modal} close={() => setModal(null)} day={day} />
      {editing !== undefined && (
        <NoteEditor
          note={editing}
          close={() => setEditing(undefined)}
          saved={reload}
        />
      )}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Delete {deleting?.title}?</DialogTitle>
          <DialogDescription className="my-4">
            This permanently deletes the note and its attachments.
          </DialogDescription>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setDeleting(null)}
          >
            Cancel
          </Button>
          <Button
            className="ml-3 bg-red-700"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await fetch("/api/notes?id=" + deleting!.id, {
                  method: "DELETE",
                });
                if (!r.ok) throw Error((await r.json()).error);
                setDeleting(null);
                await reload();
              } catch (e) {
                setError((e as Error).message);
                setDeleting(null);
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete note
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function NoteEditor({
  note,
  close,
  saved,
}: {
  note: Note | null;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent>
        <DialogTitle>{note ? "Edit note" : "New note"}</DialogTitle>
        <DialogDescription className="my-3">
          Write a note, add supporting files, or mark it as a question.
        </DialogDescription>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            form.set("is_question", form.has("is_question") ? "true" : "false");
            if (note) form.set("id", note.id);
            files.forEach((f) => form.append("files", f));
            removed.forEach((id) => form.append("remove", id));
            try {
              const r = await fetch("/api/notes", {
                method: "POST",
                body: form,
              });
              if (!r.ok) throw Error((await r.json()).error);
              await saved();
              close();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Title
            <input
              name="title"
              required
              maxLength={200}
              defaultValue={note?.title}
              disabled={busy}
            />
          </label>
          <label>
            Note
            <textarea
              name="body"
              rows={8}
              maxLength={50000}
              defaultValue={note?.body}
              disabled={busy}
            />
          </label>
          <label>
            <span>
              <input
                style={{ width: "auto" }}
                type="checkbox"
                name="is_question"
                defaultChecked={note?.is_question}
                disabled={busy}
              />{" "}
              Tag as question
            </span>
          </label>
          {note?.attachments
            .filter((a) => !removed.includes(a.id))
            .map((a) => (
              <div
                className="flex items-center justify-between gap-2"
                key={a.id}
              >
                <span className="truncate" title={a.name}>
                  {a.name}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setRemoved([...removed, a.id])}
                >
                  Remove
                </Button>
              </div>
            ))}
          <label>
            Add attachments
            <input
              type="file"
              multiple
              disabled={busy}
              onChange={(e) => {
                const next = [...files, ...Array.from(e.target.files || [])];
                e.target.value = "";
                if (
                  next.length > 10 ||
                  next.some((f) => !f.size || f.size > 10 * 1024 * 1024) ||
                  next.reduce((n, f) => n + f.size, 0) > 25 * 1024 * 1024
                ) {
                  setError(
                    "Up to 10 non-empty files, 10 MB each and 25 MB total per save.",
                  );
                  return;
                }
                setError("");
                setFiles(next);
              }}
            />
          </label>
          <ul className="attachment-chips">
            {files.map((f, i) => (
              <li key={i} title={f.name}>
                <span className="attachment-chip-name">{f.name}</span>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={"Remove " + f.name}
                  onClick={() => setFiles(files.filter((_, j) => i !== j))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Button disabled={busy}>{busy ? "Saving…" : "Save note"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
