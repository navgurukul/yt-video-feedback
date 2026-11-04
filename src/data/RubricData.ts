// Ability to Explain Rubric - Used for Concept Explanation Videos
export const abilityToExplainRubric = [
  {
    "Level": "Beginner",
    "Explaination Points need to be present in the Video ": "• The explanation is vague, incomplete, or partially incorrect.• No clear structure; jumps around; hard to follow.• Uses heavy jargon instead of simple language.• No first-principles breakdown (only memorized or surface-level statements).• No examples or analogies to aid understanding.• Cannot simplify the idea or adapt to different audiences.• Cannot link the concept to real-world or practical use.• Does not recognize or address misconceptions; may introduce new ones.• Struggles with follow-up questions.• Contains factual inaccuracies or conceptual errors."
  },
  {
    "Level": "Intermediate",
    "Explaination Points need to be present in the Video ": "• Gives a generally correct definition in their own words.• Understandable but lacks strong flow or logical sequence.• Attempts a breakdown, but shallow or incomplete.• Provides one basic example or analogy.• Can answer simple follow-up questions only.• Minor inaccuracies, missing nuances.• Addresses only obvious misconceptions, misses deeper ones.• Can explain to peers, but not to someone outside the field.• Shows early but incomplete understanding of the concept's practical relevance."
  },
  {
    "Level": "Advanced",
    "Explaination Points need to be present in the Video ": "• Clear, accurate, logically structured explanation.• Breaks the concept into fundamental components (first principles).• Uses relevant analogies/examples that genuinely help understanding.• Connects the concept to meaningful, real-world applications.• Handles deeper or unexpected follow-up questions confidently.• Shows nuanced understanding with very few gaps.• Recognizes common misconceptions and proactively clarifies them.• Uses mostly simple language but may occasionally use technical terms appropriately.• Demonstrates strong internal understanding of the \"why\" behind the concept."
  },
  {
    "Level": "Expert (Feynman Level)",
    "Explaination Points need to be present in the Video ": "• Can explain the concept to anyone, regardless of background or age.• Builds understanding from first principles step-by-step (foundations → structure → full idea).• Uses multiple well-chosen analogies/examples, making even complex ideas intuitive.• Removes unnecessary complexity while maintaining accuracy — never oversimplifies.• Shows deep nuance (limitations, variations, edge cases, implications).• Anticipates misconceptions before they arise and resolves them clearly.• Offers layered clarity (simple version → deeper version → expert version).• 100% accuracy; no misconceptions or hidden gaps.• Leaves the listener thinking: \"This is so easy — why didn't anyone explain it like this before?\""
  }
];

