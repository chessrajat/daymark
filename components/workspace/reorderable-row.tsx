"use client";
import { createContext, useContext, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { GripVertical } from "lucide-react";
import { useWorkspace } from "@/lib/store";

type Target = { id: string; placement: "before" | "after" };
type ListState = {
  active: string | null;
  target: Target | null;
  busy: boolean;
  start: (id: string) => void;
  move: (x: number, y: number) => void;
  finish: () => void;
  cancel: () => void;
  keyboardMove: (id: string, direction: "up" | "down") => void;
};
const ReorderContext = createContext<ListState | null>(null);

export function ReorderableList({ kind, children }: { kind: "project" | "module"; children: ReactNode }) {
  const command = useWorkspace((s) => s.command);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string | null>(null);
  const targetRef = useRef<Target | null>(null);
  const pending = useRef(false);
  const [active, setActive] = useState<string | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(body: unknown) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try { await command(body); }
    catch (error) { setError((error as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  function cancel() {
    activeRef.current = null;
    targetRef.current = null;
    setActive(null);
    setTarget(null);
  }
  const value: ListState = {
    active, target, busy,
    start(id) {
      if (pending.current) return;
      activeRef.current = id;
      setActive(id);
      setError("");
    },
    move(x, y) {
      const row = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-reorder-id]");
      if (!row || !listRef.current?.contains(row) || row.dataset.reorderId === activeRef.current) {
        targetRef.current = null;
        setTarget(null);
        return;
      }
      const rect = row.getBoundingClientRect();
      const next: Target = { id: row.dataset.reorderId!, placement: y < rect.top + rect.height / 2 ? "before" : "after" };
      targetRef.current = next;
      setTarget(next);
    },
    finish() {
      const id = activeRef.current;
      const destination = targetRef.current;
      cancel();
      if (id && destination) void save({
        action: kind === "project" ? "place_project" : "place_module",
        id, target_id: destination.id, placement: destination.placement,
      });
    },
    cancel,
    keyboardMove(id, direction) {
      void save({ action: kind === "project" ? "move_project" : "reorder_module", id, direction });
    },
  };
  return (
    <ReorderContext.Provider value={value}>
      <div ref={listRef} className="reorder-list">
        {children}
        {error && <p role="alert" className="reorder-error">{error}</p>}
        <span className="sr-only" role="status">{busy ? "Saving order" : active ? "Dragging item" : ""}</span>
      </div>
    </ReorderContext.Provider>
  );
}

export function ReorderableRow({ id, name, first, last, children }: {
  id: string;
  name: string;
  kind?: "project" | "module";
  first: boolean;
  last: boolean;
  children: ReactNode;
}) {
  const list = useContext(ReorderContext);
  const pointerStart = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  if (!list) throw Error("Missing reorder list");
  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (list!.busy || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStart.current = { x: event.clientX, y: event.clientY, dragging: false };
  }
  return (
    <div className={`reorder-item ${list.active === id ? "reorder-dragging" : ""} ${list.target?.id === id ? `reorder-drop-${list.target.placement}` : ""}`}
      data-reorder-id={id}>
      <div className="reorder-row">
        <button type="button" className="reorder-handle" disabled={list.busy}
          aria-label={`Rearrange ${name}`} title="Drag to rearrange. Use arrow keys to move."
          onPointerDown={pointerDown}
          onPointerMove={(event) => {
            const start = pointerStart.current;
            if (!start) return;
            if (!start.dragging && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 4) {
              start.dragging = true;
              list.start(id);
            }
            if (start.dragging) list.move(event.clientX, event.clientY);
          }}
          onPointerUp={(event) => {
            if (pointerStart.current?.dragging) list.finish();
            pointerStart.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { pointerStart.current = null; list.cancel(); }}
          onLostPointerCapture={() => { pointerStart.current = null; if (list.active === id) list.cancel(); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") { pointerStart.current = null; list.cancel(); }
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              if (!list.busy && !(event.key === "ArrowUp" ? first : last))
                list.keyboardMove(id, event.key === "ArrowUp" ? "up" : "down");
            }
          }}>
          <GripVertical size={17} aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>
  );
}
