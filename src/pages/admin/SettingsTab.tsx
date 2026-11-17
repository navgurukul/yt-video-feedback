/**
 * Institution settings: name, logo, allowed email domains, Gemini key, manual-eval exclusions,
 * plus a usage summary.
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, errorText, Settings, linesToList, listToLines } from "@/lib/adminApi";
import { Badge, Field, Notice, SectionTitle, textareaClass } from "./ui";

interface Stats {
  totals: { concept: number; project: number; custom: number; manual: number; students: number };
  activeStudents30d: number;
  llm30d: { calls: number; tokens: number; failed: number };
  byPhase: { program: string; phase: string; concept: number; project: number }[];
}

export default function SettingsTab() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: () => api<Settings>("/api/admin/settings") });
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: () => api<Stats>("/api/admin/stats") });

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [domains, setDomains] = useState("");
  const [excluded, setExcluded] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!settings.data) return;
    setName(settings.data.name);
    setLogoUrl(settings.data.logoUrl ?? "");
    setDomains(listToLines(settings.data.allowedEmailDomains));
    setExcluded(listToLines(settings.data.manualEvalExcludedEmails));
  }, [settings.data]);

  const save = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/admin/settings", "PUT", body);
      setNotice(msg);
      await qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  if (settings.isLoading) return <p className="font-bold">Loading…</p>;
  if (settings.isError) return <Notice kind="error">{errorText(settings.error)}</Notice>;
  const s = settings.data!;
  const st = stats.data;

  return (
    <div className="space-y-6">
      <Notice kind="error">{error}</Notice>
      <Notice kind="ok">{notice}</Notice>

      {st && (
        <Card className="p-6">
          <SectionTitle>Usage</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Students", st.totals.students], ["Active (30 days)", st.activeStudents30d],
              ["Concept evals", st.totals.concept], ["Project evals", st.totals.project],
              ["Manual evals", st.totals.manual], ["AI tokens (30 days)", st.llm30d.tokens.toLocaleString()],
            ].map(([label, value]) => (
              <div key={String(label)} className="border-4 border-foreground p-3">
                <div className="text-xs font-bold uppercase text-muted-foreground">{label}</div>
                <div className="text-2xl font-black">{value}</div>
              </div>
            ))}
          </div>
          {st.byPhase.length > 0 && (
            <details className="mt-4">
              <summary className="font-bold cursor-pointer">Evaluations per phase</summary>
              <table className="w-full text-sm mt-2">
                <thead><tr className="text-left border-b-2 border-foreground"><th className="p-1">Program</th><th className="p-1">Phase</th><th className="p-1">Concept</th><th className="p-1">Project</th></tr></thead>
                <tbody>{st.byPhase.map((r) => (
                  <tr key={r.program + r.phase} className="border-b border-muted"><td className="p-1">{r.program}</td><td className="p-1">{r.phase}</td><td className="p-1">{r.concept}</td><td className="p-1">{r.project}</td></tr>
                ))}</tbody>
              </table>
            </details>
          )}
        </Card>
      )}

      <Card className="p-6 space-y-4">
        <SectionTitle>Institution</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Logo URL" hint="Shown in the header next to the institution name.">
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
          </Field>
          <Field label="Allowed email domains (one per line)" hint="People signing in with these domains join automatically as students.">
            <textarea className={textareaClass} rows={3} value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="college.edu" />
          </Field>
          <Field label="Hide from manual-evaluation queue (one email per line)" hint="E.g. staff test accounts.">
            <textarea className={textareaClass} rows={3} value={excluded} onChange={(e) => setExcluded(e.target.value)} />
          </Field>
        </div>
        <Button disabled={busy} onClick={() => save({
          name, logoUrl: logoUrl.trim() || null,
          allowedEmailDomains: linesToList(domains).map((d) => d.toLowerCase().replace(/^@/, "")),
          manualEvalExcludedEmails: linesToList(excluded).map((e) => e.toLowerCase()),
        }, "Settings saved.")}>Save settings</Button>
      </Card>

      <Card className="p-6 space-y-4">
        <SectionTitle action={s.gemini.hasKey ? <Badge tone="ok">key set {s.gemini.masked}</Badge> : <Badge tone="warn">no institution key</Badge>}>
          Gemini API key
        </SectionTitle>
        <p className="text-sm">
          With an institution key, all evaluations for your students use it and students don't need their own.
          Without one, each student uses the key they enter in the app. The key is stored encrypted; only its last 4 characters are shown.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[260px]">
            <Field label={s.gemini.hasKey ? "Replace key" : "Key"}>
              <Input type="password" autoComplete="off" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIza…" />
            </Field>
          </div>
          <Button disabled={busy || geminiKey.trim().length < 10} onClick={async () => { await save({ geminiApiKey: geminiKey.trim() }, "Gemini key saved."); setGeminiKey(""); }}>
            Save key
          </Button>
          {s.gemini.hasKey && (
            <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm("Remove the institution's Gemini key? Students will need their own keys.")) save({ geminiApiKey: null }, "Gemini key removed."); }}>
              Remove key
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
