/**
 * Small building blocks shared by the admin screens (matches the app's brutal style).
 */
import React from "react";
import { cn } from "@/lib/utils";

export const textareaClass =
  "w-full p-3 border-4 border-foreground bg-background font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary";
export const selectClass =
  "w-full h-10 px-3 border-4 border-foreground bg-background text-sm font-bold focus:outline-none";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-black uppercase">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "muted" | "warn" | "ok" }) {
  const tones = {
    default: "bg-primary text-primary-foreground",
    muted: "bg-muted text-muted-foreground",
    warn: "bg-yellow-200 text-yellow-900",
    ok: "bg-green-200 text-green-900",
  };
  return <span className={cn("inline-block border-2 border-foreground px-2 py-0.5 text-xs font-bold", tones[tone])}>{children}</span>;
}

export function Notice({ kind, children }: { kind: "error" | "warn" | "ok"; children: React.ReactNode }) {
  if (!children) return null;
  const tone = kind === "error" ? "bg-red-50 border-red-600 text-red-900"
    : kind === "warn" ? "bg-yellow-50 border-yellow-600 text-yellow-900"
    : "bg-green-50 border-green-700 text-green-900";
  return <div className={cn("border-4 p-3 text-sm whitespace-pre-wrap", tone)} role={kind === "error" ? "alert" : "status"}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h2 className="text-2xl font-black uppercase">{children}</h2>
      {action}
    </div>
  );
}
