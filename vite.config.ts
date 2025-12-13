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
export default defineConfig(({ mode }) => ({
  // Development server configuration
  server: {
    host: "::", // Listen on all network interfaces
    port: 8080,
    // Proxy API requests to backend server
    proxy: {
      // Forward evaluation storage requests to API server
      '/store-evaluation': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      // Forward video evaluation requests to API server
      '/evaluate': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
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
}));