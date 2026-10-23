"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/store";
import type { Member } from "@/lib/types";

export function MemberAccountAction({ member }: { member: Member }) {
  const refresh = useWorkspace((s) => s.refresh);
  const [open,setOpen] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [username,setUsername] = useState(member.account_username || "");
  const [password,setPassword] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await fetch("/api/member-accounts", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({member_id:member.id,username,password}) });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      await refresh(); setPassword(""); setOpen(false);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/member-accounts", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({member_id:member.id}) });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      await refresh(); setPassword(""); setOpen(false);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <>
    <Button variant="outline" size="sm" onClick={() => { setUsername(member.account_username || ""); setError(""); setOpen(true); }}>
      {member.account_username ? "Manage login" : "Create login"}
    </Button>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
      <DialogContent>
        <DialogTitle className="text-xl font-semibold">{member.account_username ? "Manage" : "Create"} login for {member.name}</DialogTitle>
        <DialogDescription className="my-3 text-sm text-stone-500">This account can see only tasks assigned directly to {member.name}. Saving a new password signs out existing sessions.</DialogDescription>
        <form onSubmit={save} className="form-stack">
          <label>Username<input required minLength={3} maxLength={64} autoComplete="off" value={username} onChange={(e)=>setUsername(e.target.value)} /></label>
          <label>{member.account_username ? "New password" : "Password"}<input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={(e)=>setPassword(e.target.value)} /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            {member.account_username && <Button type="button" variant="outline" disabled={busy} onClick={disable}>Disable login</Button>}
            <Button disabled={busy}>{busy ? "Saving…" : member.account_username ? "Save new credentials" : "Create login"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
