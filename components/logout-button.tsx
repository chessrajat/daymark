"use client";
import { useState } from "react";
import { Button } from "./ui/button";
export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/auth/logout", { method: "POST" });
            if (!r.ok) throw Error("Could not sign out. Please retry.");
            window.location.assign("/login");
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        Sign out
      </Button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
