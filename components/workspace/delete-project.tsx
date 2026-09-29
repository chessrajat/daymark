"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";

export function DeleteProject({ id }: { id: string }) {
  const s = useWorkspace((s) => s);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const optionsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: globalThis.PointerEvent) {
      if (!optionsRef.current?.contains(event.target as Node))
        optionsRef.current?.removeAttribute("open");
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && optionsRef.current?.open) {
        optionsRef.current.removeAttribute("open");
        optionsRef.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const project = s.data.projects.find((p) => p.id === id);
  if (!project) return null;
  return (
    <>
      <details ref={optionsRef} className="project-options">
        <summary aria-label="Project options" title="Project options">
          <MoreHorizontal size={18} aria-hidden="true" />
        </summary>
        <div className="project-options-panel">
      <Button
        variant="ghost"
        size="sm"
        className="project-delete-option"
        onClick={() => {
          setError("");
          setConfirmation("");
          optionsRef.current?.removeAttribute("open");
          setOpen(true);
        }}
      >
        <Trash2 size={14} aria-hidden="true" /> Delete project
      </Button>
        </div>
      </details>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) {
            setOpen(value);
            if (!value) requestAnimationFrame(() => optionsRef.current?.querySelector("summary")?.focus());
          }
        }}
      >
        <DialogContent>
          <DialogTitle className="text-xl font-semibold">
            Delete {project.name}?
          </DialogTitle>
          <DialogDescription className="my-4 text-sm text-stone-500">
            This permanently deletes this project, its{" "}
            {s.data.modules.filter((m) => m.project_id === id).length} modules
            and {s.data.tasks.filter((t) => t.project_id === id).length} tasks,
            including their timelines, attachments, and My Day entries. Teams,
            members, and other projects are kept. This cannot be undone.
          </DialogDescription>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await s.command({ action: "delete_project", id, confirmation });

                setOpen(false);
                router.push("/");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Type the project name to confirm
              <input
                aria-label="Project name confirmation"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                required
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => { setOpen(false); requestAnimationFrame(() => optionsRef.current?.querySelector("summary")?.focus()); }}
              >
                Cancel
              </Button>
              <Button
                className="bg-red-700 hover:bg-red-800"
                disabled={busy || confirmation !== project.name}
              >
                {busy ? "Deleting…" : "Permanently delete project"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
