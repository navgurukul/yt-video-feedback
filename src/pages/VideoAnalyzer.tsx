import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Youtube, Zap, FileJson, Sheet, Film, Code, Layout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AnimatedHeading } from "@/components/AnimatedHeading";
import { MotionWrapper } from "@/components/MotionWrapper";
import { AnimatedIntroText } from "@/components/AnimatedIntroText";
import { CelebrationEffect } from "@/components/CelebrationEffect";
import { ErrorPanel } from "@/components/ErrorPanel";
import { motion } from "framer-motion";
import { getPhaseNames, getVideoTitlesForPhase, getVideoDetailsForTitle } from "@/data/videoData";
import { getProjectVideoForPhase } from "@/data/phasevideodata";
import { abilityToExplainRubric, Phase1Rubric, Phase2Rubric, Phase3Rubric, Phase4Rubric,Phase5Rubric, Phase6Rubric, Phase7Rubric } from "@/data/RubricData";
import {AccuracyPrompt,AccuracyConfig, AbilityToExplainPrompt,AbilityToExplainConfig, ProjectPrompt, projectconfig, CustomPrompt, CustomConfig} from '@/data/prompt'
import { ApiKeyContext } from "@/App";
import { getErrorInfo, formatErrorInfo, ErrorInfo, extractErrorStatus } from "@/lib/errorMessages";

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
] as const;

const evaluateWithModelFallback = async (
  payload: Record<string, unknown>,
  onStatus: (status: string) => void,
) => {
  const failedModels: string[] = [];

  for (const model of GEMINI_MODELS) {
    onStatus(`Trying ${model}...`);
    const response = await fetch((import.meta.env.VITE_EVAL_API_URL || 'http://localhost:3001') + '/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, model }),
    });
    const data = await response.json();
    const errorType = data?.error?.type;
    const errorCode = data?.error?.error_code;
    const errorDetails = `${data?.error?.message || ""} ${data?.error?.details || ""}`;
    const isFallbackEligible =
      errorType === "model_unavailable" ||
      errorCode === "MODEL_RETRYABLE_ERROR" ||
      response.status === 404 ||
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500 ||
      /service unavailable|high demand|overloaded|temporarily unavailable/i.test(errorDetails);

    if (response.ok || !isFallbackEligible) {
      if (response.ok) onStatus(`Using ${model}`);
      return { response, data, actualModelUsed: response.ok ? model : null };
    }

    failedModels.push(model);
    const nextModel = GEMINI_MODELS[GEMINI_MODELS.indexOf(model) + 1];
    if (nextModel) {
      onStatus(`${model} failed. Trying ${nextModel}...`);
    } else {
      onStatus(`${failedModels.join(', ')} failed. Please try again later.`);
      return { response, data, actualModelUsed: null };
    }
  }
};

