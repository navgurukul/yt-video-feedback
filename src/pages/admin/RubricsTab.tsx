/**
 * Rubric editor: criteria × levels grid, live weight total, version history, JSON mode.
 * Editing an existing rubric saves a new version; videos move to it automatically.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardPaste, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, errorText, Rubric, YtRubricDraft, linesToList, listToLines } from "@/lib/adminApi";
import { parseYtRubricText } from "@/lib/ytRubricTextParser";
import { Badge, Field, Notice, SectionTitle, selectClass, textareaClass } from "./ui";

type Row = Record<string, unknown>;
const DEFAULT_LEVELS = ["Beginner (1)", "Intermediate (2)", "Advanced (3)", "Expert (4)"];
const initialLevels = (rubric?: Rubric | null, draft?: YtRubricDraft) =>
  rubric?.levels?.length ? rubric.levels : draft?.levels?.length ? draft.levels : DEFAULT_LEVELS;

export default function RubricsTab() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin", "rubrics"], queryFn: () => api<Rubric[]>("/api/admin/rubrics") });
  const [selected, setSelected] = useState<Rubric | "new" | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteDraft, setPasteDraft] = useState<YtRubricDraft | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="p-4 h-fit">
        <SectionTitle action={<div className="flex gap-2">
          <Button size="sm" onClick={() => setSelected("new")}><Plus className="w-4 h-4 mr-1" /> New</Button>
          <Button size="sm" variant="outline" onClick={() => { setPasteOpen(true); setPasteError(""); }}>
            <ClipboardPaste className="w-4 h-4 mr-1" /> Paste Rubric
          </Button>
        </div>}>Rubrics</SectionTitle>
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

      {pasteDraft ? (
        <RubricEditor
          key="pasted-rubric"
          rubric={null}
          draft={pasteDraft}
          generated
          onCancel={() => setPasteDraft(null)}
          onSaved={async (r) => {
            await qc.invalidateQueries({ queryKey: ["admin"] });
            await qc.invalidateQueries({ queryKey: ["institution-config"] });
            setPasteDraft(null); setSelected(r);
          }}
        />
      ) : selected ? (
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
      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-3xl p-6 space-y-4">
            <SectionTitle>Paste YT rubric</SectionTitle>
            <p className="text-sm text-muted-foreground">Paste the complete rubric with assignment details, Video Analyser type, evaluation parameters, weights, and all four level descriptions.</p>
            <textarea className={textareaClass} rows={16} value={pasteText} onChange={(event) => setPasteText(event.target.value)}
              placeholder="Paste your complete rubric here, including assignment title, rubric type, evaluation parameters, weightage, and Beginner, Intermediate, Advanced, and Expert descriptions." />
            <Notice kind="error">{pasteError}</Notice>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPasteText(""); setPasteError(""); }}>Clear</Button>
              <Button variant="outline" onClick={() => { setPasteOpen(false); setPasteError(""); }}>Cancel</Button>
              <Button disabled={pasteBusy} onClick={() => {
                setPasteBusy(true); setPasteError("");
                try {
                  const draft = parseYtRubricText(pasteText);
                  setPasteDraft(draft); setPasteOpen(false);
                } catch (error) { setPasteError(errorText(error)); } finally { setPasteBusy(false); }
              }}>{pasteBusy ? "Generating…" : "Generate Rubric"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------
function RubricEditor({ rubric, draft, generated = false, onCancel, onSaved }: {
  rubric: Rubric | null; draft?: YtRubricDraft; generated?: boolean; onCancel?: () => void; onSaved: (r: Rubric) => void;
}) {
  const isNew = !rubric;
  const [name, setName] = useState(rubric?.name ?? draft?.name ?? "");
  const [assignmentTitle, setAssignmentTitle] = useState(draft?.assignmentTitle ?? "");
  const [type, setType] = useState<Rubric["rubricType"]>(rubric?.rubricType ?? draft?.rubricType ?? "project");
  const [levels, setLevels] = useState<string[]>(() => initialLevels(rubric, draft));
  const [levelText, setLevelText] = useState(() => listToLines(initialLevels(rubric, draft)));
  const [rows, setRows] = useState<Row[]>(rubric?.criteria ? structuredClone(rubric.criteria) : draft?.criteria ? structuredClone(draft.criteria) : []);
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
  const applyLevels = () => {
    const nextLevels = linesToList(levelText);
    if (nextLevels.length < 2) {
      setError("Define at least two level names.");
      return;
    }
    setError("");
    setLevels(nextLevels);
    setRows((currentRows) => currentRows.map((row) => ({
      ...row,
      ...Object.fromEntries(nextLevels.map((level) => [level, row[level] ?? ""])),
    })));
  };
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

  const save = async (criteria: Row[] = rows, levelList: string[] = linesToList(levelText)) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = isNew
        ? await api<Rubric>("/api/admin/rubrics", "POST", { name, rubricType: type, levels: levelList, criteria })
        : await api<Rubric & { videosUpdated?: number }>(`/api/admin/rubrics/${rubric!.id}/versions`, "POST", { name, criteria, levels: levelList });
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
        {generated ? "Generated YT rubric" : isNew ? "New rubric" : rubric!.name}
      </SectionTitle>
      <Notice kind="error">{error}</Notice>
      <Notice kind="ok">{notice}</Notice>

      {(isNew || rubric) && (
        <div className="grid gap-4 md:grid-cols-2">
          {draft && <div className="md:col-span-2"><Field label="Assignment details"><textarea className={textareaClass} rows={3} value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} /></Field></div>}
          <Field label="Rubric name" hint={generated ? "You can rename this generated rubric before saving." : rubric ? "Renaming saves a new version under the new name." : undefined}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Business Pitch Rubric" />
          </Field>
          {/*
          <Field label="Used for">
            <select className={selectClass} value={type} onChange={(e) => { setType(e.target.value as Rubric["rubricType"]); setRows([]); }}>
              <option value="project">Project videos (criteria × levels)</option>
              <option value="ability_to_explain">Concept videos – ability to explain (levels)</option>
              <option value="generic">Generic (criteria × levels)</option>
            </select>
          </Field>
          */}
          {!isAbility && (
            <div className="md:col-span-2">
              <Field label="Level names (one per line, lowest first)" hint="Numbers in parentheses are evaluation scores: Beginner (1), Intermediate (2), Advanced (3), and Expert (4). Add more levels below if needed.">
                <textarea
                  className={textareaClass}
                  rows={Math.max(4, Math.min(levelText.split("\n").length + 1, 10))}
                  value={levelText}
                  onChange={(e) => setLevelText(e.target.value)}
                  onBlur={applyLevels}
                />
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
        {generated && <Button variant="outline" onClick={onCancel}>Back to paste</Button>}
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
