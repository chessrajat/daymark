"use client";
import { APP_VERSION } from "@/version";
import { useState, type FormEvent } from "react";
import { Leaf, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget));
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      const next =
        new URLSearchParams(window.location.search).get("next") || "/";
      const target = new URL(next, window.location.origin);
      window.location.assign(
        target.origin === window.location.origin && target.pathname !== "/login"
          ? target.pathname + target.search
          : "/",
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="brand mb-8">
          <span className="brand-mark">
            <Leaf size={23} />
          </span>
          daymark.
        </div>
        <h1 className="text-2xl">Welcome back.</h1>
        <p className="subtitle mb-6">Sign in to your personal workspace.</p>
        <form className="form-stack" onSubmit={submit}>
          <label>
            Username
            <input
              name="username"
              autoComplete="username"
              required
              maxLength={200}
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1000}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Button disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />}Sign in
          </Button>
        </form>
        <p
          className="mt-6 text-center text-xs text-stone-400"
          aria-label="App version"
        >
          Version {APP_VERSION}
        </p>
      </div>
    </main>
  );
}
