import React, { useEffect, useState, useContext, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import ApiKeyModal from "@/components/ApiKeyModal";
import { ApiKeyContext } from "@/App";
import { apiFetch, getActiveInstitutionId, setActiveInstitutionId } from "@/lib/api";
import { MeResponse, TenantContext } from "@/lib/tenant";

type AccessState = "checking" | "ok" | "not_enrolled" | "error";

const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const { apiKey, setApiKey } = useContext(ApiKeyContext);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [access, setAccess] = useState<AccessState>("checking");
  const [accessMessage, setAccessMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;
        setUser(user);

        // Don't show modal on initial load if API key already exists
        // Only the onAuthStateChange will trigger the modal for new logins
      } catch (err) {
        console.error("AuthGate: getUser error", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);

      // Show API key modal only when user signs in (new login) and API key is not set
      if (event === 'SIGNED_IN' && session?.user && !apiKey) {
        setShowApiKeyModal(true);
      }
    });

    return () => {
      mounted = false;
      try { subscription.unsubscribe(); } catch {}
    };
  }, [apiKey]);

  // Ask the backend which institution and role this user has.
  const loadMe = useCallback(async () => {
    setAccess("checking");
    try {
      const res = await apiFetch("/api/me");
      const body = await res.json().catch(() => ({}));
      if (res.status === 403 && body?.code === "NOT_ENROLLED") {
        setAccessMessage(body.error || "");
        setAccess("not_enrolled");
        return;
      }
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const data = body as MeResponse;
      if (data.activeInstitution && data.activeInstitution.id !== getActiveInstitutionId()) {
        setActiveInstitutionId(data.activeInstitution.id);
      }
      setMe(data);
      setAccess("ok");
    } catch (err) {
      console.error("AuthGate: /api/me failed", err);
      setAccessMessage(err instanceof Error ? err.message : String(err));
      setAccess("error");
    }
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (userId) loadMe();
    else { setMe(null); setAccess("checking"); }
  }, [userId, loadMe]);

  const switchInstitution = (id: string) => {
    setActiveInstitutionId(id);
    window.location.reload();
  };

  const handleApiKeySubmit = (key: string) => {
    setApiKey(key);
    setShowApiKeyModal(false);
  };

  const startGoogle = async () => {
    try {
      await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
    } catch (err) {
      console.error("AuthGate: signInWithOAuth error", err);
    }
  };

  const signOut = async () => {
    setActiveInstitutionId(null);
    await supabase.auth.signOut();
  };

  // While loading, render nothing (or a spinner). When user not present, show blocking prompt.
  if (loading) return null;

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4">
        <div className="max-w-md w-full bg-card border-4 border-foreground p-8 rounded-lg shadow-brutal text-center">
          <h2 className="text-2xl font-black mb-4">Login Required 🔐</h2>
          <p className="mb-6 font-bold">Please sign in with your institution's Google account to continue.</p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={startGoogle}>Sign in with Google</Button>
          </div>
        </div>
      </div>
    );
  }

  if (access === "checking") return null;

  if (access === "not_enrolled" || access === "error") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4">
        <div className="max-w-md w-full bg-card border-4 border-foreground p-8 rounded-lg shadow-brutal text-center">
          <h2 className="text-2xl font-black mb-4">
            {access === "not_enrolled" ? "Not set up yet 🏫" : "Couldn't reach the server ⚠️"}
          </h2>
          <p className="mb-2 font-bold">
            {access === "not_enrolled"
              ? "Your institution isn't set up yet — contact your admin."
              : "We couldn't check your access. Please try again in a moment."}
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Signed in as <strong>{user.email}</strong>
            {access === "error" && accessMessage ? <><br />({accessMessage})</> : null}
          </p>
          <div className="flex gap-4 justify-center">
            {access === "error" && <Button onClick={loadMe}>Try again</Button>}
            <Button variant="outline" onClick={signOut}>Use another account</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TenantContext.Provider value={{ me, switchInstitution }}>
      <ApiKeyModal isOpen={showApiKeyModal} onSubmit={handleApiKeySubmit} />
      {children}
    </TenantContext.Provider>
  );
};

export default AuthGate;