// Phase 1 Rubric - HTML Project Evaluation
export const Phase1Rubric = [
  {
    "Parameter": "Understanding the Problem / Problem Articulation (e.g., “What is the purpose of this website?” “How do your pages connect?” “Why are we using only HTML?”)",
    "Weightage (%)": 15,
    "Beginner (1)": "Cannot clearly describe the purpose of the website; can name 1–2 pages but cannot explain their use or how they link. Example: “I made a homepage and a profile page… not sure why we need the others.”",
    "Intermediate (2)": "Explains some pages and their purpose, but misses the connections or overall goal; partial awareness of the HTML-only rule. Example: “I made Home, Profile, and Courses… I think HTML-only means no colors.”",
    "Advanced (3)": "Explains all pages with purpose and basic connections; understands the goal of focusing on HTML structure. Example: “Home introduces the portal; Profile shows personal info; Courses lists subjects. HTML-only lets us focus on structure first.”",
    "Expert (4)": "Clearly explains all pages, their connections, and why HTML-only is used; shows complete understanding and ownership. Example: “Each page has a role: Home welcomes, Profile shows info, Courses lists subjects, Feedback collects messages, Grades uses a table, Contact gives info. HTML-only helps me learn structure before styling or interactivity.”",
    "": "",
    "Checklist": [
      "Names all required pages for this phase's project",
      "States the specific purpose of at least 4 individual pages (not just a list)",
      "Explains how the pages connect/link to each other via navigation",
      "States the overall goal/purpose of the website as a whole",
      "Explains why the project uses HTML only at this stage (no CSS/JS)",
      "Uses specific page names when explaining (not just \"the pages\")",
      "Shows ownership/reflection (\"I structured it this way because...\") rather than reading a script"
    ]
  },
  {
    "Parameter": "Visual Appeal (Structure-only readability) (e.g., “Is content organized even without CSS?” “Are headings, lists, and paragraphs easy to read?”)",
    "Weightage (%)": 20,
    "Beginner (1)": "Layout confusing or cluttered; headings, lists, or paragraphs hard to follow. Example: All text appears in one block; lists mixed with paragraphs; hard to read.",
    "Intermediate (2)": "Basic layout readable; some headings or lists misaligned; content visually uneven. Example: Courses listed in one paragraph instead of a or ; headings inconsistent.",
    "Advanced (3)": "Layout clear and organized; headings, lists, and paragraphs structured for easy reading; consistent across pages. Example: Home page introduces portal with and ; Courses page lists subjects using cleanly.",
    "Expert (4)": "Layout highly readable and intuitive; semantic tags improve flow; content balanced even without styling. Example: Feedback form sections separated clearly with ; Grades table easy to read; headings guide user naturally through all pages.",
    "Checklist": [
      "Headings are used to separate sections (not just plain paragraph text)",
      "Lists (ul/ol) are used for list-type content instead of plain paragraphs",
      "Content order/flow makes sense even with no CSS applied",
      "Grades/data-heavy content uses a table, not free text",
      "Forms/inputs (Feedback page) are structured with labels",
      "Layout is visually consistent across pages, even unstyled",
      "Explains a specific structural decision (e.g., why a heading level or list was used)"
    ]
  },
  {
    "Parameter": "Solution Explanation / Communication Skills (e.g., “Can you explain why you used ?” “Why for inputs?” “How would you describe your site to another student?”)",
    "Weightage (%)": 20,
    "Beginner (1)": "Cannot explain code or tag choices; struggles to describe purpose of pages. Example: “I don’t know why I used … it just works.”",
    "Intermediate (2)": "Explains some tags and basic page flow but reasoning incomplete; communication unclear. Example: “I used for feedback… not sure why is needed.”",
    "Advanced (3)": "Explains page flow and tag choices clearly; can describe most decisions and structure. Example: “I used for Grades; tags connect text to inputs for accessibility; navigation links use .”",
    "Expert (4)": "Explains all pages, tag choices, and reasoning confidently; can teach others; reflects on best practices. Example: “I chose for contact info to be semantic; groups Feedback form logically; ensures consistent navigation. Can explain to another student why each tag is used.”",
    "": "",
    "Checklist": [
      "Explains why at least 3 specific HTML tags were chosen (not just \"it works\")",
      "Explains the purpose of form-related tags (label, input) if used",
      "Describes page flow/navigation in their own words",
      "Connects tag choices to accessibility or semantics",
      "Can answer a follow-up \"why\" question about a specific tag",
      "Explanation is fluent, not read verbatim from notes",
      "Could describe the site clearly enough for another student to understand it"
    ]
  }
];

