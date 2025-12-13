/**
 * @fileoverview Animated heading component with hover effects
 * @module components/AnimatedHeading
 */

import { motion } from "framer-motion";
import { ReactNode } from "react";

/**
 * Props for AnimatedHeading component
 */
interface AnimatedHeadingProps {
  /** Content to display in the heading */
  children: ReactNode;
  /** Optional CSS class names */
  className?: string;
  /** Animation delay in seconds */
  delay?: number;
}

/**
 * AnimatedHeading Component
 * 
 * Renders a heading with smooth enter animation and hover scale effect.
 * Uses spring physics for natural movement.
 * 
 * @param {AnimatedHeadingProps} props - Component props
 * @returns {JSX.Element} Animated h1 element
 * 
 * @example
 * <AnimatedHeading delay={0.3} className="text-4xl">
 *   Welcome to the App
 * </AnimatedHeading>
 */
export const AnimatedHeading = ({ children, className = "", delay = 0 }: AnimatedHeadingProps) => {
  return (
    <motion.h1
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, type: "spring", bounce: 0.4 }}
      whileHover={{ scale: 1.02 }}
      className={className}
    >
      {children}
    </motion.h1>
  );
};
