import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trophy, Star, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { AnimatedHeading } from "@/components/AnimatedHeading";
import { MotionWrapper } from "@/components/MotionWrapper";
import { AnimatedIntroText } from "@/components/AnimatedIntroText";
import { CelebrationEffect } from "@/components/CelebrationEffect";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AnalysisResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [showCelebration, setShowCelebration] = useState(false);
  
  const analysisId = searchParams.get('id');
  const stateData = location.state;
  
  const { videoUrl, evaluationMethod, rubric, evaluation, videoType, selectedPhase, selectedVideoTitle } = stateData || {};
  
  const [showDetailedResults, setShowDetailedResults] = useState(videoType === 'project');
  const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedAnalysis, setLoadedAnalysis] = useState<any>(null);

  // Determine effective evaluation method (prefer route state, then DB fields)
  const effectiveMethod = evaluationMethod || loadedAnalysis?.analysis_data?.evaluationMethod || loadedAnalysis?.evaluation_method || 'rubric';

  // If loaded from DB, attempt to read stored fields
  const dbEvaluationRaw = loadedAnalysis?.evaluation_result || loadedAnalysis?.analysis_data;

  // Mock rubric data (from the HTML example)
  const Rubric = (Array.isArray(rubric) ? rubric : null) || (Array.isArray(loadedAnalysis?.rubric) ? loadedAnalysis.rubric : null) || [
    {
      " - Criteria": "1. Understanding the Problem / Problem Articulation",
      "Weightage (%)": 15,
      "Beginner (1)": "Very limited clarity: Student can name 1–2 pages but cannot explain their purpose",
      "Intermediate (2)": "Partial clarity: Student explains some pages' purpose but misses connections",
      "Advanced (3)": "Good clarity: Student explains all pages with purpose and connections",
      "Expert (4)": "Complete clarity: Student confidently explains purpose of all pages and project goal"
    },
    {
      " - Criteria": "2. Robustness of the Solution – Conceptual Clarity / Visual Appeal",
      "Weightage (%)": 70,
      "Beginner (1)": "Weak structure: Pages incomplete or missing; frequent misuse of tags",
      "Intermediate (2)": "Basic structure: Most pages exist; some tags misused",
      "Advanced (3)": "Strong structure: All required pages complete; correct tags used",
      "Expert (4)": "Exceptional structure: Website fully complete, robust, semantically consistent"
    },
    {
      " - Criteria": "3. Solution Explanation – Communication",
      "Weightage (%)": 15,
      "Beginner (1)": "Minimal explanation: Struggles to explain choices; relies on guesswork",
      "Intermediate (2)": "Basic explanation: Explains some choices but lacks depth",
      "Advanced (3)": "Clear explanation: Explains most tag choices with reasoning",
      "Expert (4)": "Insightful explanation: Explains all choices confidently with teaching-level clarity"
    }
  ];

  // Mock analysis results
  const mockAnalysis = {
    overallGrade: "B+ (85%)",
    criteria: [
      {
        title: "Understanding the Problem / Problem Articulation",
        weight: "15%",
        grade: "Intermediate (2)",
        feedback: "Partial clarity: Student explains some pages' purpose but misses connections or the overall project objective."
      },
      {
        title: "Robustness of the Solution – Conceptual Clarity / Visual Appeal",
        weight: "70%",
        grade: "Expert (4)",
        feedback: "Exceptional structure: Website fully complete, robust, semantically consistent; smooth navigation; best practices."
      },
      {
        title: "Solution Explanation – Communication",
        weight: "15%",
        grade: "Advanced (3)",
        feedback: "Clear explanation: Explains most tag choices with reasoning; demonstrates solid understanding."
      }
    ],
    overallFeedback: "This is a mock evaluation based on the provided rubric. In production, it would use API-based analysis."
  };

  // Normalise evaluation data from state or DB into a consistent structure
  const normalizeEvaluation = (maybeEval: any, videoType: string) => {
    if (!maybeEval) return null;

    // Handle concept explanation evaluations (different structure)
    if (videoType === 'concept') {
      // For concept explanations, we have two evaluations: accuracy and abilityToExplain
      const accuracyEval = maybeEval.accuracy;
      const abilityEval = maybeEval.abilityToExplain;
      
      // Extract accuracy data
      let accuracyScore = '';
      let accuracyFeedback = '';
      if (accuracyEval) {
        try {
          const parsedAccuracy = accuracyEval.parsed || accuracyEval;
          
          // Check if it's the new structured format with "Accuracy Level" array
          if (parsedAccuracy && parsedAccuracy["Accuracy Level"] && Array.isArray(parsedAccuracy["Accuracy Level"]) && parsedAccuracy["Accuracy Level"].length > 0) {
            const accuracyItem = parsedAccuracy["Accuracy Level"][0];
            accuracyScore = accuracyItem["Accuracy Level"] || '';
            
            // Handle structured feedback (new format)
            const feedbackObj = accuracyItem["Feedback"];
            if (typeof feedbackObj === 'object' && feedbackObj !== null) {
              // Store the structured feedback object
              accuracyFeedback = feedbackObj;
            } else if (typeof feedbackObj === 'string') {
              // Try to parse if it's a JSON string (from database)
              try {
                accuracyFeedback = JSON.parse(feedbackObj);
              } catch (e) {
                // If not JSON, just use the string
                accuracyFeedback = feedbackObj || '';
              }
            } else {
              accuracyFeedback = '';
            }
          }
          // Fallback to old format for backward compatibility
          else if (parsedAccuracy.criteria && parsedAccuracy.criteria.length > 0) {
            accuracyScore = parsedAccuracy.criteria[0].score || parsedAccuracy.overallScore || '';
            accuracyFeedback = parsedAccuracy.criteria[0].feedback || parsedAccuracy.overallFeedback || '';
          } 
          else {
            accuracyScore = parsedAccuracy.overallScore || '';
            accuracyFeedback = parsedAccuracy.overallFeedback || '';
          }
        } catch (e) {
          console.warn('Failed to parse accuracy evaluation:', e);
          accuracyScore = '';
          accuracyFeedback = '';
        }
      }
      
      // Extract ability to explain data
      let abilityLevel = '';
      let abilityFeedback = '';
      if (abilityEval) {
        try {
          const parsedAbility = abilityEval.parsed || abilityEval;
          
          // Check if it's the new structured format with "Ability to explain" array
          if (parsedAbility && parsedAbility["Ability to explain"] && Array.isArray(parsedAbility["Ability to explain"]) && parsedAbility["Ability to explain"].length > 0) {
            const abilityItem = parsedAbility["Ability to explain"][0];
            abilityLevel = abilityItem["Ability to explain"] || '';
            
            // Handle structured feedback (new format) - check both "Structured Feedback" and "Feedback" for compatibility
            const feedbackObj = abilityItem["Structured Feedback"] || abilityItem["Feedback"];
            if (typeof feedbackObj === 'object' && feedbackObj !== null) {
              // Store the structured feedback object
              abilityFeedback = feedbackObj;
            } else if (typeof feedbackObj === 'string') {
              // Try to parse if it's a JSON string (from database)
              try {
                abilityFeedback = JSON.parse(feedbackObj);
              } catch (e) {
                // If not JSON, just use the string
                abilityFeedback = feedbackObj || '';
              }
            } else {
              abilityFeedback = '';
            }
          }
          // Fallback to old format for backward compatibility
          else if (parsedAbility.criteria && parsedAbility.criteria.length > 0) {
            abilityLevel = parsedAbility.criteria[0].name || '';
            abilityFeedback = parsedAbility.criteria[0].feedback || parsedAbility.overallFeedback || '';
          } 
          else {
            abilityLevel = parsedAbility.level || '';
            abilityFeedback = parsedAbility.overallFeedback || '';
          }
        } catch (e) {
          console.warn('Failed to parse ability evaluation:', e);
          abilityLevel = '';
          abilityFeedback = '';
        }
      }
      
      return {
        isConceptEvaluation: true,
        accuracyScore,
        accuracyFeedback,
        abilityLevel,
        abilityFeedback
      };
    }

    // Handle project explanation evaluations with new structured format
    // The evaluation data should contain the parameters array
    const candidate = maybeEval?.parsed ?? maybeEval?.evaluation ?? maybeEval;

    // Check if it's the new structured format with "parameters" array
    if (candidate && Array.isArray(candidate.parameters)) {
      return {
        isConceptEvaluation: false,
        criteria: candidate.parameters.map((param: any) => {
          // Format weight as percentage
          let formattedWeight = param.weightage || param.weight || '';
          if (typeof formattedWeight === 'number') {
            formattedWeight = `${formattedWeight}%`;
          } else if (typeof formattedWeight === 'string' && formattedWeight !== '') {
            if (!formattedWeight.endsWith('%')) {
              formattedWeight = `${formattedWeight}%`;
            }
          }
          
          // Keep the structured feedback for project evaluations
          return {
            title: param.name || 'Parameter',
            weight: formattedWeight,
            grade: param.level || '',
            scoreNumeric: undefined,
            feedback: param.feedback || {},
            feedbackStructure: param.feedback ? {
              good: param.feedback["What you did well."] || param.feedback["What could you do well?"] || param.feedback.good || '',
              bad: param.feedback["What could you do better."] || param.feedback["What can you do better?"] || param.feedback.bad || '',
              ugly: param.feedback["Suggestion for project improvement."] || param.feedback["Next Suggested Deep Dive?"] || param.feedback.ugly || ''
            } : null
          };
        }),
        overallGrade: undefined,
        overallScore: undefined,
        overallFeedback: ''
      };
    }
    
    // Fallback: If candidate has criteria array (old format)
    if (candidate && Array.isArray(candidate.criteria)) {
      return {
        isConceptEvaluation: false,
        criteria: candidate.criteria.map((c: any) => {
          // Format weight as percentage if it's a decimal number
          let formattedWeight = c.weight || c.weightPercent || c.weight_pct || '';
          if (typeof formattedWeight === 'number' && !isNaN(formattedWeight)) {
            // If the weight is <= 1, it's likely a decimal (0.4), so convert to percentage (40%)
            // If the weight is > 1, it's likely already a percentage (40), so just add % sign
            formattedWeight = formattedWeight <= 1 
              ? `${(formattedWeight * 100).toFixed(0)}%` 
              : `${formattedWeight}%`;
          } else if (typeof formattedWeight === 'string' && formattedWeight !== '') {
            // If it's already a string but doesn't end with %, add it
            if (!formattedWeight.endsWith('%')) {
              formattedWeight = `${formattedWeight}%`;
            }
          }
          
          return {
            title: c.name || c.title || c.criteria || 'Criterion',
            weight: formattedWeight,
            grade: c.grade || (typeof c.score === 'number' ? `${c.score}` : c.score) || '',
            scoreNumeric: typeof c.score === 'number' ? c.score : (c.score && !isNaN(Number(c.score)) ? Number(c.score) : undefined),
            feedback: c.feedback || c.comment || c.explanation || ''
          };
        }),
        overallGrade: candidate.overallGrade || (typeof candidate.overallScore === 'number' ? `${candidate.overallScore}` : candidate.overallScore) || candidate.score || '',
        overallScore: typeof candidate.overallScore === 'number' ? candidate.overallScore : (candidate.score && !isNaN(Number(candidate.score)) ? Number(candidate.score) : undefined),
        overallFeedback: candidate.overallFeedback || candidate.overall_comments || ''
      };
    }

    return null;
  };

  const evaluated: ReturnType<typeof normalizeEvaluation> = normalizeEvaluation(stateData?.evaluation ?? dbEvaluationRaw, videoType);

  // Load analysis from database if ID is provided
  useEffect(() => {
    if (analysisId && !stateData) {
      loadAnalysisFromDatabase(analysisId);
    }
  }, [analysisId, stateData]);

  const loadAnalysisFromDatabase = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('video_analyses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setLoadedAnalysis(data);
      
      // Trigger celebration for loaded analysis
      setTimeout(() => {
        setShowCelebration(true);
      }, 800);
    } catch (error) {
      console.error('Error loading analysis:', error);
      toast({
        title: "Error",
        description: "Failed to load analysis",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Trigger celebration when results load
  // Note: Data is already saved in VideoAnalyzer before navigation
  useEffect(() => {
    if (stateData && !stateData.fromHistory) {
      const timer = setTimeout(() => {
        setShowCelebration(true);
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [stateData]);

  // Note: saveAnalysis function removed - data is already saved in VideoAnalyzer before navigation
  // This prevents duplicate database entries

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="p-12 text-center max-w-2xl">
            <h1 className="text-4xl font-black uppercase mb-6">Loading Analysis... 📊</h1>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (!stateData && !loadedAnalysis) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="p-12 text-center max-w-2xl">
            <h1 className="text-4xl font-black uppercase mb-6">No Analysis Data</h1>
            <p className="text-xl font-bold mb-8">Please analyze a video first!</p>
            <Button onClick={() => navigate("/video-analyzer")} size="lg">
              Go to Analyzer
            </Button>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const getGradeColor = (grade: string) => {
    if (grade.startsWith("A")) return "text-secondary";
    if (grade.startsWith("B")) return "text-primary";
    return "text-accent";
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Celebration Effect */}
      <CelebrationEffect 
        show={showCelebration} 
        onComplete={() => setShowCelebration(false)}
        message="You Nailed It! 🎯"
      />
      
      <Header />
      
      <main className="container mx-auto px-4 py-12 flex-1">
        {/* Back Button */}
        <MotionWrapper delay={0} direction="left">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => navigate("/video-analyzer")}
              variant="outline"
              size="lg"
              className="mb-8"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              New Analysis
            </Button>
          </motion.div>
        </MotionWrapper>

        {/* Hero Section */}
        <div className="text-center mb-12">
          <AnimatedIntroText 
            text="✨ Your Feedback Results are Ready!" 
            direction="zoom" 
            delay={0.1}
          />
          <AnimatedHeading className="text-5xl md:text-7xl font-black uppercase mb-4" delay={0.3}>
            Analysis <span className="text-primary">Complete!</span>
          </AnimatedHeading>
          
          <MotionWrapper delay={0.5} direction="up">
            <div className="flex flex-wrap gap-3 justify-center items-center text-lg font-bold">
              {videoType === 'concept' && selectedPhase && selectedVideoTitle && (
                <motion.span 
                  className="bg-card border-2 border-foreground px-4 py-2"
                  whileHover={{ scale: 1.1, rotate: -2 }}
                >
                  {selectedPhase} - {selectedVideoTitle}
                </motion.span>
              )}
              {videoType === 'project' && selectedPhase && (
                <motion.span 
                  className="bg-card border-2 border-foreground px-4 py-2"
                  whileHover={{ scale: 1.1, rotate: -2 }}
                >
                  {selectedPhase}
                </motion.span>
              )}
            </div>
          </MotionWrapper>
        </div>

        {/* Video URL Display */}
        <MotionWrapper delay={0.6} direction="up">
          <Card className="max-w-6xl mx-auto p-6 mb-8">
            <p className="font-bold text-sm uppercase mb-2">📺 Video Analyzed:</p>
            <p className="break-all text-lg">{videoUrl}</p>
          </Card>
        </MotionWrapper>

        {/* Rubric Cards - Modern & Creative */}
        {videoType !== 'concept' && videoType !== 'project' && effectiveMethod !== 'rating' && (
          <MotionWrapper delay={0.7} direction="up">
            <div className="max-w-6xl mx-auto mb-12">
              <h2 className="text-4xl font-black uppercase mb-8 text-center">
                📋 Rubric <span className="text-primary">Evaluation</span>
              </h2>
              
              <div className="grid gap-6">
                {Rubric.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + index * 0.1 }}
                    whileHover={{ scale: 1.02, x: 10 }}
                  >
                    <Card className="p-6 bg-gradient-to-r from-card via-primary/5 to-card">
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Left: Criteria & Weight */}
                        <div className="flex-shrink-0 md:w-1/3">
                          <div className="bg-primary border-4 border-foreground p-4 shadow-brutal-sm mb-4">
                            <h3 className="text-lg font-black uppercase mb-2">Criteria {index + 1}</h3>
                            <p className="font-bold">{item[" - Criteria"]}</p>
                          </div>
                          <div className="bg-secondary border-4 border-foreground p-4 text-center shadow-brutal-sm">
                            <p className="text-sm font-bold uppercase mb-1">Weight</p>
                            <p className="text-3xl font-black">
                              {typeof item["Weightage (%)"] === 'number' && !isNaN(item["Weightage (%)"])
                                ? `${item["Weightage (%)"]}%`
                                : (typeof item["Weight (%)"] === 'number' && !isNaN(item["Weight (%)"])
                                  ? (item["Weight (%)"] <= 1 
                                      ? `${(item["Weight (%)"] * 100).toFixed(0)}%` 
                                      : `${item["Weight (%)"]}%`)
                                  : (item["Weightage (%)"] || item["Weight (%)"] || 'N/A'))}
                            </p>
                          </div>
                        </div>
                        
                        {/* Right: Levels Grid */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { level: "Beginner (1)", desc: item["Beginner (1)"], emoji: "🌱", color: "bg-accent/20" },
                            { level: "Intermediate (2)", desc: item["Intermediate (2)"], emoji: "🔥", color: "bg-secondary/20" },
                            { level: "Advanced (3)", desc: item["Advanced (3)"], emoji: "⚡", color: "bg-primary/20" },
                            { level: "Expert (4)", desc: item["Expert (4)"], emoji: "🏆", color: "bg-accent/30" }
                          ].map((levelData, i) => (
                            <motion.div
                              key={i}
                              whileHover={{ scale: 1.05 }}
                              className={`${levelData.color} border-2 border-foreground p-3 shadow-brutal-sm`}
                            >
                              <p className="text-sm font-black uppercase mb-1 flex items-center gap-2">
                                <span>{levelData.emoji}</span>
                                {levelData.level}
                              </p>
                              <p className="text-xs font-medium leading-relaxed">{levelData.desc}</p>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </MotionWrapper>
        )}

        {/* Evaluation Points for Rating Mode */}
        {videoType !== 'concept' && effectiveMethod === 'rating' && stateData?.evaluationPoints && (
          <MotionWrapper delay={0.7} direction="up">
            <div className="max-w-6xl mx-auto mb-12">
              <h2 className="text-4xl font-black uppercase mb-8 text-center">
                📋 Evaluation <span className="text-primary">Points</span>
              </h2>
              
              <div className="grid gap-4">
                {stateData.evaluationPoints.split(/\r?\n/).map((point: string, index: number) => (
                  point.trim() && (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -50 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + index * 0.1 }}
                      whileHover={{ scale: 1.02, x: 10 }}
                    >
                      <Card className="p-6 bg-gradient-to-r from-card via-primary/5 to-card">
                        <div className="flex items-start gap-4">
                          <div className="bg-primary border-4 border-foreground w-12 h-12 flex items-center justify-center shadow-brutal-sm flex-shrink-0 mt-1">
                            <span className="text-xl font-black">{index + 1}</span>
                          </div>
                          <div className="font-bold text-lg pt-1">{point.trim()}</div>
                        </div>
                      </Card>
                    </motion.div>
                  )
                ))}
              </div>
            </div>
          </MotionWrapper>
        )}

        {/* Concept Explanation Results */}
        {videoType === 'concept' && evaluated?.isConceptEvaluation && (
          <MotionWrapper delay={1} direction="zoom">
            <div className="max-w-4xl mx-auto mb-8">
              <h2 className="text-4xl font-black uppercase mb-8 text-center">
                🎯 Concept <span className="text-secondary">Evaluation</span>
              </h2>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Accuracy Card */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="bg-gradient-to-br from-primary to-blue-500 border-4 border-foreground p-8 shadow-brutal-xl"
                >
                  <div className="text-center">
                    <Trophy className="w-16 h-16 mx-auto mb-4" />
                    <p className="text-2xl font-black uppercase mb-2">Accuracy &gt; 80%?</p>
                    <p className="text-5xl font-black text-foreground">
                      {(() => {
                        const score = evaluated?.accuracyScore;
                        if (!score) return 'N/A';
                        const numericScore = typeof score === 'string' ? parseFloat(score.replace('%', '')) : score;
                        return numericScore >= 80 ? 'Yes' : 'No';
                      })()}
                    </p>
                  </div>
                </motion.div>
                
                {/* Ability to Explain Card */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="bg-gradient-to-br from-secondary to-purple-500 border-4 border-foreground p-8 shadow-brutal-xl"
                >
                  <div className="text-center">
                    <Star className="w-16 h-16 mx-auto mb-4" />
                    <p className="text-2xl font-black uppercase mb-2">Ability to Explain</p>
                    <p className="text-3xl font-black text-foreground">{evaluated.abilityLevel || 'N/A'}</p>
                  </div>
                </motion.div>
              </div>
            </div>
          </MotionWrapper>
        )}
        
        {/* Detailed Feedback for Concept Evaluations */}
        {videoType === 'concept' && evaluated?.isConceptEvaluation && (
          <MotionWrapper delay={1.2} direction="up">
            <div className="max-w-6xl mx-auto mb-8 grid gap-6 md:grid-cols-2">
              {/* Accuracy Feedback */}
              {evaluated.accuracyFeedback && typeof evaluated.accuracyFeedback === 'object' && (
                <Card className="p-8 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                  <h3 className="text-2xl font-black uppercase mb-6 flex items-center gap-2">
                    <Trophy className="w-8 h-8" />
                    Accuracy Feedback
                  </h3>
                  <div className="space-y-4">
                    {evaluated.accuracyFeedback?.["What you did well."] && (
                      <div className="bg-green-500/10 border-l-4 border-green-500 p-4">
                        <h4 className="text-lg font-black uppercase mb-2 flex items-center gap-2">
                          <span>✓</span> What you did well
                        </h4>
                        {Array.isArray(evaluated.accuracyFeedback["What you did well."]) ? (
                          <ul className="list-disc list-inside space-y-2">
                            {evaluated.accuracyFeedback["What you did well."].map((point: string, idx: number) => (
                              <li key={idx} className="text-base font-medium leading-relaxed">{point}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-base font-medium leading-relaxed">{evaluated.accuracyFeedback["What you did well."]}</p>
                        )}
                      </div>
                    )}
                    {evaluated.accuracyFeedback?.["What could you do better."] && (
                      <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-4">
                        <h4 className="text-lg font-black uppercase mb-2 flex items-center gap-2">
                          <span>⚠</span> What could you do better
                        </h4>
                        {Array.isArray(evaluated.accuracyFeedback["What could you do better."]) ? (
                          <ul className="list-disc list-inside space-y-2">
                            {evaluated.accuracyFeedback["What could you do better."].map((point: string, idx: number) => (
                              <li key={idx} className="text-base font-medium leading-relaxed">{point}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-base font-medium leading-relaxed">{evaluated.accuracyFeedback["What could you do better."]}</p>
                        )}
                      </div>
                    )}
                    {evaluated.accuracyFeedback?.["Suggestion for technical accuracy improvement."] && (
                      <div className="bg-blue-500/10 border-l-4 border-blue-500 p-4">
                        <h4 className="text-lg font-black uppercase mb-2 flex items-center gap-2">
                          <span>🎯</span> Suggestion for technical accuracy improvement
                        </h4>
                        {Array.isArray(evaluated.accuracyFeedback["Suggestion for technical accuracy improvement."]) ? (
                          <ul className="list-disc list-inside space-y-2">
                            {evaluated.accuracyFeedback["Suggestion for technical accuracy improvement."].map((point: string, idx: number) => (
                              <li key={idx} className="text-base font-medium leading-relaxed">{point}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-base font-medium leading-relaxed">{evaluated.accuracyFeedback["Suggestion for technical accuracy improvement."]}</p>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              )}
              
              {/* Ability to Explain Feedback */}
              {evaluated.abilityFeedback && typeof evaluated.abilityFeedback === 'object' && (
                <Card className="p-8 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                  <h3 className="text-2xl font-black uppercase mb-6 flex items-center gap-2">
                    <Star className="w-8 h-8" />
                    Ability Feedback
                  </h3>
                  <div className="space-y-4">
                    {evaluated.abilityFeedback?.["What you did well."] && (
                      <div className="bg-green-500/10 border-l-4 border-green-500 p-4">
                        <h4 className="text-lg font-black uppercase mb-2 flex items-center gap-2">
                          <span>✓</span> What you did well
                        </h4>
                        {Array.isArray(evaluated.abilityFeedback["What you did well."]) ? (
                          <ul className="list-disc list-inside space-y-2">
                            {evaluated.abilityFeedback["What you did well."].map((point: string, idx: number) => (
                              <li key={idx} className="text-base font-medium leading-relaxed">{point}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-base font-medium leading-relaxed">{evaluated.abilityFeedback["What you did well."]}</p>
                        )}
                      </div>
                    )}
                    {evaluated.abilityFeedback?.["What could you do better."] && (
                      <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-4">
                        <h4 className="text-lg font-black uppercase mb-2 flex items-center gap-2">
                          <span>⚠</span> What could you do better
                        </h4>
                        {Array.isArray(evaluated.abilityFeedback["What could you do better."]) ? (
                          <ul className="list-disc list-inside space-y-2">
                            {evaluated.abilityFeedback["What could you do better."].map((point: string, idx: number) => (
                              <li key={idx} className="text-base font-medium leading-relaxed">{point}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-base font-medium leading-relaxed">{evaluated.abilityFeedback["What could you do better."]}</p>
                        )}
                      </div>
                    )}
                    {evaluated.abilityFeedback?.["Suggestion for improving explanation."] && (
                      <div className="bg-purple-500/10 border-l-4 border-purple-500 p-4">
                        <h4 className="text-lg font-black uppercase mb-2 flex items-center gap-2">
                          <span>🎯</span> Suggestion for improving explanation
                        </h4>
                        {Array.isArray(evaluated.abilityFeedback["Suggestion for improving explanation."]) ? (
                          <ul className="list-disc list-inside space-y-2">
                            {evaluated.abilityFeedback["Suggestion for improving explanation."].map((point: string, idx: number) => (
                              <li key={idx} className="text-base font-medium leading-relaxed">{point}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-base font-medium leading-relaxed">{evaluated.abilityFeedback["Suggestion for improving explanation."]}</p>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </MotionWrapper>
        )}
        
        {/* Project Explanation Results - Hide for project type */}
        {videoType !== 'concept' && videoType !== 'project' && (
          <MotionWrapper delay={1} direction="zoom">
            <div className="max-w-4xl mx-auto mb-8">
              <h2 className="text-4xl font-black uppercase mb-8 text-center">
                🎯 Your <span className="text-secondary">Score</span>
              </h2>
              <motion.div
                whileHover={{ scale: 1.02, rotate: -0.5 }}
                className="bg-gradient-to-br from-primary via-secondary to-accent border-4 border-foreground p-12 shadow-brutal-xl"
              >
                <div className="flex items-center justify-center gap-8 flex-wrap">
                  {effectiveMethod === 'rating' ? (
                    <>
                      <div className="text-center">
                        <Trophy className="w-20 h-20 mx-auto mb-4" />
                        <p className="text-2xl font-black uppercase mb-2">Rating Summary</p>
                        <p className="text-3xl font-black text-foreground">See Evaluation Points Below</p>
                      </div>
                      <div className="bg-card border-4 border-foreground p-6 shadow-brutal-sm min-w-[200px]">
                        <div className="flex items-center gap-3 mb-3">
                          <TrendingUp className="w-6 h-6" />
                          <p className="text-lg font-black uppercase">Stats</p>
                        </div>
                        <div className="space-y-2 text-center">
                          <p className="text-xl font-bold">🔥 Rating Mode</p>
                          <p className="text-xl font-bold">📋 Evaluation Points</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-center">
                        <Trophy className="w-20 h-20 mx-auto mb-4" />
                        <p className="text-2xl font-black uppercase mb-2">Overall Grade</p>
                        <p className="text-7xl font-black text-foreground">{evaluated?.overallGrade ?? mockAnalysis.overallGrade}</p>
                      </div>
                      <div className="bg-card border-4 border-foreground p-6 shadow-brutal-sm min-w-[200px]">
                        <div className="flex items-center gap-3 mb-3">
                          <TrendingUp className="w-6 h-6" />
                          <p className="text-lg font-black uppercase">Stats</p>
                        </div>
                        <div className="space-y-2 text-center">
                          <p className="text-xl font-bold">🔥 Top Tier</p>
                          <p className="text-xl font-bold">🏅 {evaluated?.overallGrade ?? mockAnalysis.overallGrade}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          </MotionWrapper>
        )}

        {/* Continue Button - Expandable */}
        {/* {videoType !== 'project' && (
          <MotionWrapper delay={1.2} direction="up">
            <div className="max-w-4xl mx-auto mb-12">
              <motion.button
                onClick={() => setShowDetailedResults(!showDetailedResults)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full bg-accent border-4 border-foreground p-8 shadow-brutal-lg hover:translate-x-2 hover:translate-y-2 hover:[box-shadow:8px_8px_0px_0px_rgba(13,13,13,1),0_0_40px_hsl(var(--accent)/0.9)] transition-all"
              >
                <div className="flex items-center justify-center gap-4 text-3xl font-black uppercase">
                  <span>{showDetailedResults ? "Hide Details" : "Continue 🔥"}</span>
                  {showDetailedResults ? <ChevronUp className="w-10 h-10" /> : <ChevronDown className="w-10 h-10" />}
                </div>
                <p className="text-lg font-bold mt-2">
                  {showDetailedResults ? "Collapse evaluation details" : "View detailed evaluation breakdown 📋"}
                </p>
              </motion.button>
            </div>
          </MotionWrapper>
        )}  */}

        {/* Detailed Analysis - Expandable Section */}
        <AnimatePresence>
          {(showDetailedResults || videoType === 'project') && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-6xl mx-auto mb-12 overflow-hidden"
            >
              <div className="space-y-8">
                <MotionWrapper delay={0.2} direction="zoom">
                  <h2 className="text-4xl font-black uppercase text-center mb-8">
                    {videoType === 'project' ? '📋 Detailed Breakdown' : videoType === 'concept' ? '📋 Concept Evaluation' : effectiveMethod === 'rating' ? '📋 Evaluation Points' : '💡 Detailed'} {videoType !== 'project' && <span className="text-accent">Breakdown</span>}
                  </h2>
                </MotionWrapper>

                {/* Confetti Effect on Expand */}
                <CelebrationEffect 
                  show={showDetailedResults} 
                  onComplete={() => {}}
                  message="Let's Dive In! 🎉"
                />
                
                {videoType === 'concept' && evaluated?.isConceptEvaluation ? (
                  <div className="text-center">
                    <p className="text-xl font-bold">Concept explanation evaluations are displayed above.</p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {(evaluated?.criteria ?? mockAnalysis.criteria).map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.1 }}
                        whileHover={{ scale: 1.02, x: 10 }}
                      >
                        <Card className="p-8 bg-gradient-to-r from-card to-muted/30">
                          {effectiveMethod === 'rating' ? (
                            <div className="flex items-center gap-6 justify-between">
                              <div className="flex-1">
                                <h3 className="text-2xl font-black uppercase mb-2">{item.title}</h3>
                                <p className="text-md font-medium leading-relaxed">{item.feedback}</p>
                              </div>
                              <div className="ml-6 text-center">
                                <p className="text-sm font-bold uppercase mb-2">Score</p>
                                <p className="text-6xl font-black">{item.scoreNumeric ?? item.grade ?? '—'}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col lg:flex-row gap-6">
                              <div className="flex-1">
                                <h3 className="text-2xl font-black uppercase mb-4 flex items-center gap-2">
                                  <span>{index === 0 ? "🎯" : index === 1 ? "🔥" : "✨"}</span>
                                  {item.title}
                                </h3>
                                <div className="mb-4">
                                  <span className="bg-accent border-2 border-foreground px-4 py-2 inline-block text-lg font-black uppercase shadow-brutal-sm">
                                    Grade: {item.grade}
                                  </span>
                                </div>
                                
                                {/* Show structured feedback for project evaluations */}
                                {videoType === 'project' && item.feedbackStructure ? (
                                  <div className="space-y-4">
                                    {item.feedbackStructure.good && (
                                      <div className="bg-green-500/10 border-l-4 border-green-500 p-4">
                                        <h4 className="text-lg font-black uppercase mb-2 flex items-center gap-2">
                                          <span>✓</span> What you did well
                                        </h4>
                                        {Array.isArray(item.feedbackStructure.good) ? (
                                          <ul className="list-disc list-inside space-y-2">
                                            {item.feedbackStructure.good.map((point: string, idx: number) => (
                                              <li key={idx} className="text-base font-medium leading-relaxed">{point}</li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="text-base font-medium leading-relaxed">{item.feedbackStructure.good}</p>
                                        )}
                                      </div>
                                    )}
                                    {item.feedbackStructure.bad && (
                                      <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-4">
                                        <h4 className="text-lg font-black uppercase mb-2 flex items-center gap-2">
                                          <span>⚠</span> What could you do better
                                        </h4>
                                        {Array.isArray(item.feedbackStructure.bad) ? (
                                          <ul className="list-disc list-inside space-y-2">
                                            {item.feedbackStructure.bad.map((point: string, idx: number) => (
                                              <li key={idx} className="text-base font-medium leading-relaxed">{point}</li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="text-base font-medium leading-relaxed">{item.feedbackStructure.bad}</p>
                                        )}
                                      </div>
                                    )}
                                    {item.feedbackStructure.ugly && (
                                      <div className="bg-blue-500/10 border-l-4 border-blue-500 p-4">
                                        <h4 className="text-lg font-black uppercase mb-2 flex items-center gap-2">
                                          <span>🎯</span> Suggestion for project improvement
                                        </h4>
                                        {Array.isArray(item.feedbackStructure.ugly) ? (
                                          <ul className="list-disc list-inside space-y-2">
                                            {item.feedbackStructure.ugly.map((point: string, idx: number) => (
                                              <li key={idx} className="text-base font-medium leading-relaxed">{point}</li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="text-base font-medium leading-relaxed">{item.feedbackStructure.ugly}</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-lg font-medium leading-relaxed">{typeof item.feedback === 'string' ? item.feedback : ''}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Overall Feedback - Hide for project evaluations */}
        {videoType !== 'project' && videoType !== 'concept' && (
        <MotionWrapper delay={1.3} direction="zoom">
          <div className="max-w-4xl mx-auto mb-12">
            <motion.div whileHover={{ scale: 1.02 }}>
              <Card className="p-8 bg-accent/10 border-l-8 border-l-accent">
                <h3 className="text-2xl font-black uppercase mb-4 flex items-center gap-2">
                  <Star className="w-8 h-8" /> Overall Feedback
                </h3>
                {videoType === 'concept' && evaluated?.isConceptEvaluation ? (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xl font-black mb-2">Accuracy Feedback</h4>
                      {typeof evaluated.accuracyFeedback === 'object' && evaluated.accuracyFeedback !== null ? (
                        <div className="space-y-2">
                          {evaluated.accuracyFeedback?.["What you did well."] && (
                            <div className="mb-2">
                              <p className="text-lg font-bold">✓ <strong>Well:</strong></p>
                              {Array.isArray(evaluated.accuracyFeedback["What you did well."]) ? (
                                <ul className="list-disc list-inside ml-4">
                                  {evaluated.accuracyFeedback["What you did well."].map((point: string, idx: number) => (
                                    <li key={idx}>{point}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="ml-4">{evaluated.accuracyFeedback["What you did well."]}</p>
                              )}
                            </div>
                          )}
                          {evaluated.accuracyFeedback?.["What could you do better."] && (
                            <div className="mb-2">
                              <p className="text-lg font-bold">⚠ <strong>Better:</strong></p>
                              {Array.isArray(evaluated.accuracyFeedback["What could you do better."]) ? (
                                <ul className="list-disc list-inside ml-4">
                                  {evaluated.accuracyFeedback["What could you do better."].map((point: string, idx: number) => (
                                    <li key={idx}>{point}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="ml-4">{evaluated.accuracyFeedback["What could you do better."]}</p>
                              )}
                            </div>
                          )}
                          {evaluated.accuracyFeedback?.["Suggestion for technical accuracy improvement."] && (
                            <div className="mb-2">
                              <p className="text-lg font-bold">🎯 <strong>Next:</strong></p>
                              {Array.isArray(evaluated.accuracyFeedback["Suggestion for technical accuracy improvement."]) ? (
                                <ul className="list-disc list-inside ml-4">
                                  {evaluated.accuracyFeedback["Suggestion for technical accuracy improvement."].map((point: string, idx: number) => (
                                    <li key={idx}>{point}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="ml-4">{evaluated.accuracyFeedback["Suggestion for technical accuracy improvement."]}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-lg font-bold">{evaluated.accuracyFeedback || 'No feedback available'}</p>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xl font-black mb-2">Ability to Explain Feedback</h4>
                      {typeof evaluated.abilityFeedback === 'object' && evaluated.abilityFeedback !== null ? (
                        <div className="space-y-2">
                          {evaluated.abilityFeedback?.["What you did well."] && (
                            <div className="mb-2">
                              <p className="text-lg font-bold">✓ <strong>Well:</strong></p>
                              {Array.isArray(evaluated.abilityFeedback["What you did well."]) ? (
                                <ul className="list-disc list-inside ml-4">
                                  {evaluated.abilityFeedback["What you did well."].map((point: string, idx: number) => (
                                    <li key={idx}>{point}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="ml-4">{evaluated.abilityFeedback["What you did well."]}</p>
                              )}
                            </div>
                          )}
                          {evaluated.abilityFeedback?.["What could you do better."] && (
                            <div className="mb-2">
                              <p className="text-lg font-bold">⚠ <strong>Better:</strong></p>
                              {Array.isArray(evaluated.abilityFeedback["What could you do better."]) ? (
                                <ul className="list-disc list-inside ml-4">
                                  {evaluated.abilityFeedback["What could you do better."].map((point: string, idx: number) => (
                                    <li key={idx}>{point}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="ml-4">{evaluated.abilityFeedback["What could you do better."]}</p>
                              )}
                            </div>
                          )}
                          {evaluated.abilityFeedback?.["Suggestion for improving explanation."] && (
                            <div className="mb-2">
                              <p className="text-lg font-bold">🎯 <strong>Next:</strong></p>
                              {Array.isArray(evaluated.abilityFeedback["Suggestion for improving explanation."]) ? (
                                <ul className="list-disc list-inside ml-4">
                                  {evaluated.abilityFeedback["Suggestion for improving explanation."].map((point: string, idx: number) => (
                                    <li key={idx}>{point}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="ml-4">{evaluated.abilityFeedback["Suggestion for improving explanation."]}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-lg font-bold">{evaluated.abilityFeedback || 'No feedback available'}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-lg font-bold">{evaluated?.overallFeedback ?? mockAnalysis.overallFeedback}</p>
                )}
              </Card>
            </motion.div>
          </div>
        </MotionWrapper>
        )}

        {/* Action Buttons */}
        <MotionWrapper delay={1.4} direction="up">
          <div className="max-w-4xl mx-auto mt-12 flex gap-4 flex-wrap justify-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => navigate("/video-analyzer")}
                variant="default"
                size="lg"
              >
                Analyze Another Video
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => window.print()}
                variant="secondary"
                size="lg"
              >
                Export Results
              </Button>
            </motion.div>
          </div>
        </MotionWrapper>
      </main>

      <Footer />
    </div>
  );
};

export default AnalysisResults;
