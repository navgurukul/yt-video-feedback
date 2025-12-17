import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import YoutubeFeedback from "./pages/YoutubeFeedback";
import VideoAnalyzer from "./pages/VideoAnalyzer";
import AnalysisResults from "./pages/AnalysisResults";
import History from "./pages/History";
import AllEvaluations from "./pages/AllEvaluations";
import NotFound from "./pages/NotFound";
import { useEffect, useState, createContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import AuthGate from "@/components/AuthGate";

const queryClient = new QueryClient();

// Create context for API key
export const ApiKeyContext = createContext<{
  apiKey: string | null;
  setApiKey: (key: string) => void;
}>({
  apiKey: null,
  setApiKey: () => {},
});

const App = () => {
  const [apiKey, setApiKey] = useState<string | null>(() => {
    // Initialize from localStorage
    return localStorage.getItem('gemini_api_key');
  });

  // Update localStorage whenever apiKey changes
  const handleSetApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  useEffect(() => {
    // If the app is loaded with OAuth callback params, let Supabase process them
    const href = window.location.href;
    const isCallback = href.includes("access_token=") || href.includes("code=") || href.includes("error=");
    console.log("App: useEffect - current href:", href, "isCallback:", isCallback);
    if (isCallback) {
      (async () => {
        try {
          console.log("App: processing OAuth callback - calling getSessionFromUrl");
          // read debug markers written before redirect (if any)
          try {
            const stored = JSON.parse(localStorage.getItem('supabase_auth_debug') || 'null');
            console.log('App: debug markers found before callback:', stored);
          } catch (err) { console.warn('App: failed to read debug markers', err); }

          // supabase-js may process the callback automatically; fetch the current user/session
          try {
            const userRes = await supabase.auth.getUser();
            console.log("App: getUser result after callback:", userRes);
            try {
              const prev = JSON.parse(localStorage.getItem('supabase_auth_debug') || '[]');
              prev.push({ step: 'callback-processed', ts: Date.now(), userRes });
              localStorage.setItem('supabase_auth_debug', JSON.stringify(prev));
              console.log('App: appended callback-processed marker');
            } catch (err) { console.warn('App: failed to append callback marker', err); }
          } catch (err) {
            console.error('App: error calling getUser after callback', err);
          }
        } catch (e) {
          console.error("App: getSessionFromUrl error:", e);
        }

        // remove query/hash params from URL to keep it clean
        try {
          const clean = window.location.origin + window.location.pathname + window.location.search.replace(/(\?|&)\w+=.*$/g, "");
          window.history.replaceState({}, document.title, clean);
          console.log("App: cleaned URL to:", clean);
        } catch (err) {
          console.error("App: error cleaning URL:", err);
        }
      })();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ApiKeyContext.Provider value={{ apiKey, setApiKey: handleSetApiKey }}>
          <AuthGate>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/video-analyzer" element={<VideoAnalyzer />} />
              <Route path="/history" element={<History />} />
              <Route path="/all-evaluations" element={<AllEvaluations />} />
              <Route path="/analysis-results" element={<AnalysisResults />} />
              <Route path="/yt-feedback" element={<YoutubeFeedback />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthGate>
        </ApiKeyContext.Provider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