// Phase 2 Rubric - CSS Project Evaluation
export const Phase2Rubric = [
  {
    "Parameter": "Understanding the problem\n\n\n(Sample prompts: 1. Why did you put your CSS like this (inside page, outside file, or in the tag)? 2. Why did you use Flexbox/Grid here instead of another way? \n3. If your project gets bigger, how will your CSS make it easy or hard to manage?)",
    "Weightage (%)": 15,
    "Beginner (1)": "The student added CSS but in a very basic or incorrect way e.g., mixing inline styles in HTML, repeating rules, or only changing colordls and fonts without structure. They cannot explain why CSS is separated from HTML.",
    "Intermediate (2)": "The student used an external CSS file and applied some structured styles. The layout is partly consistent but still uses simple selectors. They know CSS is for design but can’t always explain conflicts (cascade/specificity).",
    "Advanced (3)": "The student’s project shows good CSS structure: consistent classes, external file, and responsive design with media queries. They can clearly explain why they used a layout method (Flexbox/Grid) and how cascade/specificity affects their project.",
    "Expert (4)": "The student’s CSS in the project is scalable and professional: clear naming, modular organization, hover/focus states for interactivity, and accessible styles (e.g., readable colors, spacing). They can link their choices to performance, maintainability, and teamwork.",
    "": "",
    "Checklist": [
      "States where their CSS lives (external file vs inline vs style tag) and why",
      "Explains at least one layout method used (Flexbox/Grid) and why chosen over alternatives",
      "Mentions cascade or specificity when relevant, even briefly",
      "Explains how their CSS would scale if the project got bigger",
      "Uses an external stylesheet rather than only inline styles",
      "Structured selectors (classes) rather than repeated inline rules",
      "Discusses maintainability or organization of the CSS"
    ]
  },
  {
    "Parameter": "Visual Appeal\n\n(Sample prompts: 1. Why did you choose these colors? 2. How did you ensure consistency across pages (colors, buttons, headings, spacing? 3. How do users know what to click on? 4. How did you decide spacing, padding, and margins between elements?)",
    "Weightage (%)": 30,
    "Beginner (1)": "Design is messy. E.g., buttons blend into the background, headings the same size as body text, links hard to identify, colors clash. Cannot justify why red was used for headings or why spacing is inconsistent.",
    "Intermediate (2)": "Design simple but functional. E.g., headings slightly larger than body, buttons a different color, sections somewhat separated, but spacing/alignment inconsistent. Can explain some choices like “made buttons stand out” but not fully.",
    "Advanced (3)": "Design clean and professional. E.g., headings larger and bold, buttons colored and hover effect added, consistent margins/padding, readable fonts. Can explain how these choices improve readability and UX, e.g., “added 20px margin between sections for clarity.”",
    "Expert (4)": "Design polished, thoughtful, and consistent. E.g., clear hierarchy (h1 > h2 > h3), consistent spacing (margin/padding uniform), accessible colors (contrast ratio meets standards), interactive elements intuitive (hover/focus states). Can explain how decisions solve user problems, enhance engagement, and improve overall learning experience.",
    "": "",
    "Checklist": [
      "Headings and body text are visually distinguishable (size/weight)",
      "Buttons/links are visually distinct from static text",
      "Spacing (margin/padding) is consistent across sections/pages",
      "Explains a specific color choice, not just \"I liked it\"",
      "Explains a specific spacing/alignment decision",
      "Hover or focus states are present on interactive elements",
      "Layout remains usable if the browser window is narrowed (responsive awareness)"
    ]
  },
  {
    "Parameter": "Solution Explanation (Design & Visual)\n\n(Sample prompts: 1. Why did you choose these colors? 2. Explain the spacing choices. 3. How do users know what to click on?, 4. What would happen if we made the browser window really narrow?)",
    "Weightage (%)": 15,
    "Beginner (1)": "The design looks messy. Colors clash, spacing is uneven, and interactive elements don't work well. When asked about choices, they cannot explain why things look the way they do.",
    "Intermediate (2)": "The design is simple but works. There's some attempt to organize things visually. They can give basic reasons for choices, like making important things bigger or more colorful.",
    "Advanced (3)": "The design looks clean and professional. Colors, spacing, and typography work well together. Interactive elements feel responsive. They can clearly explain how their choices improve the user experience.",
    "Expert (4)": "The design is polished and thoughtful. Everything works together consistently. They can explain how their design solves specific problems and works for different users, showing a deep understanding of design principles.",
    "": "",
    "Checklist": [
      "Explains why specific colors were chosen",
      "Explains spacing/layout choices with reasoning, not just description",
      "Explains how users are guided to what's clickable",
      "Addresses what happens on a narrow/small screen",
      "Explanation is specific to their project, not generic CSS theory",
      "Connects visual choices to user experience, not just aesthetics",
      "Speaks confidently/fluently, not reading from a script"
    ]
  }
];

