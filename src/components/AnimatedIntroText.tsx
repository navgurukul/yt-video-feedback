/**
 * @fileoverview Animated introductory text component
 * @module components/AnimatedIntroText
 */

import { motion } from "framer-motion";

/**
 * Props for AnimatedIntroText component
 */
interface AnimatedIntroTextProps {
  /** Text content to display */
  text: string;
  /** Animation direction (left, right, up, zoom) */
  direction?: "left" | "right" | "up" | "zoom";
  /** Animation delay in seconds */
  delay?: number;
}

/**
 * AnimatedIntroText Component
 * 
 * Displays introductory text with dramatic enter animation.
 * Perfect for hero sections and page intros.
 * 
 * @param {AnimatedIntroTextProps} props - Component props
 * @returns {JSX.Element} Animated text div
 * 
 * @example
 * <AnimatedIntroText 
 *   text="Analyzing brilliance in progress…" 
 *   direction="up" 
 *   delay={0.1}
 * />
 */
export const AnimatedIntroText = ({ 
  text, 
  direction = "left",
  delay = 0.2 
}: AnimatedIntroTextProps) => {
  /**
   * Determines initial position based on animation direction
   * @returns Animation initial state object
   */
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

  /**
   * Determines target animation position
   * @returns Animation target state object
   */
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
