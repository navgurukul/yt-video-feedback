import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Phase1Rubric, Phase2Rubric, Phase3Rubric, Phase4Rubric, Phase5Rubric, Phase6Rubric, Phase7Rubric } from "@/data/RubricData";

interface ProjectVideoRecord {
  id: number;
  email: string;
  project_name: string;
  video_url: string;
  manual_evaluated?: boolean;
}

interface ParameterFeedback {
  level: string;
  whatWentWell: string;
  whatCouldImprove: string;
  suggestions: string;
}

const getYouTubeEmbedUrl = (url: string) => {
  const standardMatch = url.match(/[?&]v=([^&]+)/);
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  const embedMatch = url.match(/youtube\.com\/embed\/([^?&]+)/);
  const id = standardMatch?.[1] || shortMatch?.[1] || embedMatch?.[1];
  return id ? `https://www.youtube.com/embed/${id}` : url;
};

const getRubricForProject = (projectName: string) => {
  if (!projectName) return Phase1Rubric;
  const normalized = projectName.toLowerCase();
  if (normalized.includes("phase 1")) return Phase1Rubric;
  if (normalized.includes("phase 2")) return Phase2Rubric;
  if (normalized.includes("phase 3")) return Phase3Rubric;
  if (normalized.includes("phase 4")) return Phase4Rubric;
  if (normalized.includes("phase 5")) return Phase5Rubric;
  if (normalized.includes("phase 6")) return Phase6Rubric;
  if (normalized.includes("phase 7")) return Phase7Rubric;
  return Phase1Rubric;
};

