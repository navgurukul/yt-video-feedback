import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquareQuote, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const Header = () => {
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log("Header: useEffect mount - checking user");
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Header: onAuthStateChange event:", event, "session:", session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    console.log("Header: checkUser - getting current user from Supabase");
    const { data: { user } } = await supabase.auth.getUser();
    console.log("Header: checkUser result user:", user);
    setUser(user);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out! 👋",
      description: "See you next time",
    });
    window.location.href = "/";
  };

  const handleGoogleSignIn = async () => {
    try {
      console.log("Header: handleGoogleSignIn - starting Google OAuth");
      // write a debug marker to localStorage so we can inspect after redirect
      try {
        const marker = { step: 'start-signin', ts: Date.now(), href: window.location.href };
        localStorage.setItem('supabase_auth_debug', JSON.stringify([marker]));
        console.log('Header: wrote debug marker to localStorage', marker);
      } catch (err) { console.warn('Header: failed to write debug marker', err); }

      setLoading(true);
      const res = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
      console.log("Header: handleGoogleSignIn - supabase.auth.signInWithOAuth returned:", res);
      try {
        const prev = JSON.parse(localStorage.getItem('supabase_auth_debug') || '[]');
        prev.push({ step: 'after-signin-call', ts: Date.now(), res });
        localStorage.setItem('supabase_auth_debug', JSON.stringify(prev));
      } catch (err) { console.warn('Header: failed to append debug marker', err); }
    } catch (error: any) {
      console.error("Header: handleGoogleSignIn error:", error);
      toast({ title: "Error", description: error?.message || "Google sign-in failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="border-b-4 border-foreground bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="bg-primary border-4 border-foreground p-2 shadow-brutal-sm group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-none group-hover:rotate-3 transition-all duration-300">
                <MessageSquareQuote className="w-6 h-6 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-2xl font-black uppercase tracking-tight group-hover:scale-105 transition-transform">
                Feedback<span className="text-primary">Hub</span> 💬
              </span>
            </Link>
            <nav className="hidden md:flex gap-6">
              <Link to="/" className="font-bold hover:text-primary hover:scale-105 transition-all">
                Home
              </Link>
              <Link to="/video-analyzer" className="font-bold hover:text-primary hover:scale-105 transition-all">
                Analyzer
              </Link>
              <Link to="/history" className="font-bold hover:text-primary hover:scale-105 transition-all">
                History
              </Link>
            </nav>
          </div>
          <div className="flex gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm">
                  {user.email}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleLogout}
                  className="gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={handleGoogleSignIn} disabled={loading}>
                {loading ? "Redirecting..." : "Sign in with Google"}
              </Button>
            )}
          </div>
        </div>
      </header>
    </>
  );
};
