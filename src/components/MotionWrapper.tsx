/**
 * @fileoverview Reusable motion wrapper component for consistent animations
 * @module components/MotionWrapper
 */

import { motion } from "framer-motion";
import { ReactNode } from "react";

/**
 * Props for MotionWrapper component
 */
interface MotionWrapperProps {
  /** Child elements to be animated */
  children: ReactNode;
  /** Optional CSS class names */
  className?: string;
  /** Animation delay in seconds */
  delay?: number;
  /** Animation direction (left, right, up, down, zoom) */
  direction?: "left" | "right" | "up" | "down" | "zoom";
}

/**
 * MotionWrapper Component
 * 
 * Wraps child elements with smooth enter animations.
 * Supports multiple animation directions and customizable delays.
 * 
 * @param {MotionWrapperProps} props - Component props
 * @returns {JSX.Element} Animated wrapper component
 * 
 * @example
 * <MotionWrapper delay={0.2} direction="left">
 *   <h1>Animated Content</h1>
 * </MotionWrapper>
 */
export const MotionWrapper = ({ 
  children, 
  className = "", 
  delay = 0,
  direction = "up" 
}: MotionWrapperProps) => {
  /**
   * Determines initial position based on animation direction
   * @returns Animation initial state object
   */
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
      transition={{ duration: 0.6, delay, type: "spring", bounce: 0.3 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