const ManualEvaluation = () => {
  const [videos, setVideos] = useState<ProjectVideoRecord[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<ProjectVideoRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [overallRating, setOverallRating] = useState("");
  const [overallComments, setOverallComments] = useState("");
  const [feedbackByParameter, setFeedbackByParameter] = useState<Record<string, ParameterFeedback>>({});
  const [searchId, setSearchId] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
      await fetchVideos();
    };
    init();
  }, []);

  const fetchVideos = async (evaluationId?: string) => {
    try {
      setLoading(true);
      setSearchError(null);
      const API_URL = import.meta.env.PROD ? import.meta.env.VITE_API_URL || "http://localhost:3001" : "";
      const query = evaluationId ? `?id=${encodeURIComponent(evaluationId)}` : "";
      const response = await fetch(`${API_URL}/api/manual-eval-videos${query}`);
      if (!response.ok) throw new Error("Failed to fetch videos");
      const data = await response.json();
      setVideos(data.data || []);
      setSelectedVideo((prev) => prev || (data.data?.[0] ?? null));
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Unable to load manual evaluation videos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchById = async () => {
    const trimmed = searchId.trim();
    if (!trimmed) {
      await fetchVideos();
      return;
    }

    if (!/^\d+$/.test(trimmed)) {
      setSearchError("Evaluation ID must be a numeric value.");
      return;
    }

    await fetchVideos(trimmed);
  };

  const rubric = useMemo(() => getRubricForProject(selectedVideo?.project_name || ""), [selectedVideo]);

  useEffect(() => {
    if (!selectedVideo) return;
    const initialFeedback: Record<string, ParameterFeedback> = {};
    getRubricForProject(selectedVideo.project_name).forEach((item) => {
      const key = item.Parameter;
      initialFeedback[key] = {
        level: "",
        whatWentWell: "",
        whatCouldImprove: "",
        suggestions: "",
      };
    });
    setFeedbackByParameter(initialFeedback);
    setOverallRating("");
    setOverallComments("");
  }, [selectedVideo]);

  const updateFeedback = (parameter: string, field: keyof ParameterFeedback, value: string) => {
    setFeedbackByParameter((prev) => ({
      ...prev,
      [parameter]: {
        ...prev[parameter],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async () => {
    if (!selectedVideo) return;
    if (!userEmail) {
      toast({ title: "Not signed in", description: "Please sign in to submit evaluations.", variant: "destructive" });
      return;
    }

    // Validate that all parameters have a level selected
    const missingLevels = Object.entries(feedbackByParameter)
      .filter(([, feedback]) => !feedback.level)
      .map(([name]) => name);

    if (missingLevels.length > 0) {
      toast({
        title: "Validation Error",
        description: `Please select a level for: ${missingLevels.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    // Validate that overall comments are provided
    if (!overallComments.trim()) {
      toast({
        title: "Validation Error",
        description: "Overall comments are required.",
        variant: "destructive",
      });
      return;
    }

    const allFeedback = Object.entries(feedbackByParameter).map(([name, feedback]) => ({
      name,
      level: feedback.level,
      whatWentWell: feedback.whatWentWell,
      whatCouldImprove: feedback.whatCouldImprove,
      suggestions: feedback.suggestions,
    }));

    try {
      setSaving(true);
      const API_URL = import.meta.env.PROD ? import.meta.env.VITE_API_URL || "http://localhost:3001" : "";
      const response = await fetch(`${API_URL}/api/manual-evaluation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectEvaluationId: selectedVideo.id,
          evaluatorEmail: userEmail,
          evaluatedVideoUrl: selectedVideo.video_url,
          projectName: selectedVideo.project_name,
          phase: selectedVideo.project_name,
          evaluationJson: {
            parameters: allFeedback,
            overallRating,
            overallComments,
          },
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save evaluation");
      }
      toast({ title: "Saved", description: "Manual evaluation saved successfully." });
      await fetchVideos();
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: String(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Manual YT Project Video Evaluation</h1>
            <p className="mt-1 text-sm text-slate-600">
              Select a project video from the list to review, watch it in the player, and score against the phase rubric.
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <Card className="h-fit hover:translate-x-0 hover:translate-y-0 hover:rotate-0 hover:shadow-brutal">
            <CardHeader>
              <CardTitle>Video Review Queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Search by evaluation ID</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={searchId}
                    onChange={(event) => setSearchId(event.target.value)}
                    placeholder="Enter evaluation ID"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  />
                  <Button className="hover:translate-x-0 hover:translate-y-0 active:translate-x-0 active:translate-y-0" onClick={handleSearchById} disabled={loading}>Search</Button>
                  <Button
                    variant="secondary"
                    className="hover:translate-x-0 hover:translate-y-0 active:translate-x-0 active:translate-y-0"
                    onClick={() => { setSearchId(""); setSearchError(null); fetchVideos(); }}
                    disabled={loading}
                  >
                    Clear
                  </Button>
                </div>
                {searchError ? <p className="text-sm text-red-600">{searchError}</p> : null}
              </div>
              {loading ? (
                <div>Loading videos…</div>
              ) : videos.length === 0 ? (
                <div>No videos found.</div>
              ) : (
                videos.map((video) => (
                  <button
                    key={video.id}
                    type="button"
                    className={`w-full rounded-lg border p-3 text-left transition hover:border-slate-400 ${selectedVideo?.id === video.id ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white"}`}
                    onClick={() => setSelectedVideo(video)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{video.project_name}</p>
                        <p className="text-sm text-slate-600">{video.email}</p>
                        <p className="text-xs text-slate-500">Evaluation ID: {video.id}</p>
                      </div>
                      {video.manual_evaluated ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">Evaluated</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">Pending</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {selectedVideo ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Video Player</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-black">
                      <iframe
                        title="Selected video"
                        src={getYouTubeEmbedUrl(selectedVideo.video_url)}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-slate-600">Project</p>
                        <p>{selectedVideo.project_name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600">Student</p>
                        <p>{selectedVideo.email}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Rubric & Manual Evaluation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-800">Rubric for this phase</p>
                      <p className="mt-2 text-sm text-slate-600">Use the rubric below to evaluate the video and provide feedback for each parameter.</p>
                    </div>

                    {rubric.map((item) => {
                      const parameter = item.Parameter;
                      const feedback = feedbackByParameter[parameter] || {
                        level: "",
                        whatWentWell: "",
                        whatCouldImprove: "",
                        suggestions: "",
                      };
                      return (
                        <div key={parameter} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="mb-4 flex flex-col gap-2">
                            <h2 className="text-lg font-semibold">{parameter}</h2>
                            {item["Beginner (1)"] || item["Intermediate (2)"] || item["Advanced (3)"] || item["Expert (4)"] ? (
                              <div className="space-y-2 border-t border-slate-200 pt-3">
                                {item["Beginner (1)"] && (
                                  <div className="text-sm">
                                    <span className="font-medium text-slate-700">Beginner:</span>
                                    <p className="text-slate-600 mt-1">{item["Beginner (1)"]}</p>
                                  </div>
                                )}
                                {item["Intermediate (2)"] && (
                                  <div className="text-sm">
                                    <span className="font-medium text-slate-700">Intermediate:</span>
                                    <p className="text-slate-600 mt-1">{item["Intermediate (2)"]}</p>
                                  </div>
                                )}
                                {item["Advanced (3)"] && (
                                  <div className="text-sm">
                                    <span className="font-medium text-slate-700">Advanced:</span>
                                    <p className="text-slate-600 mt-1">{item["Advanced (3)"]}</p>
                                  </div>
                                )}
                                {item["Expert (4)"] && (
                                  <div className="text-sm">
                                    <span className="font-medium text-slate-700">Expert:</span>
                                    <p className="text-slate-600 mt-1">{item["Expert (4)"]}</p>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <label className="text-sm font-medium">Level <span className="text-red-600">*</span></label>
                              <select
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                                value={feedback.level}
                                onChange={(e) => updateFeedback(parameter, "level", e.target.value)}
                              >
                                <option value="">Select level</option>
                                <option value="Beginner">Beginner</option>
                                <option value="Intermediate">Intermediate</option>
                                <option value="Advanced">Advanced</option>
                                <option value="Expert">Expert</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-sm font-medium">What went well</label>
                              <textarea
                                rows={3}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                                value={feedback.whatWentWell}
                                onChange={(e) => updateFeedback(parameter, "whatWentWell", e.target.value)}
                                placeholder="Describe strengths"
                              />
                            </div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 mt-4">
                            <div className="space-y-1">
                              <label className="text-sm font-medium">What could you do better</label>
                              <textarea
                                rows={3}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                                value={feedback.whatCouldImprove}
                                onChange={(e) => updateFeedback(parameter, "whatCouldImprove", e.target.value)}
                                placeholder="Suggest improvements"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-sm font-medium">Suggestions</label>
                              <textarea
                                rows={3}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                                value={feedback.suggestions}
                                onChange={(e) => updateFeedback(parameter, "suggestions", e.target.value)}
                                placeholder="Actionable next steps"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div>
                        <label className="text-sm font-medium">Evaluator</label>
                        <input
                          type="text"
                          value={userEmail || ""}
                          disabled
                          className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Overall comments <span className="text-red-600">*</span></label>
                        <textarea
                          rows={4}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                          value={overallComments}
                          onChange={(e) => setOverallComments(e.target.value)}
                          placeholder="Provide overall feedback about the evaluation"
                        />
                      </div>
                      <Button onClick={handleSubmit} disabled={saving}>
                        {saving ? "Saving…" : "Save Manual Evaluation"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Select a video</CardTitle>
                </CardHeader>
                <CardContent>Please select a video from the list to begin manual evaluation.</CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ManualEvaluation;
