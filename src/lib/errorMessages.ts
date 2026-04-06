/**
 * Centralized error message mapping for all evaluation types
 * Maps API error codes/types to user-friendly messages and actionable suggestions
 */

export interface ErrorInfo {
  code: number | string;
  title: string;
  message: string;
  severity: "error" | "warning";
  suggestions: string[];
  retryable: boolean;
  nextSteps: string;
  icon?: string;
}

// Error definitions with messages and suggestions
const ERROR_DEFINITIONS: Record<string | number, Omit<ErrorInfo, 'code'>> = {
  429: {
    title: "API Quota Exceeded",
    message: "Your Gemini API free tier allows 20 evaluations per day. You've used all 20 requests available today.",
    severity: "error",
    suggestions: [
      "Wait 24 hours for your daily quota to reset (resets at midnight UTC)",
      "Upgrade to a paid Gemini API plan for unlimited requests",
      "Check your API usage at console.cloud.google.com > Gemini API",
      "Ask your instructor if they have a higher-tier API key to share"
    ],
    retryable: false,
    nextSteps: "Come back tomorrow when your quota resets, or upgrade your API plan",
    icon: "⏰"
  },

  401: {
    title: "Invalid or Missing API Key",
    message: "The Gemini API key is invalid, expired, or missing. The system cannot authenticate with the API.",
    severity: "error",
    suggestions: [
      "Go to Settings > API Configuration",
      "Generate a new Gemini API key from ai.google.dev",
      "Ensure you're using the 'API Key' (not OAuth token)",
      "Verify the API key has 'Gemini API' enabled in Google Cloud Console"
    ],
    retryable: true,
    nextSteps: "Update your API key in Settings and try again",
    icon: "🔑"
  },

  400: {
    title: "Invalid Video",
    message: "The video could not be processed. This usually means the video URL is invalid, the video is private, or the content cannot be analyzed.",
    severity: "error",
    suggestions: [
      "Verify the URL is a valid YouTube link (should start with https://youtube.com or https://youtu.be)",
      "Check that the video is PUBLIC (not Private or Unlisted)",
      "Ensure the video has audio and visible content",
      "Try with a different video to verify the system works"
    ],
    retryable: true,
    nextSteps: "Provide a valid, public YouTube video URL and try again",
    icon: "📹"
  },

  403: {
    title: "Permission Denied",
    message: "Access to the Gemini API or video is denied. This may be due to API restrictions or video privacy settings.",
    severity: "error",
    suggestions: [
      "Ensure the video is public (not private or age-restricted)",
      "Check your Gemini API plan allows video analysis",
      "Verify your API key hasn't been revoked",
      "Check if there are any API access restrictions in place"
    ],
    retryable: true,
    nextSteps: "Update privacy settings and API configuration, then try again",
    icon: "🚫"
  },

  500: {
    title: "Server Error",
    message: "The Gemini API service encountered an unexpected error. This is a temporary service issue.",
    severity: "warning",
    suggestions: [
      "Wait a few minutes and try again",
      "Check the Gemini API status at status.cloud.google.com",
      "Try with a different video to isolate the issue",
      "If problem persists, report to Gemini API support"
    ],
    retryable: true,
    nextSteps: "Wait a few moments and try again. The service should recover shortly.",
    icon: "⚠️"
  },

  503: {
    title: "Service Unavailable",
    message: "The Gemini API service is temporarily unavailable or under maintenance.",
    severity: "warning",
    suggestions: [
      "Wait 5-10 minutes for the service to recover",
      "Check Gemini API status: status.cloud.google.com",
      "Your request will be automatically retried",
      "No action needed on your part"
    ],
    retryable: true,
    nextSteps: "The service is temporarily down. Please try again in a few minutes.",
    icon: "🔧"
  },

  NETWORK_ERROR: {
    title: "Network Connection Error",
    message: "Connection to the Gemini API failed. This may be a network issue on your device or the API server.",
    severity: "error",
    suggestions: [
      "Check your internet connection",
      "Try connecting to a different WiFi network or mobile data",
      "Disable any VPN if you're using one",
      "Try again in a few moments"
    ],
    retryable: true,
    nextSteps: "Verify your internet connection and try again",
    icon: "🌐"
  },

  TIMEOUT: {
    title: "Request Timeout",
    message: "The evaluation took too long to complete and the request timed out. The video may be very long or the API is slow.",
    severity: "warning",
    suggestions: [
      "Try with a shorter video (under 10 minutes recommended)",
      "Try a video with clearer audio and content",
      "Wait a few minutes and try again",
      "Check if Gemini API is experiencing high load"
    ],
    retryable: true,
    nextSteps: "Try with a shorter or simpler video",
    icon: "⏱️"
  },

  UNKNOWN_ERROR: {
    title: "Unexpected Error",
    message: "An unexpected error occurred. This shouldn't happen - please check the console for details.",
    severity: "error",
    suggestions: [
      "Check the browser console for error details (F12 > Console)",
      "Refresh the page and try again",
      "Try with a different video",
      "Report this issue with the console error message"
    ],
    retryable: true,
    nextSteps: "Refresh the page and try again. If the issue persists, report the error.",
    icon: "❌"
  }
};

