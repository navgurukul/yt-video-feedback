/**
 * Syllabus builder: Program → Phase → Video, with reordering and active toggles.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, errorText, AdminConfig, AdminPhase, AdminProgram, AdminVideo, PromptTemplate, Rubric, linesToList, listToLines } from "@/lib/adminApi";
import { Badge, Field, Notice, SectionTitle, selectClass, textareaClass } from "./ui";

type Editing =
  | { kind: "program"; program?: AdminProgram }
  | { kind: "phase"; programId: string; phase?: AdminPhase }
  | { kind: "video"; phaseId: string; video?: AdminVideo; videoType: "concept" | "project" }
  | null;

export default function SyllabusTab() {
  const qc = useQueryClient();
  const tree = useQuery({ queryKey: ["admin", "config"], queryFn: () => api<AdminConfig>("/api/admin/config") });
  const rubrics = useQuery({ queryKey: ["admin", "rubrics"], queryFn: () => api<Rubric[]>("/api/admin/rubrics") });
  const prompts = useQuery({ queryKey: ["admin", "prompts"], queryFn: () => api<PromptTemplate[]>("/api/admin/prompts") });

  const [programId, setProgramId] = useState<string>("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const programs = tree.data?.programs ?? [];
  const program = programs.find((p) => p.id === programId) ?? programs[0];

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "config"] });
    await qc.invalidateQueries({ queryKey: ["institution-config"] });
  };
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await fn(); await refresh(); return true; } catch (e) { setError(errorText(e)); return false; } finally { setBusy(false); }
  };

  const move = (list: { id: string }[], index: number, dir: -1 | 1) => {
    const ids = list.map((x) => x.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return null;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    return ids;
  };

  if (tree.isLoading) return <p className="font-bold">Loading syllabus…</p>;
  if (tree.isError) return <Notice kind="error">{errorText(tree.error)}</Notice>;

  return (
    <div className="space-y-6">
      <Notice kind="error">{error}</Notice>

      {editing && (
        <Editor
          key={`${editing.kind}-${editing.kind === "program" ? editing.program?.id : editing.kind === "phase" ? editing.phase?.id : editing.video?.id ?? editing.videoType}`}
          editing={editing}
          rubrics={rubrics.data ?? []}
          prompts={prompts.data ?? []}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={async (body) => {
            const ok = await run(async () => {
              if (editing.kind === "program") {
                return editing.program ? api(`/api/admin/programs/${editing.program.id}`, "PATCH", body) : api("/api/admin/programs", "POST", body);
              }
              if (editing.kind === "phase") {
                return editing.phase ? api(`/api/admin/phases/${editing.phase.id}`, "PATCH", body)
                  : api("/api/admin/phases", "POST", { ...body, programId: editing.programId });
              }
              return editing.video ? api(`/api/admin/videos/${editing.video.id}`, "PATCH", body)
                : api("/api/admin/videos", "POST", { ...body, phaseId: editing.phaseId, videoType: editing.videoType });
            });
            if (ok) setEditing(null);
          }}
        />
      )}

      {/* Programs */}
      <Card className="p-6">
        <SectionTitle action={<Button size="sm" onClick={() => setEditing({ kind: "program" })}><Plus className="w-4 h-4 mr-1" /> Program</Button>}>
          Programs
        </SectionTitle>
        {programs.length === 0 && <p className="text-muted-foreground">No programs yet. Add your first program (e.g. "MBA 2026", "B.Tech CSE – Semester 3").</p>}
        <div className="flex flex-wrap gap-3">
          {programs.map((p) => (
            <div key={p.id} className={`flex items-center gap-2 border-4 border-foreground px-3 py-2 ${program?.id === p.id ? "bg-primary text-primary-foreground" : "bg-background"}`}>
              <button className="font-bold" onClick={() => setProgramId(p.id)}>{p.name}</button>
              {!p.isActive && <Badge tone="muted">inactive</Badge>}
              <button aria-label="Edit program" onClick={() => setEditing({ kind: "program", program: p })}><Pencil className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </Card>

      {/* Phases + videos of the selected program */}
      {program && (
        <Card className="p-6">
          <SectionTitle action={<Button size="sm" onClick={() => setEditing({ kind: "phase", programId: program.id })}><Plus className="w-4 h-4 mr-1" /> Phase</Button>}>
            {program.name}: phases
          </SectionTitle>
          {program.phases.length === 0 && <p className="text-muted-foreground">No phases yet.</p>}
          <div className="space-y-3">
            {program.phases.map((ph, i) => {
              const isOpen = open[ph.id];
              const concept = ph.videos.filter((v) => v.videoType === "concept");
              const project = ph.videos.filter((v) => v.videoType === "project");
              return (
                <div key={ph.id} className={`border-4 border-foreground ${ph.isActive ? "" : "opacity-60"}`}>
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/40">
                    <button className="flex items-center gap-1 font-black text-left flex-1 min-w-[200px]" onClick={() => setOpen({ ...open, [ph.id]: !isOpen })}>
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} {ph.name}
                    </button>
                    <Badge tone="muted">{concept.length} concept · {project.length} project</Badge>
                    {!ph.isActive && <Badge tone="warn">inactive</Badge>}
                    <Button size="sm" variant="outline" disabled={busy || i === 0} aria-label="Move up"
                      onClick={() => { const ids = move(program.phases, i, -1); if (ids) run(() => api(`/api/admin/programs/${program.id}/phases/reorder`, "POST", { ids })); }}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy || i === program.phases.length - 1} aria-label="Move down"
                      onClick={() => { const ids = move(program.phases, i, 1); if (ids) run(() => api(`/api/admin/programs/${program.id}/phases/reorder`, "POST", { ids })); }}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing({ kind: "phase", programId: program.id, phase: ph })}>Edit</Button>
                    <Button size="sm" variant="outline" disabled={busy}
                      onClick={() => run(() => api(`/api/admin/phases/${ph.id}`, "PATCH", { isActive: !ph.isActive }))}>
                      {ph.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>

                  {isOpen && (
                    <div className="p-3 space-y-4">
                      {(["concept", "project"] as const).map((type) => {
                        const list = type === "concept" ? concept : project;
                        return (
                          <div key={type}>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-black uppercase text-sm">{type === "concept" ? "Concept videos" : "Project video"}</h3>
                              <Button size="sm" variant="outline" onClick={() => setEditing({ kind: "video", phaseId: ph.id, videoType: type })}>
                                <Plus className="w-4 h-4 mr-1" /> {type === "concept" ? "Concept video" : "Project video"}
                              </Button>
                            </div>
                            {list.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
                            <ul className="space-y-2">
                              {list.map((v, j) => (
                                <li key={v.id} className={`flex flex-wrap items-center gap-2 border-2 border-foreground p-2 ${v.isActive ? "" : "opacity-60"}`}>
                                  <span className="flex-1 min-w-[200px] font-bold">{v.title}</span>
                                  {!v.isActive && <Badge tone="warn">inactive</Badge>}
                                  {type === "project" && !v.rubricId && <Badge tone="warn">no rubric</Badge>}
                                  {type === "concept" && !v.abilityRubricId && <Badge tone="warn">no rubric</Badge>}
                                  <Button size="sm" variant="outline" disabled={busy || j === 0} aria-label="Move up"
                                    onClick={() => { const ids = move(list, j, -1); if (ids) run(() => api(`/api/admin/phases/${ph.id}/videos/reorder`, "POST", { ids })); }}>
                                    <ArrowUp className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" disabled={busy || j === list.length - 1} aria-label="Move down"
                                    onClick={() => { const ids = move(list, j, 1); if (ids) run(() => api(`/api/admin/phases/${ph.id}/videos/reorder`, "POST", { ids })); }}>
                                    <ArrowDown className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditing({ kind: "video", phaseId: ph.id, video: v, videoType: v.videoType })}>Edit</Button>
                                  <Button size="sm" variant="outline" disabled={busy}
                                    onClick={() => run(() => api(`/api/admin/videos/${v.id}`, "PATCH", { isActive: !v.isActive }))}>
                                    {v.isActive ? "Deactivate" : "Activate"}
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------
function Editor({ editing, rubrics, prompts, busy, onCancel, onSave }: {
  editing: NonNullable<Editing>; rubrics: Rubric[]; prompts: PromptTemplate[]; busy: boolean;
  onCancel: () => void; onSave: (body: Record<string, unknown>) => void;
}) {
  const v = editing.kind === "video" ? editing.video : undefined;
  const base = editing.kind === "program" ? editing.program : editing.kind === "phase" ? editing.phase : undefined;
  const [name, setName] = useState(editing.kind === "video" ? v?.title ?? "" : base?.name ?? "");
  const [description, setDescription] = useState((editing.kind === "video" ? v?.description : base?.description) ?? "");
  const [whatToCover, setWhatToCover] = useState(v?.whatToCover ?? "");
  const [items, setItems] = useState(listToLines(editing.kind === "video" && editing.videoType === "project" ? v?.keyTopics : v?.questionsToAnswer));
  const [rubricId, setRubricId] = useState((editing.kind === "video" && editing.videoType === "project" ? v?.rubricId : v?.abilityRubricId) ?? "");
  const [p1, setP1] = useState((editing.kind === "video" && editing.videoType === "project" ? v?.projectPromptId : v?.accuracyPromptId) ?? "");
  const [p2, setP2] = useState(v?.abilityPromptId ?? "");

  const videoType = editing.kind === "video" ? editing.videoType : null;
  const rubricOptions = useMemo(() => rubrics.filter((r) =>
    videoType === "project" ? r.rubricType !== "ability_to_explain" : r.rubricType !== "project"), [rubrics, videoType]);
  const promptOptions = (kind: PromptTemplate["kind"]) => prompts.filter((p) => p.kind === kind && p.isActive);

  const title = editing.kind === "program" ? (base ? "Edit program" : "New program")
    : editing.kind === "phase" ? (base ? "Edit phase" : "New phase")
    : `${v ? "Edit" : "New"} ${videoType} video`;

  const submit = () => {
    if (editing.kind !== "video") return onSave({ name, description: description || null });
    const body: Record<string, unknown> = { title: name, description: description || null, whatToCover: whatToCover || null };
    if (videoType === "project") Object.assign(body, { keyTopics: linesToList(items), rubricId: rubricId || null, projectPromptId: p1 || null });
    else Object.assign(body, { questionsToAnswer: linesToList(items), abilityRubricId: rubricId || null, accuracyPromptId: p1 || null, abilityPromptId: p2 || null });
    onSave(body);
  };

  const promptSelect = (label: string, kind: PromptTemplate["kind"], value: string, set: (s: string) => void) => (
    <Field label={label} hint="Global defaults are the built-in prompts; create your own under Prompts.">
      <select className={selectClass} value={value} onChange={(e) => set(e.target.value)}>
        <option value="">— none —</option>
        {promptOptions(kind).map((p) => (
          <option key={p.id} value={p.id}>{p.name} v{p.version}{p.isGlobalDefault ? " (global default)" : ""}</option>
        ))}
      </select>
    </Field>
  );

  return (
    <Card className="p-6 border-primary">
      <SectionTitle>{title}</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={editing.kind === "video" ? "Title" : "Name"}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description (optional)">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {editing.kind === "video" && (
          <>
            <div className="md:col-span-2">
              <Field label="What the video should cover" hint="Sent to the AI as the expected content.">
                <textarea className={textareaClass} rows={3} value={whatToCover} onChange={(e) => setWhatToCover(e.target.value)} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label={videoType === "project" ? "Key topics (one per line)" : "Questions the student must answer (one per line)"}>
                <textarea className={textareaClass} rows={5} value={items} onChange={(e) => setItems(e.target.value)} />
              </Field>
            </div>
            <Field label={videoType === "project" ? "Project rubric" : "Ability-to-explain rubric"}>
              <select className={selectClass} value={rubricId} onChange={(e) => setRubricId(e.target.value)}>
                <option value="">— none —</option>
                {rubricOptions.map((r) => <option key={r.id} value={r.id}>{r.name} v{r.version}</option>)}
              </select>
            </Field>
            {videoType === "project"
              ? promptSelect("Project prompt", "project", p1, setP1)
              : (
                <>
                  {promptSelect("Accuracy prompt", "accuracy", p1, setP1)}
                  {promptSelect("Ability-to-explain prompt", "ability_to_explain", p2, setP2)}
                </>
              )}
          </>
        )}
      </div>
      <div className="flex gap-3 mt-6">
        <Button onClick={submit} disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save"}</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}
