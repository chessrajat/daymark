"use client";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/store";
import type { Module } from "@/lib/types";

export function ModuleOptions({ module, taskCount, active }: { module: Module; taskCount: number; active: boolean }) {
  const command = useWorkspace((s) => s.command);
  const router = useRouter();
  const optionsRef = useRef<HTMLDetailsElement>(null);
  const [action, setAction] = useState<"rename" | "delete" | null>(null);
  const [name, setName] = useState(module.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    function dismiss(event: globalThis.PointerEvent) {
      if (!optionsRef.current?.contains(event.target as Node)) optionsRef.current?.removeAttribute("open");
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
  function choose(value: "rename" | "delete") {
    optionsRef.current?.removeAttribute("open");
    setName(module.name);
    setError("");
    setAction(value);
  }
  function close() {
    if (busy) return;
    setAction(null);
    requestAnimationFrame(() => optionsRef.current?.querySelector("summary")?.focus());
  }
  return (
    <>
      <details ref={optionsRef} className="project-options module-options">
        <summary aria-label={`Options for ${module.name}`} title="Module options">
          <MoreHorizontal size={16} aria-hidden="true" />
        </summary>
        <div className="project-options-panel">
          <Button variant="ghost" size="sm" className="module-option" onClick={() => choose("rename")}>
            <Pencil size={14} aria-hidden="true" /> Rename module
          </Button>
          <Button variant="ghost" size="sm" className="project-delete-option" onClick={() => choose("delete")}>
            <Trash2 size={14} aria-hidden="true" /> Delete module
          </Button>
        </div>
      </details>
      <Dialog open={action !== null} onOpenChange={(open) => { if (!open) close(); }}>
        <DialogContent>
          <DialogTitle className="text-xl font-semibold">
            {action === "rename" ? "Rename module" : `Delete ${module.name}?`}
          </DialogTitle>
          <DialogDescription className="my-4 text-sm text-stone-500">
            {action === "rename" ? "Choose a new name for this module." :
              `This removes the module. Its ${taskCount} ${taskCount === 1 ? "task will" : "tasks will"} move to No module in this project, keeping their updates and attachments.`}
          </DialogDescription>
          <form className="form-stack" onSubmit={async (event) => {
            event.preventDefault();
            if (busy || !action) return;
            setBusy(true);
            setError("");
            try {
              await command(action === "rename" ? { action: "rename_module", id: module.id, name } : { action: "delete_module", id: module.id });
              setAction(null);
              if (action === "delete" && active) router.push(`/projects/${module.project_id}`);
              else requestAnimationFrame(() => optionsRef.current?.querySelector("summary")?.focus());
            } catch (error) { setError((error as Error).message); }
            finally { setBusy(false); }
          }}>
            {action === "rename" && <label>
              Module name
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required disabled={busy} />
            </label>}
            {error && <p role="alert" className="error">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={close}>Cancel</Button>
              <Button className={action === "delete" ? "bg-red-700 hover:bg-red-800" : undefined}
                disabled={busy || (action === "rename" && !name.trim())}>
                {busy ? "Saving…" : action === "rename" ? "Save name" : "Delete module"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
