import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Play, Video, Trash2 } from "lucide-react";
import { MotionWrapper } from "@/components/MotionWrapper";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AuthModal } from "@/components/AuthModal";
import { format } from "date-fns";

interface ConceptEvaluation {
  id: string;
  email: string;
  project_name: string;
  page_name: string;
  video_url: string;
  concept_explanation_accuracy: string;
  concept_explanation_feedback: string;
  ability_to_explain_evaluation: string;
  ability_to_explain_feedback: string;
  created_at: string;
  type: 'concept';
}

interface ProjectEvaluation {
  id: string;
  email: string;
  project_name: string;
  video_url: string;
  project_explanation_evaluation: string;
  project_explanation_feedback: string;
  project_explanation_evaluationjson: any;
  created_at: string;
  type: 'project';
}

type EvaluationRecord = ConceptEvaluation | ProjectEvaluation;

const History = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [evaluationHistory, setEvaluationHistory] = useState<EvaluationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authType, setAuthType] = useState<"login" | "signup">("login");

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    
    if (user) {
      fetchHistory(user.email!);
    } else {
      setLoading(false);
      setShowAuthModal(true);
    }
  };

  const fetchHistory = async (email: string) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      
      // Fetch concept evaluations
      const conceptResponse = await fetch(`${API_URL}/concept-history?email=${encodeURIComponent(email)}`);
      
      if (!conceptResponse.ok) {
        console.error('Concept history fetch failed:', await conceptResponse.text());
      }
      
      const conceptData = await conceptResponse.json();
      
      // Fetch project evaluations
      const projectResponse = await fetch(`${API_URL}/project-history?email=${encodeURIComponent(email)}`);
      
      if (!projectResponse.ok) {
        console.error('Project history fetch failed:', await projectResponse.text());
      }
      
      const projectData = await projectResponse.json();
      
      // Combine and sort by created_at
      const conceptRecords: ConceptEvaluation[] = (conceptData.data || []).map((item: any) => ({
        ...item,
        type: 'concept' as const
      }));
      
      const projectRecords: ProjectEvaluation[] = (projectData.data || []).map((item: any) => ({
        ...item,
        type: 'project' as const
      }));
      
      const allRecords = [...conceptRecords, ...projectRecords].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setEvaluationHistory(allRecords);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast({
        title: "Error",
        description: "Failed to load your analysis history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, type: 'concept' | 'project', e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const endpoint = type === 'concept' 
        ? `${API_URL}/concept-evaluation/${id}` 
        : `${API_URL}/project-evaluation/${id}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete evaluation');
      }
      
      setEvaluationHistory(prev => prev.filter(item => item.id !== id));
      
      toast({
        title: "Deleted! 🗑️",
        description: `${type === 'concept' ? 'Concept' : 'Project'} evaluation removed from history`,
      });
    } catch (error) {
      console.error('Error deleting analysis:', error);
      toast({
        title: "Error",
        description: "Failed to delete analysis",
        variant: "destructive",
      });
    }
  };

  const handleCardClick = (record: EvaluationRecord) => {
    if (record.type === 'concept') {
      const conceptRecord = record as ConceptEvaluation;
      
      // Parse the accuracy and ability data
      let accuracyData: any = {};
      let abilityData: any = {};
      
      try {
        // The concept_explanation_accuracy might be a number, string, or JSON
        let accuracyValue = conceptRecord.concept_explanation_accuracy;
        let accuracyFeedback = conceptRecord.concept_explanation_feedback;
        
        // Check if it's already a JSON object
        if (typeof accuracyValue === 'string') {
          try {
            // Try to parse as JSON first
            const parsed = JSON.parse(accuracyValue);
            if (parsed && typeof parsed === 'object') {
              accuracyData = parsed;
            } else {
              // It's a plain string or number, create the structure
              accuracyData = {
                "Accuracy Level": [{
                  "Accuracy Level": accuracyValue,
                  "Feedback": accuracyFeedback || ''
                }]
              };
            }
          } catch {
            // Not JSON, treat as a direct value (number or string like "85" or "85%")
            accuracyData = {
              "Accuracy Level": [{
                "Accuracy Level": accuracyValue,
                "Feedback": accuracyFeedback || ''
              }]
            };
          }
        } else if (typeof accuracyValue === 'number') {
          // Direct numeric value
          accuracyData = {
            "Accuracy Level": [{
              "Accuracy Level": `${accuracyValue}%`,
              "Feedback": accuracyFeedback || ''
            }]
          };
        } else if (accuracyValue && typeof accuracyValue === 'object') {
          // Already an object
          accuracyData = accuracyValue;
        } else {
          // Fallback
          accuracyData = {
            "Accuracy Level": [{
              "Accuracy Level": accuracyValue || '',
              "Feedback": accuracyFeedback || ''
            }]
          };
        }
      } catch (e) {
        console.error('Error parsing accuracy data:', e);
        // Fallback: create structure from feedback
        accuracyData = {
          "Accuracy Level": [{
            "Accuracy Level": conceptRecord.concept_explanation_accuracy || '',
            "Feedback": conceptRecord.concept_explanation_feedback || ''
          }]
        };
      }
      
      try {
        // Parse ability data - similar logic
        let abilityValue = conceptRecord.ability_to_explain_evaluation;
        let abilityFeedback = conceptRecord.ability_to_explain_feedback;
        
        if (typeof abilityValue === 'string') {
          try {
            const parsed = JSON.parse(abilityValue);
            if (parsed && typeof parsed === 'object') {
              abilityData = parsed;
            } else {
              abilityData = {
                "Ability to explain": [{
                  "Ability to explain": abilityValue,
                  "Feedback": abilityFeedback || ''
                }]
              };
            }
          } catch {
            abilityData = {
              "Ability to explain": [{
                "Ability to explain": abilityValue,
                "Feedback": abilityFeedback || ''
              }]
            };
          }
        } else if (abilityValue && typeof abilityValue === 'object') {
          abilityData = abilityValue;
        } else {
          abilityData = {
            "Ability to explain": [{
              "Ability to explain": abilityValue || '',
              "Feedback": abilityFeedback || ''
            }]
          };
        }
      } catch (e) {
        console.error('Error parsing ability data:', e);
        // Fallback: create structure from feedback
        abilityData = {
          "Ability to explain": [{
            "Ability to explain": conceptRecord.ability_to_explain_evaluation || '',
            "Feedback": conceptRecord.ability_to_explain_feedback || ''
          }]
        };
      }
      
      navigate('/analysis-results', {
        state: {
          videoUrl: conceptRecord.video_url,
          videoType: 'concept',
          projectType: conceptRecord.project_name || conceptRecord.page_name,
          selectedPhase: conceptRecord.project_name || '',
          selectedVideoTitle: conceptRecord.page_name || '',
          evaluation: {
            accuracy: accuracyData,
            abilityToExplain: abilityData
          },
          fromHistory: true
        }
      });
    } else {
      const projectRecord = record as ProjectEvaluation;
      
      // Parse the evaluation JSON
      let evaluationData: any = {};
      try {
        evaluationData = typeof projectRecord.project_explanation_evaluationjson === 'string'
          ? JSON.parse(projectRecord.project_explanation_evaluationjson)
          : projectRecord.project_explanation_evaluationjson;
      } catch (e) {
        console.error('Error parsing project evaluation:', e);
      }
      
      navigate('/analysis-results', {
        state: {
          videoUrl: projectRecord.video_url,
          videoType: 'project',
          projectType: projectRecord.project_name,
          selectedPhase: projectRecord.project_name || '',
          evaluation: evaluationData,
          fromHistory: true
        }
      });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return 'Recently';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-br from-primary/20 via-background via-50% to-accent/20">
        <Header />
        <main className="flex-1 relative z-10 flex items-center justify-center">
          <MotionWrapper delay={0.1} direction="zoom">
            <div className="text-center">
              <h2 className="text-3xl font-black mb-4">Login Required 🔐</h2>
              <p className="text-lg font-bold mb-4">Please sign in to view your analysis history</p>
            </div>
          </MotionWrapper>
        </main>
        <Footer />
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
          type={authType}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-br from-primary/20 via-background via-50% to-accent/20">
      <Header />

      <main className="flex-1 relative z-10">
        <section className="container mx-auto px-4 py-12">
          <MotionWrapper delay={0.1} direction="up">
            <h1 className="text-4xl md:text-6xl font-black uppercase text-center mb-4">
              Analysis History 📹
            </h1>
            <p className="text-center text-lg md:text-xl font-bold mb-12 max-w-2xl mx-auto">
              View all your previous video feedback analyses
            </p>
          </MotionWrapper>

          {loading ? (
            <div className="text-center py-20">
              <p className="text-xl font-bold">Loading your history... 📹</p>
            </div>
          ) : evaluationHistory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {evaluationHistory.map((record, index) => {
                const isConcept = record.type === 'concept';
                const title = isConcept 
                  ? (record as ConceptEvaluation).project_name || (record as ConceptEvaluation).page_name || 'Concept Evaluation'
                  : (record as ProjectEvaluation).project_name;
                const typeLabel = isConcept ? '📚 Concept' : '🚀 Project';
                
                return (
                  <MotionWrapper key={record.id} delay={0.1 + index * 0.05} direction="up">
                    <motion.div
                      whileHover={{ 
                        scale: 1.03, 
                        rotate: 1,
                        y: -5
                      }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", bounce: 0.4 }}
                      onClick={() => handleCardClick(record)}
                      className="relative"
                    >
                      <Card className="cursor-pointer group hover:shadow-brutal-lg transition-all duration-300">
                        <motion.button
                          onClick={(e) => handleDelete(record.id, record.type, e)}
                          className="absolute -top-2 -right-2 z-10 bg-destructive text-destructive-foreground p-2 border-2 border-foreground shadow-brutal-sm hover:shadow-none transition-all"
                          whileHover={{ scale: 1.1, rotate: 10 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                        <CardHeader>
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-6xl">{isConcept ? '📚' : '🚀'}</div>
                            <motion.div
                              whileHover={{ scale: 1.2, rotate: 90 }}
                              transition={{ duration: 0.3 }}
                            >
                              <Play className="w-8 h-8 text-primary" />
                            </motion.div>
                          </div>
                          <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-2">
                            {title}
                          </CardTitle>
                          <div className="mt-2">
                            <span className="inline-block bg-accent border-2 border-foreground px-3 py-1 text-xs font-black uppercase">
                              {typeLabel}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              <span className="font-bold">{formatDate(record.created_at)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </MotionWrapper>
                );
              })}
            </div>
          ) : (
            <MotionWrapper delay={0.3} direction="zoom">
              <div className="text-center py-20">
                <Video className="w-20 h-20 mx-auto mb-4 text-muted-foreground" />
                <p className="text-xl font-bold text-muted-foreground mb-4">
                  No analyses yet! 🎬
                </p>
                <p className="text-lg font-bold text-muted-foreground">
                  Start by analyzing your first video 🚀
                </p>
              </div>
            </MotionWrapper>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default History;
