import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Youtube, Zap, FileJson, Sheet, Film, Code, Layout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AnimatedHeading } from "@/components/AnimatedHeading";
import { MotionWrapper } from "@/components/MotionWrapper";
import { AnimatedIntroText } from "@/components/AnimatedIntroText";
import { CelebrationEffect } from "@/components/CelebrationEffect";
import { motion } from "framer-motion";

const VideoAnalyzer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCelebration, setShowCelebration] = useState(false);
  
  const [videoUrl, setVideoUrl] = useState("https://youtu.be/XLvrN6ZcGQ4?si=cfy2QnblXCd4UEsa&t=1");
  const [videoType, setVideoType] = useState<"concept" | "project">("concept");
  const [projectType, setProjectType] = useState<"Phase1" | "Phase2">("Phase1");
  const [pageName, setPageName] = useState("");
  const [videoDetailsText, setVideoDetailsText] = useState("");
  const [error, setError] = useState("");

  // Ability to explain Rubric
  const abilityToExplainRubric = [
    {
      "Level": "Beginner",
      "Explaination Points need to be present in the Video ": "• The explanation is vague, incomplete, or partially incorrect.• No clear structure; jumps around; hard to follow.• Uses heavy jargon instead of simple language.• No first-principles breakdown (only memorized or surface-level statements).• No examples or analogies to aid understanding.• Cannot simplify the idea or adapt to different audiences.• Cannot link the concept to real-world or practical use.• Does not recognize or address misconceptions; may introduce new ones.• Struggles with follow-up questions.• Contains factual inaccuracies or conceptual errors."
    },
    {
      "Level": "Intermediate",
      "Explaination Points need to be present in the Video ": "• Gives a generally correct definition in their own words.• Understandable but lacks strong flow or logical sequence.• Attempts a breakdown, but shallow or incomplete.• Provides one basic example or analogy.• Can answer simple follow-up questions only.• Minor inaccuracies, missing nuances.• Addresses only obvious misconceptions, misses deeper ones.• Can explain to peers, but not to someone outside the field.• Shows early but incomplete understanding of the concept’s practical relevance."
    },
    {
      "Level": "Advanced",
      "Explaination Points need to be present in the Video ": "• Clear, accurate, logically structured explanation.• Breaks the concept into fundamental components (first principles).• Uses relevant analogies/examples that genuinely help understanding.• Connects the concept to meaningful, real-world applications.• Handles deeper or unexpected follow-up questions confidently.• Shows nuanced understanding with very few gaps.• Recognizes common misconceptions and proactively clarifies them.• Uses mostly simple language but may occasionally use technical terms appropriately.• Demonstrates strong internal understanding of the \"why\" behind the concept."
    },
    {
      "Level": "Expert (Feynman Level)",
      "Explaination Points need to be present in the Video ": "• Can explain the concept to anyone, regardless of background or age.• Builds understanding from first principles step-by-step (foundations → structure → full idea).• Uses multiple well-chosen analogies/examples, making even complex ideas intuitive.• Removes unnecessary complexity while maintaining accuracy — never oversimplifies.• Shows deep nuance (limitations, variations, edge cases, implications).• Anticipates misconceptions before they arise and resolves them clearly.• Offers layered clarity (simple version → deeper version → expert version).• 100% accuracy; no misconceptions or hidden gaps.• Leaves the listener thinking: \"This is so easy — why didn’t anyone explain it like this before?\""
    }
  ];

  // HTML Project Rubric
  const htmlProjectRubric = [
    {
      "Parameter": "Understanding the Problem / Problem Articulation (e.g., \"What is the purpose of this website?\" \"How do your pages connect?\" \"Why are we using only HTML?\")",
      "Weightage (%)": 40,
      "Beginner (1)": "Cannot clearly describe the purpose of the website; can name 1–2 pages but cannot explain their use or how they link. Example: \"I made a homepage and a profile page… not sure why we need the others.\"",
      "Intermediate (2)": "Explains some pages and their purpose, but misses the connections or overall goal; partial awareness of the HTML-only rule. Example: \"I made Home, Profile, and Courses… I think HTML-only means no colors.\"",
      "Advanced (3)": "Explains all pages with purpose and basic connections; understands the goal of focusing on HTML structure. Example: \"Home introduces the portal; Profile shows personal info; Courses lists subjects. HTML-only lets us focus on structure first.\"",
      "Expert (4)": "Clearly explains all pages, their connections, and why HTML-only is used; shows complete understanding and ownership. Example: \"Each page has a role: Home welcomes, Profile shows info, Courses lists subjects, Feedback collects messages, Grades uses a table, Contact gives info. HTML-only helps me learn structure before styling or interactivity.\""
    },
    {
      "Parameter": "Conceptual Clarity (HTML Semantics & Structure) (e.g., \"Why did you use , , or ?\" \"When would you use vs ?\")",
      "Weightage (%)": 40,
      "Beginner (1)": "Uses tags randomly; cannot explain why a tag is used. Example: \"I put everything in … don’t know why.\"",
      "Intermediate (2)": "Shows partial understanding of HTML tags; uses headings, lists, or images but misuses some semantic tags. Example: \"I used for all headings… not sure about .\"",
      "Advanced (3)": "Correctly uses semantic tags; explains why tags are chosen and their hierarchy. Example: \" for top navigation, for closing notes, for lists like hobbies or courses.\"",
      "Expert (4)": "Fully explains semantic structure and tag choices; can teach others why certain tags are used. Example: \" wraps navigation links for clarity and accessibility; separates content logically; used for step-by-step instructions; for unordered lists like hobbies. Tags improve readability and structure.\""
    },
    {
      "Parameter": "Solution Explanation / Communication Skills (e.g., \"Can you explain why you used ?\" \"Why for inputs?\" \"How would you describe your site to another student?\")",
      "Weightage (%)": 20,
      "Beginner (1)": "Cannot explain code or tag choices; struggles to describe purpose of pages. Example: \"I don’t know why I used … it just works.\"",
      "Intermediate (2)": "Explains some tags and basic page flow but reasoning incomplete; communication unclear. Example: \"I used for feedback… not sure why is needed.\"",
      "Advanced (3)": "Explains page flow and tag choices clearly; can describe most decisions and structure. Example: \"I used for Grades; tags connect text to inputs for accessibility; navigation links use .\"",
      "Expert (4)": "Explains all pages, tag choices, and reasoning confidently; can teach others; reflects on best practices. Example: \"I chose for contact info to be semantic; groups Feedback form logically; ensures consistent navigation. Can explain to another student why each tag is used.\""
    }
  ];

  // CSS Project Rubric
  const cssProjectRubric = [
    {
      "Parameter": "Understanding the problem\n\n\n(Sample prompts: 1. Why did you put your CSS like this (inside page, outside file, or in the tag)? 2. Why did you use Flexbox/Grid here instead of another way?\n3. If your project gets bigger, how will your CSS make it easy or hard to manage?)",
      "Weightage (%)": 40,
      "Beginner": "The student added CSS but in a very basic or incorrect way e.g., mixing inline styles in HTML, repeating rules, or only changing colordls and fonts without structure. They cannot explain why CSS is separated from HTML.",
      "Intermediate": "The student used an external CSS file and applied some structured styles. The layout is partly consistent but still uses simple selectors. They know CSS is for design but can’t always explain conflicts (cascade/specificity).",
      "Advanced": "The student’s project shows good CSS structure: consistent classes, external file, and responsive design with media queries. They can clearly explain why they used a layout method (Flexbox/Grid) and how cascade/specificity affects their project.",
      "Expert": "The student’s CSS in the project is scalable and professional: clear naming, modular organization, hover/focus states for interactivity, and accessible styles (e.g., readable colors, spacing). They can link their choices to performance, maintainability, and teamwork."
    },
    {
      "Parameter": "Conceptual Clarity & Understanding of CSS\n\n(Sample prompts: 1. Explain the box model and how it affects spacing, padding, and borders. 2. Difference between Flexbox vs Grid? 3. How do media queries work? 4. Why did you choose relative vs absolute positioning in certain areas? 5. How do units like px, %, em, and rem affect responsiveness?)",
      "Weightage (%)": 40,
      "Beginner": "Weak understanding. Cannot explain box model (e.g., why padding adds space inside a div), cascading, specificity, Flexbox/Grid, or media queries. Misuses units (e.g., sets width 100px instead of % for responsive divs).",
      "Intermediate": "Partial understanding. Knows box model basics (padding, margin, border) and some selectors. Uses Flex/Grid but with errors (e.g., items don’t align vertically). Media queries applied inconsistently. Can partially explain positioning (relative/absolute).",
      "Advanced": "Partial understanding of CSS; knows box model and some selectors; basic Flexbox/Grid; understands media queries but uses inconsistently; can give partial explanation of layout decisions.",
      "Expert": "Deep understanding of CSS; modular and scalable structure; advanced Flexbox/Grid layouts; handles cascading, specificity, and media queries expertly; explains reasoning and trade-offs; can teach others and predict outcomes of code changes."
    },
    {
      "Parameter": "Solution Explanation (Design & Visual)\n\n(Sample prompts: 1. Why did you choose these colors? 2. Explain the spacing choices. 3. How do users know what to click on?, 4. What would happen if we made the browser window really narrow?)",
      "Weightage (%)": 20,
      "Beginner": "The design looks messy. Colors clash, spacing is uneven, and interactive elements don't work well. When asked about choices, they cannot explain why things look the way they do.",
      "Intermediate": "The design is simple but works. There's some attempt to organize things visually. They can give basic reasons for choices, like making important things bigger or more colorful.",
      "Advanced": "The design looks clean and professional. Colors, spacing, and typography work well together. Interactive elements feel responsive. They can clearly explain how their choices improve the user experience.",
      "Expert": "The design is polished and thoughtful. Everything works together consistently. They can explain how their design solves specific problems and works for different users, showing a deep understanding of design principles."
    }
  ];

  // Page options for Phase1 and Phase2
  const pageOptions = [
    "Home Page",
    "Profile Page", 
    "Courses Page",
    "Feedback Page",
    "Grades Table Page",
    "Contact Us Page"
  ];

  // Video details mapping
  const getVideoDetails = () => {
    let details = "";
    
    if (videoType === "concept") {
      details += "Video Content: Concept Explanation\n";
      details += `Page Name: ${pageName}\n`;
      
      switch(`${projectType}-${pageName}`) {
        case "Phase1-Home Page":
          details += `Page Details: HTML only Page
  Video Content Details: 
  • What to cover: Walk through the process of creating a basic homepage using only HTML. Add a title, heading, some paragraph text, and navigation links.
  • Ensure these are answered:
  • What is the purpose of the <head>, <body>, and <title> tags?
  • How do we add links to other pages using <a> tags?
  • What tags are necessary for structuring a home page?
  • How do you create headings (<h1>, <h2>, etc.) and paragraphs (<p>)?`;
          break;
          
        case "Phase1-Profile Page":
          details += `Page Details: HTML only Page
Video Content Details: 
* What to cover: Build a student profile page with an image, an "about me" section, and a list of hobbies.
* Ensure these are answered:
  * How do we embed an image with <img> and what are the essential attributes (src, alt)?
  * What tags help organize sections like hobbies or personal details (e.g., <section>, <div>)?
  * How do unordered lists <ul> and ordered lists <ol> work, and when would you use each?
  * How can you add a line break (<br>) or a horizontal rule (<hr>)?`;
          break;
          
        case "Phase1-Courses Page":
          details += `Page Details: HTML only Page
Video Content Details: 
* What to cover: Create a "My Courses" page that lists all the courses a student is enrolled in, with links to each course's specific page (even if those pages don't exist yet).
* Ensure these are answered:
  * How do you structure a list of items that each have a title and a short description?
  * How can you use <a> tags to create placeholder links for future pages?
  * What is the difference between an absolute URL and a relative URL in a link's href attribute?
  * How can you use heading tags to create a clear hierarchy on the page?`;
          break;
          
        case "Phase1-Feedback Page":
          details += `Page Details: HTML only Page
Video Content Details: 
* What to cover: Build an HTML form that allows students to submit feedback. Include a text area for comments and a submit button.
* Ensure these are answered:
  * What is the purpose of the <form> tag and what are the action and method attributes?
  * How do you create a multi-line text input using <textarea>?
  * What are the different types of <input> tags (e.g., text, email, submit)?
  * How does the <label> tag improve accessibility and user experience?`;
          break;
          
        case "Phase1-Grades Table Page":
          details += `Page Details: HTML only Page
Video Content Details: 
* What to cover: Create a "Grades" page that displays course grades in a structured table format with columns for Course Name, Grade, and Comments.
* Ensure these are answered:
  * What are the essential tags for creating a table (<table>, <tr>, <th>, <td>)?
  * What is the difference between <th> (table header) and <td> (table data)?
  * How do you define the header row of a table?
  * How does the scope attribute (col or row) in a <th> tag help with accessibility?`;
          break;
          
        case "Phase1-Contact Us Page":
          details += `Page Details: HTML only Page
Video Content Details: 
* What to cover: Create a simple "Contact Us" page with an address, a "mailto" link for email, and a "tel" link for a phone number.
* Ensure these are answered:
  * How do you create a link that opens the user's default email client using mailto:?
  * How do you create a clickable phone number link using tel:?
  * What is the best way to format a physical address in HTML for readability?
  * How can you use the <address> tag semantically?`;
          break;
          
        case "Phase2-Home Page":
          details += `Page Details: CSS Styled Page
Video Content Details: 
Briefly show the "before" (HTML-only) version and then the "after" (CSS-styled) version of the page.
Explain Styles: Walk through your CSS file (or the relevant part for that page). Point out the key CSS rules you added for that specific page.
Explain "Why": Describe why you made certain styling choices. For example:
  * Why did you pick a particular color scheme or font?
  * How did Flexbox help you achieve a certain layout?
  * What was your thinking behind the spacing or sizing of elements?
Demonstrate: Show how the CSS rules affect the page in the browser.

Verify whether following Styling & CSS Properties applied to the HTML only page :
  * Welcome Message/Hero Section:
    * <h1>: Make it prominent using font-size, text-align: center;, margin-bottom.
    * Introductory <p>: Use font-size, text-align: center;, max-width, margin: auto; for readability.
  * Curriculum Note: This page reinforces your global styles (nav, header, footer) and lets you practice styling basic text content.`;
          break;
          
        case "Phase2-Profile Page":
          details += `Page Details: CSS Styled Page
Video Content Details: 
Briefly show the "before" (HTML-only) version and then the "after" (CSS-styled) version of the page.
Explain Styles: Walk through your CSS file (or the relevant part for that page). Point out the key CSS rules you added for that specific page.
Explain "Why": Describe why you made certain styling choices. For example:
  * Why did you pick a particular color scheme or font?
  * How did Flexbox help you achieve a certain layout?
  * What was your thinking behind the spacing or sizing of elements?
Demonstrate: Show how the CSS rules affect the page in the browser.

Verify whether following Styling & CSS Properties applied to the HTML only page :
* Styling Focus & CSS Properties:
  * Profile Image (<img>): A great place to practice visual styling.
    * display: block; margin-left: auto; margin-right: auto; (for centering).
    * width, height, border-radius: 50%; (for a circular image – a common design pattern).
    * border, object-fit: cover; (if image aspect ratio needs control).
  * Text Sections (<h2>, <p>, <ul>):
    * Headings (<h2>, <h3>): Reinforce typographic hierarchy. Consider adding border-bottom for subtle separation.
    * Lists (<ul>): list-style-type (or none for custom styling), padding-left.
  * Curriculum Note: Focus on visual presentation of content and spacing (Box Model!).`;
          break;
          
        case "Phase2-Courses Page":
          details += `Page Details: CSS Styled Page
Video Content Details: 
Briefly show the "before" (HTML-only) version and then the "after" (CSS-styled) version of the page.
Explain Styles: Walk through your CSS file (or the relevant part for that page). Point out the key CSS rules you added for that specific page.
Explain "Why": Describe why you made certain styling choices. For example:
  * Why did you pick a particular color scheme or font?
  * How did Flexbox help you achieve a certain layout?
  * What was your thinking behind the spacing or sizing of elements?
Demonstrate: Show how the CSS rules affect the page in the browser.

Verify whether following Styling & CSS Properties applied to the HTML only page :
* Styling Focus & CSS Properties 
  * Course "Cards": Aim to make each course look like a distinct card.
    * If using <ul>/<ol> for courses, style the <li>: background-color, border, border-radius, padding, box-shadow.
    * Container for Cards (<ul> or a parent <div> if you had one): display: flex;, flex-wrap: wrap; (allows cards to go to next line), gap: 20px; (spacing between cards).
    * Individual Cards (<li> or other course item wrapper): flex-basis (e.g., 300px or a percentage to control how many cards per row), display: flex; flex-direction: column; (to help align content within the card, like pushing a "Read More" button to the bottom).
    * Course Title (<h2>): margin-top: 0;
    * Description (<p>): flex-grow: 1; (allows description to take available vertical space within the card).
  * Curriculum Note: This is your primary practice ground for Flexbox layouts and creating modular content blocks (cards).
* Course "Cards": Make each course look like a distinct card. Use background-color, border, border-radius, padding, box-shadow.
* Container for Cards (<div> parent):
  * display: grid;
  * grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); (auto-adjusts number of cards per row)
  * grid-template-rows: set fixed or auto row heights if needed
  * gap: 20px; (spacing between cards)
  * justify-items: start | center | end | stretch (horizontal alignment inside grid cells)
  * align-items: start | center | end | stretch (vertical alignment inside grid cells)
  * justify-content: start | center | space-between | space-evenly (aligns whole grid horizontally in parent)
  * align-content: start | center | space-between | stretch (aligns whole grid vertically in parent)
  * grid-auto-flow: row | column | dense (controls auto-placement of items)
* Individual Cards (<div class="course-card">):
  * Can span multiple columns using grid-column: 1 / 3; or multiple rows with grid-row: 1 / 2;
  * grid-area: if using named template areas
  * Use display: flex; flex-direction: column; inside the card to arrange content vertically and push elements like buttons to the bottom
* Course Title (<h2>): margin-top: 0;
* Description (<p>): Use flex-grow: 1; if nested flex is used inside the card
* Extra per-item controls: justify-self, align-self (override alignment for individual items inside the grid)`;
          break;
          
        case "Phase2-Feedback Page":
          details += `Page Details: CSS Styled Page
Video Content Details: 
Briefly show the "before" (HTML-only) version and then the "after" (CSS-styled) version of the page.
Explain Styles: Walk through your CSS file (or the relevant part for that page). Point out the key CSS rules you added for that specific page.
Explain "Why": Describe why you made certain styling choices. For example:
  * Why did you pick a particular color scheme or font?
  * How did Flexbox help you achieve a certain layout?
  * What was your thinking behind the spacing or sizing of elements?
Demonstrate: Show how the CSS rules affect the page in the browser.

Verify whether following Styling & CSS Properties applied to the HTML only page :
* Recall: Contains a form for user input.
* Key HTML Elements to Style: <form>, <label>, <input> (various types), <textarea>, <button>, <select>.
* Styling Focus & CSS Properties: Making forms user-friendly and visually appealing.
  * Form Container (<form>): max-width, margin: auto;, padding, background-color, border, border-radius, box-shadow.
  * Labels (<label>): display: block; (to stack above inputs), margin-bottom, font-weight: bold;.
  * Input Fields (<input>, <textarea>, <select>):
    * width: 100%; (to fill their container), padding, border, border-radius, font-size. Crucially, box-sizing: border-box; (if not globally set) is very helpful here.
  * Submit Button (<button>): display: block; (or inline-block), width, background-color, color, padding, border: none;, border-radius, cursor: pointer;.
  * Pseudo-classes: input:focus, button:hover – provide essential visual feedback.
  * Curriculum Note: Styling forms is a practical skill. Pay attention to usability (clear labels, good spacing, obvious buttons).`;
          break;
          
        case "Phase2-Grades Table Page":
          details += `Page Details: CSS Styled Page
Video Content Details: 
Briefly show the "before" (HTML-only) version and then the "after" (CSS-styled) version of the page.
Explain Styles: Walk through your CSS file`;
          break;
          
        default:
          details += "Page Details: Custom Page\nVideo Content Details: ";
      }
    } else {
      // For project explanation videos, keep the original textarea
      details = "Enter key:value pairs per line. Example:\nRole and Objective: You are an expert Computer Science Evaluator and Technical Mentor. You are evaluating a Project Explainer Video submitted by a student.\nProject Context & Constraints: The student has built a \"Student Profile & Course Portal.\"\nCRITICAL CONSTRAINT: The project must be HTML ONLY. No CSS and No JavaScript.\nVideo Content: Project Explanation\nVideo Content Details:";
    }
    
    return details;
  };

  // Reset pageName and clear error when switching to project video type
  useEffect(() => {
    if (videoType === "project") {
      setPageName("");
      setError("");
    }
  }, [videoType]);

  // Update video details when selections change
  useEffect(() => {
    if (videoType === "concept" && projectType && pageName) {
      setVideoDetailsText(getVideoDetails());
    } else if (videoType === "project") {
      // For project explanation, generate video details based on selected project type
      let details = "Role and Objective: You are an expert Computer Science Evaluator and Technical Mentor. You are evaluating a Project Explainer Video submitted by a student.\n";
      details += "Project Context & Constraints: The student has built a \"Student Profile & Course Portal.\"\n";
      setVideoDetailsText(details);
    }
  }, [videoType, projectType, pageName]);

  const handleAnalyze = () => {
    setError("");
    
    // Validate video URL
    if (!videoUrl || !videoUrl.includes("youtube.com") && !videoUrl.includes("youtu.be")) {
      setError("Please enter a valid YouTube URL");
      return;
    }

    // Validate that a page is selected when in concept explanation mode
    if (videoType === "concept" && (!pageName || pageName === "")) {
      setError("Please select a page for concept explanation");
      return;
    }

    // Start evaluation (call backend evaluate endpoint)
    setShowCelebration(true);

    // Show persistent toast that will stay until dismissed
    const { dismiss } = toast({ 
      title: "Analysis Started! 🎮", 
      description: "Processing your video with AI...",
      duration: Infinity // Keep toast visible until manually dismissed
    });

    (async () => {
      try {
        let evaluationPayload = {};
        let projectRubric = null;
        
        // Create payload with common fields
        const payload = {
          videoUrl,
          videoDetails: videoDetailsText,
        };
        
        // Determine which rubric to use based on video type
        if (videoType === "concept") {
          // For Concept Explanation, we'll do two evaluations:
          // 1. Accuracy evaluation based on getVideoDetails
          // 2. Ability to explain evaluation based on abilityToExplainRubric
          
          // First, get the accuracy evaluation
          const accuracyPayload = {  
          ...payload, 
          promptbegining: "You are an expert YouTube video evaluator. Evaluate the video according to the provided video details.",
          evaluationType: "accuracy"
             };

          const accuracyResp = await fetch((import.meta.env.VITE_EVAL_API_URL || 'http://localhost:3001') + '/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(accuracyPayload),
          });

          const accuracyData = await accuracyResp.json();
          const accuracyEvaluation = accuracyData.parsed ?? accuracyData;

          // Second, get the ability to explain evaluation
          const abilityPayload = {
            ...payload,
            rubric: abilityToExplainRubric,
          promptbegining: "You are an expert YouTube video evaluator. Evaluate the video according to the provided video details and Rubric.",
            evaluationType: "ability"
                };

          const abilityResp = await fetch((import.meta.env.VITE_EVAL_API_URL || 'http://localhost:3001') + '/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(abilityPayload),
          });

          const abilityData = await abilityResp.json();
          const abilityEvaluation = abilityData.parsed ?? abilityData;
          console.log('Ability Evaluation Response:', abilityData);

          if (!abilityResp.ok) {
            console.error('Ability Evaluation API error', abilityData);
            setShowCelebration(false);
            dismiss(); // Dismiss the processing toast
            
            // Handle specific Gemini API errors
            let errorMessage = 'Ability evaluation failed. See console for details.';
            if (abilityData.status && abilityData.message) {
              errorMessage = `Ability evaluation failed (${abilityData.status}: ${abilityData.statusText}). ${abilityData.message}`;
            }
            
            setError(errorMessage);
            return;
          }

          // Combine both evaluations
          evaluationPayload = {
            accuracy: accuracyEvaluation,
            abilityToExplain: abilityEvaluation
          };
        } else {
          // For Project Explanation, use the appropriate project rubric
          if (projectType === "Phase1") {
            projectRubric = htmlProjectRubric;
          } else {
            projectRubric = cssProjectRubric;
          }
          console.log(' Video Analyze Log : Project evaluation"');
          const projectPayload = {
            ...payload,
            rubric: projectRubric,
            evaluationType: "project"
          };

          const resp = await fetch((import.meta.env.VITE_EVAL_API_URL || 'http://localhost:3001') + '/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectPayload),
          });

          const data = await resp.json();
          evaluationPayload = data.parsed ?? data;

          if (!resp.ok) {
            console.error('Evaluation API error', data);
            setShowCelebration(false);
            dismiss(); // Dismiss the processing toast
            
            // Handle specific Gemini API errors
            let errorMessage = 'Evaluation API returned an error. See console for details.';
            if (data.status && data.message) {
              errorMessage = `Evaluation failed (${data.status}: ${data.statusText}). ${data.message}`;
            }
            
            setError(errorMessage);
            return;
          }
        }

        // Save evaluation to PostgreSQL database
        try {
          // Get current user from Supabase (for user ID only)
          const { supabase } = await import('@/integrations/supabase/client');
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            // Ensure evaluationPayload is properly structured
            //console.log('Evaluation payload before sending to DB:', JSON.stringify(evaluationPayload, null, 2));
            
            // Send data to PostgreSQL via our backend API
            const requestData = {
              userId: user.id,
              userEmail: user.email,
              videoUrl,
              evaluationData: {
                evaluation_result: evaluationPayload ?? {},
                video_type: videoType,
                project_type: videoType === "project" ? projectType : null
              },
              videoDetails: payload?.videoDetails || {},
              videoType,
              projectType,
              pageName: videoType === "concept" ? pageName : null
            };
            
            //console.log('Sending request data to store evaluation:', JSON.stringify(requestData, null, 2));
            
            const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/store-evaluation';
            console.log('Calling API endpoint:', apiUrl);
            
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestData)
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to store evaluation');
            }

            const result = await response.json();
            //console.log('Evaluation stored successfully:', result);
          }
        } catch (dbErr) {
          console.warn('Failed to save evaluation to PostgreSQL:', dbErr);
          // Don't return here - still navigate to results page even if DB save fails
        }

        setTimeout(() => {
          setShowCelebration(false);
          dismiss(); // Dismiss the processing toast before navigation
          // Log what we're sending to the results page
          //console.log('Navigating to results with evaluation:', JSON.stringify(evaluationPayload, null, 2));
          navigate('/analysis-results', { 
            state: { 
              videoUrl, 
              evaluation: evaluationPayload, 
              videoDetails: payload?.videoDetails,
              videoType,
              projectType,
              projectRubric,
              pageName: videoType === "concept" ? pageName : null
            } 
          });
        }, 800);
      } catch (err: any) {
        console.error('Evaluation error', err);
        setShowCelebration(false);
        dismiss(); // Dismiss the processing toast on error
        setError('Evaluation failed. See console for details.');
      }
    })();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Celebration Effect */}
      <CelebrationEffect 
        show={showCelebration} 
        onComplete={() => setShowCelebration(false)}
        message="Mission Complete 🚀"
      />
      
      <Header />
      
      <main className="container mx-auto px-4 py-12 flex-1">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <AnimatedIntroText 
            text="Analyzing brilliance in progress… ⚡" 
            direction="up" 
          />
          <AnimatedHeading className="text-5xl md:text-7xl font-black uppercase mb-4">
            <span className="text-primary">YouTube</span> Video
            <br />
            Feedback 
          </AnimatedHeading>
          <MotionWrapper delay={0.3} direction="zoom">
            <p className="text-xl font-bold max-w-2xl mx-auto">
              Power up your content with AI-driven feedback analysis! 🎮
            </p>
          </MotionWrapper>
        </div>

        {/* Main Form Card */}
        <MotionWrapper delay={0.4} direction="up">
          <Card className="max-w-4xl mx-auto p-8 md:p-12">
          <div className="space-y-8">
            {/* Video Type Selection */}
            <div className="space-y-3">
              <Label className="text-xl font-black uppercase flex items-center gap-2">
                <Film className="w-6 h-6" />
                Video Type
              </Label>
              <div className="flex gap-4">
                <Button
                  variant={videoType === "concept" ? "default" : "outline"}
                  size="lg"
                  onClick={() => {
                    setVideoType("concept");
                    setError("");
                  }}
                  className="flex-1"
                >
                  Concept Explanation
                </Button>
                <Button
                  variant={videoType === "project" ? "default" : "outline"}
                  size="lg"
                  onClick={() => {
                    setVideoType("project");
                    setError("");
                  }}
                  className="flex-1"
                >
                  Project Explanation
                </Button>
              </div>
            </div>

            {/* Project Type Selection (shown for both concept and project explanation) */}
            <div className="space-y-3">
              <Label className="text-xl font-black uppercase flex items-center gap-2">
                <Code className="w-6 h-6" />
                Select Project
              </Label>
              <div className="flex gap-4">
                <Button
                  variant={projectType === "Phase1" ? "default" : "outline"}
                  size="lg"
                  onClick={() => {
                    setProjectType("Phase1");
                    setPageName(""); // Reset page selection when project changes
                  }}
                  className="flex-1"
                >
                  Phase1
                </Button>
                <Button
                  variant={projectType === "Phase2" ? "default" : "outline"}
                  size="lg"
                  onClick={() => {
                    setProjectType("Phase2");
                    setPageName(""); // Reset page selection when project changes
                  }}
                  className="flex-1"
                >
                  Phase2
                </Button>
              </div>
            </div>

            {/* Page Selection (only for concept explanation) */}
            {videoType === "concept" && (
              <div className="space-y-3">
                <Label className="text-xl font-black uppercase flex items-center gap-2">
                  <Layout className="w-6 h-6" />
                  Select Page
                </Label>
                <Select onValueChange={setPageName} value={pageName}>
                  <SelectTrigger className="w-full text-lg h-12">
                    <SelectValue placeholder="Select a page" />
                  </SelectTrigger>
                  <SelectContent>
                    {pageOptions.map((page) => (
                      <SelectItem key={page} value={page}>
                        {page}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Video URL Input */}
            <div className="space-y-3">
              <Label className="text-xl font-black uppercase flex items-center gap-2">
                <Youtube className="w-6 h-6" />
                Video URL
              </Label>
              <Input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="font-mono text-lg placeholder:font-mono"
              />
            </div>
            {/* Error Display */}
            {error && (
              <div className="border-4 border-destructive bg-destructive/10 p-6 shadow-brutal">
                <p className="text-destructive font-black uppercase text-center">
                  ⚠️ {error}
                </p>
              </div>
            )}

            {/* Analyze Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={handleAnalyze}
                size="lg"
                variant="default"
                className="w-full text-2xl h-16"
              >
                🎯 ANALYZE VIDEO
              </Button>
            </motion.div>
          </div>
        </Card>
        </MotionWrapper>
      </main>

      <Footer />
    </div>
  );
};

export default VideoAnalyzer;
