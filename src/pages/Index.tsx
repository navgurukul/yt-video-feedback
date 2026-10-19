import { useNavigate } from "react-router-dom";
import { useContext, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Sparkles, Video } from "lucide-react";
import { AnimatedHeading } from "@/components/AnimatedHeading";
import { MotionWrapper } from "@/components/MotionWrapper";
import { motion } from "framer-motion";
import { FailedRequestCard, FailedRequestItem } from "@/components/FailedRequestCard";
import { supabase } from "@/integrations/supabase/client";
import { ApiKeyContext } from "@/App";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { apiKey } = useContext(ApiKeyContext);
  const [failedRequests, setFailedRequests] = useState<FailedRequestItem[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const API_BASE_URL = import.meta.env.VITE_EVAL_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const refreshFailedRequests = async (email: string | null) => {
    if (!email) {
      setFailedRequests([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/failed-requests?email=${encodeURIComponent(email)}`);
      if (!response.ok) {
        setFailedRequests([]);
        return;
      }

      const result = await response.json();
      setFailedRequests(result?.data || []);
    } catch (error) {
      console.error('Failed to load failed requests on homepage:', error);
      setFailedRequests([]);
    }
  };

  const handleHomeDelete = async (id: string) => {
    if (!userEmail) return;

    const response = await fetch(`${API_BASE_URL}/failed-requests/${id}?email=${encodeURIComponent(userEmail)}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      setFailedRequests(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleHomeRetry = async (request: FailedRequestItem) => {
    if (!userEmail) return;

    try {
      const response = await fetch(`${API_BASE_URL}/failed-requests/${request.id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail, userId: request.user_id, apiKey })
      });

      const result = await response.json().catch(() => ({ success: false, error: { message: 'Unable to retry this request' } }));

      if (!response.ok || !result.success) {
        const message = (result?.error?.message || '').toLowerCase();
        const friendlyMessage = message.includes('429') || message.includes('busy') || message.includes('unavailable') || message.includes('model_unavailable')
          ? 'Gemini abhi busy hai, thodi der baad dobara try karo.'
          : result?.error?.message || 'Unable to retry this request';
        throw new Error(friendlyMessage);
      }

      await refreshFailedRequests(userEmail);
    } catch (error) {
      console.error('Failed to retry request from home:', error);
      toast({
        title: 'Retry failed',
        description: error instanceof Error ? error.message : 'Unable to retry this request',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const loadFailedRequests = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const email = user?.email;
        setUserEmail(email || null);

        if (!email) {
          setFailedRequests([]);
          return;
        }

        await refreshFailedRequests(email);
      } catch (error) {
        console.error('Failed to load failed requests on homepage:', error);
        setFailedRequests([]);
      }
    };

    loadFailedRequests();
  }, [API_BASE_URL]);

  // Floating emoji shapes configuration
  const floatingShapes = [
    { id: 1, emoji: "✨", delay: 0, duration: 10, x: "10%", y: "20%" },
    { id: 2, emoji: "🔥", delay: 0.5, duration: 12, x: "85%", y: "15%" },
    { id: 3, emoji: "🎉", delay: 1, duration: 11, x: "15%", y: "70%" },
    { id: 4, emoji: "🚀", delay: 1.5, duration: 13, x: "80%", y: "65%" },
    { id: 5, emoji: "💬", delay: 0.3, duration: 9, x: "50%", y: "10%" },
    { id: 6, emoji: "⚡", delay: 0.8, duration: 11, x: "45%", y: "85%" },
  ];

  const partnerNotice = "Dear Partners,/We use Google Gemini models with a free quota. Because many people around the world use these models, they may not work for some hours or days./Please do not worry if this happens. Keep preparing your videos. When the models are available again, use the new Failed Request Recovery feature to process your videos again./Thank you for your patience and support.";
  const partnerNoticeLines = partnerNotice.split("/").map((line) => line.trim()).filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-br from-primary/20 via-background via-50% to-accent/20">
      {/* Floating Emoji Background Animations */}
      {floatingShapes.map((shape) => (
        <motion.div
          key={shape.id}
          className="absolute pointer-events-none z-0 text-6xl opacity-20"
          style={{
            left: shape.x,
            top: shape.y,
          }}
          animate={{
            y: [0, -40, 0],
            x: [0, 30, 0],
            rotate: [0, 10, -10, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: shape.duration,
            repeat: Infinity,
            delay: shape.delay,
            ease: "easeInOut",
          }}
        >
          {shape.emoji}
        </motion.div>
      ))}
      
      <Header />

      <main className="flex-1 relative z-10">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <AnimatedHeading className="text-5xl md:text-7xl font-black uppercase leading-tight mb-6">
              NG YT VIDEO FEEDBACK 🚀
            </AnimatedHeading>
            <MotionWrapper delay={0.2} direction="up">
              <p className="text-xl md:text-2xl font-bold mb-12 max-w-2xl mx-auto">
                Analyze your videos with AI-powered feedback using custom rubrics ✨
              </p>
            </MotionWrapper>
            <MotionWrapper delay={0.4} direction="zoom">
              <motion.div 
                whileHover={{ scale: 1.05, y: -5 }} 
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", bounce: 0.5 }}
              >
                <Button 
                  size="lg" 
                  onClick={() => navigate("/video-analyzer")}
                  className="text-xl h-14 px-10 shadow-brutal-lg hover:[box-shadow:12px_12px_0px_0px_rgba(13,13,13,1)] transition-all duration-300"
                >
                  <Video className="w-6 h-6 mr-2" />
                  Analyze Video 🔥
                </Button>
              </motion.div>
            </MotionWrapper>
            <MotionWrapper delay={0.5} direction="up">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                whileHover={{ y: -2 }}
                className="mt-6 max-w-3xl mx-auto text-left rounded-2xl border-4 border-foreground bg-background shadow-brutal overflow-hidden"
              >
                <div className="relative px-4 py-3 md:px-5 bg-gradient-to-r from-primary/20 via-accent/10 to-secondary/20 border-b-2 border-foreground">
                  <motion.div
                    className="absolute right-4 top-3"
                    animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.08, 1] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Sparkles className="w-5 h-5 text-primary" />
                  </motion.div>
                  <p className="text-xs md:text-sm font-black uppercase tracking-wider text-foreground">
                    Service Update
                  </p>
                  <p className="text-sm md:text-base font-semibold text-foreground/90 mt-1">
                    NG YT Video Feedback Notice
                  </p>
                </div>

                <div className="px-4 py-4 md:px-5 md:py-5 bg-card">
                  {partnerNoticeLines.map((line, index) => (
                    <motion.p
                      key={`notice-line-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + index * 0.1, duration: 0.35 }}
                      className={`text-sm md:text-base leading-relaxed text-foreground/90 ${index === 0 ? "font-bold" : "font-medium"} ${index > 0 ? "mt-2" : ""}`}
                    >
                      {index === 2 ? (
                        <>
                          {line.split("Failed Request Recovery")[0]}
                          <span className="font-bold text-primary">Failed Request Recovery</span>
                          {line.split("Failed Request Recovery")[1] || ""}
                        </>
                      ) : (
                        line
                      )}
                    </motion.p>
                  ))}
                </div>
              </motion.div>
            </MotionWrapper>
          </div>
        </section>

        {userEmail && failedRequests.length > 0 && (
          <section className="container mx-auto px-4 py-12">
            <div className="max-w-6xl mx-auto mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-3xl font-black uppercase">Failed Request Recovery</h2>
                <span className="bg-destructive text-destructive-foreground border-2 border-foreground px-3 py-1 text-xs font-black uppercase">
                  {failedRequests.length} waiting
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {failedRequests.map((request) => (
                <FailedRequestCard
                  key={request.id}
                  request={request}
                  onRetry={handleHomeRetry}
                  onDelete={handleHomeDelete}
                />
              ))}
            </div>
          </section>
        )}

        {/* Quick Info Section */}
        <section className="container mx-auto px-4 py-12">
          <MotionWrapper delay={0.3} direction="up">
            <div className="max-w-3xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-secondary/30 border-2 border-secondary/50 rounded-lg p-6 text-center"
                >
                  <div className="text-4xl mb-3">✨</div>
                  <h3 className="font-bold text-lg mb-2 text-foreground/90">Collect</h3>
                  <p className="text-sm text-foreground/70">Gather video feedback</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="bg-accent/30 border-2 border-accent/50 rounded-lg p-6 text-center"
                >
                  <div className="text-4xl mb-3">🔥</div>
                  <h3 className="font-bold text-lg mb-2 text-foreground/90">Analyze</h3>
                  <p className="text-sm text-foreground/70">AI-powered insights</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                  className="bg-primary/30 border-2 border-primary/50 rounded-lg p-6 text-center"
                >
                  <div className="text-4xl mb-3">🎉</div>
                  <h3 className="font-bold text-lg mb-2 text-foreground/90">Improve</h3>
                  <p className="text-sm text-foreground/70">Enhance your concepts & Skills</p>
                </motion.div>
              </div>
            </div>
          </MotionWrapper>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
