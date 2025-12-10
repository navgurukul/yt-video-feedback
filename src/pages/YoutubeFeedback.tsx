import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function YoutubeFeedback() {
  const [videoLink, setVideoLink] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (videoLink) {
      setSubmitted(true);
      toast.success("Video link submitted for feedback!");
    }
  };

  const feedbackQuestions = [
    { question: "Content Quality", score: "8.5/10" },
    { question: "Engagement Level", score: "9.0/10" },
    { question: "Audio Quality", score: "7.5/10" },
    { question: "Visual Appeal", score: "8.0/10" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <h1 className="text-5xl md:text-6xl font-black uppercase mb-12 text-center">
          YouTube Video <span className="text-primary">Feedback</span>
        </h1>

        <div className="max-w-3xl mx-auto space-y-8">
          {/* Submit Link Card */}
          <div className="bg-card border-4 border-foreground p-8 shadow-brutal">
            <h2 className="text-2xl font-black uppercase mb-6">Submit Link</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="url"
                value={videoLink}
                onChange={(e) => setVideoLink(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                required
              />
              <Button type="submit" className="w-full">
                Submit for Feedback
              </Button>
            </form>
          </div>

          {/* Rubric & Feedback Card */}
          {submitted && (
            <div className="bg-primary border-4 border-foreground p-8 shadow-brutal">
              <h2 className="text-2xl font-black uppercase mb-6">Rubric & Feedback</h2>
              <div className="grid gap-4">
                {feedbackQuestions.map((item, index) => (
                  <div
                    key={index}
                    className="bg-card border-4 border-foreground p-4 shadow-brutal-sm"
                  >
                    <div className="flex justify-between items-center">
                      <p className="font-bold">{item.question}</p>
                      <p className="text-xl font-black">{item.score}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 bg-card border-4 border-foreground p-6 shadow-brutal-sm">
                <h3 className="font-black uppercase mb-3">Overall Feedback</h3>
                <p className="font-medium">
                  Your video shows strong engagement and content quality. Consider improving
                  audio clarity for better viewer experience. The visual presentation is
                  solid and keeps viewers interested throughout.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
