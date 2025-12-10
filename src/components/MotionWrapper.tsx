import { motion } from "framer-motion";
import { ReactNode } from "react";

interface MotionWrapperProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "left" | "right" | "up" | "down" | "zoom";
}

export const MotionWrapper = ({ 
  children, 
  className = "", 
  delay = 0,
  direction = "up" 
}: MotionWrapperProps) => {
  const getInitialPosition = () => {
    switch (direction) {
      case "left":
        return { opacity: 0, x: -50 };
      case "right":
        return { opacity: 0, x: 50 };
      case "up":
        return { opacity: 0, y: 50 };
      case "down":
        return { opacity: 0, y: -50 };
      case "zoom":
        return { opacity: 0, scale: 0.8 };
      default:
        return { opacity: 0, y: 50 };
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
      transition={{ duration: 0.6, delay, type: "spring", bounce: 0.3 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