// Phase 3 Rubric - JavaScript Project Evaluation
export const Phase3Rubric = [
  {
    "Parameter": "Understanding the Problem / Problem Articulation (e.g., “What is the goal of this project?” “Why is JS needed?” “How does JS make your quiz interactive?”)",
    "Weightage (%)": 10,
    "Beginner (1)": "Cannot clearly describe the project; mixes up quiz flow and features; cannot say why JS is needed.",
    "Intermediate (2)": "States the main goal (quiz app) and mentions some role of JS (e.g., buttons, navigation) but misses finer details.",
    "Advanced (3)": "Explains project goal and role of each feature; describes how JS makes pages interactive (questions load, score updates).",
    "Expert (4)": "Connects project to bigger learning outcomes; explains why certain JS concepts were chosen; links interactivity to clarity, usability, and learning.",
    "Checklist": [
      "States the overall goal of the quiz app clearly",
      "Explains why JavaScript specifically is needed (not CSS/HTML)",
      "Describes at least 2 specific interactive features (e.g., button clicks, score update)",
      "Explains how JS makes the page interactive, not just \"it works\"",
      "Connects specific JS concepts to specific features (e.g., \"arrays store questions\")",
      "Explains the quiz flow (Start to Quiz to Results) accurately",
      "Reflects on why this project structure supports learning/usability"
    ]
  },
  {
    "Parameter": "Visual Appeal (“Is the Start Quiz button clearly visible and distinct?” “How easy is it for a user to read questions and options?”\n“Are colors, fonts, and spacing consistent across all pages?” “Does the layout help guide the user naturally from Start → Quiz → Results?”\n“Are interactive elements (buttons, answer options) easy to click and responsive?” “How would you improve the visual hierarchy or readability of your quiz?”)",
    "Weightage (%)": 10,
    "Beginner (1)": "Layout is confusing or cluttered; buttons and text hard to read; colors clash or are inconsistent; quiz sections not clearly separated; interactive elements (Start, Next, Restart) are difficult to identify.",
    "Intermediate (2)": "Basic layout with some consistency; buttons or text may be misaligned; colors and fonts mostly readable but not polished; minor issues with spacing or section separation; some interactive elements may be slightly confusing.",
    "Advanced (3)": "Layout is consistent and organized; buttons, text, and sections are clear and readable; colors and fonts are pleasant and uniform; spacing, alignment, and sectioning make navigation easy; interactive elements are easy to identify and use.",
    "Expert (4)": "Layout is polished, intuitive, and visually engaging; buttons, text, and quiz sections are highly readable and well-aligned; color scheme, fonts, and spacing are consistent and enhance user experience; interactive elements are visually distinct and guide the user naturally; overall UI/UX demonstrates attention to detail, accessibility, and usability.",
    "Checklist": [
      "Start/Next/Restart buttons are clearly visible and distinct",
      "Questions and answer options are easy to read",
      "Colors and fonts are consistent across all quiz screens",
      "Layout guides the user naturally from Start to Quiz to Results",
      "Interactive elements are easy to click/tap and respond visibly",
      "Explains a specific visual/UX decision, not just \"it looks fine\"",
      "Can name a specific improvement they'd make to visual hierarchy"
    ]
  },
  {
    "Parameter": "Solution Explanation / Communication\n(e.g., “Can you explain what happens when the user clicks Start Quiz?” “How is the final score calculated and displayed?” “Which JS concepts did you use to make questions appear dynamically?” “How did you use Arrays and Objects to store questions and answers?” “Why did you choose this structure for your code?” “Did you encounter any errors while implementing the quiz? How did you debug them?” “How did you test that all edge cases are handled?” “Which part of this project helped you understand JavaScript concepts the most?”)",
    "Weightage (%)": 10,
    "Beginner (1)": "Can only read the code without explaining its functionality; struggles to describe the quiz flow; cannot identify which JS concepts are used; cannot justify any design or implementation choices.",
    "Intermediate (2)": "Explains parts of the code and some JS concepts, such as variables or functions; describes basic flow of the quiz (Start, Next, Results) but reasoning is shallow; can provide limited justification for choices; partially explains debugging or handling skipped questions.",
    "Advanced (3)": "Explains project flow clearly, including how Start, Next, Results, and Restart work; describes which JS concepts are applied (functions, arrays, objects, DOM, events, conditional statements) and why; can justify main design choices; explains how user interactions are handled and some edge cases; demonstrates understanding of debugging and problem-solving process; can summarize learning points from the project.",
    "Expert (4)": "Explains the project comprehensively and confidently, as if teaching a peer; describes in-depth every feature, including quiz flow, score calculation, handling skipped/invalid answers, and restart mechanism; explains the purpose of each function, data structure, and DOM manipulation; reflects on why specific JS concepts were chosen and how they enhance interactivity; discusses design decisions, usability, and visual appeal; anticipates potential issues or edge cases and explains how they are addressed; reflects on learning outcomes and explains how the project deepened understanding of JS concepts.",
    "Checklist": [
      "Explains what happens when Start Quiz is clicked, step by step",
      "Explains how the score is calculated and displayed",
      "Names specific JS concepts used (arrays, objects, DOM, events, conditionals)",
      "Explains why they structured their code the way they did",
      "Describes at least one bug/error and how it was debugged",
      "Explains how edge cases (skipped/invalid answers) are handled",
      "Reflects on which JS concept helped them understand the most"
    ]
  }
] ;

