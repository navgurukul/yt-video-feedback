/**
 * Members of the institution: invite (single or bulk), change role/program, remove.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, errorText, AdminConfig, Member } from "@/lib/adminApi";
import { useTenant } from "@/lib/tenant";
import { Badge, Field, Notice, SectionTitle, selectClass, textareaClass } from "./ui";

const ROLES = [
  { value: "student", label: "Student" },
  { value: "evaluator", label: "Evaluator (sees all evaluations, manual evaluation)" },
  { value: "institution_admin", label: "Institution admin" },
];
const ROLE_SHORT: Record<string, string> = { student: "Student", evaluator: "Evaluator", institution_admin: "Admin" };

export default function UsersTab() {
  const qc = useQueryClient();
  const { me } = useTenant();
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: () => api<Member[]>("/api/admin/users") });
  const tree = useQuery({ queryKey: ["admin", "config"], queryFn: () => api<AdminConfig>("/api/admin/config") });
  const programs = tree.data?.programs ?? [];

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("student");
  const [programId, setProgramId] = useState("");
  const [bulk, setBulk] = useState("");
  const [filter, setFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });
  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true); setError(""); setNotice("");
    try { const msg = await fn(); if (msg) setNotice(msg); await refresh(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  const invite = () => run(async () => {
    await api("/api/admin/users", "POST", { email: email.trim(), role, programId: programId || null });
    setEmail("");
    return `Added ${email.trim()} as ${ROLE_SHORT[role]}. They can sign in with Google right away.`;
  });

  // Bulk: one per line, "email" or "email, role"
  const importBulk = () => run(async () => {
    const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean);
    const failed: string[] = [];
    let ok = 0;
    for (const line of lines) {
      const [addr, r] = line.split(/[,;\t]/).map((x) => x.trim());
      const rr = (r || role).toLowerCase().replace(/\s+/g, "_").replace(/^admin$/, "institution_admin");
      try { await api("/api/admin/users", "POST", { email: addr, role: rr, programId: programId || null }); ok++; }
      catch (e) { failed.push(`${line}: ${errorText(e)}`); }
    }
    setBulk("");
    if (failed.length) setError(`Could not add ${failed.length}:\n${failed.join("\n")}`);
    return `Added or updated ${ok} of ${lines.length}.`;
  });

  const shown = useMemo(() => (users.data ?? []).filter((u) =>
    (!filter || u.email.includes(filter.toLowerCase())) && (!roleFilter || u.role === roleFilter)), [users.data, filter, roleFilter]);

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <SectionTitle>Add people</SectionTitle>
        <Notice kind="error">{error}</Notice>
        <Notice kind="ok">{notice}</Notice>
        <div className="grid gap-4 md:grid-cols-[1fr_260px_220px_auto] items-end">
          <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@college.edu" /></Field>
          <Field label="Role">
            <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Program (optional)">
            <select className={selectClass} value={programId} onChange={(e) => setProgramId(e.target.value)}>
              <option value="">— any —</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Button onClick={invite} disabled={busy || !email.includes("@")}>Add</Button>
        </div>
        <Field label="Bulk add (one per line: email or email, role)" hint="Paste a column from a spreadsheet. Roles: student, evaluator, admin. Uses the role/program above when not given.">
          <textarea className={textareaClass} rows={4} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"asha@college.edu\nravi@college.edu, evaluator"} />
        </Field>
        <Button variant="outline" onClick={importBulk} disabled={busy || !bulk.trim()}>Import list</Button>
        <p className="text-xs text-muted-foreground">Anyone whose email domain is in Settings → Allowed email domains joins automatically as a student on first sign-in.</p>
      </Card>

      <Card className="p-6">
        <SectionTitle action={<span className="text-sm font-bold">{shown.length} of {users.data?.length ?? 0}</span>}>Members</SectionTitle>
        <div className="flex flex-wrap gap-3 mb-4">
          <Input className="max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search email" />
          <select className={`${selectClass} max-w-[200px]`} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{ROLE_SHORT[r.value]}</option>)}
          </select>
        </div>
        {users.isLoading && <p>Loading…</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b-4 border-foreground">
                <th className="p-2">Email</th><th className="p-2">Role</th><th className="p-2">Program</th><th className="p-2">Evaluations</th><th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, 500).map((u) => (
                <tr key={u.id} className="border-b border-muted">
                  <td className="p-2 font-mono">{u.email}{u.email === me?.email && <Badge tone="muted">you</Badge>}</td>
                  <td className="p-2">
                    <select className="border-2 border-foreground bg-background px-1" value={u.role} disabled={busy}
                      onChange={(e) => run(async () => { await api(`/api/admin/users/${u.id}`, "PATCH", { role: e.target.value }); return `${u.email} is now ${ROLE_SHORT[e.target.value]}.`; })}>
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{ROLE_SHORT[r.value]}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <select className="border-2 border-foreground bg-background px-1" value={u.program_id ?? ""} disabled={busy}
                      onChange={(e) => run(async () => { await api(`/api/admin/users/${u.id}`, "PATCH", { programId: e.target.value || null }); })}>
                      <option value="">— any —</option>
                      {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td className="p-2">{u.evaluations}</td>
                  <td className="p-2 text-right">
                    <Button size="sm" variant="outline" disabled={busy}
                      onClick={() => { if (window.confirm(`Remove ${u.email}'s ${ROLE_SHORT[u.role]} access? Their past evaluations are kept.`)) run(async () => { await api(`/api/admin/users/${u.id}`, "DELETE"); return `Removed ${u.email}.`; }); }}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > 500 && <p className="text-xs mt-2">Showing the first 500; use search to narrow down.</p>}
        </div>
      </Card>
    </div>
  );
}
