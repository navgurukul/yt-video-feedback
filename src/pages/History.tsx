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

interface VideoAnalysis {
  id: string;
  video_title: string;
  video_url: string;
  score: number | null;
  created_at: string;
}

const History = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [videoHistory, setVideoHistory] = useState<VideoAnalysis[]>([]);
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
      fetchHistory();
    } else {
      setLoading(false);
      setShowAuthModal(true);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('video_analyses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setVideoHistory(data || []);
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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from('video_analyses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setVideoHistory(prev => prev.filter(item => item.id !== id));
      
      toast({
        title: "Deleted! 🗑️",
        description: "Analysis removed from history",
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

  const handleCardClick = (videoId: string) => {
    navigate(`/analysis-results?id=${videoId}`);
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
          ) : videoHistory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {videoHistory.map((video, index) => (
                <MotionWrapper key={video.id} delay={0.1 + index * 0.05} direction="up">
                  <motion.div
                    whileHover={{ 
                      scale: 1.03, 
                      rotate: 1,
                      y: -5
                    }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", bounce: 0.4 }}
                    onClick={() => handleCardClick(video.id)}
                    className="relative"
                  >
                    <Card className="cursor-pointer group hover:shadow-brutal-lg transition-all duration-300">
                      <motion.button
                        onClick={(e) => handleDelete(video.id, e)}
                        className="absolute -top-2 -right-2 z-10 bg-destructive text-destructive-foreground p-2 border-2 border-foreground shadow-brutal-sm hover:shadow-none transition-all"
                        whileHover={{ scale: 1.1, rotate: 10 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                      <CardHeader>
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-6xl">🎬</div>
                          <motion.div
                            whileHover={{ scale: 1.2, rotate: 90 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Play className="w-8 h-8 text-primary" />
                          </motion.div>
                        </div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-2">
                          {video.video_title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span className="font-bold">{formatDate(video.created_at)}</span>
                          </div>
                          {video.score && (
                            <div className="bg-primary text-primary-foreground px-3 py-1 border-2 border-foreground font-black">
                              {video.score}/10
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </MotionWrapper>
              ))}
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
