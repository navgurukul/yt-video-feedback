import React, { useEffect, useState, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import ApiKeyModal from "@/components/ApiKeyModal";
import { ApiKeyContext } from "@/App";
import { loginUser } from "@/lib/authService";
import { useToast } from "@/hooks/use-toast";

const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const { apiKey, setApiKey, jwtToken, setJwtToken } = useContext(ApiKeyContext);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    // Set a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.warn("AuthGate: Loading timeout - forcing load complete");
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    const init = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.error("AuthGate: Supabase error", error);
          // Check if it's a configuration error
          if (error.message.includes('Invalid') || error.message.includes('fetch')) {
            setSupabaseError('Supabase is not properly configured. Please check your .env file.');
          }
        }
        if (!mounted) return;
        setUser(user);
        
        // Don't show modal on initial load if API key already exists
        // Only the onAuthStateChange will trigger the modal for new logins
      } catch (err) {
        console.error("AuthGate: getUser error", err);
        setSupabaseError('Authentication service error. Please check configuration.');
      } finally {
        if (mounted) {
          clearTimeout(loadingTimeout);
          setLoading(false);
        }
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      
      // Show API key modal only when user signs in (new login) and API key is not set
      if (event === 'SIGNED_IN' && session?.user) {
        // Authenticate with backend and get JWT token
        const email = session.user.email || '';
        const name = session.user.user_metadata?.full_name || session.user.email || '';
        const supabaseId = session.user.id;

        const loginResponse = await loginUser(email, name, supabaseId);
        
        if (loginResponse.success && loginResponse.data) {
          // Store JWT token
          setJwtToken(loginResponse.data.token);
          
          // Show API key modal if user doesn't have API key configured
          if (!loginResponse.data.user.hasApiKey && !apiKey) {
            setShowApiKeyModal(true);
          }
        } else {
          toast({
            title: "Authentication Error",
            description: loginResponse.error || "Failed to authenticate with backend",
            variant: "destructive",
          });
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      try { subscription.unsubscribe(); } catch {}
    };
  }, [apiKey, jwtToken, setJwtToken, toast]);

  const handleApiKeySubmit = async (key: string) => {
    setApiKey(key);
    
    // Send API key to backend for encrypted storage
    if (user?.email) {
      try {
        const { setUserApiKey } = await import('@/lib/authService');
        const result = await setUserApiKey(user.email, key);
        
        if (result.success) {
          toast({
            title: "Success",
            description: "API key saved securely",
          });
        } else {
          toast({
            title: "Warning",
            description: "API key saved locally but failed to sync with server",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Failed to save API key to backend:', error);
      }
    }
    
    setShowApiKeyModal(false);
  };

  const startGoogle = async () => {
    try {
      await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
    } catch (err) {
      console.error("AuthGate: signInWithOAuth error", err);
    }
  };

  // While loading, show a spinner instead of blank screen
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-foreground mx-auto mb-4"></div>
          <p className="text-lg font-bold">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4">
        <div className="max-w-md w-full bg-card border-4 border-foreground p-8 rounded-lg shadow-brutal text-center">
          <h2 className="text-2xl font-black mb-4">
            {supabaseError ? '⚠️ Configuration Error' : '🔐 Login Required'}
          </h2>
          {supabaseError ? (
            <div>
              <p className="mb-4 font-bold text-red-600">{supabaseError}</p>
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-left text-sm mb-4">
                <p className="font-bold mb-2">To fix this:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Edit <code className="bg-gray-200 dark:bg-gray-700 px-1">.env</code> file</li>
                  <li>Add your Supabase URL and Key</li>
                  <li>Restart the dev server</li>
                </ol>
              </div>
              <p className="text-xs text-muted-foreground">
                Get credentials from: <a href="https://supabase.com" target="_blank" className="underline">supabase.com</a>
              </p>
            </div>
          ) : (
            <>
              <p className="mb-6 font-bold">Please sign in with your Navgurukul Google account to continue.</p>
              <div className="flex gap-4 justify-center">
                <Button variant="outline" onClick={startGoogle}>Sign in with Google</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">Only users with <strong>@navgurukul.org</strong> email can access the app.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <ApiKeyModal isOpen={showApiKeyModal} onSubmit={handleApiKeySubmit} />
      {children}
    </>
  );
};

export default AuthGate;
