import { motion } from "framer-motion";
import { ReactNode } from "react";

interface AnimatedHeadingProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

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