// Phase 4 Rubric - Advanced JavaScript & API Integration Evaluation
export const Phase4Rubric = [
  {
    "Parameter": "Understanding the Problem\n\n\n1. Explain how your app sends a request to Gemini and receives the response.\n2. Why did you choose async/await here?\n3. How does user input flow through your system?\n4. What would break if Gemini returns an unexpected response?\n5. Why did you structure your code this way?",
    "Weightage (%)": 20,
    "Beginner (1)": "The student uses ES6 and fetch(), but in a basic or incorrect way. They cannot clearly explain how async code works, why APIs require Promises, or how data flows from request - response - UI. Their reasoning feels guess-based, and they mix old JavaScript patterns with ES6.",
    "Intermediate (2)": "The student shows a partial understanding of modern JavaScript features and can describe the “general idea” behind API calls. They correctly use some ES6 (like let/const, template literals), but cannot fully justify their choices or explain async behavior deeply. Their understanding of the overall architecture is incomplete.",
    "Advanced (3)": "The student demonstrates a clear understanding of ES6 and the request/response cycle. They explain how user inputs become prompts, how fetch() works, how async/await helps, and how responses are parsed and rendered. They justify their file structure, explain why they used specific ES6 techniques, and reason through API workflows with confidence.",
    "Expert (4)": "The student deeply understands JavaScript architecture, async design patterns, and API communication. They explain trade-offs (Promises vs async/await), modular code organization, error handling strategies, scalability, and maintainability. They can predict failure cases, data inconsistencies, and performance implications like a professional engineer.",
    "Checklist": [
      "Explains how the app sends a request to Gemini and receives a response",
      "Justifies why async/await is used, not just \"because we were told to\"",
      "Traces how user input flows through the system to the API and back",
      "Explains what would happen if Gemini returns an unexpected/error response",
      "Justifies their file/code structure with reasoning",
      "Uses ES6 features (let/const, template literals, destructuring) correctly and can name them",
      "Ties the explanation to their actual code, not generic API theory"
    ]
  },
  {
    "Parameter": "Solution Explanation\n\n\n1. Why did you design your UI this way?\n2. How does the user understand what your app is doing?\n3. Explain why you placed this logic in a separate function.\n4. What would happen if the screen became very narrow?\n5. How does your design improve user experience?",
    "Weightage (%)": 20,
    "Beginner (1)": "The student cannot clearly explain why they wrote their code the way they did. Their reasoning is unclear or mixed up. They struggle to describe how their JS decisions affect user experience or API behavior.",
    "Intermediate (2)": "The student provides a basic explanation of what they built and some reasoning behind their choices. They can describe their logic but not deeply justify it. Their explanation lacks flow or user-centered thinking.",
    "Advanced (3)": "The student clearly explains their technical and design decisions, connecting ES6 choices, async logic, and UI behavior. They articulate how their structure improves readability, scalability, and user experience. Their reasoning is organized and confident.",
    "Expert (4)": "The student offers thoughtful, precise, and intuitive explanations. They justify architectural choices, async handling, user flows, error handling, and UI design with clarity. They communicate like someone who deeply understands their project and could teach it to others.",
    "Checklist": [
      "Explains their specific UI design decisions",
      "Explains how the user is informed of what the app is doing (loading/errors)",
      "Justifies why logic was placed in a separate function/module",
      "Addresses what happens on a narrow screen or with different input sizes",
      "Connects design choices explicitly to user experience",
      "Explains error-handling behavior for failed API calls",
      "Speaks with specific, concrete detail rather than general statements"
    ]
  }
];

// Phase 5 Rubric - Backend with Node.js & Express Evaluation
export const Phase5Rubric = [
  {
    "Parameter": "Understanding the Problem / Backend Architecture Awareness\n\n\n(e.g., “Why do we need a backend?” \n\n“What is client-server architecture?” \n\n“Why should API keys stay on the server?”)",
    "Weightage (%)": 15,
    "Beginner (1)": "Cannot clearly explain why backend exists; thinks it is just another JS file. Example: “Frontend sends data… backend gives response.”",
    "Intermediate (2)": "Explains basic frontend → backend flow but lacks deeper reasoning. Example: “Backend processes request and sends it back.”",
    "Advanced (3)": "Clearly explains how the client and server work together, why their responsibilities should be kept separate, and why sensitive information like API keys must be stored only on the backend for security.",
    "Expert (4)": "Fully understands backend architecture; confidently explains scalability, security, API protection, and real-world server responsibility.",
    "Checklist": [
      "Explains why a backend is needed at all, not just \"it responds to requests\"",
      "Describes client-server architecture in their own words",
      "Explains why API keys must stay on the server, not the frontend",
      "Describes the request-processing-response flow accurately",
      "Distinguishes frontend responsibility from backend responsibility",
      "Mentions a security or scalability consideration",
      "Explanation reflects their actual project, not a generic definition"
    ]
  },
  {
    "Parameter": "Solution Explanation \n\n\n(e.g., “Walk me through your system.” \n\n“What happens when a user sends a request?” \n\n“How would you improve this system?”)",
    "Weightage (%)": 15,
    "Beginner (1)": "Struggles to explain system flow; explains code line-by-line without logic.",
    "Intermediate (2)": "Explains basic request-response flow but lacks structured reasoning.",
    "Advanced (3)": "Clearly explains full frontend → backend → external API → response cycle with confidence.",
    "Expert (4)": "Explains system like a backend engineer; discusses improvements, scalability, deployment considerations, and future enhancements clearly and confidently.",
    "Checklist": [
      "Walks through the full system flow, not just isolated code lines",
      "Explains what happens end-to-end when a user sends a request",
      "Names specific Express routes/middleware used",
      "Explains the role of environment variables / API key handling",
      "Explains how the response is sent back to the frontend",
      "Suggests at least one specific, real improvement to the system",
      "Speaks with structured, logical flow rather than line-by-line narration"
    ]
  }
];