/**
 * Get error information from API error response
 * @param status HTTP status code or custom error code
 * @param originalError Optional original error object for additional context
 * @returns ErrorInfo object with user-friendly messages
 */
export function getErrorInfo(
  status: number | string,
  originalError?: any
): ErrorInfo {
  // Check if it's a known error type
  if (status in ERROR_DEFINITIONS) {
    return {
      code: status,
      ...ERROR_DEFINITIONS[status as keyof typeof ERROR_DEFINITIONS]
    };
  }

  // Default to unknown error
  return {
    code: status,
    ...ERROR_DEFINITIONS.UNKNOWN_ERROR
  };
}

/**
 * Determine if error is critical (stops evaluation)
 * vs partial (allows showing some results)
 */
export function isCriticalError(status: number | string): boolean {
  // All errors are critical by default
  // Only 429 might allow partial results (if prior evaluation succeeded)
  return status !== 429;
}

/**
 * Determine if user can retry this error
 */
export function isRetryable(status: number | string): boolean {
  const errorInfo = getErrorInfo(status);
  return errorInfo.retryable;
}

/**
 * Extract error code/status from various error response formats
 */
export function extractErrorStatus(error: any): number | string {
  // Check common error response formats
  if (error?.status) return error.status;
  if (error?.code) return error.code;
  if (error?.status_code) return error.status_code;
  if (error?.error?.code) return error.error.code;
  if (error?.error?.status) return error.error.status;
  
  // Check for text/message patterns
  if (typeof error?.message === 'string') {
    if (error.message.includes("429") || error.message.includes("quota")) return 429;
    if (error.message.includes("401") || error.message.includes("Unauthorized")) return 401;
    if (error.message.includes("400") || error.message.includes("Invalid")) return 400;
    if (error.message.includes("403") || error.message.includes("Forbidden")) return 403;
    if (error.message.includes("500")) return 500;
    if (error.message.includes("503") || error.message.includes("Unavailable")) return 503;
  }

  return "UNKNOWN_ERROR";
}

/**
 * Extract a meaningful message from nested error responses
 */
export function extractErrorMessage(error: any): string {
  // Direct message field
  if (typeof error?.message === 'string') {
    return error.message;
  }

  // Nested error structure
  if (error?.error?.message) {
    return error.error.message;
  }

  // Error details
  if (error?.details) {
    return error.details;
  }

  return "An unexpected error occurred";
}

/**
 * Format error info for display with proper messaging
 * This handles quota-specific messages with time remaining
 */
export function formatErrorInfo(error: any): ErrorInfo {
  const status = extractErrorStatus(error);
  const errorInfo = getErrorInfo(status, error);

  // For quota errors, try to extract retry timing
  if (status === 429 && error?.message) {
    const match = error.message.match(/Retry in (\d+\.\d+)ms/);
    if (match) {
      const ms = parseFloat(match[1]);
      const seconds = Math.ceil(ms / 1000);
      errorInfo.nextSteps = `Please wait ${seconds} seconds before retrying.`;
    }
  }

  return errorInfo;
}
