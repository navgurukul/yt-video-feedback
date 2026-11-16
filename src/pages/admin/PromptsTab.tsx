/**
 * Prompt templates: global defaults (read-only, can be copied) and the institution's own,
 * versioned prompts. Includes a "test on a YouTube URL" dry run.
 */
import { useContext, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiKeyContext } from "@/App";
import { api, errorText, AdminConfig, PromptTemplate, PROMPT_KIND_LABEL } from "@/lib/adminApi";
import { Badge, Field, Notice, SectionTitle, selectClass, textareaClass } from "./ui";

const REQUIRED_FIELDS: Record<PromptTemplate["kind"], string[]> = {
  accuracy: ["Accuracy Level"],
  ability_to_explain: ["Ability to explain"],
  project: ["video_validation", "topic_coverage", "parameters"],
  custom: ["evaluation_result"],
};
const KINDS = Object.keys(PROMPT_KIND_LABEL) as PromptTemplate["kind"][];

export default function PromptsTab() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin", "prompts"], queryFn: () => api<PromptTemplate[]>("/api/admin/prompts") });
  const [selected, setSelected] = useState<PromptTemplate | { new: PromptTemplate["kind"] } | null>(null);

  const byKind = useMemo(() => {
    const m = new Map<string, PromptTemplate[]>();
    for (const p of list.data ?? []) m.set(p.kind, [...(m.get(p.kind) ?? []), p]);
    return m;
  }, [list.data]);

  const key = !selected ? "" : "new" in selected ? `new-${selected.new}` : `${selected.isGlobalDefault ? "g" : "o"}-${selected.kind}-${selected.name}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <Card className="p-4 h-fit space-y-4">
        <SectionTitle>Prompts</SectionTitle>
        {list.isLoading && <p>Loading…</p>}
        {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
        {KINDS.map((kind) => (
          <div key={kind}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-black uppercase">{PROMPT_KIND_LABEL[kind]}</h3>
              <button className="text-xs font-bold underline" onClick={() => setSelected({ new: kind })}>+ new</button>
            </div>
            <ul className="space-y-1">
              {(byKind.get(kind) ?? []).map((p) => (
                <li key={p.id}>
                  <button
                    className={`w-full text-left border-2 border-foreground p-2 text-sm ${selected && !("new" in selected) && selected.id === p.id ? "bg-primary text-primary-foreground" : "bg-background"}`}
                    onClick={() => setSelected(p)}
                  >
                    <span className="font-bold">{p.name}</span> <span className="text-xs">v{p.version}</span>
                    {p.isGlobalDefault && <span className="block text-xs">global default (read-only)</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>

      {selected ? (
        <PromptEditor
          key={key}
          prompt={"new" in selected ? null : selected}
          newKind={"new" in selected ? selected.new : undefined}
          globals={(list.data ?? []).filter((p) => p.isGlobalDefault)}
          onSaved={async (p) => { await qc.invalidateQueries({ queryKey: ["admin"] }); setSelected(p); }}
        />
      ) : (
        <Card className="p-6 space-y-3">
          <p className="text-muted-foreground">Select a prompt to view it, or create your own.</p>
          <p className="text-sm">Global default prompts are the ones Navgurukul uses today. To customise one, open it and choose <strong>Make my own copy</strong>, then link videos to your copy under Syllabus.</p>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------
function PromptEditor({ prompt, newKind, globals, onSaved }: {
  prompt: PromptTemplate | null; newKind?: PromptTemplate["kind"]; globals: PromptTemplate[]; onSaved: (p: PromptTemplate) => void;
}) {
  const kind = prompt?.kind ?? newKind!;
  const starter = globals.find((g) => g.kind === kind);
  const readOnly = !!prompt?.isGlobalDefault;
  const [name, setName] = useState(prompt?.name ?? "");
  const [text, setText] = useState(prompt?.promptText ?? starter?.promptText ?? "");
  const [config, setConfig] = useState(JSON.stringify(prompt?.generationConfig ?? starter?.generationConfig ?? {}, null, 2));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const versions = useQuery({
    queryKey: ["admin", "prompt-versions", prompt?.id],
    enabled: !!prompt && !readOnly,
    queryFn: () => api<PromptTemplate[]>(`/api/admin/prompts/${prompt!.id}/versions`),
  });

  const parseConfig = () => {
    try { return JSON.parse(config); } catch (e) { throw new Error(`Generation config is not valid JSON: ${errorText(e)}`); }
  };

  const save = async (body?: { promptText: string; generationConfig: unknown }) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = body ?? { promptText: text, generationConfig: parseConfig() };
      let saved: PromptTemplate & { videosUpdated?: number };
      if (!prompt || readOnly) {
        saved = await api("/api/admin/prompts", "POST", { kind, name: name.trim() || `${prompt?.name ?? PROMPT_KIND_LABEL[kind]} (copy)`, ...payload });
        setNotice(`Created "${saved.name}". Link videos to it under Syllabus.`);
      } else {
        saved = await api(`/api/admin/prompts/${prompt.id}/versions`, "POST", payload);
        setNotice(`Saved as version ${saved.version}.${saved.videosUpdated ? ` ${saved.videosUpdated} video(s) now use it.` : ""}`);
      }
      onSaved(saved);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <SectionTitle action={prompt && <Badge tone={readOnly ? "muted" : "default"}>{readOnly ? "global default" : `v${prompt.version}`}</Badge>}>
          {prompt ? prompt.name : `New ${PROMPT_KIND_LABEL[kind].toLowerCase()} prompt`}
        </SectionTitle>
        <Notice kind="error">{error}</Notice>
        <Notice kind="ok">{notice}</Notice>

        <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            {(!prompt || readOnly) && (
              <Field label="Name" hint={readOnly ? "Name for your copy" : undefined}>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${PROMPT_KIND_LABEL[kind]} – our college`} />
              </Field>
            )}
            <Field label="Prompt text">
              <textarea className={textareaClass} rows={18} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <Field label="Generation config (JSON)" hint="temperature, seed, responseMimeType and responseSchema (the shape of the AI's answer).">
              <textarea className={textareaClass} rows={12} value={config} onChange={(e) => setConfig(e.target.value)} />
            </Field>
            <Button onClick={() => save()} disabled={busy}>
              {busy ? "Saving…" : !prompt ? "Create prompt" : readOnly ? "Make my own copy" : "Save as new version"}
            </Button>
          </div>

          <aside className="border-4 border-foreground p-4 text-sm space-y-3 h-fit bg-muted/30">
            <h3 className="font-black uppercase">What the server adds</h3>
            <p>After your prompt text, the server appends:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>VIDEO DETAILS</strong>: the video's title, what to cover, and its questions or key topics (from Syllabus).</li>
              {kind !== "accuracy" && kind !== "custom" && <li><strong>RUBRIC</strong>: the rubric linked to the video, as JSON.</li>}
              {kind === "custom" && <li><strong>CUSTOM_PROMPT</strong>: the criteria the student typed.</li>}
            </ul>
            <h3 className="font-black uppercase">Required output fields</h3>
            <p>The <code>responseSchema</code> must contain:</p>
            <ul className="list-disc pl-5">{REQUIRED_FIELDS[kind].map((f) => <li key={f}><code>{f}</code></li>)}</ul>
            <p className="text-xs text-muted-foreground">The results page reads these fields, so the server rejects schemas without them.</p>
          </aside>
        </div>

        {prompt && !readOnly && (
          <div>
            <h3 className="font-black uppercase mb-2">Version history</h3>
            <ul className="space-y-2">
              {(versions.data ?? []).map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2 border-2 border-foreground p-2 text-sm">
                  <Badge tone={v.isActive ? "ok" : "muted"}>v{v.version}{v.isActive ? " · in use" : ""}</Badge>
                  <span>{new Date(v.createdAt).toLocaleString()}</span>
                  <span className="text-muted-foreground">{v.createdBy}</span>
                  {!v.isActive && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => save({ promptText: v.promptText, generationConfig: v.generationConfig })}>
                      Restore (as new version)
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {prompt && kind !== "custom" && <TestPanel prompt={prompt} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------
function TestPanel({ prompt }: { prompt: PromptTemplate }) {
  const { apiKey } = useContext(ApiKeyContext);
  const tree = useQuery({ queryKey: ["admin", "config"], queryFn: () => api<AdminConfig>("/api/admin/config") });
  const wantType = prompt.kind === "project" ? "project" : "concept";
  const videos = (tree.data?.programs ?? []).flatMap((p) => p.phases.flatMap((ph) =>
    ph.videos.filter((v) => v.videoType === wantType && v.isActive).map((v) => ({ id: v.id, label: `${p.name} › ${ph.name} › ${v.title}` }))));
  const [videoId, setVideoId] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ text: string; parsed: unknown; latencyMs: number; keySource: string; model: string; promptText: string } | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const run = async () => {
    setBusy(true); setError(""); setResult(null);
    try {
      setResult(await api(`/api/admin/prompts/${prompt.id}/test`, "POST", { videoUrl: url.trim(), videoAssignmentId: videoId, apiKey: apiKey || undefined }));
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  return (
    <Card className="p-6 space-y-4">
      <SectionTitle>Test on a YouTube video</SectionTitle>
      <p className="text-sm text-muted-foreground">Runs this prompt against a real video with Gemini. Nothing is saved to anyone's history.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={`Which ${wantType} video's details and rubric to use`}>
          <select className={selectClass} value={videoId} onChange={(e) => setVideoId(e.target.value)}>
            <option value="">— select —</option>
            {videos.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="YouTube URL"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtu.be/…" /></Field>
      </div>
      <Button onClick={run} disabled={busy || !videoId || !url.trim()}>{busy ? "Running… (up to a minute)" : "Run test"}</Button>
      <Notice kind="error">{error}</Notice>
      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="ok">{(result.latencyMs / 1000).toFixed(1)} s</Badge>
            <Badge tone="muted">{result.model}</Badge>
            <Badge tone="muted">key: {result.keySource}</Badge>
          </div>
          <pre className="border-4 border-foreground p-3 text-xs overflow-auto max-h-[480px] bg-background">
            {result.parsed ? JSON.stringify(result.parsed, null, 2) : result.text}
          </pre>
          <button className="text-sm underline font-bold" onClick={() => setShowPrompt(!showPrompt)}>{showPrompt ? "Hide" : "Show"} the full prompt that was sent</button>
          {showPrompt && <pre className="border-2 border-foreground p-3 text-xs overflow-auto max-h-[480px] whitespace-pre-wrap">{result.promptText}</pre>}
        </div>
      )}
    </Card>
  );
}
