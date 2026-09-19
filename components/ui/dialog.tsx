"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export const Dialog = D.Root;
export const DialogTitle = D.Title;
export const DialogDescription = D.Description;
export function DialogContent({ children }: { children: React.ReactNode }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-stone-950/35 backdrop-blur-sm" />
      <D.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-7 shadow-2xl">
        {children}
        <D.Close
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded p-1 text-stone-400 hover:bg-stone-100"
        >
          <X size={18} />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