// Phase 6 Rubric - MongoDB & Mongoose Evaluation
export const Phase6Rubric = [
  {
    "Parameter": "Understanding the Problem/Database Architecture Awareness\n\n\n(e.g., \n\n\n• Why do web applications need databases?\n\n\n• What is MongoDB, and how is it different from traditional databases?\n\n\n• What role does Mongoose play in Node.js applications?)",
    "Weightage (%)": 15,
    "Beginner (1)": "Cannot clearly explain the purpose of databases; thinks MongoDB is just a place to store random data, with a limited understanding of how the backend communicates with the database.",
    "Intermediate (2)": "Explains that databases store application data, but lacks clarity on database structure or MongoDB concepts.",
    "Advanced (3)": "Clearly explains why applications need databases, how MongoDB stores data as documents, and how Mongoose helps interact with the database.",
    "Expert (4)": "Demonstrates a strong understanding of database architecture, explaining collections, documents, schemas, and how backend systems manage persistent data in real applications.",
    "Checklist": [
      "Explains why the application needs a database, not just \"to store data\"",
      "Explains what MongoDB is and how it differs from a plain file/array",
      "Explains Mongoose's role in connecting Node.js to MongoDB",
      "Mentions collections/documents/schemas accurately",
      "Explains how the backend communicates with the database",
      "Distinguishes schema design from ad-hoc data storage",
      "Explanation is specific to their own schema, not generic"
    ]
  },
  {
    "Parameter": "Solution Explanation(Database Operations & Data Flow Understanding)\n\n\n(e.g., \n\n\n• What happens when a user submits feedback?\n\n• How is data stored and retrieved from MongoDB?\n\n• How does data travel from the database to the frontend?\n\n)",
    "Weightage (%)": 15,
    "Beginner (1)": "Cannot clearly explain how data flows between frontend, backend, and database.",
    "Intermediate (2)": "Understands basic data saving and retrieval but struggles to explain the full data lifecycle.",
    "Advanced (3)": "Clearly explains data flow: frontend form → backend route → database storage → backend retrieval → frontend display.",
    "Expert (4)": "Demonstrates strong understanding of data lifecycle, request handling, query execution, and structured response formatting for frontend display.",
    "Checklist": [
      "Explains what happens when a user submits feedback, end-to-end",
      "Explains how data is saved to MongoDB (.save() or equivalent)",
      "Explains how data is retrieved from MongoDB (.find() or equivalent)",
      "Traces the full flow: frontend form to backend route to database to response",
      "Mentions data validation or error handling",
      "Explains how retrieved data is displayed back on the frontend",
      "Speaks with an accurate, structured lifecycle explanation"
    ]
  }
];

