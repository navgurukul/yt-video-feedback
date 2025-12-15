import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Sparkles, Video } from "lucide-react";
import { AnimatedHeading } from "@/components/AnimatedHeading";
import { MotionWrapper } from "@/components/MotionWrapper";
import { motion } from "framer-motion";

const Index = () => {
  const navigate = useNavigate();

  // Floating emoji shapes configuration
  const floatingShapes = [
    { id: 1, emoji: "✨", delay: 0, duration: 10, x: "10%", y: "20%" },
    { id: 2, emoji: "🔥", delay: 0.5, duration: 12, x: "85%", y: "15%" },
    { id: 3, emoji: "🎉", delay: 1, duration: 11, x: "15%", y: "70%" },
    { id: 4, emoji: "🚀", delay: 1.5, duration: 13, x: "80%", y: "65%" },
    { id: 5, emoji: "💬", delay: 0.3, duration: 9, x: "50%", y: "10%" },
    { id: 6, emoji: "⚡", delay: 0.8, duration: 11, x: "45%", y: "85%" },
  ];

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
          </div>
        </section>

        {/* Quick Info Section */}
        <section className="container mx-auto px-4 py-12">
          <MotionWrapper delay={0.3} direction="up">
            <div className="max-w-3xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div
                  whileHover={{ scale: 1.03, rotate: -1 }}
                  className="bg-secondary/50 border-4 border-foreground p-6 shadow-brutal-sm text-center"
                >
                  <div className="text-4xl mb-2">✨</div>
                  <h3 className="font-black text-lg mb-1">Collect</h3>
                  <p className="text-sm font-bold">Gather video feedback</p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.03, rotate: 1 }}
                  className="bg-accent/50 border-4 border-foreground p-6 shadow-brutal-sm text-center"
                >
                  <div className="text-4xl mb-2">🔥</div>
                  <h3 className="font-black text-lg mb-1">Analyze</h3>
                  <p className="text-sm font-bold">AI-powered insights</p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.03, rotate: -1 }}
                  className="bg-primary/50 border-4 border-foreground p-6 shadow-brutal-sm text-center"
                >
                  <div className="text-4xl mb-2">🎉</div>
                  <h3 className="font-black text-lg mb-1">Improve</h3>
                  <p className="text-sm font-bold">Enhance your concepts & Skills</p>
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
