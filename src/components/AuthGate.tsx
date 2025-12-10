import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;
        setUser(user);
      } catch (err) {
        console.error("AuthGate: getUser error", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      try { subscription.unsubscribe(); } catch {}
    };
  }, []);

  const startGoogle = async () => {
    try {
      await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
    } catch (err) {
      console.error("AuthGate: signInWithOAuth error", err);
    }
  };

  // While loading, render nothing (or a spinner). When user not present, show blocking prompt.
  if (loading) return null;

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4">
        <div className="max-w-md w-full bg-card border-4 border-foreground p-8 rounded-lg shadow-brutal text-center">
          <h2 className="text-2xl font-black mb-4">Login Required 🔐</h2>
          <p className="mb-6 font-bold">Please sign in with your Navgurukul Google account to continue.</p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={startGoogle}>Sign in with Google</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">Only users with <strong>@navgurukul.org</strong> email can access the app.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGate;
