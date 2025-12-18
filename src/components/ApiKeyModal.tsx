import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (apiKey: string) => void;
  onRemove?: () => void;
  currentApiKey?: string;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSubmit, onRemove, currentApiKey }) => {
  const [apiKey, setApiKey] = useState(currentApiKey || "");
  const [error, setError] = useState("");
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);

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
    setApiKey(""); // Clear the form
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove();
      setShowConfirmRemove(false);
      setApiKey("");
      setError("");
    }
  };

  const handleClose = () => {
    setError("");
    setShowConfirmRemove(false);
    setApiKey(currentApiKey || ""); // Reset to current key
    onClose();
  };

  // Update API key when currentApiKey prop changes
  React.useEffect(() => {
    if (currentApiKey !== undefined) {
      setApiKey(currentApiKey);
    }
  }, [currentApiKey]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md border-4 border-foreground shadow-brutal">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            🔑 {currentApiKey ? "Update" : "Enter"} Your Gemini API Key
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            {currentApiKey ? 
              "Update your Google Gemini API key below." :
              "To use the video analysis features, please provide your Google Gemini API key."
            }
            {!currentApiKey && (
              <>
                {" "}You can get one from{" "}
                <a 
                  href="https://aistudio.google.com/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline hover:text-primary/80"
                >
                  Google AI Studio
                </a>
              </>
            )}
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
        <div className="flex justify-between gap-3">
          {/* Remove API Key Button - only show if there's a current key */}
          {currentApiKey && (
            <div className="flex-1">
              {!showConfirmRemove ? (
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmRemove(true)}
                  className="border-2 border-red-500 text-red-600 hover:bg-red-50 gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfirmRemove(false)}
                    className="border-2 border-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemove}
                    className="border-2 border-foreground shadow-brutal gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Confirm Remove
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-3 ml-auto">
            <Button
              variant="outline"
              onClick={handleClose}
              className="border-2 border-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-primary text-primary-foreground hover:bg-primary/90 border-2 border-foreground shadow-brutal"
            >
              {currentApiKey ? "Update" : "Continue"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { ApiKeyModal };
export default ApiKeyModal;
