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

export function TeamAction({
  id,
  name,
  teamId,
}: {
  id: string;
  name: string;
  teamId?: string;
}) {
  const command = useWorkspace((s) => s.command);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = teamId ? "Remove from team" : "Delete team";
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
            {teamId
              ? "This member will become independent. Their tasks stay assigned to them, and the team is removed from those task assignments."
              : "The team will be deleted. Members become independent and keep their tasks. Tasks assigned only to this team become unassigned. All tasks, updates, and attachments are kept."}{" "}
            Affected tasks will record this change in their timelines.
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
                  await command(
                    teamId
                      ? { action: "remove_member", id, team_id: teamId }
                      : { action: "delete_team", id },
                  );
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
