/**
 * @fileoverview Main application header with authentication state
 * @module components/Header
 */

import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquareQuote, LogOut, Key, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ApiKeyContext } from "@/App";
import { ApiKeyModal } from "@/components/ApiKeyModal";

/**
 * Header Component
 * 
 * Displays the main navigation bar with logo, navigation links, and auth status.
 * Manages user authentication state and provides logout functionality.
 * 
 * @returns {JSX.Element} Application header component
 */
export const Header = () => {
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const { apiKey, setApiKey } = useContext(ApiKeyContext);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    console.log("Header: useEffect mount - checking user");
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Header: onAuthStateChange event:", event, "session:", session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Fetches and sets current user from Supabase
   * @async
   */
  const checkUser = async () => {
    console.log("Header: checkUser - getting current user from Supabase");
    const { data: { user } } = await supabase.auth.getUser();
    console.log("Header: checkUser result user:", user);
    setUser(user);
  };

  /**
   * Handles user logout and redirects to home page
   * @async
   */
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

  /**
   * Handles API key management - opens modal to change/clear API key
   */
  const handleApiKeyManagement = () => {
    setShowApiKeyModal(true);
  };

  /**
   * Handles removing the API key
   */
  const handleRemoveApiKey = () => {
    setApiKey('');
    localStorage.removeItem('gemini_api_key');
    setShowApiKeyModal(false);
    toast({
      title: "API Key Removed! 🗑️",
      description: "You'll need to enter a new API key for evaluations",
    });
  };

  /**
   * Handles API key modal submission
   */
  const handleApiKeySubmit = (newApiKey: string) => {
    setApiKey(newApiKey);
    setShowApiKeyModal(false);
    toast({
      title: "API Key Updated! ✅",
      description: "Your new API key has been saved",
    });
  };

  return (
    <>
      <header className="border-b-4 border-foreground bg-card relative">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4 md:gap-8">
            <Link to="/" className="flex items-center gap-2 md:gap-3 group">
              <div className="bg-primary border-4 border-foreground p-2 shadow-brutal-sm group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-none group-hover:rotate-3 transition-all duration-300">
                <MessageSquareQuote className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-lg md:text-2xl font-black uppercase tracking-tight group-hover:scale-105 transition-transform">
                Feedback<span className="text-primary">Hub</span> 💬
              </span>
            </Link>
            {/* Desktop Navigation */}
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
              {/* <Link to="/all-evaluations" className="font-bold hover:text-primary hover:scale-105 transition-all">
                All Evaluations
              </Link> */}
            </nav>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            {/* Mobile Menu Toggle */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>

            {/* Desktop API Key Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleApiKeyManagement}
              className={`hidden md:flex gap-2 ${apiKey ? 'border-green-500 text-green-700 hover:bg-green-50' : 'border-orange-500 text-orange-700 hover:bg-orange-50'}`}
              title={apiKey ? "API Key Set - Click to Manage" : "No API Key - Click to Set"}
            >
              <Key className={`w-4 h-4 ${apiKey ? 'text-green-600' : 'text-orange-600'}`} />
              <span>
                {apiKey ? "API Key" : "Set API Key"}
              </span>
              {apiKey && (
                <div className="w-2 h-2 bg-green-500 rounded-full ml-1" title="API Key Active" />
              )}
            </Button>

            {/* Desktop User Controls */}
            {user ? (
              <div className="hidden md:flex items-center gap-3">
                <span className="font-bold text-sm truncate max-w-[150px]">
                  {user.email}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleLogout}
                  className="gap-2 whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleGoogleSignIn} 
                disabled={loading}
                className="hidden md:flex whitespace-nowrap"
              >
                {loading ? "Redirecting..." : "Sign in with Google"}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t-4 border-foreground bg-card">
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-3">
              {/* Navigation Links */}
              <Link 
                to="/" 
                className="font-bold hover:text-primary py-2 px-3 hover:bg-muted rounded transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link 
                to="/video-analyzer" 
                className="font-bold hover:text-primary py-2 px-3 hover:bg-muted rounded transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Analyzer
              </Link>
              <Link 
                to="/history" 
                className="font-bold hover:text-primary py-2 px-3 hover:bg-muted rounded transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                History
              </Link>
              <Link 
                to="/all-evaluations" 
                className="font-bold hover:text-primary py-2 px-3 hover:bg-muted rounded transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                All Evaluations
              </Link>

              {/* Divider */}
              <div className="border-t-2 border-foreground my-2"></div>

              {/* API Key Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  handleApiKeyManagement();
                  setIsMobileMenuOpen(false);
                }}
                className={`gap-2 justify-start ${apiKey ? 'border-green-500 text-green-700 hover:bg-green-50' : 'border-orange-500 text-orange-700 hover:bg-orange-50'}`}
                title={apiKey ? "API Key Set - Click to Manage" : "No API Key - Click to Set"}
              >
                <Key className={`w-4 h-4 ${apiKey ? 'text-green-600' : 'text-orange-600'}`} />
                <span>
                  {apiKey ? "API Key" : "Set API Key"}
                </span>
                {apiKey && (
                  <div className="w-2 h-2 bg-green-500 rounded-full ml-1" title="API Key Active" />
                )}
              </Button>

              {/* User Info / Auth */}
              {user ? (
                <>
                  <div className="font-bold text-sm py-2 px-3 truncate">
                    {user.email}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="gap-2 justify-start"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </Button>
                </>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleGoogleSignIn} 
                  disabled={loading}
                  className="justify-start"
                >
                  {loading ? "Redirecting..." : "Sign in with Google"}
                </Button>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* API Key Management Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSubmit={handleApiKeySubmit}
        onRemove={handleRemoveApiKey}
        currentApiKey={apiKey}
      />
    </>
  );
};
