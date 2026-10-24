/**
 * Rubric editor: criteria × levels grid, live weight total, version history, JSON mode.
 * Editing an existing rubric saves a new version; videos move to it automatically.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, errorText, Rubric, linesToList, listToLines } from "@/lib/adminApi";
import { Badge, Field, Notice, SectionTitle, selectClass, textareaClass } from "./ui";

type Row = Record<string, unknown>;
const DEFAULT_LEVELS = ["Beginner (1)", "Intermediate (2)", "Advanced (3)", "Expert (4)"];

export default function RubricsTab() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin", "rubrics"], queryFn: () => api<Rubric[]>("/api/admin/rubrics") });
  const [selected, setSelected] = useState<Rubric | "new" | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="p-4 h-fit">
        <SectionTitle action={<Button size="sm" onClick={() => setSelected("new")}><Plus className="w-4 h-4 mr-1" /> New</Button>}>Rubrics</SectionTitle>
        {list.isLoading && <p>Loading…</p>}
        {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
        <ul className="space-y-2">
          {(list.data ?? []).map((r) => (
            <li key={r.id}>
              <button
                className={`w-full text-left border-2 border-foreground p-2 ${selected !== "new" && selected?.name === r.name ? "bg-primary text-primary-foreground" : "bg-background"}`}
                onClick={() => setSelected(r)}
              >
                <div className="font-bold">{r.name}</div>
                <div className="text-xs">{r.rubricType.replace(/_/g, " ")} · v{r.version}{(r.versions ?? 1) > 1 ? ` (${r.versions} versions)` : ""}</div>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {selected ? (
        <RubricEditor
          key={selected === "new" ? "new" : selected.name}
          rubric={selected === "new" ? null : selected}
          onSaved={async (r) => {
            await qc.invalidateQueries({ queryKey: ["admin"] });
            await qc.invalidateQueries({ queryKey: ["institution-config"] });
            setSelected(r);
          }}
        />
      ) : (
        <Card className="p-6"><p className="text-muted-foreground">Select a rubric to view or edit it, or create a new one.</p></Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------
function RubricEditor({ rubric, onSaved }: { rubric: Rubric | null; onSaved: (r: Rubric) => void }) {
  const isNew = !rubric;
  const [name, setName] = useState(rubric?.name ?? "");
  const [type, setType] = useState<Rubric["rubricType"]>(rubric?.rubricType ?? "project");
  const [levels, setLevels] = useState<string[]>(rubric?.levels?.length ? rubric.levels : DEFAULT_LEVELS);
  const [rows, setRows] = useState<Row[]>(rubric?.criteria ? structuredClone(rubric.criteria) : []);
  const [jsonMode, setJsonMode] = useState(false);
  const [json, setJson] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const versions = useQuery({
    queryKey: ["admin", "rubric-versions", rubric?.id],
    enabled: !!rubric,
    queryFn: () => api<Rubric[]>(`/api/admin/rubrics/${rubric!.id}/versions`),
  });

  const isAbility = type === "ability_to_explain";
  // Ability rubrics: rows are levels {Level, <description key>}
  const descKey = (rows[0] && Object.keys(rows[0]).find((k) => k !== "Level")) || "Description";
  const total = rows.reduce((a, r) => a + (Number(r["Weightage (%)"]) || 0), 0);

  // Update a row in place so existing key order is kept (the AI sees the rubric text as stored).
  const setCell = (i: number, key: string, value: unknown) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const addRow = () => setRows((rs) => [
    ...rs,
    isAbility
      ? { Level: "", [descKey]: "" }
      : { Parameter: "", "Weightage (%)": 0, ...Object.fromEntries(levels.map((l) => [l, ""])), Checklist: [] },
  ]);

  const toJson = () => { setJson(JSON.stringify(rows, null, 2)); setJsonMode(true); };
  const fromJson = () => {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) throw new Error("Criteria must be a JSON array");
      setRows(parsed); setJsonMode(false); setError("");
    } catch (e) { setError(`Invalid JSON: ${errorText(e)}`); }
  };

  const save = async (criteria: Row[] = rows, levelList: string[] = levels) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = isNew
        ? await api<Rubric>("/api/admin/rubrics", "POST", { name, rubricType: type, levels: levelList, criteria })
        : await api<Rubric & { videosUpdated?: number }>(`/api/admin/rubrics/${rubric!.id}/versions`, "POST", { criteria, levels: levelList });
      const moved = (saved as { videosUpdated?: number }).videosUpdated;
      setNotice([
        isNew ? `Created "${saved.name}".` : `Saved as version ${saved.version}.${moved ? ` ${moved} video(s) now use it.` : ""} Past evaluations keep the version they were graded with.`,
        ...(saved.warnings ?? []).map((w) => `⚠ ${w}`),
      ].join("\n"));
      onSaved(saved);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  return (
    <Card className="p-6 space-y-5">
      <SectionTitle action={rubric && <Badge>v{rubric.version}{rubric.isActive ? "" : " (inactive)"}</Badge>}>
        {isNew ? "New rubric" : rubric!.name}
      </SectionTitle>
      <Notice kind="error">{error}</Notice>
      <Notice kind="ok">{notice}</Notice>

      {isNew && (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Business Pitch Rubric" /></Field>
          <Field label="Used for">
            <select className={selectClass} value={type} onChange={(e) => { setType(e.target.value as Rubric["rubricType"]); setRows([]); }}>
              <option value="project">Project videos (criteria × levels)</option>
              <option value="ability_to_explain">Concept videos – ability to explain (levels)</option>
              <option value="generic">Generic (criteria × levels)</option>
            </select>
          </Field>
          {!isAbility && (
            <div className="md:col-span-2">
              <Field label="Level names (one per line, lowest first)" hint='Keep "(1)…(4)" style numbering if you want scores per level.'>
                <textarea className={textareaClass} rows={4} value={listToLines(levels)} onChange={(e) => setLevels(linesToList(e.target.value))} />
              </Field>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!isAbility && (
          <span className={`border-4 px-3 py-1 font-black ${total === 100 ? "border-green-700 text-green-800" : "border-red-600 text-red-700"}`}>
            Total weight: {total}%
          </span>
        )}
        <Button variant="outline" size="sm" onClick={jsonMode ? fromJson : toJson}>{jsonMode ? "Back to grid (apply JSON)" : "Edit as JSON"}</Button>
      </div>

      {jsonMode ? (
        <textarea className={textareaClass} rows={20} value={json} onChange={(e) => setJson(e.target.value)} />
      ) : isAbility ? (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="border-2 border-foreground p-3 grid gap-2 md:grid-cols-[200px_1fr_auto]">
              <Input value={String(r.Level ?? "")} onChange={(e) => setCell(i, "Level", e.target.value)} placeholder="Level name" />
              <textarea className={textareaClass} rows={3} value={String(r[descKey] ?? "")} onChange={(e) => setCell(i, descKey, e.target.value)} placeholder="What this level looks like" />
              <Button variant="outline" size="sm" aria-label="Remove level" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r, i) => (
            <div key={i} className="border-4 border-foreground p-3 space-y-3">
              <div className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
                <Field label={`Criterion ${i + 1}`}>
                  <Input value={String(r.Parameter ?? "")} onChange={(e) => setCell(i, "Parameter", e.target.value)} placeholder="e.g. Problem understanding" />
                </Field>
                <Field label="Weight %">
                  <Input type="number" min={1} max={100} value={String(r["Weightage (%)"] ?? "")}
                    onChange={(e) => setCell(i, "Weightage (%)", e.target.value === "" ? "" : Number(e.target.value))} />
                </Field>
                <div className="flex items-end">
                  <Button variant="outline" size="sm" aria-label="Remove criterion" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {levels.map((l) => (
                  <Field key={l} label={l}>
                    <textarea className={textareaClass} rows={4} value={String(r[l] ?? "")} onChange={(e) => setCell(i, l, e.target.value)} />
                  </Field>
                ))}
              </div>
              <Field label="Checklist (one item per line, optional)" hint="Observable things the AI should look for.">
                <textarea className={textareaClass} rows={3} value={listToLines(Array.isArray(r.Checklist) ? (r.Checklist as string[]) : [])}
                  onChange={(e) => setCell(i, "Checklist", linesToList(e.target.value))} />
              </Field>
            </div>
          ))}
        </div>
      )}

      {!jsonMode && <Button variant="outline" onClick={addRow}><Plus className="w-4 h-4 mr-1" /> {isAbility ? "Level" : "Criterion"}</Button>}

      <div className="flex gap-3">
        <Button onClick={() => save()} disabled={busy || jsonMode || (isNew && !name.trim()) || rows.length === 0}>
          {busy ? "Saving…" : isNew ? "Create rubric" : "Save as new version"}
        </Button>
      </div>

      {rubric && (
        <div>
          <h3 className="font-black uppercase mb-2">Version history</h3>
          <ul className="space-y-2">
            {(versions.data ?? []).map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2 border-2 border-foreground p-2 text-sm">
                <Badge tone={v.isActive ? "ok" : "muted"}>v{v.version}{v.isActive ? " · in use" : ""}</Badge>
                <span>{new Date(v.createdAt).toLocaleString()}</span>
                <span className="text-muted-foreground">{v.createdBy}</span>
                {!v.isActive && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => save(v.criteria, v.levels)}>Restore (as new version)</Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
