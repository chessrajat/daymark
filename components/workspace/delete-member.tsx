"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/store";
import { useState } from "react";

export function DeleteMember({ id, name }: { id: string; name: string }) {
  const command = useWorkspace((s) => s.command);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = "Delete member";
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="mb-2 text-red-700"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogTitle className="text-xl font-semibold">
            {label}: {name}?
          </DialogTitle>
          <DialogDescription className="my-4 text-sm text-stone-500">
            This permanently deletes this independent member. Their tasks,
            updates, and attachments are kept. Their tasks become unassigned
            unless they still have a team assignment. Each affected task records
            this change in its timeline.
          </DialogDescription>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-700 hover:bg-red-800"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await command({ action: "delete_member", id });
                  setOpen(false);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : label}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
