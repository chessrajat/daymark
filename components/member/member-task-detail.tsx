"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TaskTimeline } from "@/components/tasks/task-timeline";
import { statuses, type Event } from "@/lib/types";

type Task = { id:string;title:string;description:string;status:string;priority:string;target_date:string|null;dependency_reason:string|null };
export function MemberTaskDetail() {
  const { id } = useParams<{id:string}>();
  const [task,setTask] = useState<Task|null>(null);
  const [events,setEvents] = useState<Event[]>([]);
  const [nextCursor,setNextCursor] = useState<string|null>(null);
  const [loadingOlder,setLoadingOlder] = useState(false);
  const [olderError,setOlderError] = useState("");
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const [status,setStatus] = useState("");
  const [reason,setReason] = useState("");
  const load = useCallback(async () => {
    const r = await fetch(`/api/member/tasks/${id}`);
    const data = await r.json(); if (!r.ok) throw Error(data.error);
    setTask(data.task); setEvents(data.events); setNextCursor(data.nextCursor); setStatus(data.task.status); setReason(data.task.dependency_reason || "");
  },[id]);
  async function loadOlder() {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true); setOlderError("");
    try {
      const r = await fetch(`/api/member/tasks/${id}?before=${nextCursor}`);
      const data = await r.json(); if (!r.ok) throw Error(data.error);
      setEvents(current => [...data.events, ...current]); setNextCursor(data.nextCursor);
    } catch (e) { setOlderError((e as Error).message); }
    finally { setLoadingOlder(false); }
  }
  useEffect(()=>{ load().catch(e=>setError(e.message)).finally(()=>setLoading(false)); },[load]);
  async function submit(e:FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await fetch(`/api/member/tasks/${id}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({message,status,dependency_reason:reason}) });
      const data = await r.json(); if (!r.ok) throw Error(data.error);
      setMessage(""); await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-5xl px-5 py-8">
    <Link href="/my-tasks" className="text-sm text-emerald-800">← My tasks</Link>
    {loading ? <p className="mt-8">Loading task…</p> : task ? <>
      <section className="my-6 rounded-2xl border border-stone-200 bg-white p-6"><h1 className="text-3xl font-semibold">{task.title}</h1><p className="mt-3 whitespace-pre-wrap text-stone-700">{task.description}</p><div className="mt-5 flex flex-wrap gap-3 text-sm text-stone-600"><span>Status: {task.status}</span><span>Priority: {task.priority}</span><span>Target: {task.target_date || "Not set"}</span></div>{task.dependency_reason && <p className="mt-3 text-sm">Waiting on: {task.dependency_reason}</p>}</section>
      <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-6"><h2 className="mb-4 text-xl font-semibold">Post an update</h2><form onSubmit={submit} className="form-stack"><label>Update<textarea className="min-h-28" required maxLength={10000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="What changed?" /></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>{status === "Dependent" && <label>What are you waiting on?<textarea required maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} /></label>}{error && <p className="error" role="alert">{error}</p>}<Button disabled={busy}>{busy ? "Posting…" : "Post update"}</Button></form></section>
      <TaskTimeline events={events} loading={false} hasOlder={!!nextCursor} loadingOlder={loadingOlder} olderError={olderError} loadOlder={loadOlder} />
    </> : <p className="mt-8" role="alert">{error || "Task not found."}</p>}
  </main>;
}