// Phase 7 Rubric - CollabSphere Full-Stack Capstone Project Evaluation
export const Phase7Rubric = [
  {
    "Parameter": "Understanding the Problem & System Architecture Awareness (e.g., Why is authentication required? Why use AI integration? How do frontend, backend, database, and AI interact together?)",
    "Weightage (%)": 15,
    "Beginner (1)": "Cannot clearly explain system architecture or purpose of AI integration; limited understanding of how different parts of the application communicate.",
    "Intermediate (2)": "Understands frontend/backend/database basics but struggles to explain scalability, AI workflows, or authentication flow clearly.",
    "Advanced (3)": "Clearly explains architecture, authentication flow, API structure, database usage, and why AI is integrated into the application.",
    "Expert (4)": "Demonstrates strong architectural understanding, explaining scalable application flow, AI request lifecycle, modular backend design, and production-level system thinking.",
    "Checklist": [
      "Explains why authentication is required for this application",
      "Explains why AI integration was added and what problem it solves",
      "Describes how frontend, backend, database, and AI service interact",
      "Mentions security considerations (JWT, bcrypt, or equivalent)",
      "Explains a specific architectural decision with reasoning",
      "Distinguishes their explanation from a generic full-stack description",
      "Shows awareness of scalability or production-readiness"
    ]
  },
  {
    "Parameter": "Solution Explanation (Project Flow & AI/Data Lifecycle Understanding) (e.g., What happens when a user logs in? How does AI generate responses? How does data move across the system?)",
    "Weightage (%)": 15,
    "Beginner (1)": "Cannot explain complete project flow or how requests move through the system.",
    "Intermediate (2)": "Understands basic request-response cycle but struggles to explain AI flow or authentication lifecycle completely.",
    "Advanced (3)": "Clearly explains frontend → backend → database → AI API → frontend lifecycle with proper request handling.",
    "Expert (4)": "Demonstrates strong understanding of complete application lifecycle including authentication validation, middleware execution, database queries, AI request/response processing, and frontend rendering flow.",
    "Checklist": [
      "Explains what happens when a user logs in, step by step",
      "Explains how the AI generates and returns a response",
      "Traces how data moves across frontend to backend to database to AI to frontend",
      "Explains authentication/middleware validation in the request flow",
      "Mentions error handling for failed AI or database calls",
      "Names specific project features tied to specific code, not generic",
      "Reflects on a real limitation or improvement for the system"
    ]
  }
];

// Phase 8 Rubric - Python Basics Project Evaluation
export const Phase8Rubric = [
  {
    "Parameter": "Understanding the Problem & System Architecture Awareness (e.g., Why use Python? What is FastAPI? How do API routes, validation, services, CSV storage, and analytics work together?)",
    "Weight": 0.15,
    "Beginner": "Cannot clearly explain the purpose of the Expense Tracker API or the role of Python and FastAPI. Has limited understanding of REST APIs, HTTP methods, or how expense data is stored and retrieved.",
    "Intermediate": "Understands basic Python syntax, REST APIs, and FastAPI routes but struggles to explain the overall project architecture, separation of responsibilities, or the role of Pandas and NumPy.",
    "Advanced": "Clearly explains the purpose of the Expense Tracker API, REST architecture, request/response cycle, project structure, CSV storage, Pydantic validation, and the use of Pandas and NumPy for analytics. Can explain key differences between Python and JavaScript and identify suitable use cases for each.",
    "Expert": "Demonstrates strong system-level understanding, explaining modular backend architecture, separation of API, service, and analytics layers, data handling decisions, API design, and the trade-offs of CSV versus database storage. Clearly justifies technology choices and identifies practical opportunities for scalability and future improvements."
  },
  {
    "Parameter": "Solution Explanation (API Request Flow & Data Lifecycle Understanding) (e.g., What happens when an expense is created? How is it validated, stored, updated, deleted, and included in analytics?)",
    "Weight": 0.15,
    "Beginner": "Cannot explain the complete request-to-response flow. Struggles to describe how data reaches an endpoint, how an expense is stored, or how the API returns results and errors.",
    "Intermediate": "Explains a basic API request/response cycle and some CRUD operations but cannot consistently describe validation, service-layer logic, CSV updates, or analytics processing.",
    "Advanced": "Clearly explains the complete flow: client request → FastAPI route → Pydantic validation → service/business logic → CSV read/write → JSON response. Explains how Pandas and NumPy are used to calculate reports and how errors are returned for invalid input or missing expenses.",
    "Expert": "Demonstrates a thorough understanding of the complete application lifecycle, including request parsing, validation, routing, service-layer execution, file persistence, data aggregation, response serialization, HTTP status codes, and exception handling. Can trace a request through the relevant files, explain failure scenarios, and identify improvements to reliability, maintainability, and performance."
  }
];

