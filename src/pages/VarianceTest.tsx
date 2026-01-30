import { useState, useEffect, useContext } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MotionWrapper } from "@/components/MotionWrapper";
import { AnimatedHeading } from "@/components/AnimatedHeading";
import { AccuracyConfig, AccuracyPrompt, AbilityToExplainConfig, AbilityToExplainPrompt, projectconfig, ProjectPrompt, CustomPrompt, CustomConfig } from "@/data/prompt";
import { abilityToExplainRubric, Phase1Rubric, Phase2Rubric, Phase3Rubric, Phase4Rubric, Phase5Rubric, Phase6Rubric } from "@/data/RubricData";
import { getPhaseNames, getVideoTitlesForPhase, getVideoDetailsForTitle } from "@/data/videoData";
import { getProjectVideoForPhase } from "@/data/phasevideodata";
import { ApiKeyContext } from "@/App";
import { Film, Code, Layout, FileJson, Sheet, Youtube } from "lucide-react";

/**
 * Variance Test Page
 * 
 * Allows administrators to test Gemini API evaluation consistency
 * by running the same video through multiple iterations and analyzing variance.
 */
const VarianceTest = () => {
  const { toast } = useToast();
  const { apiKey: contextApiKey } = useContext(ApiKeyContext);
  
  // Form state matching VideoAnalyzer structure
  const [videoUrl, setVideoUrl] = useState("");
  const [videoType, setVideoType] = useState<"concept" | "project" | "other">("concept");
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [selectedVideoTitle, setSelectedVideoTitle] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [customContext, setCustomContext] = useState("");
  const [iterations, setIterations] = useState(3);
  const [error, setError] = useState("");
  
  // Test state
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  
  const phaseNames = getPhaseNames();
  const availableVideoTitles = selectedPhase ? getVideoTitlesForPhase(selectedPhase) : [];

  // Get video details based on selections (matching VideoAnalyzer logic)
  const getVideoDetails = () => {
    let details = "";
    
    if (videoType === "concept") {
      details += `Video Title: ${selectedVideoTitle}\n\n`;
      const videoData = getVideoDetailsForTitle(selectedPhase, selectedVideoTitle);
      if (videoData) {
        details += `What to cover:\n${videoData.whatToCover}\n\n`;
        details += `Ensure these are answered:\n`;
        videoData.questionsToAnswer.forEach((question, idx) => {
          details += `${idx + 1}. ${question}\n`;
        });
      }
    } else if (videoType === "project") {
      const projectVideo = getProjectVideoForPhase(selectedPhase);
      if (projectVideo) {
        details += `Project Video Title: ${projectVideo.title}\n\n`;
        details += `Description: ${projectVideo.description}\n\n`;
        details += `What to cover:\n${projectVideo.whatToCover}\n\n`;
        details += `Key Topics to explain:\n`;
        projectVideo.keyTopics.forEach((topic, idx) => {
          details += `${idx + 1}. ${topic}\n`;
        });
      }
    } else if (videoType === "other") {
      details = `Custom Evaluation Criteria:\n${customPrompt}`;
      if (customContext && customContext.trim()) {
        details += `\n\nAdditional Context:\n${customContext}`;
      }
    }
    return details;
  };

  // Reset selections when video type or phase changes
  useEffect(() => {
    setSelectedVideoTitle("");
    setError("");
  }, [selectedPhase, videoType]);

  const handleRunTest = async () => {
    setError("");
    
    // Validation matching VideoAnalyzer
    if (!videoUrl || (!videoUrl.includes("youtube.com") && !videoUrl.includes("youtu.be"))) {
      setError("Please enter a valid YouTube URL");
      return;
    }

    if (videoType !== "other" && (!selectedPhase || selectedPhase === "")) {
      setError("Please select a Phase");
      return;
    }

    if (videoType === "concept" && (!selectedVideoTitle || selectedVideoTitle === "")) {
      setError("Please select a Video Title for concept explanation evaluation");
      return;
    }

    if (videoType === "other" && (!customPrompt || customPrompt.trim() === "")) {
      setError("Please enter a custom evaluation prompt for Other type evaluation");
      return;
    }

    if (iterations < 2 || iterations > 10) {
      setError("Iterations must be between 2 and 10");
      return;
    }

    setIsRunning(true);
    setTestResults(null);

    try {
      const videoDetailsText = getVideoDetails();
      let payload: any = {
        videoUrl,
        videoDetails: videoDetailsText,
        iterations,
        apiKey: contextApiKey || undefined,
      };

      // Build payload based on video type (matching VideoAnalyzer logic)
      if (videoType === "concept") {
        // Concept evaluation needs both accuracy and ability checks
        payload.evaluationType = "concept";
        payload.promptbegining = AccuracyPrompt;
        payload.structuredreturnedconfig = AccuracyConfig;
        payload.rubric = abilityToExplainRubric;
        // Note: The test will run accuracy check, ability check happens on backend
      } else if (videoType === "project") {
        // Project evaluation
        payload.evaluationType = "project";
        payload.promptbegining = ProjectPrompt;
        payload.structuredreturnedconfig = projectconfig;
        
        // Select rubric based on phase
        let projectRubric: any = Phase1Rubric;
        switch (selectedPhase) {
          case "Phase 1: HTML Only — Student Profile & Course Portal":
            projectRubric = Phase1Rubric;
            break;
          case "Phase 2: CSS Styling — Interactive Portfolio & Blog":
            projectRubric = Phase2Rubric;
            break;
          case "Phase 3: JavaScript Basics — To-Do List & Weather App":
            projectRubric = Phase3Rubric;
            break;
          case "Phase 4: Advanced JavaScript — E-Commerce Site & Chat Application":
            projectRubric = Phase4Rubric;
            break;
          case "Phase 5: Full-Stack Development — Social Media Platform & Project Management Tool":
            projectRubric = Phase5Rubric;
            break;
          case "Phase 6: Deployment & Optimization — Blog Platform & Portfolio Site":
            projectRubric = Phase6Rubric;
            break;
        }
        payload.rubric = projectRubric;
      } else if (videoType === "other") {
        // Custom evaluation
        payload.evaluationType = "custom";
        payload.promptbegining = CustomPrompt;
        payload.structuredreturnedconfig = CustomConfig;
        payload.customPrompt = customPrompt;
        payload.customContext = customContext;
      }

      console.log("Starting variance test...", payload);

      const response = await fetch("/test-variance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to run variance test");
      }

      setTestResults(data);

      // Show toast with results
      const consistencyScore = data.variance_analysis?.consistency_score || 0;
      const emoji = consistencyScore >= 95 ? "✅" : consistencyScore >= 80 ? "⚠️" : "❌";
      
      toast({
        title: `${emoji} Test Complete`,
        description: `Consistency Score: ${consistencyScore.toFixed(2)}% (${data.successful_count}/${data.iterations} successful)`,
        variant: consistencyScore >= 80 ? "default" : "destructive",
      });
    } catch (error: any) {
      console.error("Variance test error:", error);
      setError(error.message);
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleClearResults = () => {
    setTestResults(null);
  };

  const getConsistencyColor = (score: number) => {
    if (score >= 95) return "text-green-600";
    if (score >= 80) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <MotionWrapper className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <AnimatedHeading className="text-4xl md:text-5xl font-bold text-center mb-4">
          🧪 Variance Test
        </AnimatedHeading>
        
        <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">
          Test the consistency of Gemini API evaluations by running the same video through multiple iterations.
          This helps identify variance issues and validates deterministic parameters.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Configuration Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Test Configuration</CardTitle>
              <CardDescription>
                Set up your variance test parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Video Type Selection */}
              <div className="space-y-3">
                <Label className="text-lg font-bold flex items-center gap-2">
                  <Film className="w-5 h-5" />
                  Video Type
                </Label>
                <div className="flex flex-col gap-2">
                  <Button
                    variant={videoType === "concept" ? "default" : "outline"}
                    onClick={() => {
                      setVideoType("concept");
                      setError("");
                      setTestResults(null);
                    }}
                    className="w-full justify-start"
                    disabled={isRunning}
                  >
                    Concept Explanation
                  </Button>
                  <Button
                    variant={videoType === "project" ? "default" : "outline"}
                    onClick={() => {
                      setVideoType("project");
                      setError("");
                      setTestResults(null);
                    }}
                    className="w-full justify-start"
                    disabled={isRunning}
                  >
                    Project Explanation
                  </Button>
                  <Button
                    variant={videoType === "other" ? "default" : "outline"}
                    onClick={() => {
                      setVideoType("other");
                      setError("");
                      setTestResults(null);
                    }}
                    className="w-full justify-start"
                    disabled={isRunning}
                  >
                    Other
                  </Button>
                </div>
              </div>

              {/* Phase Selection (hidden for other type) */}
              {videoType !== "other" && (
                <div className="space-y-3">
                  <Label className="text-lg font-bold flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Select Phase
                  </Label>
                  <Select 
                    onValueChange={setSelectedPhase} 
                    value={selectedPhase}
                    disabled={isRunning}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a Phase" />
                    </SelectTrigger>
                    <SelectContent>
                      {phaseNames.map((phase) => (
                        <SelectItem key={phase} value={phase}>
                          {phase}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Video Title Selection (only for concept) */}
              {videoType === "concept" && selectedPhase && (
                <div className="space-y-3">
                  <Label className="text-lg font-bold flex items-center gap-2">
                    <Layout className="w-5 h-5" />
                    Select Video Title
                  </Label>
                  <Select 
                    onValueChange={setSelectedVideoTitle} 
                    value={selectedVideoTitle}
                    disabled={!selectedPhase || isRunning}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a Video Title" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVideoTitles.map((title) => (
                        <SelectItem key={title} value={title}>
                          {title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Custom Prompt Input (only for other type) */}
              {videoType === "other" && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label className="text-lg font-bold flex items-center gap-2">
                      <FileJson className="w-5 h-5" />
                      Custom Evaluation Prompt
                    </Label>
                    <textarea
                      placeholder="Enter your custom evaluation criteria or specific aspects you want the AI to focus on..."
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      className="w-full min-h-[100px] p-3 border rounded-md resize-vertical text-sm"
                      rows={4}
                      disabled={isRunning}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-lg font-bold flex items-center gap-2">
                      <Sheet className="w-5 h-5" />
                      Additional Context (Optional)
                    </Label>
                    <textarea
                      placeholder="Add any additional context, rules, or details about the video..."
                      value={customContext}
                      onChange={(e) => setCustomContext(e.target.value)}
                      className="w-full min-h-[80px] p-3 border rounded-md resize-vertical text-sm"
                      rows={3}
                      disabled={isRunning}
                    />
                  </div>
                </div>
              )}

              {/* Video URL Input */}
              <div className="space-y-3">
                <Label className="text-lg font-bold flex items-center gap-2">
                  <Youtube className="w-5 h-5" />
                  Video URL
                </Label>
                <Input
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  disabled={isRunning}
                  className="font-mono"
                />
              </div>

              {/* Iterations Input */}
              <div className="space-y-3">
                <Label htmlFor="iterations" className="text-lg font-bold">
                  Iterations (2-10)
                </Label>
                <Input
                  id="iterations"
                  type="number"
                  min={2}
                  max={10}
                  value={iterations}
                  onChange={(e) => setIterations(parseInt(e.target.value) || 3)}
                  disabled={isRunning}
                />
                <p className="text-xs text-muted-foreground">
                  Number of times to run the same evaluation
                </p>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-destructive/10 border border-destructive p-3 rounded-md">
                  <p className="text-destructive text-sm font-semibold">
                    ⚠️ {error}
                  </p>
                </div>
              )}

              {/* Run Test Button */}
              <Button
                onClick={handleRunTest}
                disabled={isRunning}
                className="w-full"
                size="lg"
              >
                {isRunning ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Running Test... ({iterations} iterations)
                  </>
                ) : (
                  <>🚀 Run Variance Test</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Information Panel */}
          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <h4 className="font-semibold mb-1">📊 Test Process:</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>Select video type (Concept/Project/Other)</li>
                  <li>Choose phase and video details (like VideoAnalyzer)</li>
                  <li>Runs the same video through {iterations} identical evaluations</li>
                  <li>Compares all responses to detect differences</li>
                  <li>Calculates consistency score (0-100%)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-1">🎯 Video Type Options:</h4>
                <ul className="space-y-1 text-gray-600">
                  <li><strong>Concept Explanation:</strong> Tests accuracy + ability to explain evaluations</li>
                  <li><strong>Project Explanation:</strong> Tests project rubric-based evaluations</li>
                  <li><strong>Other:</strong> Tests custom evaluation prompts</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-1">🎯 Consistency Levels:</h4>
                <ul className="space-y-1">
                  <li className="text-green-600">✅ 95-100%: Excellent (deterministic)</li>
                  <li className="text-yellow-600">⚠️ 80-94%: Good (minor variance)</li>
                  <li className="text-red-600">❌ &lt;80%: Poor (high variance)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-1">⚙️ Current Config:</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-600 text-xs">
                  <li>temperature: 0 (deterministic)</li>
                  <li>topK: 1 (most likely token)</li>
                  <li>topP: 1.0 (no nucleus sampling)</li>
                  <li>candidateCount: 1 (single response)</li>
                  <li>seed: 42 (fixed random seed)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-1">💡 Best Practices:</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>Start with 3-4 iterations</li>
                  <li>Use videos with clear, unambiguous content</li>
                  <li>Test different video types separately</li>
                  <li>Review differing fields to identify patterns</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Panel */}
        {testResults && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Test Results</CardTitle>
                <Button variant="outline" size="sm" onClick={handleClearResults}>
                  Clear Results
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Total Iterations</div>
                    <div className="text-2xl font-bold">{testResults.iterations}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Successful</div>
                    <div className="text-2xl font-bold text-green-600">
                      {testResults.successful_count}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Avg Time</div>
                    <div className="text-2xl font-bold">
                      {testResults.avg_iteration_time_ms}ms
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg ${
                    testResults.variance_analysis.consistency_score >= 95 ? 'bg-green-50' :
                    testResults.variance_analysis.consistency_score >= 80 ? 'bg-yellow-50' :
                    'bg-red-50'
                  }`}>
                    <div className="text-sm text-gray-600">Consistency</div>
                    <div className={`text-2xl font-bold ${getConsistencyColor(testResults.variance_analysis.consistency_score)}`}>
                      {testResults.variance_analysis.consistency_score.toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Variance Analysis */}
                <div>
                  <h3 className="font-semibold mb-2">📊 Variance Analysis</h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span>Identical Responses:</span>
                      <span className="font-semibold">
                        {testResults.variance_analysis.identical_count} / {testResults.variance_analysis.total_comparisons}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Variance:</span>
                      <span className="font-semibold">
                        {testResults.variance_analysis.variance_percentage.toFixed(2)}%
                      </span>
                    </div>
                    {testResults.variance_analysis.differing_fields.length > 0 && (
                      <div>
                        <div className="font-semibold mb-1">Differing Fields:</div>
                        <ul className="list-disc list-inside text-sm text-gray-700">
                          {testResults.variance_analysis.differing_fields.map((field: string, idx: number) => (
                            <li key={idx}>{field}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recommendations */}
                {testResults.recommendations && testResults.recommendations.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">💡 Recommendations</h3>
                    <ul className="space-y-2">
                      {testResults.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="bg-blue-50 p-3 rounded-lg text-sm">
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Individual Responses */}
                <div>
                  <h3 className="font-semibold mb-2">📝 Individual Responses</h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {testResults.responses.map((response: any, idx: number) => (
                      <details key={idx} className="bg-gray-50 p-3 rounded-lg">
                        <summary className="cursor-pointer font-semibold text-sm">
                          Iteration {response.iteration} 
                          {response.success && <span className="text-green-600 ml-2">✓</span>}
                          {response.error && <span className="text-red-600 ml-2">✗</span>}
                          <span className="text-gray-500 ml-2">({response.time_ms}ms)</span>
                        </summary>
                        <pre className="mt-2 text-xs bg-white p-2 rounded overflow-x-auto">
                          {JSON.stringify(response.parsed || response.error, null, 2)}
                        </pre>
                      </details>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Usage Guide */}
        <Card>
          <CardHeader>
            <CardTitle>📖 Usage Guide</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <h4>Quick Start</h4>
            <ol className="list-decimal list-inside space-y-2">
              <li><strong>Select Video Type:</strong> Choose Concept Explanation, Project Explanation, or Other</li>
              <li><strong>For Concept:</strong> Select Phase → Select Video Title → Enter YouTube URL</li>
              <li><strong>For Project:</strong> Select Phase → Enter YouTube URL</li>
              <li><strong>For Other:</strong> Enter Custom Evaluation Prompt → Add Context (optional) → Enter YouTube URL</li>
              <li>Set number of iterations (3-4 recommended)</li>
              <li>Click "Run Variance Test" and wait for results</li>
            </ol>

            <h4 className="mt-4">Interpreting Results</h4>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Consistency Score:</strong> Higher is better. 95%+ means excellent determinism.</li>
              <li><strong>Differing Fields:</strong> Shows which parts of the response vary between iterations.</li>
              <li><strong>Recommendations:</strong> Actionable suggestions to improve consistency.</li>
            </ul>

            <h4 className="mt-4">Troubleshooting</h4>
            <ul className="list-disc list-inside space-y-2">
              <li>If consistency &lt; 80%, check prompt clarity and scoring formulas</li>
              <li>If feedback text varies, add more structured templates to prompts</li>
              <li>If levels vary, strengthen threshold criteria with exact percentages</li>
              <li>Consider implementing response caching for 100% consistency</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </MotionWrapper>
  );
};

export default VarianceTest;
