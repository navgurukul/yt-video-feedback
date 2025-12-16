/**
 * API Middleware: Error Handler
 * Centralized error handling middleware
 */

export function errorHandler(err, req, res, next) {
  console.error('❌ Unhandled error:', err);

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: err.name || 'Error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

/**
 * Not Found Handler
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
}

/**
 * Request Logger Middleware
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? '⚠️' : '✅';
    console.log(
      `${logLevel} ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`
    );
  });

  next();
}