const VideoAnalyzer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState("Mission Started 🚀");
  const { apiKey } = useContext(ApiKeyContext);
  
  const [videoUrl, setVideoUrl] = useState("");
  // const [videoUrl, setVideoUrl] = useState("https://youtu.be/XLvrN6ZcGQ4?si=cfy2QnblXCd4UEsa&t=1"); // Test URL for local testing
  const [videoType, setVideoType] = useState<"concept" | "project" | "other">("concept");
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [selectedVideoTitle, setSelectedVideoTitle] = useState<string>("");
  const [videoDetailsText, setVideoDetailsText] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [customContext, setCustomContext] = useState("");
  const [error, setError] = useState("");
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("");
  
  const phaseNames = getPhaseNames();
  const availableVideoTitles = selectedPhase ? getVideoTitlesForPhase(selectedPhase) : [];

  // Video details mapping
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
      // For project videos, get details from phasevideodata
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
      // For other type, use the custom prompt and context as video details
      details = `Custom Evaluation Criteria:\n${customPrompt}`;
      if (customContext && customContext.trim()) {
        details += `\n\nAdditional Context:\n${customContext}`;
      }
    }
    return details;
  };



  // Reset video title and clear error when switching phase or video type
  useEffect(() => {
    setSelectedVideoTitle("");
    setError("");
    setErrorInfo(null);
  }, [selectedPhase, videoType]);

  // Update video details when selections change
  useEffect(() => {
    if (videoType === "concept" && selectedPhase && selectedVideoTitle) {
      setVideoDetailsText(getVideoDetails());
    } else if (videoType === "project" && selectedPhase) {
      setVideoDetailsText(getVideoDetails());
    } else if (videoType === "other" && customPrompt) {
      setVideoDetailsText(getVideoDetails());
    }
  }, [videoType, selectedPhase, selectedVideoTitle, customPrompt, customContext]);

  // Helper function to create validation error objects
  const createValidationError = (
    title: string,
    message: string,
    suggestions: string[],
    context: string
  ): ErrorInfo => {
    return {
      code: `VALIDATION_${context}`,
      title,
      message,
      severity: "warning",
      suggestions,
      retryable: false,
      nextSteps: "Fill in the required field(s) and try again",
    };
  };

  const handleAnalyze = () => {
    setError("");
    setErrorInfo(null);
    setAnalysisStatus("Preparing Gemini evaluation...");
    setIsAnalyzing(true);
    
    // Validate video URL
    if (!videoUrl || !videoUrl.includes("youtube.com") && !videoUrl.includes("youtu.be")) {
      const validationError = createValidationError(
        "Invalid YouTube URL",
        "The video URL must be a valid YouTube link. Please check the URL and make sure it points to a YouTube video.",
        [
          "Ensure the URL contains 'youtube.com' or 'youtu.be'",
          "Copy the full URL from the YouTube video page",
          "Check for typos in the URL",
          "Try using a different format (full URL vs shortened URL)"
        ],
        "URL"
      );
      setErrorInfo(validationError);
      setError(validationError.message);
      setIsAnalyzing(false);
      return;
    }

    // Validate that a phase is selected (not required for other type)
    if (videoType !== "other" && (!selectedPhase || selectedPhase === "")) {
      const validationError = createValidationError(
        "Phase Not Selected",
        "You must select a Phase to proceed with the evaluation. Each phase has different evaluation criteria and requirements.",
        [
          "Select a phase from the dropdown menu (Phase 1 through Phase 7)",
          "Each phase builds on previous concepts with increasing complexity",
          "Phase 1-2 focus on HTML and CSS fundamentals, Phase 3-6 cover advanced topics",
          "Switch between phases if your project covers different curriculum stages"
        ],
        "PHASE"
      );
      setErrorInfo(validationError);
      setError(validationError.message);
      setIsAnalyzing(false);
      return;
    }

    // Validate that a video title is selected when in concept explanation mode
    if (videoType === "concept" && (!selectedVideoTitle || selectedVideoTitle === "")) {
      const validationError = createValidationError(
        "Video Title Not Selected",
        "For concept explanation evaluation, you must select which specific topic or page your video covers. This helps us evaluate the accuracy and clarity of your explanation.",
        [
          "Select a topic from the 'Video Title' dropdown menu",
          "Choose the specific concept your video explains",
          "Make sure your video matches the selected concept",
            "Ensure you selected a Phase first (from Phase 1 through Phase 7)"
        ],
        "VIDEO_TITLE"
      );
      setErrorInfo(validationError);
      setError(validationError.message);
      setIsAnalyzing(false);
      return;
    }

    // Validate that a custom prompt is provided when in other mode
    if (videoType === "other" && (!customPrompt || customPrompt.trim() === "")) {
      const validationError = createValidationError(
        "Custom Evaluation Prompt Missing",
        "For custom evaluation type, you must provide evaluation criteria or a prompt that describes what you want the AI to evaluate in your video.",
        [
          "Enter specific evaluation criteria (e.g., 'Evaluate code quality and best practices')",
          "Be clear about what aspects of the video to evaluate",
          "Include any specific standards or rubrics to apply",
          "Add context or additional instructions if needed"
        ],
        "CUSTOM_PROMPT"
      );
      setErrorInfo(validationError);
      setError(validationError.message);
      setIsAnalyzing(false);
      return;
    }

    // Start evaluation (call backend evaluate endpoint)
    setCelebrationMessage("Mission Started 🚀");
    setShowCelebration(true);

    // Show persistent toast that will stay until dismissed
    const { dismiss } = toast({ 
      title: "Analysis Started! 🎮", 
      description: "Processing your video with AI...",
      duration: Infinity // Keep toast visible until manually dismissed
    });

    (async () => {
      try {
        let evaluationPayload = {};
        let projectRubric = null;
        
        // Create payload with common fields
        const payload = {
          videoUrl,
          videoDetails: videoDetailsText,
        };
        
        // Determine which rubric to use based on video type
        if (videoType === "concept") {
          // For Concept Explanation, we'll do two evaluations:
          // 1. Accuracy evaluation based on getVideoDetails
          // 2. Ability to explain evaluation based on abilityToExplainRubric
          
          // Arrays to store API call metrics and issues
          const apiCalls = [];
          const issues = [];
          
          // First, get the accuracy evaluation
          const accuracyPayload = {  
          ...payload, 
          promptbegining: AccuracyPrompt,
          structuredreturnedconfig: AccuracyConfig,
          evaluationType: "accuracy",
          apiKey: apiKey // Include user's API key
             };

          let accuracyError = null;
          let accuracyResp;
          let accuracyData;
          let accuracyModel = null;
          
          try {
            const accuracyResult = await evaluateWithModelFallback(accuracyPayload, setAnalysisStatus);
            accuracyResp = accuracyResult.response;
            accuracyData = accuracyResult.data;
            accuracyModel = accuracyResult.actualModelUsed;
            
            // Capture API call metrics - 1st call
            if (accuracyData.metrics) {
              apiCalls.push({
                call_number: 1,
                evaluation_type: "accuracy",
                metrics: accuracyData.metrics,
                error: accuracyData.error || null
              });
            }
            
            // If API returned an error, capture it as an issue
            if (accuracyData.error) {
              issues.push({
                issue_type: accuracyData.error.type || 'api_error',
                issue_description: accuracyData.error.message || 'Accuracy evaluation failed',
                error_code: accuracyData.error.error_code || String(accuracyData.error.status_code),
                stacktrace: accuracyData.error.stacktrace || ''
              });
            }
          } catch (err) {
            accuracyError = err;
            apiCalls.push({
              call_number: 1,
              evaluation_type: "accuracy",
              metrics: null,
              error: {
                type: "network_error",
                message: String(err)
              }
            });
            issues.push({
              issue_type: 'network_error',
              issue_description: 'Network error during accuracy evaluation: ' + String(err),
              error_code: 'NETWORK_ERROR',
              stacktrace: err instanceof Error ? err.stack : ''
            });
          }

          const accuracyEvaluation = accuracyData?.parsed ?? accuracyData;
          console.log('Evaluation Response:', JSON.stringify({ accuracy: accuracyEvaluation }, null, 2));

          // Check if accuracy evaluation failed
          if (accuracyError || !accuracyResp?.ok || accuracyEvaluation?.error) {
            console.error('Accuracy Evaluation API error', accuracyData);
            setShowCelebration(false);
            dismiss();
            
            // Extract and format error info - prioritize HTTP status code from response
            const httpStatus = accuracyResp?.status || 500;
            const formattedError = formatErrorInfo(
              accuracyData?.error || {},
              !accuracyResp?.ok ? httpStatus : undefined,
              "accuracy"
            );
            
            setErrorInfo(formattedError);
            setError(formattedError.message);
            setIsAnalyzing(false);
            return;
          }

          // Second, get the ability to explain evaluation
          const abilityPayload = {
            ...payload,
            rubric: abilityToExplainRubric,
            promptbegining: AbilityToExplainPrompt,
            structuredreturnedconfig: AbilityToExplainConfig,
            evaluationType: "ability",
            apiKey: apiKey // Include user's API key
                };

          let abilityError = null;
          let abilityResp;
          let abilityData;
          let abilityModel = null;

          try {
            const abilityResult = await evaluateWithModelFallback(abilityPayload, setAnalysisStatus);
            abilityResp = abilityResult.response;
            abilityData = abilityResult.data;
            abilityModel = abilityResult.actualModelUsed;
            
            // Capture API call metrics - 2nd call
            if (abilityData.metrics) {
              apiCalls.push({
                call_number: 2,
                evaluation_type: "ability",
                metrics: abilityData.metrics,
                error: abilityData.error || null
              });
            }
          } catch (err) {
            abilityError = err;
            apiCalls.push({
              call_number: 2,
              evaluation_type: "ability",
              metrics: null,
              error: {
                message: String(err),
                type: "network_error"
              }
            });
          }

          const abilityEvaluation = abilityData?.parsed ?? abilityData;

          if (abilityError || !abilityResp?.ok) {
            console.error('Ability Evaluation API error', abilityData);
            setShowCelebration(false);
            dismiss(); // Dismiss the processing toast
            
            // Extract error info - this is a PARTIAL error since accuracy succeeded
            // Prioritize HTTP status code from response
            const httpStatus = abilityResp?.status || 500;
            const formattedError = formatErrorInfo(
              abilityData?.error || {},
              !abilityResp?.ok ? httpStatus : undefined,
              "ability"
            );
            
            // Store the error but continue with partial results (accuracy succeeded)
            // We'll pass both accuracy results and the ability error to AnalysisResults
            // This will be handled in AnalysisResults to show accuracy + error banner
            
            // For now, treat as critical error on ability alone but preserve accuracy
            setErrorInfo(formattedError);
            setError(formattedError.message);
            setIsAnalyzing(false);
            return;
          }

          // Combine both evaluations with API metrics
          evaluationPayload = {
            evaluation_result: {
              accuracy: accuracyEvaluation,
              abilityToExplain: abilityEvaluation
            },
            api_calls: apiCalls,
            issues: issues,
            actual_model_used: `accuracy: ${accuracyModel}; ability: ${abilityModel}`
          };
        } else if (videoType === "other") {
          // For Other type, use custom prompt evaluation
          const apiCalls = [];
          const issues = [];
          
          const customPayload = {
            ...payload,
            promptbegining: CustomPrompt,
            structuredreturnedconfig: CustomConfig,
            customPrompt: customPrompt, // Include the user's custom prompt
            customContext: customContext, // Include the user's custom context
            evaluationType: "custom",
            apiKey: apiKey // Include user's API key
          };

          let customError = null;
          let resp;
          let data;
          let actualModelUsed = null;

          try {
            const customResult = await evaluateWithModelFallback(customPayload, setAnalysisStatus);
            resp = customResult.response;
            data = customResult.data;
            actualModelUsed = customResult.actualModelUsed;
            
            // Capture API call metrics
            if (data.metrics) {
              apiCalls.push({
                call_number: 1,
                evaluation_type: "custom",
                metrics: data.metrics,
                error: data.error || null
              });
            }
            
            // If API returned an error, capture it as an issue
            if (data.error) {
              issues.push({
                issue_type: data.error.type || 'api_error',
                issue_description: data.error.message || 'Custom evaluation failed',
                error_code: data.error.error_code || String(data.error.status_code),
                stacktrace: data.error.stacktrace || ''
              });
            }
          } catch (err) {
            customError = err;
            apiCalls.push({
              call_number: 1,
              evaluation_type: "custom",
              metrics: null,
              error: {
                message: String(err),
                type: "network_error"
              }
            });
            issues.push({
              issue_type: 'network_error',
              issue_description: 'Network error during custom evaluation: ' + String(err),
              error_code: 'NETWORK_ERROR',
              stacktrace: err instanceof Error ? err.stack : ''
            });
          }

          if (customError || !resp?.ok) {
            console.error('Custom Evaluation API error', data);
            setShowCelebration(false);
            dismiss(); // Dismiss the processing toast
            
            // Extract and format error info - prioritize HTTP status
            const httpStatus = resp?.status || 500;
            const formattedError = formatErrorInfo(
              data?.error || {},
              !resp?.ok ? httpStatus : undefined,
              "custom"
            );
            
            setErrorInfo(formattedError);
            setError(formattedError.message);
            setIsAnalyzing(false);
            return;
          }

          const customEvaluation = data?.parsed ?? data;
          evaluationPayload = {
            evaluation_result: customEvaluation,
            api_calls: apiCalls,
            issues: issues,
            actual_model_used: actualModelUsed
          };
        } else {
          // For Project Explanation, use the appropriate project rubric
          const apiCalls = [];
          const issues = [];

          switch (selectedPhase) {
            case "Phase 1: Student Profile & Course Portal (HTML Only)":
              projectRubric = Phase1Rubric;
              break;
            case "Phase 2: Dressing Up Your Websites with CSS":
              projectRubric = Phase2Rubric;
              break;
            case "Phase 3: Bringing Your Websites to Life with JavaScript!":
              projectRubric = Phase3Rubric;
              break;
            case "Phase 4: Building an AI-Powered Content Generator with Modern JavaScript & Gemini API":
              projectRubric = Phase4Rubric;
              break;
            case "Phase 5: Your First Backend with Node.js, Express & Gemini AI":
              projectRubric = Phase5Rubric;
              break;
            case "Phase 6: Your First Database with MongoDB & Mongoose":
              projectRubric = Phase6Rubric;
              break;
            case "Phase 7: Final Full-Stack Project with AI Integration":
              projectRubric = Phase7Rubric;
              break;
            default:
              projectRubric = Phase1Rubric; // Default to Phase1 rubric
          }

          const projectPayload = {
            ...payload,
            rubric: projectRubric,
            promptbegining: ProjectPrompt,
            structuredreturnedconfig: projectconfig,
            evaluationType: "project",
            apiKey: apiKey // Include user's API key
          };

          let projectError = null;
          let resp;
          let data;
          let actualModelUsed = null;

          try {
            const projectResult = await evaluateWithModelFallback(projectPayload, setAnalysisStatus);
            resp = projectResult.response;
            data = projectResult.data;
            actualModelUsed = projectResult.actualModelUsed;
            
            // Capture API call metrics
            if (data.metrics) {
              apiCalls.push({
                call_number: 1,
                evaluation_type: "project",
                metrics: data.metrics,
                error: data.error || null
              });
            }
            
            // If API returned an error, capture it as an issue
            if (data.error) {
              issues.push({
                issue_type: data.error.type || 'api_error',
                issue_description: data.error.message || 'Project evaluation failed',
                error_code: data.error.error_code || String(data.error.status_code),
                stacktrace: data.error.stacktrace || ''
              });
            }
          } catch (err) {
            projectError = err;
            apiCalls.push({
              call_number: 1,
              evaluation_type: "project",
              metrics: null,
              error: {
                message: String(err),
                type: "network_error"
              }
            });
            issues.push({
              issue_type: 'network_error',
              issue_description: 'Network error during project evaluation: ' + String(err),
              error_code: 'NETWORK_ERROR',
              stacktrace: err instanceof Error ? err.stack : ''
            });
          }

          if (projectError || !resp?.ok) {
            console.error('Evaluation API error', data);
            setShowCelebration(false);
            dismiss(); // Dismiss the processing toast
            
            // Extract and format error info - prioritize HTTP status
            const httpStatus = resp?.status || 500;
            const formattedError = formatErrorInfo(
              data?.error || {},
              !resp?.ok ? httpStatus : undefined,
              "project"
            );
            
            setErrorInfo(formattedError);
            setError(formattedError.message);
            setIsAnalyzing(false);
            return;
          }

          const projectEvaluation = data?.parsed ?? data;
          evaluationPayload = {
            evaluation_result: projectEvaluation,
            api_calls: apiCalls,
            issues: issues,
            actual_model_used: actualModelUsed
          };
        }

        // Save evaluation to PostgreSQL database
        try {
          // Get current user from Supabase (for user ID only)
          const { supabase } = await import('@/integrations/supabase/client');
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            // Ensure evaluationPayload is properly structured
            
            // Send data to PostgreSQL via our backend API
            const requestData = {
              userId: user.id,
              userEmail: user.email,
              videoUrl,
              evaluationData: evaluationPayload,
              videoType,
              selectedPhase: videoType !== "other" ? selectedPhase : null,
              selectedVideoTitle: videoType === "concept" ? selectedVideoTitle : null,
              customPrompt: videoType === "other" ? customPrompt : null,
              customContext: videoType === "other" ? customContext : null
            };
            
            const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/store-evaluation';
            
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestData)
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to store evaluation');
            }

            const result = await response.json();
          }
        } catch (dbErr) {
          console.warn('Failed to save evaluation to PostgreSQL:', dbErr);
          // Don't return here - still navigate to results page even if DB save fails
        }

        setTimeout(() => {
          setCelebrationMessage("Mission Completed 🚀");
          setShowCelebration(false);
          setIsAnalyzing(false);
          dismiss(); // Dismiss the processing toast before navigation
          navigate('/analysis-results', { 
            state: { 
              videoUrl, 
              evaluation: evaluationPayload, 
              videoDetails: payload?.videoDetails,
              videoType,
              projectRubric,
              selectedPhase,
              selectedVideoTitle,
              customPrompt,
              customContext
            } 
          });
        }, 800);
      } catch (err: any) {
        console.error('Evaluation error', err);
        setShowCelebration(false);
        dismiss(); // Dismiss the processing toast on error
        setError('Evaluation failed. See console for details.');
        setIsAnalyzing(false);
      }
    })();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Celebration Effect */}
      <CelebrationEffect 
        show={showCelebration} 
        onComplete={() => setShowCelebration(false)}
        message={celebrationMessage}
      />
      
      <Header />
      
      <main className="container mx-auto px-4 py-12 flex-1">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <AnimatedIntroText 
            text="Analyzing brilliance in progress… ⚡" 
            direction="up" 
          />
          <AnimatedHeading className="text-5xl md:text-7xl font-black uppercase mb-4">
            <span className="text-primary">YouTube</span> Video
            <br />
            Feedback 
          </AnimatedHeading>
          <MotionWrapper delay={0.3} direction="zoom">
            <p className="text-xl font-bold max-w-2xl mx-auto">
              Power up your content with AI-driven feedback analysis! 🎮
            </p>
          </MotionWrapper>
        </div>

        {/* Main Form Card */}
        <MotionWrapper delay={0.4} direction="up">
          <Card className="max-w-4xl mx-auto p-8 md:p-12">
          <div className="space-y-8">
            {/* Video Type Selection */}
            <div className="space-y-3">
              <Label className="text-xl font-black uppercase flex items-center gap-2">
                <Film className="w-6 h-6" />
                Video Type
              </Label>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  variant={videoType === "concept" ? "default" : "outline"}
                  size="lg"
                  onClick={() => {
                    setVideoType("concept");
                    setError("");
                    setErrorInfo(null);
                  }}
                  className="flex-1 w-full sm:w-auto"
                >
                  Concept Explanation
                </Button>
                <Button
                  variant={videoType === "project" ? "default" : "outline"}
                  size="lg"
                  onClick={() => {
                    setVideoType("project");
                    setError("");
                    setErrorInfo(null);
                  }}
                  className="flex-1 w-full sm:w-auto"
                >
                  Project Explanation
                </Button>
                <Button
                  variant={videoType === "other" ? "default" : "outline"}
                  size="lg"
                  onClick={() => {
                    setVideoType("other");
                    setError("");
                    setErrorInfo(null);
                  }}
                  className="flex-1 w-full sm:w-auto"
                >
                  Other
                </Button>
              </div>
            </div>

            {/* Phase Selection Dropdown (hidden for other type) */}
            {videoType !== "other" && (
              <div className="space-y-3">
                <Label className="text-xl font-black uppercase flex items-center gap-2">
                  <Code className="w-6 h-6" />
                  Select Phase
                </Label>
                <Select onValueChange={setSelectedPhase} value={selectedPhase}>
                  <SelectTrigger className="w-full text-lg h-12">
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

            {/* Video Title Selection (only for concept explanation) */}
            {videoType === "concept" && selectedPhase && (
              <div className="space-y-3">
                <Label className="text-xl font-black uppercase flex items-center gap-2">
                  <Layout className="w-6 h-6" />
                  Select Video Title
                </Label>
                <Select 
                  onValueChange={setSelectedVideoTitle} 
                  value={selectedVideoTitle}
                  disabled={!selectedPhase}
                >
                  <SelectTrigger className="w-full text-lg h-12">
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
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-xl font-black uppercase flex items-center gap-2">
                    <FileJson className="w-6 h-6" />
                    Custom Evaluation Prompt
                  </Label>
                  <textarea
                    placeholder="Enter your custom evaluation criteria or specific aspects you want the AI to focus on when analyzing this video..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="w-full min-h-[120px] p-4 border-4 border-foreground bg-background font-mono text-lg resize-vertical"
                    rows={5}
                  />
                  <p className="text-sm text-muted-foreground">
                    Describe what you want the AI to evaluate in your video. Be specific about the criteria, topics, or skills you want feedback on.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-xl font-black uppercase flex items-center gap-2">
                    <Sheet className="w-6 h-6" />
                    Additional Context (Optional)
                  </Label>
                  <textarea
                    placeholder="Add any additional context, rules, or details about the video that might help with evaluation. For example: target audience, specific requirements, background information, etc."
                    value={customContext}
                    onChange={(e) => setCustomContext(e.target.value)}
                    className="w-full min-h-[100px] p-4 border-4 border-foreground bg-background font-mono text-lg resize-vertical"
                    rows={4}
                  />
                  <p className="text-sm text-muted-foreground">
                    Optional: Provide additional context, rules, or background information that might be relevant for the evaluation.
                  </p>
                </div>
              </div>
            )}

            {/* Video URL Input */}
            <div className="space-y-3">
              <Label className="text-xl font-black uppercase flex items-center gap-2">
                <Youtube className="w-6 h-6" />
                YouTube Video URL (≤ 10 min video)
              </Label>
              <Input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="font-mono text-lg placeholder:font-mono"
              />
            </div>
            
            {/* Error Display with Detailed ErrorPanel */}
            {errorInfo && (
              <ErrorPanel
                error={errorInfo}
                evaluationType={
                  videoType === "concept" ? "concept-accuracy" :
                  videoType === "project" ? "project" :
                  "custom"
                }
                onRetry={() => {
                  setError("");
                  setErrorInfo(null);
                  handleAnalyze();
                }}
                onDismiss={() => {
                  setError("");
                  setErrorInfo(null);
                }}
              />
            )}

            {/* Analyze Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={handleAnalyze}
                size="lg"
                variant="default"
                className="w-full text-2xl h-16"
                disabled={isAnalyzing}
              >
                {isAnalyzing ? "🔄 ANALYZING..." : "🎯 ANALYZE VIDEO"}
              </Button>
            </motion.div>
            {analysisStatus && (
              <p className="text-center text-sm font-medium text-muted-foreground" role="status">
                {analysisStatus}
              </p>
            )}
          </div>
        </Card>
        </MotionWrapper>
      </main>

      <Footer />
    </div>
  );
};

export default VideoAnalyzer;
