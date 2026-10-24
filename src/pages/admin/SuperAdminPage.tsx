/**
 * /super-admin — platform owner console: institutions, first admins, suspension, usage.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, errorText, InstitutionRow, linesToList } from "@/lib/adminApi";
import { useTenant } from "@/lib/tenant";
import { Badge, Field, Notice, SectionTitle, selectClass, textareaClass } from "./ui";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export default function SuperAdminPage() {
  const { me, switchInstitution } = useTenant();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["super", "institutions"], enabled: !!me?.isSuperAdmin, queryFn: () => api<InstitutionRow[]>("/api/super/institutions") });

  const [form, setForm] = useState({ name: "", slug: "", type: "college", domains: "", adminEmail: "", cloneFrom: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [addAdmin, setAddAdmin] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true); setError(""); setNotice("");
    try { setNotice(await fn()); await qc.invalidateQueries({ queryKey: ["super"] }); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  if (!me?.isSuperAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 flex-1">
          <Card className="max-w-xl mx-auto p-8 text-center">
            <h1 className="text-2xl font-black mb-2">Super admins only</h1>
            <Link to="/" className="underline font-bold">Back to home</Link>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const rows = list.data ?? [];
  const totals = rows.reduce((a, r) => ({ students: a.students + r.students, evaluations: a.evaluations + r.evaluations, tokens: a.tokens + Number(r.tokens_30d) }), { students: 0, evaluations: 0, tokens: 0 });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 flex-1 space-y-6">
        <div>
          <h1 className="text-4xl font-black uppercase">Super admin</h1>
          <p className="font-bold text-muted-foreground">All institutions on the platform</p>
        </div>
        <Notice kind="error">{error}</Notice>
        <Notice kind="ok">{notice}</Notice>

        <div className="grid gap-3 sm:grid-cols-4">
          {[["Institutions", rows.length], ["Students", totals.students], ["Evaluations", totals.evaluations], ["AI tokens (30 days)", totals.tokens.toLocaleString()]].map(([l, v]) => (
            <Card key={String(l)} className="p-4"><div className="text-xs font-bold uppercase text-muted-foreground">{l}</div><div className="text-3xl font-black">{v}</div></Card>
          ))}
        </div>

        <Card className="p-6">
          <SectionTitle>Institutions</SectionTitle>
          {list.isLoading && <p>Loading…</p>}
          {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b-4 border-foreground">
                  <th className="p-2">Institution</th><th className="p-2">Domains</th><th className="p-2">Students</th><th className="p-2">Admins</th>
                  <th className="p-2">Evaluations</th><th className="p-2">Tokens 30d</th><th className="p-2">Gemini key</th><th className="p-2">Status</th><th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-muted align-top">
                    <td className="p-2"><div className="font-bold">{r.name}</div><div className="text-xs text-muted-foreground">{r.slug} · {r.type}</div></td>
                    <td className="p-2 text-xs">{r.allowed_email_domains.join(", ") || "—"}</td>
                    <td className="p-2">{r.students}</td>
                    <td className="p-2">{r.admins}</td>
                    <td className="p-2">{r.evaluations}</td>
                    <td className="p-2">{Number(r.tokens_30d).toLocaleString()}</td>
                    <td className="p-2">{r.has_gemini_key ? <Badge tone="ok">set</Badge> : <Badge tone="muted">none</Badge>}</td>
                    <td className="p-2">{r.status === "active" ? <Badge tone="ok">active</Badge> : <Badge tone="warn">suspended</Badge>}</td>
                    <td className="p-2 space-y-2 min-w-[220px]">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => switchInstitution(r.id)} title="Open the app as this institution">Open</Button>
                        <Button size="sm" variant="outline" disabled={busy}
                          onClick={() => {
                            const next = r.status === "active" ? "suspended" : "active";
                            if (next === "suspended" && !window.confirm(`Suspend ${r.name}? Its users will not be able to sign in.`)) return;
                            run(async () => { await api(`/api/super/institutions/${r.id}`, "PATCH", { status: next }); return `${r.name} is now ${next}.`; });
                          }}>
                          {r.status === "active" ? "Suspend" : "Reactivate"}
                        </Button>
                      </div>
                      <div className="flex gap-1">
                        <Input className="h-8 text-xs" placeholder="add admin email" value={addAdmin[r.id] ?? ""} onChange={(e) => setAddAdmin({ ...addAdmin, [r.id]: e.target.value })} />
                        <Button size="sm" disabled={busy || !(addAdmin[r.id] ?? "").includes("@")}
                          onClick={() => run(async () => {
                            await api(`/api/super/institutions/${r.id}/users`, "POST", { email: addAdmin[r.id].trim(), role: "institution_admin" });
                            setAddAdmin({ ...addAdmin, [r.id]: "" });
                            return `Added ${addAdmin[r.id].trim()} as admin of ${r.name}.`;
                          })}>Add</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <SectionTitle>New institution</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <Input value={form.name} placeholder="e.g. ABC Institute of Management"
                onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugTouched ? form.slug : slugify(e.target.value) })} />
            </Field>
            <Field label="Short id (slug)" hint="Lowercase letters, numbers and dashes.">
              <Input value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: slugify(e.target.value) }); }} />
            </Field>
            <Field label="Type">
              <select className={selectClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {["school", "college", "university", "bootcamp", "ngo", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="First admin's email" hint="They can sign in with Google and set everything up.">
              <Input value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} placeholder="dean@college.edu" />
            </Field>
            <Field label="Allowed email domains (one per line, optional)" hint="Students with these domains join automatically.">
              <textarea className={textareaClass} rows={2} value={form.domains} onChange={(e) => setForm({ ...form, domains: e.target.value })} placeholder="college.edu" />
            </Field>
            <Field label="Start from" hint="Copy another institution's programs, phases, videos, rubrics and prompts.">
              <select className={selectClass} value={form.cloneFrom} onChange={(e) => setForm({ ...form, cloneFrom: e.target.value })}>
                <option value="">Blank: the admin builds the syllabus</option>
                {rows.map((r) => <option key={r.id} value={r.id}>Copy of {r.name}</option>)}
              </select>
            </Field>
          </div>
          <Button disabled={busy || !form.name.trim() || !form.slug || !form.adminEmail.includes("@")}
            onClick={() => run(async () => {
              const res = await api<{ institution: { name: string }; cloned: { phases: number; videos: number } | null }>("/api/super/institutions", "POST", {
                name: form.name.trim(), slug: form.slug, type: form.type, adminEmail: form.adminEmail.trim(),
                allowedEmailDomains: linesToList(form.domains).map((d) => d.toLowerCase().replace(/^@/, "")),
                cloneFromInstitutionId: form.cloneFrom || null,
              });
              setForm({ name: "", slug: "", type: "college", domains: "", adminEmail: "", cloneFrom: "" }); setSlugTouched(false);
              return `Created ${res.institution.name}${res.cloned ? ` with ${res.cloned.phases} phases and ${res.cloned.videos} videos copied` : ""}. ${form.adminEmail.trim()} can now sign in as its admin.`;
            })}>
            {busy ? "Creating…" : "Create institution"}
          </Button>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
