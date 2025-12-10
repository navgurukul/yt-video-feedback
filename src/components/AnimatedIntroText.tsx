import { motion } from "framer-motion";

interface AnimatedIntroTextProps {
  text: string;
  direction?: "left" | "right" | "up" | "zoom";
  delay?: number;
}

export const AnimatedIntroText = ({ 
  text, 
  direction = "left",
  delay = 0.2 
}: AnimatedIntroTextProps) => {
  const getInitialPosition = () => {
    switch (direction) {
      case "left":
        return { opacity: 0, x: -100 };
      case "right":
        return { opacity: 0, x: 100 };
      case "up":
        return { opacity: 0, y: 100 };
      case "zoom":
        return { opacity: 0, scale: 0.5 };
      default:
        return { opacity: 0, x: -100 };
    }
  };

  const getAnimatePosition = () => {
    switch (direction) {
      case "zoom":
        return { opacity: 1, scale: 1 };
      default:
        return { opacity: 1, x: 0, y: 0 };
    }
  };

  return (
    <motion.div
      initial={getInitialPosition()}
      animate={getAnimatePosition()}
      transition={{ duration: 0.8, delay, type: "spring", bounce: 0.4 }}
      className="text-xl md:text-2xl font-black uppercase text-primary mb-6"
    >
      {text}
    </motion.div>
  );
};