// Phase 9 Rubric - Foundations of AI and Machine Learning Project Evaluation
export const Phase9Rubric = [
  {
    "Parameter": "Understanding the Problem & System Architecture Awareness (e.g., What is AI/ML? Why is AI integrated into OpsLens? How do incident data, backend APIs, ML models or LLMs, and the frontend interact?)",
    "Weight": 0.15,
    "Beginner": "Cannot clearly explain the purpose of OpsLens or the difference between artificial intelligence and machine learning. Has limited understanding of how incident data flows through the application or how AI is used to analyze technical incidents.",
    "Intermediate": "Understands basic AI/ML concepts and the overall application structure but struggles to explain the selected project's AI workflow, data preprocessing, model training, LLM integration, or the relationship between frontend, backend, and AI components.",
    "Advanced": "Clearly explains AI/ML fundamentals, the chosen project's architecture, incident data flow, and the role of the selected AI approach. Understands how authentication, APIs, data processing, AI inference, and frontend rendering work together. Can explain the difference between traditional ML models and LLM-based solutions.",
    "Expert": "Demonstrates strong architectural understanding, explaining the complete AI/ML pipeline, technology choices, model or LLM integration, data flow, evaluation strategy, and deployment-ready architecture. Can justify design decisions and discuss practical trade-offs involving accuracy, latency, cost, scalability, privacy, and reliability."
  },
  {
    "Parameter": "Solution Explanation (Project Flow & AI/Data Lifecycle Understanding) (e.g., What happens when a user submits an incident? How does the system process it, invoke AI, and return a result?)",
    "Weight": 0.15,
    "Beginner": "Cannot explain the complete application workflow or how incident information moves from the user interface to the backend and AI component. Struggles to describe how the system generates or displays an analysis result.",
    "Intermediate": "Explains the basic request-response cycle and some application features but struggles to describe the complete processing pipeline, data storage, model inference or LLM requests, and how results reach the frontend.",
    "Advanced": "Clearly explains the complete workflow: user login → dashboard → incident submission → backend processing → selected AI pipeline → result generation → result display. Can explain relevant API endpoints, data storage, error handling, and how the selected AI output is generated.",
    "Expert": "Demonstrates a thorough understanding of the complete application and AI lifecycle, including request validation, incident persistence, data preprocessing, model inference or LLM invocation, result processing, response serialization, and frontend rendering. Can trace a request through the code, explain how failures are handled, interpret the results produced by the selected AI technique, and discuss the reliability and limitations of the solution."
  }
];

// Phase 10 Rubric - Production AI Full-Stack Project Evaluation
export const Phase10Rubric = [
  {
    "Parameter": "Understanding the Problem & System Architecture Awareness (e.g., Why is Rozgar needed? How do authentication, location matching, job management, ratings, RAG, and voice AI work together?)",
    "Weight": 0.15,
    "Beginner": "Cannot clearly explain the problem Rozgar solves or how workers and recruiters use the platform. Has limited understanding of the MERN architecture, authentication, location-based matching, or the purpose of the voice assistant.",
    "Intermediate": "Understands the basic frontend, backend, and database architecture but struggles to explain role-based access, geospatial queries, the relationship between jobs and applications, or how RAG and voice technologies support Ask Rozgar.",
    "Advanced": "Clearly explains the end-to-end architecture, including React, Express, MongoDB, phone OTP authentication, JWT authorization, geospatial job matching, application management, two-way ratings, and the RAG-based voice assistant. Explains how the application components communicate and why embeddings, vector search, speech-to-text, and text-to-speech are used.",
    "Expert": "Demonstrates strong architectural understanding, explaining modular backend design, data relationships, geospatial indexing, authentication and authorization boundaries, embedding and retrieval pipelines, LLM integration, and voice processing. Can justify technology choices and discuss scalability, latency, cost, privacy, reliability, and the needs of users with limited literacy."
  },
  {
    "Parameter": "Solution Explanation (Project Flow & AI/Data Lifecycle Understanding) (e.g., What happens when a recruiter posts a job? How does a worker apply? How does a spoken question become an answer based on that worker's actual data?)",
    "Weight": 0.15,
    "Beginner": "Cannot explain the complete job lifecycle or the request-response flow. Struggles to describe how jobs are stored, how workers discover nearby jobs, or how Ask Rozgar processes questions.",
    "Intermediate": "Explains basic CRUD operations and frontend-backend communication but cannot consistently trace role-based authorization, the application and rating workflows, or the complete voice and retrieval pipeline.",
    "Advanced": "Clearly explains the complete platform workflow: recruiter signup → job posting → geospatial indexing → nearby job discovery → application → shortlisting/hiring → completion → two-way ratings. Can also explain the AI workflow from voice capture through transcription, embedding, user-filtered retrieval, reranking, LLM response generation, and spoken output.",
    "Expert": "Demonstrates a thorough understanding of the entire application lifecycle and can trace requests across frontend components, backend routes, controllers, MongoDB models, and AI services. Explains how job and application updates affect searchable records, how JWT-derived identity restricts retrieval, how retrieved chunks and scores can be inspected, and how missing or irrelevant information is handled. Can demonstrate that two workers receive answers grounded only in their own data and explain the failure scenarios, security controls, and architectural trade-offs."
  }
];
