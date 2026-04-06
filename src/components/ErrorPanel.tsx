import React from 'react';
import { AlertCircle, CheckCircle, Info, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorInfo } from '@/lib/errorMessages';
import { motion } from 'framer-motion';

interface ErrorPanelProps {
  error: ErrorInfo;
  evaluationType?: 'concept-accuracy' | 'concept-ability' | 'project' | 'custom';
  partialResults?: {
    accuracy?: any;
    abilityToExplain?: any;
    [key: string]: any;
  };
  onRetry?: () => void;
  onDismiss?: () => void;
  showPartialResults?: boolean;
}

export function ErrorPanel({
  error,
  evaluationType,
  partialResults,
  onRetry,
  onDismiss,
  showPartialResults = true
}: ErrorPanelProps) {
  // Determine if we have partial results to show
  const hasPartialResults = 
    showPartialResults && 
    partialResults && 
    Object.keys(partialResults).some(key => partialResults[key]);

  // Icon based on severity
  const IconComponent = error.severity === 'error' ? AlertCircle : Zap;
  const borderColor = error.severity === 'error' ? 'border-red-500' : 'border-yellow-500';
  const bgColor = error.severity === 'error' ? 'bg-red-50' : 'bg-yellow-50';
  const textColor = error.severity === 'error' ? 'text-red-900' : 'text-yellow-900';
  const subtextColor = error.severity === 'error' ? 'text-red-800' : 'text-yellow-800';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`border-l-4 ${borderColor} ${bgColor} p-4 mb-6`}>
        {/* Header with icon and title */}
        <div className="flex items-start gap-4">
          <IconComponent className={`w-6 h-6 ${textColor} mt-1 flex-shrink-0`} />
          
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3 className={`font-semibold ${textColor}`}>
              {error.icon} {error.title}
            </h3>
            
            {/* Main message */}
            <p className={`${subtextColor} mt-1 text-sm leading-relaxed`}>
              {error.message}
            </p>

            {/* Partial results section if available */}
            {hasPartialResults && evaluationType === 'concept-ability' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-4 p-3 bg-white rounded border-l-2 border-green-500"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-900">
                      ✅ Accuracy evaluation completed
                    </p>
                    <p className="text-xs text-green-800 mt-1">
                      Your accuracy results are saved above. The ability evaluation failed due to {error.title.toLowerCase()}.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Suggestions section */}
            <div className="mt-4 pt-4 border-t border-opacity-20" style={{ borderColor: error.severity === 'error' ? 'rgb(220, 38, 38)' : 'rgb(202, 138, 4)' }}>
              <p className={`text-sm font-semibold ${textColor} mb-2`}>
                What to do:
              </p>
              <ul className={`space-y-2 ml-2`}>
                {error.suggestions.map((suggestion, idx) => (
                  <li key={idx} className={`text-sm ${subtextColor} flex items-start`}>
                    <span className="mr-3 flex-shrink-0">
                      {idx === 0 && '①'}
                      {idx === 1 && '②'}
                      {idx === 2 && '③'}
                      {idx === 3 && '④'}
                    </span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Next steps guidance */}
            <div className={`mt-3 p-2 rounded bg-opacity-10 ${error.severity === 'error' ? 'bg-red-900' : 'bg-yellow-900'}`}>
              <p className={`text-xs ${textColor} italic flex items-start gap-2`}>
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error.nextSteps}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-5 pt-4 border-t border-opacity-20" style={{ borderColor: error.severity === 'error' ? 'rgb(220, 38, 38)' : 'rgb(202, 138, 4)' }}>
          {error.retryable && onRetry && (
            <Button
              onClick={onRetry}
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Try Again
            </Button>
          )}
          {onDismiss && (
            <Button
              onClick={onDismiss}
              variant="outline"
              size="sm"
              className={`${error.severity === 'error' ? 'border-red-300 text-red-900 hover:bg-red-50' : 'border-yellow-300 text-yellow-900 hover:bg-yellow-50'}`}
            >
              Dismiss
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
