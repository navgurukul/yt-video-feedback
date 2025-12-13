/**
 * @fileoverview Application footer with social media links
 * @module components/Footer
 */

import { Github, Twitter, Linkedin } from "lucide-react";

/**
 * Footer Component
 * 
 * Displays copyright information and social media links.
 * Uses neobrutalist design with shadow effects on links.
 * 
 * @returns {JSX.Element} Application footer component
 */
export const Footer = () => {
  return (
    <footer className="border-t-4 border-foreground bg-card mt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-bold">
            © 2024 NG YT VIDEO FEEDBACK. All rights reserved.
          </p>
          <div className="flex gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-primary border-4 border-foreground shadow-brutal-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-secondary border-4 border-foreground shadow-brutal-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
            >
              <Twitter className="w-5 h-5" />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-primary border-4 border-foreground shadow-brutal-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
            >
              <Linkedin className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
