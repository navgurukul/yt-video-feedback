import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ApiKeyModalProps {
  isOpen: boolean;
  onSubmit: (apiKey: string) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onSubmit }) => {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!apiKey.trim()) {
      setError("Please enter your Gemini API key");
      return;
    }

    if (!apiKey.startsWith("AIza")) {
      setError("Invalid API key format. Gemini API keys start with 'AIza'");
      return;
    }

    onSubmit(apiKey.trim());
    setError("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md border-4 border-foreground shadow-brutal" hideClose>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">🔑 Enter Your Gemini API Key</DialogTitle>
          <DialogDescription className="text-base pt-2">
            To use the video analysis features, please provide your Google Gemini API key.
            You can get one from{" "}
            <a 
              href="https://aistudio.google.com/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              Google AI Studio
            </a>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-sm font-medium">
              API Key
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit();
                }
              }}
              className="border-2 border-foreground"
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-500 font-medium">{error}</p>
            )}
          </div>
          <div className="bg-muted p-3 rounded-lg border-2 border-foreground/20">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> Your API key is stored locally in your browser session and is not saved on our servers.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button
            onClick={handleSubmit}
            className="bg-primary text-primary-foreground hover:bg-primary/90 border-2 border-foreground shadow-brutal"
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApiKeyModal;
