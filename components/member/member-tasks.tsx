"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { statuses } from "@/lib/types";

type Task = { id:string;title:string;description:string;status:string;priority:string;target_date:string|null;created_at:string;updated_at:string };
export function MemberTasks({ name }: { name:string }) {
  const [tasks,setTasks] = useState<Task[]>([]);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  const [status,setStatus] = useState("open");
  const [dateField,setDateField] = useState("target_date");
  const [from,setFrom] = useState("");
  const [to,setTo] = useState("");
  useEffect(() => { fetch("/api/member/tasks").then(async r => {
    const data = await r.json(); if (!r.ok) throw Error(data.error);
    setTasks(data.tasks);
  }).catch(e=>setError(e.message)).finally(()=>setLoading(false)); }, []);
  const shown = tasks.filter((t) => {
    if (status === "open" && ["Completed","Dropped"].includes(t.status)) return false;
    if (status !== "all" && status !== "open" && t.status !== status) return false;
    const value = dateField === "target_date" ? t.target_date : dateField === "created_at" ? t.created_at.slice(0,10) : t.updated_at.slice(0,10);
    if ((from || to) && !value) return false;
    return (!from || value! >= from) && (!to || value! <= to);
  });
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-8">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold">My tasks</h1><p className="text-stone-500">Tasks assigned to {name}</p></div><LogoutButton /></header>
    <div className="mb-6 grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-4">
      <label className="text-sm">Status<select className="mt-1 w-full rounded-lg border p-2" value={status} onChange={e=>setStatus(e.target.value)}><option value="open">Open tasks</option><option value="all">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
      <label className="text-sm">Date type<select className="mt-1 w-full rounded-lg border p-2" value={dateField} onChange={e=>setDateField(e.target.value)}><option value="target_date">Target date</option><option value="created_at">Created</option><option value="updated_at">Updated</option></select></label>
      <label className="text-sm">From<input className="mt-1 w-full rounded-lg border p-2" type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
      <label className="text-sm">To<input className="mt-1 w-full rounded-lg border p-2" type="date" value={to} onChange={e=>setTo(e.target.value)} /></label>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <p>Loading tasks…</p> : shown.length ? <div className="space-y-3">{shown.map(t=><Link href={`/my-tasks/${t.id}`} key={t.id} className="block rounded-2xl border border-stone-200 bg-white p-5 shadow-sm hover:border-emerald-600"><div className="flex justify-between gap-3"><strong>{t.title}</strong><span className="text-sm text-stone-600">{t.status}</span></div><p className="mt-1 line-clamp-2 text-sm text-stone-500">{t.description}</p><p className="mt-2 text-xs text-stone-500">{t.target_date ? `Target: ${t.target_date}` : "No target date"}</p></Link>)}</div> : <p className="rounded-2xl border border-stone-200 bg-white p-6 text-stone-500">No tasks match these filters.</p>}
  </main>;
}
