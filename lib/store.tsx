"use client";
import { createContext, useContext, useState } from "react";
import { createStore, useStore } from "zustand";
import type { Data } from "./types";
export type State = {
  data: Data;
  loading: boolean;
  error: string;
  search: string;
  refresh: () => Promise<void>;
  setSearch: (s: string) => void;
  command: (body: unknown) => Promise<string | undefined>;
};
function makeStore() {
  return createStore<State>((set, get) => ({
    data: { modules: [], projects: [], teams: [], members: [], tasks: [] },
    loading: true,
    error: "",
    search: "",
    setSearch: (search) => set({ search }),
    refresh: async () => {
      try {
        const r = await fetch("/api/workspace");
        if (r.status === 401) {
          window.location.assign("/login");
          throw Error("Session expired. Please sign in.");
        }
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        set({ data, loading: false, error: "" });
      } catch (e) {
        set({ loading: false, error: (e as Error).message });
      }
    },
    command: async (body) => {
      const r = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 401) {
        window.location.assign("/login");
        throw Error("Session expired. Please sign in.");
      }
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      await get().refresh();
      return result.id;
    },
  }));
}
const Context = createContext<ReturnType<typeof makeStore> | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useWorkspace<T>(selector: (state: State) => T) {
  const store = useContext(Context);
  if (!store) throw Error("Missing workspace provider");
  return useStore(store, selector);
}
