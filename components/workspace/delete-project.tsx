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
import { useState } from "react";

export function DeleteProject({ id }: { id: string }) {
  const s = useWorkspace((s) => s);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const project = s.data.projects.find((p) => p.id === id);
  if (!project) return null;
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-red-700"
        onClick={() => {
          setError("");
          setConfirmation("");
          setOpen(true);
        }}
      >
        Delete project
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
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
                onClick={() => setOpen(false)}
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
