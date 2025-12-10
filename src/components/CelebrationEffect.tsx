import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface CelebrationEffectProps {
  show: boolean;
  onComplete?: () => void;
  message?: string;
}

const emojis = ["🔥", "✨", "🎉", "💎", "🎊", "💫", "🌟", "⚡"];
const messages = [
  "Great Job!",
  "You Nailed It!",
  "Mission Complete 🚀",
  "Awesome Work! 🎯",
  "You're a Star! ⭐"
];

export const CelebrationEffect = ({ 
  show, 
  onComplete,
  message 
}: CelebrationEffectProps) => {
  const [particles, setParticles] = useState<Array<{ id: number; emoji: string; x: number; delay: number }>>([]);
  const displayMessage = message || messages[Math.floor(Math.random() * messages.length)];

  useEffect(() => {
    if (show) {
      // Generate 15 floating particles
      const newParticles = Array.from({ length: 15 }, (_, i) => ({
        id: i,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        x: Math.random() * 100 - 50, // Random horizontal spread
        delay: Math.random() * 0.3,
      }));
      setParticles(newParticles);

      // Auto-hide after animation
      const timeout = setTimeout(() => {
        onComplete?.();
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Background Pulse Glow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0, 0.3, 0.3, 0],
              scale: [1, 1.05, 1.05, 1]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className="fixed inset-0 bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 pointer-events-none z-40"
          />

          {/* Success Message */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1.2, 1.2, 1],
              y: [50, 0, 0, -20]
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
          >
            <div className="bg-primary border-4 border-foreground px-12 py-6 shadow-brutal-lg">
              <h2 className="text-4xl md:text-6xl font-black uppercase text-center whitespace-nowrap">
                {displayMessage}
              </h2>
            </div>
          </motion.div>

          {/* Floating Emoji Particles */}
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              initial={{ 
                opacity: 0,
                scale: 0,
                x: "50vw",
                y: "50vh",
              }}
              animate={{ 
                opacity: [0, 1, 1, 0],
                scale: [0, 1.5, 1.5, 0.5],
                x: `calc(50vw + ${particle.x}vw)`,
                y: ["50vh", "20vh", "10vh", "-10vh"],
                rotate: [0, 180, 360, 540],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 2,
                delay: particle.delay,
                ease: "easeOut"
              }}
              className="fixed text-6xl pointer-events-none z-50"
              style={{
                filter: "drop-shadow(0 0 10px rgba(0,0,0,0.3))"
              }}
            >
              {particle.emoji}
            </motion.div>
          ))}

          {/* Confetti Burst from Bottom */}
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={`confetti-${i}`}
              initial={{ 
                opacity: 0,
                x: "50vw",
                y: "100vh",
                scale: 0,
              }}
              animate={{ 
                opacity: [0, 1, 1, 0],
                x: `${Math.random() * 100}vw`,
                y: `${Math.random() * 50}vh`,
                scale: [0, 1, 1, 0],
                rotate: Math.random() * 720,
              }}
              transition={{
                duration: 1.5,
                delay: Math.random() * 0.3,
                ease: "easeOut"
              }}
              className="fixed w-3 h-3 pointer-events-none z-40"
              style={{
                backgroundColor: [
                  "hsl(var(--primary))",
                  "hsl(var(--secondary))",
                  "hsl(var(--accent))",
                ][i % 3],
                boxShadow: "0 0 10px rgba(0,0,0,0.3)"
              }}
            />
          ))}
        </>
      )}
    </AnimatePresence>
  );
};
