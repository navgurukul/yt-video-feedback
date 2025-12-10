import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "login" | "signup";
}

export const AuthModal = ({ isOpen, onClose, type }: AuthModalProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGoogle = async () => {
    try {
      console.log("AuthModal: handleGoogle - initiating Google OAuth");
      try {
        const marker = { step: "modal-start-signin", ts: Date.now(), href: window.location.href };
        localStorage.setItem("supabase_auth_debug", JSON.stringify([marker]));
        console.log("AuthModal: wrote debug marker to localStorage", marker);
      } catch (err) {
        console.warn("AuthModal: failed to write debug marker", err);
      }

      setLoading(true);
      const res = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
      console.log("AuthModal: handleGoogle - signInWithOAuth returned:", res);
      try {
        const prev = JSON.parse(localStorage.getItem("supabase_auth_debug") || "[]");
        prev.push({ step: "modal-after-signin-call", ts: Date.now(), res });
        localStorage.setItem("supabase_auth_debug", JSON.stringify(prev));
      } catch (err) {
        console.warn("AuthModal: failed to append debug marker", err);
      }
    } catch (error: any) {
      console.error("AuthModal: handleGoogle error:", error);
      toast({
        title: "Error",
        description: error.message || "Google sign-in failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border-4 border-foreground shadow-brutal bg-card">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase">
            {type === "login" ? "Login" : "Sign Up"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4 text-center">
          <p className="text-xl font-bold">Welcome to YT-Video-Feedback.</p>
          <p className="text-sm text-muted-foreground">Click below to sign in with your Google account.</p>
          <div className="flex gap-2 justify-center mt-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button id="GoogleSignInButton" onClick={handleGoogle} disabled={loading}>
              {loading ? "Redirecting..." : "Sign in with Google"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
