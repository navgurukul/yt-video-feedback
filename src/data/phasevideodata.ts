/**
 * @fileoverview Project video data structure for phase-based project evaluations
 * @module data/phasevideodata
 * 
 * This module defines the structure and content for project explanation videos.
 * Unlike concept videos which have multiple videos per phase, project videos
 * have ONE video per phase covering the entire project.
 */

export interface ProjectVideoDetails {
  title: string;
  description: string;
  whatToCover: string;
  keyTopics: string[];
}

export interface ProjectPhaseData {
  phase: string;
  projectVideo: ProjectVideoDetails;
}

/**
 * Project video data structure
 * Each phase has exactly ONE project explanation video
 */
export const projectVideoDataStructure: ProjectPhaseData[] = [
  {
    phase: "Phase 1: Student Profile & Course Portal (HTML Only)",
    projectVideo: {
      title: "Student Profile & Course Portal - Complete Project Walkthrough",
      description: "A complete walkthrough of the HTML-only Student Profile & Course Portal project, explaining all pages, structure, and semantic HTML choices.",
      whatToCover: "Walk through your complete Student Profile & Course Portal website. Explain each page (Home, Profile, Courses, Feedback, Grades, Contact), how they connect through navigation, and why you chose specific HTML tags for structure and semantics.",
      keyTopics: [
        "Overall project structure and page organization",
        "Navigation and linking between pages",
        "Semantic HTML usage (header, nav, main, footer, article, section)",
        "Forms and input elements on the Feedback page",
        "Tables for the Grades page",
        "Lists and content organization",
        "Accessibility considerations in HTML"
      ]
    }
  },
  {
    phase: "Phase 2: Dressing Up Your Websites with CSS",
    projectVideo: {
      title: "Design & Layout Fundamentals - Complete Project Walkthrough",
      description: "A complete walkthrough of the CSS-styled project demonstrating design and layout fundamentals, explaining layout techniques, responsive design, and styling principles.",
      whatToCover: "Walk through your complete CSS project demonstrating design and layout fundamentals. Explain your CSS organization, layout choices (Flexbox/Grid), color scheme, typography, responsive design with media queries, and how CSS enhances the user experience.",
      keyTopics: [
        "CSS file organization and structure",
        "Box model understanding and application",
        "Flexbox and/or Grid layout implementations",
        "Color scheme and typography choices",
        "Responsive design with media queries",
        "Hover states and transitions",
        "CSS best practices and maintainability"
      ]
    }
  },
  {
    phase: "Phase 3: Bringing Your Websites to Life with JavaScript!",
    projectVideo: {
      title: "Interactive Quiz Master - Complete Project Walkthrough",
      description: "A complete walkthrough of the JavaScript-powered Interactive Quiz Master, explaining DOM manipulation, event handling, dynamic question display, and score calculation features.",
      whatToCover: "Walk through your Interactive Quiz Master project. Explain how JavaScript creates quiz interactivity, DOM manipulation for dynamic question display, event listeners for user interactions, data structures for storing questions and answers, and how the application manages quiz flow and score calculation.",
      keyTopics: [
        "DOM selection and manipulation for quiz interface",
        "Event listeners and handling user interactions",
        "Arrays and objects for question and answer storage",
        "Functions and code organization for quiz logic",
        "Dynamic HTML creation for question display",
        "Conditional statements for answer validation and scoring",
        "Debugging techniques and testing quiz functionality"
      ]
    }
  },
  {
    phase: "Phase 4: Building an AI-Powered Content Generator with Modern JavaScript & Gemini API",
    projectVideo: {
      title: "AI-Powered Content Generator - Complete Project Walkthrough",
      description: "A complete walkthrough of the modern JavaScript project featuring an AI-Powered Content Generator with ES6+ features and Gemini API integration for intelligent content creation.",
      whatToCover: "Walk through your AI-Powered Content Generator project. Explain modern ES6+ features implementation, Gemini API integration using fetch(), async/await patterns, destructuring for API responses, and how different content generation features work together.",
      keyTopics: [
        "ES6+ features (let/const, arrow functions, template literals)",
        "Destructuring and spread/rest operators",
        "Array methods for data processing (map, filter, reduce)",
        "Fetch API and Promise handling for Gemini integration",
        "Async/await patterns for API communication",
        "Error handling and user feedback systems",
        "Code organization and modern JavaScript best practices"
      ]
    }
  },
  {
    phase: "Phase 5: Your First Backend with Node.js, Express & Gemini AI",
    projectVideo: {
      title: "Ask Gemini Full-Stack Application - Complete Project Walkthrough",
      description: "A complete walkthrough of the full-stack Ask Gemini web application with Node.js/Express backend, covering server setup, API integration with Gemini AI, and secure frontend-backend communication.",
      whatToCover: "Walk through your Ask Gemini full-stack application. Explain your Node.js server setup, Express route configuration, secure Gemini API integration from the backend, middleware usage, environment variable management, and how data flows from frontend to backend to Gemini API and back.",
      keyTopics: [
        "Node.js server initialization and Express app setup",
        "Express routes and HTTP request handling (GET, POST)",
        "Backend Gemini API integration and fetch requests",
        "Environment variables and API key security (.env, dotenv)",
        "Express middleware (JSON parsing, static file serving)",
        "Frontend-backend communication and data flow",
        "Error handling and debugging in backend applications"
      ]
    }
  },
  {
    phase: "Phase 6: Your First Database with MongoDB & Mongoose",
    projectVideo: {
      title: "Student Feedback Manager - Complete Project Walkthrough",
      description: "A complete walkthrough of the full-stack Student Feedback Manager application with MongoDB database integration, covering database connection, Mongoose schemas and models, CRUD operations, and persistent data storage.",
      whatToCover: "Walk through your Student Feedback Manager application. Explain your MongoDB Atlas setup and connection, Mongoose schema and model design for feedback data, CRUD operations implementation (create feedback, read all feedback), data validation, and the complete flow from frontend form submission to database storage and data retrieval.",
      keyTopics: [
        "MongoDB Atlas setup and database connection (mongoose.connect)",
        "Mongoose schemas and models for data structure definition",
        "CRUD operations (Create with .save(), Read with .find())",
        "Data validation and error handling in database operations",
        "Environment variables for secure database credentials",
        "Frontend to backend to database data flow",
        "Express middleware for JSON parsing and database integration"
      ]
    }
  }
];

/**
 * Get all phase names for project videos
 * @returns Array of phase name strings
 */
export const getProjectPhaseNames = (): string[] => {
  return projectVideoDataStructure.map(phase => phase.phase);
};

/**
 * Get project video details for a specific phase
 * @param phaseName - The name of the phase
 * @returns ProjectVideoDetails or undefined if not found
 */
export const getProjectVideoForPhase = (phaseName: string): ProjectVideoDetails | undefined => {
  const phase = projectVideoDataStructure.find(p => p.phase === phaseName);
  return phase?.projectVideo;
};

/**
 * Get the full phase data including video details
 * @param phaseName - The name of the phase
 * @returns ProjectPhaseData or undefined if not found
 */
export const getProjectPhaseData = (phaseName: string): ProjectPhaseData | undefined => {
  return projectVideoDataStructure.find(p => p.phase === phaseName);
};
