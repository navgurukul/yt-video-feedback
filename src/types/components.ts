/**
 * @fileoverview Type definitions for UI components
 * @module types/components
 */

/**
 * Animation direction options for motion components
 */
export type AnimationDirection = 'up' | 'down' | 'left' | 'right' | 'zoom';

/**
 * Props for MotionWrapper component
 * Wraps children with animation effects
 */
export interface MotionWrapperProps {
  children: React.ReactNode;
  delay?: number;
  direction?: AnimationDirection;
  className?: string;
}

/**
 * Props for AnimatedHeading component
 * Displays animated text with customizable styling
 */
export interface AnimatedHeadingProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Props for AnimatedIntroText component
 * Shows introductory text with animation
 */
export interface AnimatedIntroTextProps {
  text: string;
  direction?: AnimationDirection;
  delay?: number;
  className?: string;
}

/**
 * Props for CelebrationEffect component
 * Displays celebration animations on success
 */
export interface CelebrationEffectProps {
  show: boolean;
  onComplete?: () => void;
  message?: string;
}

/**
 * Props for AuthModal component
 * Handles authentication UI
 */
export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Props for AuthGate component
 * Protects routes requiring authentication
 */
export interface AuthGateProps {
  children: React.ReactNode;
}
