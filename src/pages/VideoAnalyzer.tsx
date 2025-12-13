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
import { motion } from "framer-motion";
import { getPhaseNames, getVideoTitlesForPhase, getVideoDetailsForTitle } from "@/data/videoData";
import { abilityToExplainRubric, Phase1Rubric, Phase2Rubric, Phase3Rubric, Phase4Rubric,Phase5Rubric, Phase6Rubric } from "@/data/RubricData";
import {AccuracyPrompt,AccuracyConfig, AbilityToExplainPrompt,AbilityToExplainConfig, ProjectPrompt, projectconfig} from '@/data/prompt'
import { a } from "node_modules/framer-motion/dist/types.d-BJcRxCew";
import { ApiKeyContext } from "@/App";

const VideoAnalyzer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCelebration, setShowCelebration] = useState(false);
  const { apiKey } = useContext(ApiKeyContext);
  
  const [videoUrl, setVideoUrl] = useState("https://youtu.be/XLvrN6ZcGQ4?si=cfy2QnblXCd4UEsa&t=1");
  const [videoType, setVideoType] = useState<"concept" | "project">("concept");
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [selectedVideoTitle, setSelectedVideoTitle] = useState<string>("");
  const [videoDetailsText, setVideoDetailsText] = useState("");
  const [error, setError] = useState("");
  
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
    } 
    return details;
  };



  // Reset video title and clear error when switching phase or video type
  useEffect(() => {
    setSelectedVideoTitle("");
    setError("");
  }, [selectedPhase, videoType]);

  // Update video details when selections change
  useEffect(() => {
    if (videoType === "concept" && selectedPhase && selectedVideoTitle) {
      setVideoDetailsText(getVideoDetails());
    } 
  }, [videoType, selectedPhase, selectedVideoTitle]);

  const handleAnalyze = () => {
    setError("");
    
    // Validate video URL
    if (!videoUrl || !videoUrl.includes("youtube.com") && !videoUrl.includes("youtu.be")) {
      setError("Please enter a valid YouTube URL");
      return;
    }

    // Validate that a phase is selected
    if (!selectedPhase || selectedPhase === "") {
      setError("Please select a Phase");
      return;
    }

    // Validate that a video title is selected when in concept explanation mode
    if (videoType === "concept" && (!selectedVideoTitle || selectedVideoTitle === "")) {
      setError("Please select a Video Title for concept explanation evaluation");
      return;
    }

    // Start evaluation (call backend evaluate endpoint)
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
          
          // First, get the accuracy evaluation
          const accuracyPayload = {  
          ...payload, 
          promptbegining: AccuracyPrompt,
          structuredreturnedconfig: AccuracyConfig,
          evaluationType: "accuracy",
          apiKey: apiKey // Include user's API key
             };

          const accuracyResp = await fetch((import.meta.env.VITE_EVAL_API_URL || 'http://localhost:3001') + '/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(accuracyPayload),
          });

          const accuracyData = await accuracyResp.json();
          console.log('Accuracy Evaluation Response:', JSON.stringify(accuracyData, null, 2));
          const accuracyEvaluation = accuracyData.parsed ?? accuracyData;
          console.log('Accuracy Evaluation (extracted):', JSON.stringify(accuracyEvaluation, null, 2));

          // Second, get the ability to explain evaluation
          const abilityPayload = {
            ...payload,
            rubric: abilityToExplainRubric,
          promptbegining: AbilityToExplainPrompt,
          structuredreturnedconfig: AbilityToExplainConfig,
            evaluationType: "ability",
            apiKey: apiKey // Include user's API key
                };

          const abilityResp = await fetch((import.meta.env.VITE_EVAL_API_URL || 'http://localhost:3001') + '/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(abilityPayload),
          });

          const abilityData = await abilityResp.json();
          console.log('Ability Evaluation Response:', JSON.stringify(abilityData, null, 2));
          const abilityEvaluation = abilityData.parsed ?? abilityData;
          console.log('Ability Evaluation (extracted):', JSON.stringify(abilityEvaluation, null, 2));

          if (!abilityResp.ok) {
            console.error('Ability Evaluation API error', abilityData);
            setShowCelebration(false);
            dismiss(); // Dismiss the processing toast
            
            // Handle specific Gemini API errors
            let errorMessage = 'Ability evaluation failed. See console for details.';
            if (abilityData.status && abilityData.message) {
              errorMessage = `Ability evaluation failed (${abilityData.status}: ${abilityData.statusText}). ${abilityData.message}`;
            }
            
            setError(errorMessage);
            return;
          }

          // Combine both evaluations
          evaluationPayload = {
            accuracy: accuracyEvaluation,
            abilityToExplain: abilityEvaluation
          };
          console.log('Combined Evaluation Payload:', JSON.stringify(evaluationPayload, null, 2));
        } else {
          // For Project Explanation, use the appropriate project rubric

          switch (selectedPhase) {
            case "Phase 1: HTML Only — Student Profile & Course Portal":
              projectRubric= Phase1Rubric;
              break;
            case "Phase 2: CSS Styling — Interactive Portfolio & Blog":
            projectRubric= Phase1Rubric;
              break;
            case "Phase 3: JavaScript Basics — To-Do List & Weather App":
              projectRubric = Phase3Rubric
            case "phase 4: Advanced JavaScript — E-Commerce Site & Chat Application":
            projectRubric = Phase4Rubric
              break;
              case "Phase 5: Full-Stack Development — Social Media Platform & Project Management Tool":
              projectRubric= Phase5Rubric;
              break;
              case "Phase 6: Deployment & Optimization — Blog Platform & Portfolio Site":
              projectRubric = Phase6Rubric
              break;
            default:
              projectRubric = "Phase1"; // Default to Phase1 rubric
          }

          console.log(' Video Analyze Log : Project evaluation"');
          const projectPayload = {
            ...payload,
            rubric: projectRubric,
          promptbegining: ProjectPrompt,
          structuredreturnedconfig: projectconfig,
            evaluationType: "project",
            apiKey: apiKey // Include user's API key
          };

          const resp = await fetch((import.meta.env.VITE_EVAL_API_URL || 'http://localhost:3001') + '/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectPayload),
          });

          const data = await resp.json();
          console.log('Project Evaluation Response:', JSON.stringify(data, null, 2));
          evaluationPayload = data.parsed ?? data;
          console.log('Project Evaluation Payload:', JSON.stringify(evaluationPayload, null, 2));

          if (!resp.ok) {
            console.error('Evaluation API error', data);
            setShowCelebration(false);
            dismiss(); // Dismiss the processing toast
            
            // Handle specific Gemini API errors
            let errorMessage = 'Evaluation API returned an error. See console for details.';
            if (data.status && data.message) {
              errorMessage = `Evaluation failed (${data.status}: ${data.statusText}). ${data.message}`;
            }
            
            setError(errorMessage);
            return;
          }
        }

        // Save evaluation to PostgreSQL database
        try {
          // Get current user from Supabase (for user ID only)
          const { supabase } = await import('@/integrations/supabase/client');
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            // Ensure evaluationPayload is properly structured
            //console.log('Evaluation payload before sending to DB:', JSON.stringify(evaluationPayload, null, 2));
            
            // Send data to PostgreSQL via our backend API
            const requestData = {
              userId: user.id,
              userEmail: user.email,
              videoUrl,
              evaluationData: {
                evaluation_result: evaluationPayload ?? {},
                video_type: videoType,
              },
              videoType,
              selectedPhase,
              selectedVideoTitle
            };
            
            //console.log('Sending request data to store evaluation:', JSON.stringify(requestData, null, 2));
            
            const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/store-evaluation';
            console.log('Calling API endpoint:', apiUrl);
            
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
            //console.log('Evaluation stored successfully:', result);
          }
        } catch (dbErr) {
          console.warn('Failed to save evaluation to PostgreSQL:', dbErr);
          // Don't return here - still navigate to results page even if DB save fails
        }

        setTimeout(() => {
          setShowCelebration(false);
          dismiss(); // Dismiss the processing toast before navigation
          // Log what we're sending to the results page
          //console.log('Navigating to results with evaluation:', JSON.stringify(evaluationPayload, null, 2));
          navigate('/analysis-results', { 
            state: { 
              videoUrl, 
              evaluation: evaluationPayload, 
              videoDetails: payload?.videoDetails,
              videoType,
              projectRubric,
              selectedPhase,
              selectedVideoTitle
            } 
          });
        }, 800);
      } catch (err: any) {
        console.error('Evaluation error', err);
        setShowCelebration(false);
        dismiss(); // Dismiss the processing toast on error
        setError('Evaluation failed. See console for details.');
      }
    })();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Celebration Effect */}
      <CelebrationEffect 
        show={showCelebration} 
        onComplete={() => setShowCelebration(false)}
        message="Mission Complete 🚀"
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
              <div className="flex gap-4">
                <Button
                  variant={videoType === "concept" ? "default" : "outline"}
                  size="lg"
                  onClick={() => {
                    setVideoType("concept");
                    setError("");
                  }}
                  className="flex-1"
                >
                  Concept Explanation
                </Button>
                <Button
                  variant={videoType === "project" ? "default" : "outline"}
                  size="lg"
                  onClick={() => {
                    setVideoType("project");
                    setError("");
                  }}
                  className="flex-1"
                >
                  Project Explanation
                </Button>
              </div>
            </div>

            {/* Phase Selection Dropdown */}
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

            {/* Video URL Input */}
            <div className="space-y-3">
              <Label className="text-xl font-black uppercase flex items-center gap-2">
                <Youtube className="w-6 h-6" />
                Video URL
              </Label>
              <Input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="font-mono text-lg placeholder:font-mono"
              />
            </div>
            {/* Error Display */}
            {error && (
              <div className="border-4 border-destructive bg-destructive/10 p-6 shadow-brutal">
                <p className="text-destructive font-black uppercase text-center">
                  ⚠️ {error}
                </p>
              </div>
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
              >
                🎯 ANALYZE VIDEO
              </Button>
            </motion.div>
          </div>
        </Card>
        </MotionWrapper>
      </main>

      <Footer />
    </div>
  );
};

export default VideoAnalyzer;
