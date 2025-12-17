/**
 * @fileoverview All Evaluations Page - Admin view to see all student evaluations
 * @module pages/AllEvaluations
 */

import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Clock, 
  Play, 
  Video, 
  Search, 
  Users, 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  ArrowUpDown
} from "lucide-react";
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

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface StatsInfo {
  totalEvaluations: number;
  uniqueStudents: number;
  conceptCount: number;
  projectCount: number;
}

const AllEvaluations = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authType, setAuthType] = useState<"login" | "signup">("login");
  
  // Filters and pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "concept" | "project">("all");
  const [sortBy, setSortBy] = useState<"created_at" | "email" | "project_name">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0
  });
  const [stats, setStats] = useState<StatsInfo>({
    totalEvaluations: 0,
    uniqueStudents: 0,
    conceptCount: 0,
    projectCount: 0
  });

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchAllEvaluations();
    }
  }, [user, currentPage, filterType, sortBy, sortOrder]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (user) {
        setCurrentPage(1);
        fetchAllEvaluations();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    
    if (!user) {
      setLoading(false);
      setShowAuthModal(true);
    }
  };

  const fetchAllEvaluations = async () => {
    try {
      setLoading(true);
      // Use relative URL in development (proxied by Vite) or absolute URL in production
      const API_URL = import.meta.env.PROD 
        ? (import.meta.env.VITE_API_URL || 'http://localhost:3001')
        : '';
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '12',
        type: filterType,
        sortBy,
        sortOrder,
        ...(searchTerm && { search: searchTerm })
      });
      
      const response = await fetch(`${API_URL}/all-evaluations?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch evaluations');
      }
      
      const data = await response.json();
      
      setEvaluations(data.data || []);
      setPagination(data.pagination);
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching all evaluations:', error);
      toast({
        title: "Error",
        description: "Failed to load evaluations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (record: EvaluationRecord) => {
    if (record.type === 'concept') {
      const conceptRecord = record as ConceptEvaluation;
      
      let accuracyData: any = {};
      let abilityData: any = {};
      
      try {
        let accuracyValue = conceptRecord.concept_explanation_accuracy;
        let accuracyFeedback = conceptRecord.concept_explanation_feedback;
        
        if (typeof accuracyValue === 'string') {
          try {
            const parsed = JSON.parse(accuracyValue);
            if (parsed && typeof parsed === 'object') {
              accuracyData = parsed;
            } else {
              accuracyData = {
                "Accuracy Level": [{
                  "Accuracy Level": accuracyValue,
                  "Feedback": accuracyFeedback || ''
                }]
              };
            }
          } catch {
            accuracyData = {
              "Accuracy Level": [{
                "Accuracy Level": accuracyValue,
                "Feedback": accuracyFeedback || ''
              }]
            };
          }
        } else if (typeof accuracyValue === 'number') {
          accuracyData = {
            "Accuracy Level": [{
              "Accuracy Level": `${accuracyValue}%`,
              "Feedback": accuracyFeedback || ''
            }]
          };
        } else {
          accuracyData = {
            "Accuracy Level": [{
              "Accuracy Level": accuracyValue || '',
              "Feedback": accuracyFeedback || ''
            }]
          };
        }
      } catch (e) {
        console.error('Error parsing accuracy data:', e);
        accuracyData = {
          "Accuracy Level": [{
            "Accuracy Level": conceptRecord.concept_explanation_accuracy || '',
            "Feedback": conceptRecord.concept_explanation_feedback || ''
          }]
        };
      }
      
      try {
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
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch {
      return 'Recently';
    }
  };

  const getStudentName = (email: string) => {
    return email.split('@')[0];
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-br from-primary/20 via-background via-50% to-accent/20">
        <Header />
        <main className="flex-1 relative z-10 flex items-center justify-center">
          <MotionWrapper delay={0.1} direction="zoom">
            <div className="text-center">
              <h2 className="text-3xl font-black mb-4">Login Required 🔐</h2>
              <p className="text-lg font-bold mb-4">Please sign in to view all evaluations</p>
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
          {/* Header */}
          <MotionWrapper delay={0.1} direction="up">
            <h1 className="text-4xl md:text-6xl font-black uppercase text-center mb-4">
              All Student Evaluations 📊
            </h1>
            <p className="text-center text-lg md:text-xl font-bold mb-8 max-w-2xl mx-auto">
              View and manage all video feedback evaluations
            </p>
          </MotionWrapper>

          {/* Stats Cards */}
          <MotionWrapper delay={0.2} direction="up">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-8">
              <Card className="text-center">
                <CardContent className="pt-4">
                  <div className="text-3xl font-black text-primary">{stats.totalEvaluations}</div>
                  <div className="text-sm font-bold text-muted-foreground">Total Evaluations</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-4">
                  <div className="text-3xl font-black text-primary">{stats.uniqueStudents}</div>
                  <div className="text-sm font-bold text-muted-foreground">Students</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-4">
                  <div className="text-3xl font-black text-blue-500">{stats.conceptCount}</div>
                  <div className="text-sm font-bold text-muted-foreground">Concept Videos</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-4">
                  <div className="text-3xl font-black text-green-500">{stats.projectCount}</div>
                  <div className="text-sm font-bold text-muted-foreground">Project Videos</div>
                </CardContent>
              </Card>
            </div>
          </MotionWrapper>

          {/* Filters */}
          <MotionWrapper delay={0.3} direction="up">
            <div className="flex flex-col md:flex-row gap-4 max-w-4xl mx-auto mb-8">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search by email or project name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 font-bold"
                />
              </div>
              
              {/* Type Filter */}
              <div className="flex gap-2">
                <Button
                  variant={filterType === 'all' ? 'default' : 'outline'}
                  onClick={() => { setFilterType('all'); setCurrentPage(1); }}
                  className="font-bold"
                >
                  All
                </Button>
                <Button
                  variant={filterType === 'concept' ? 'default' : 'outline'}
                  onClick={() => { setFilterType('concept'); setCurrentPage(1); }}
                  className="font-bold"
                >
                  📚 Concept
                </Button>
                <Button
                  variant={filterType === 'project' ? 'default' : 'outline'}
                  onClick={() => { setFilterType('project'); setCurrentPage(1); }}
                  className="font-bold"
                >
                  🚀 Project
                </Button>
              </div>

              {/* Sort */}
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border-2 border-foreground font-bold bg-background"
                >
                  <option value="created_at">Date</option>
                  <option value="email">Student</option>
                  <option value="project_name">Project</option>
                </select>
                <Button
                  variant="outline"
                  onClick={toggleSortOrder}
                  className="font-bold"
                >
                  <ArrowUpDown className="w-4 h-4 mr-1" />
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </Button>
              </div>
            </div>
          </MotionWrapper>

          {/* Evaluations Grid */}
          {loading ? (
            <div className="text-center py-20">
              <p className="text-xl font-bold">Loading evaluations... 📊</p>
            </div>
          ) : evaluations.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
                {evaluations.map((record, index) => {
                  const isConcept = record.type === 'concept';
                  const title = isConcept 
                    ? (record as ConceptEvaluation).page_name || (record as ConceptEvaluation).project_name || 'Concept Evaluation'
                    : (record as ProjectEvaluation).project_name || 'Project Evaluation';
                  const typeLabel = isConcept ? '📚 Concept' : '🚀 Project';
                  
                  return (
                    <MotionWrapper key={`${record.type}-${record.id}`} delay={0.1 + index * 0.03} direction="up">
                      <motion.div
                        whileHover={{ 
                          scale: 1.03, 
                          rotate: 1,
                          y: -5
                        }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", bounce: 0.4 }}
                        onClick={() => handleCardClick(record)}
                        className="relative h-full"
                      >
                        <Card className="cursor-pointer group hover:shadow-brutal-lg transition-all duration-300 h-full">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-4xl">{isConcept ? '📚' : '🚀'}</div>
                              <motion.div
                                whileHover={{ scale: 1.2, rotate: 90 }}
                                transition={{ duration: 0.3 }}
                              >
                                <Play className="w-6 h-6 text-primary" />
                              </motion.div>
                            </div>
                            <CardTitle className="text-base group-hover:text-primary transition-colors line-clamp-2">
                              {title}
                            </CardTitle>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="inline-block bg-accent border-2 border-foreground px-2 py-0.5 text-xs font-black uppercase">
                                {typeLabel}
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-2">
                            {/* Student Info */}
                            <div className="flex items-center gap-2 mb-2">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-bold truncate" title={record.email}>
                                {getStudentName(record.email)}
                              </span>
                            </div>
                            
                            {/* Project Name */}
                            {record.project_name && (
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium truncate">
                                  {record.project_name}
                                </span>
                              </div>
                            )}
                            
                            {/* Date */}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              <span className="font-bold">{formatDate(record.created_at)}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </MotionWrapper>
                  );
                })}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <MotionWrapper delay={0.4} direction="up">
                  <div className="flex items-center justify-center gap-4 mt-8">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="font-bold"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum;
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-10 h-10 font-bold"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                      disabled={currentPage === pagination.totalPages}
                      className="font-bold"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                  
                  <p className="text-center text-sm font-bold text-muted-foreground mt-4">
                    Showing {((currentPage - 1) * pagination.limit) + 1} - {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} evaluations
                  </p>
                </MotionWrapper>
              )}
            </>
          ) : (
            <MotionWrapper delay={0.3} direction="zoom">
              <div className="text-center py-20">
                <Video className="w-20 h-20 mx-auto mb-4 text-muted-foreground" />
                <p className="text-xl font-bold text-muted-foreground mb-4">
                  No evaluations found! 🔍
                </p>
                <p className="text-lg font-bold text-muted-foreground">
                  {searchTerm ? 'Try a different search term' : 'No evaluations have been submitted yet'}
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

export default AllEvaluations;
