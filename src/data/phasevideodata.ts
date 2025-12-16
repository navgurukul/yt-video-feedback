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
    phase: "Phase 1: HTML Only — Student Profile & Course Portal",
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
    phase: "Phase 2: CSS Styling — Interactive Portfolio & Blog",
    projectVideo: {
      title: "Interactive Portfolio & Blog - Complete Project Walkthrough",
      description: "A complete walkthrough of the CSS-styled Interactive Portfolio & Blog project, explaining design choices, layout techniques, and responsive design.",
      whatToCover: "Walk through your complete Interactive Portfolio & Blog project. Explain your CSS organization, layout choices (Flexbox/Grid), color scheme, typography, responsive design with media queries, and how CSS enhances the user experience.",
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
    phase: "Phase 3: JavaScript Basics — To-Do List & Weather App",
    projectVideo: {
      title: "To-Do List & Weather App - Complete Project Walkthrough",
      description: "A complete walkthrough of the JavaScript-powered To-Do List & Weather App, explaining DOM manipulation, event handling, and interactive features.",
      whatToCover: "Walk through your To-Do List & Weather App project. Explain how JavaScript adds interactivity, DOM manipulation techniques, event listeners, data structures (arrays/objects), and how the app responds to user input.",
      keyTopics: [
        "DOM selection and manipulation",
        "Event listeners and handling user interactions",
        "Arrays and objects for data storage",
        "Functions and code organization",
        "Dynamic HTML creation with JavaScript",
        "Form handling and validation",
        "Debugging techniques used"
      ]
    }
  },
  {
    phase: "Phase 4: Advanced JavaScript — E-Commerce Site & Chat Application",
    projectVideo: {
      title: "E-Commerce Site & Chat Application - Complete Project Walkthrough",
      description: "A complete walkthrough of the Advanced JavaScript project featuring E-Commerce and Chat functionality with Gemini API integration.",
      whatToCover: "Walk through your E-Commerce Site & Chat Application project. Explain API integration with Gemini, async/await patterns, fetch requests, ES6+ features, error handling, and how different components work together.",
      keyTopics: [
        "API integration and fetch requests",
        "Async/await and Promise handling",
        "ES6+ features (arrow functions, destructuring, template literals)",
        "Error handling and user feedback",
        "Code organization and modularity",
        "State management in the application",
        "Gemini API prompt engineering"
      ]
    }
  },
  {
    phase: "Phase 5: Full-Stack Development — Social Media Platform & Project Management Tool",
    projectVideo: {
      title: "Full-Stack Social Media & Project Management - Complete Project Walkthrough",
      description: "A complete walkthrough of the full-stack project with Node.js/Express backend, covering server setup, API endpoints, and frontend-backend communication.",
      whatToCover: "Walk through your Full-Stack Social Media Platform & Project Management Tool. Explain your Express server setup, API endpoints (GET, POST, PUT, DELETE), middleware usage, frontend-backend communication, and how data flows through the application.",
      keyTopics: [
        "Express server setup and configuration",
        "RESTful API design and endpoints",
        "Middleware (CORS, JSON parsing, custom middleware)",
        "Frontend fetch calls to backend",
        "Error handling on both frontend and backend",
        "Environment variables and configuration",
        "Project file structure and organization"
      ]
    }
  },
  {
    phase: "Phase 6: Deployment & Optimization — Blog Platform & Portfolio Site",
    projectVideo: {
      title: "MongoDB & Mongoose Full-Stack Application - Complete Project Walkthrough",
      description: "A complete walkthrough of the MongoDB-integrated full-stack application, covering database design, Mongoose models, CRUD operations, and deployment.",
      whatToCover: "Walk through your complete full-stack application with MongoDB. Explain your database design, Mongoose schemas and models, CRUD operations, data validation, and the complete flow from user interaction to database storage and back.",
      keyTopics: [
        "MongoDB Atlas setup and connection",
        "Mongoose schemas and models",
        "CRUD operations (Create, Read, Update, Delete)",
        "Data validation and error handling",
        "Frontend to backend to database flow",
        "Deployment considerations",
        "Security best practices"
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
