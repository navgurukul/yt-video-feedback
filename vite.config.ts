/**
 * @fileoverview Vite configuration for React application
 * @module vite.config
 * 
 * Configures:
 * - Development server with proxy for API requests
 * - React with SWC for faster builds
 * - Path aliases for cleaner imports
 * - Development tools (component tagger)
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Vite configuration export
 * Configures server, plugins, and module resolution
 */
export default defineConfig(({ mode }) => {
  // Get backend API URL from environment variable or use default for development
  const apiUrl = process.env.VITE_API_URL || process.env.VITE_EVAL_API_URL || 'http://localhost:3001';
  
  return {
    // Development server configuration
    server: {
      host: "::", // Listen on all network interfaces
      port: 8080,
      // Proxy API requests to backend server (only in development)
      proxy: mode === 'development' ? {
        // Forward evaluation storage requests to API server
        '/store-evaluation': {
          target: apiUrl,
          changeOrigin: true,
          secure: false
        },
        // Forward video evaluation requests to API server
        '/evaluate': {
          target: apiUrl,
          changeOrigin: true,
          secure: false
        }
      } : undefined
    },
    // Plugins: React with SWC, and component tagger in development
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    // Module resolution configuration
    resolve: {
      // Path alias: @ points to src directory
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});