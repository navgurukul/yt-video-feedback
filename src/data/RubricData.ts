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
    "Beginner (1)": "Uses tags randomly; cannot explain why a tag is used. Example: \"I put everything in … don't know why.\"",
    "Intermediate (2)": "Shows partial understanding of HTML tags; uses headings, lists, or images but misuses some semantic tags. Example: \"I used for all headings… not sure about .\"",
    "Advanced (3)": "Correctly uses semantic tags; explains why tags are chosen and their hierarchy. Example: \" for top navigation, for closing notes, for lists like hobbies or courses.\"",
    "Expert (4)": "Fully explains semantic structure and tag choices; can teach others why certain tags are used. Example: \" wraps navigation links for clarity and accessibility; separates content logically; used for step-by-step instructions; for unordered lists like hobbies. Tags improve readability and structure.\""
  },
  {
    "Parameter": "Solution Explanation / Communication Skills (e.g., \"Can you explain why you used ?\" \"Why for inputs?\" \"How would you describe your site to another student?\")",
    "Weightage (%)": 20,
    "Beginner (1)": "Cannot explain code or tag choices; struggles to describe purpose of pages. Example: \"I don't know why I used … it just works.\"",
    "Intermediate (2)": "Explains some tags and basic page flow but reasoning incomplete; communication unclear. Example: \"I used for feedback… not sure why is needed.\"",
    "Advanced (3)": "Explains page flow and tag choices clearly; can describe most decisions and structure. Example: \"I used for Grades; tags connect text to inputs for accessibility; navigation links use .\"",
    "Expert (4)": "Explains all pages, tag choices, and reasoning confidently; can teach others; reflects on best practices. Example: \"I chose for contact info to be semantic; groups Feedback form logically; ensures consistent navigation. Can explain to another student why each tag is used.\""
  }
];

// Phase 2 Rubric - CSS Project Evaluation
export const Phase2Rubric = [
  {
    "Parameter": "Understanding the problem\n\n\n(Sample prompts: 1. Why did you put your CSS like this (inside page, outside file, or in the tag)? 2. Why did you use Flexbox/Grid here instead of another way?\n3. If your project gets bigger, how will your CSS make it easy or hard to manage?)",
    "Weightage (%)": 40,
    "Beginner": "The student added CSS but in a very basic or incorrect way e.g., mixing inline styles in HTML, repeating rules, or only changing colordls and fonts without structure. They cannot explain why CSS is separated from HTML.",
    "Intermediate": "The student used an external CSS file and applied some structured styles. The layout is partly consistent but still uses simple selectors. They know CSS is for design but can't always explain conflicts (cascade/specificity).",
    "Advanced": "The student's project shows good CSS structure: consistent classes, external file, and responsive design with media queries. They can clearly explain why they used a layout method (Flexbox/Grid) and how cascade/specificity affects their project.",
    "Expert": "The student's CSS in the project is scalable and professional: clear naming, modular organization, hover/focus states for interactivity, and accessible styles (e.g., readable colors, spacing). They can link their choices to performance, maintainability, and teamwork."
  },
  {
    "Parameter": "Conceptual Clarity & Understanding of CSS\n\n(Sample prompts: 1. Explain the box model and how it affects spacing, padding, and borders. 2. Difference between Flexbox vs Grid? 3. How do media queries work? 4. Why did you choose relative vs absolute positioning in certain areas? 5. How do units like px, %, em, and rem affect responsiveness?)",
    "Weightage (%)": 40,
    "Beginner": "Weak understanding. Cannot explain box model (e.g., why padding adds space inside a div), cascading, specificity, Flexbox/Grid, or media queries. Misuses units (e.g., sets width 100px instead of % for responsive divs).",
    "Intermediate": "Partial understanding. Knows box model basics (padding, margin, border) and some selectors. Uses Flex/Grid but with errors (e.g., items don't align vertically). Media queries applied inconsistently. Can partially explain positioning (relative/absolute).",
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

// Phase 3 Rubric - JavaScript Project Evaluation
export const Phase3Rubric = [
  {
    "Parameter (sample facilitator prompts)": "Understanding the Problem / Problem Articulation (e.g., \"What is the goal of this project?\" \"Why is JS needed?\" \"How does JS make your quiz interactive?\")",
    "Weightage (%)": 10,
    "Beginner (1)": "Cannot clearly describe the project; mixes up quiz flow and features; cannot say why JS is needed.",
    "Intermediate (2)": "States the main goal (quiz app) and mentions some role of JS (e.g., buttons, navigation) but misses finer details.",
    "Advanced (3)": "Explains project goal and role of each feature; describes how JS makes pages interactive (questions load, score updates).",
    "Expert (4)": "Connects project to bigger learning outcomes; explains why certain JS concepts were chosen; links interactivity to clarity, usability, and learning."
  },
  {
    "Parameter (sample facilitator prompts)": "Robustness (e.g., What happens if you reuse a function incorrectly? How would you pass the question data into a display function? Can you modify the function to handle multiple questions? How does your checkAnswer function update the score? Can your displayQuestion function handle different question types? What happens if you click Next without selecting an answer? How does the code know which question to display next? How does the score get updated after each answer? What determines when the quiz ends? What happens if a user clicks an answer before questions load? Does your code break if the array is empty? What happens if a user submits without choosing an option? How do you prevent negative scores? What if the quiz has zero questions? What if all answers are the same? What happens if the user tries to answer after the last question? What if two questions have the same ID?)",
    "Weightage (%)": 40,
    "Beginner (1)": "Quiz is incomplete: only one page works or questions do not display; no score calculation; no navigation; buttons do not respond; errors break the app.",
    "Intermediate (2)": "Quiz runs for some questions; Start Quiz and Next work inconsistently; partial score calculation; some answers update incorrectly; some errors may crash the quiz; UI may be confusing.",
    "Advanced (3)": "Quiz runs for all questions; Start, Next, and Restart work; scores update correctly; logic handles most skipped or invalid answers; minor UI inconsistencies; code mostly structured.",
    "Expert (4)": "Quiz fully functional: all features (Start, Next, Results, Restart) work smoothly; scores always accurate; handles skipped, repeated, or invalid answers gracefully; flow and navigation polished; code is clean, maintainable; UI/UX seamless."
  },
  {
    "Parameter (sample facilitator prompts)": "Conceptual Clarity & Understanding of JS Concepts (e.g., \"What is the purpose of your score variable?\" \"Why did you choose an array to store questions instead of individual variables?\"\"How does each object in your questions array represent a single quiz question?\" \"How would you add a new question dynamically?\"\"What does your displayQuestion function do?\" \"How does your checkAnswer function update the score?\" \"How do you loop through questions or options?\" \"How do you decide which question to display next?\" \"How does your code update the page with a new question?\" \"What happens when a button is clicked?\" \"How did you check if all questions load correctly?\" \"What do you do if the user skips a question?\")",
    "Weightage (%)": 30,
    "Beginner (1)": "Cannot explain the purpose of variables, functions, arrays, or objects; confused about how JS manipulates the page; struggles to connect JS concepts to project features.",
    "Intermediate (2)": "Explains some JS concepts like variables and functions; understands basic array or object usage; describes simple DOM updates; can connect concepts to one or two features (e.g., showing one question), but reasoning is incomplete.",
    "Advanced (3)": "Explains most JS concepts clearly and correctly; understands how arrays and objects store questions/answers; explains how functions modularize code; can describe DOM manipulation and event handling in multiple features; demonstrates logic flow in the quiz (Start → Next → Results).",
    "Expert (4)": "Fully explains all JS concepts in the context of the project; shows deep understanding of variables, arrays, objects, loops, functions, conditional statements, events, and DOM manipulation; can predict outcomes of code changes; connects JS concepts to interactivity, usability, and project structure; explains reasoning behind choosing specific concepts or structures; can teach others how each concept works within the project."
  },
  {
    "Parameter (sample facilitator prompts)": "Visual Appeal (\"Is the Start Quiz button clearly visible and distinct?\" \"How easy is it for a user to read questions and options?\"\n\"Are colors, fonts, and spacing consistent across all pages?\" \"Does the layout help guide the user naturally from Start → Quiz → Results?\"\n\"Are interactive elements (buttons, answer options) easy to click and responsive?\" \"How would you improve the visual hierarchy or readability of your quiz?\")",
    "Weightage (%)": 10,
    "Beginner (1)": "Layout is confusing or cluttered; buttons and text hard to read; colors clash or are inconsistent; quiz sections not clearly separated; interactive elements (Start, Next, Restart) are difficult to identify.",
    "Intermediate (2)": "Basic layout with some consistency; buttons or text may be misaligned; colors and fonts mostly readable but not polished; minor issues with spacing or section separation; some interactive elements may be slightly confusing.",
    "Advanced (3)": "Layout is consistent and organized; buttons, text, and sections are clear and readable; colors and fonts are pleasant and uniform; spacing, alignment, and sectioning make navigation easy; interactive elements are easy to identify and use.",
    "Expert (4)": "Layout is polished, intuitive, and visually engaging; buttons, text, and quiz sections are highly readable and well-aligned; color scheme, fonts, and spacing are consistent and enhance user experience; interactive elements are visually distinct and guide the user naturally; overall UI/UX demonstrates attention to detail, accessibility, and usability."
  },
  {
    "Parameter (sample facilitator prompts)": "Solution Explanation / Communication\n(e.g., \"Can you explain what happens when the user clicks Start Quiz?\" \"How is the final score calculated and displayed?\" \"Which JS concepts did you use to make questions appear dynamically?\" \"How did you use Arrays and Objects to store questions and answers?\" \"Why did you choose this structure for your code?\" \"Did you encounter any errors while implementing the quiz? How did you debug them?\" \"How did you test that all edge cases are handled?\" \"Which part of this project helped you understand JavaScript concepts the most?\")",
    "Weightage (%)": 10,
    "Beginner (1)": "Can only read the code without explaining its functionality; struggles to describe the quiz flow; cannot identify which JS concepts are used; cannot justify any design or implementation choices.",
    "Intermediate (2)": "Explains parts of the code and some JS concepts, such as variables or functions; describes basic flow of the quiz (Start, Next, Results) but reasoning is shallow; can provide limited justification for choices; partially explains debugging or handling skipped questions.",
    "Advanced (3)": "Explains project flow clearly, including how Start, Next, Results, and Restart work; describes which JS concepts are applied (functions, arrays, objects, DOM, events, conditional statements) and why; can justify main design choices; explains how user interactions are handled and some edge cases; demonstrates understanding of debugging and problem-solving process; can summarize learning points from the project.",
    "Expert (4)": "Explains the project comprehensively and confidently, as if teaching a peer; describes in-depth every feature, including quiz flow, score calculation, handling skipped/invalid answers, and restart mechanism; explains the purpose of each function, data structure, and DOM manipulation; reflects on why specific JS concepts were chosen and how they enhance interactivity; discusses design decisions, usability, and visual appeal; anticipates potential issues or edge cases and explains how they are addressed; reflects on learning outcomes and explains how the project deepened understanding of JS concepts."
  }
] ;

// Phase 4 Rubric - Advanced JavaScript & API Integration Evaluation
export const Phase4Rubric = [
  {
    "Parameter": "Understanding the Problem",
    "Prompts": "1. Explain how your app sends a request to Gemini and receives the response. 2. Why did you choose async/await here? 3. How does user input flow through your system? 4. What would break if Gemini returns an unexpected response? 5. Why did you structure your code this way?",
    "Weight": 20,
    "Beginner": "The student uses ES6 and fetch(), but in a basic or incorrect way. They cannot clearly explain how async code works, why APIs require Promises, or how data flows from request - response - UI. Their reasoning feels guess-based, and they mix old JavaScript patterns with ES6.",
    "Intermediate": "The student shows a partial understanding of modern JavaScript features and can describe the \"general idea\" behind API calls. They correctly use some ES6 (like let/const, template literals), but cannot fully justify their choices or explain async behavior deeply. Their understanding of the overall architecture is incomplete.",
    "Advanced": "The student demonstrates a clear understanding of ES6 and the request/response cycle. They explain how user inputs become prompts, how fetch() works, how async/await helps, and how responses are parsed and rendered. They justify their file structure, explain why they used specific ES6 techniques, and reason through API workflows with confidence.",
    "Expert": "The student deeply understands JavaScript architecture, async design patterns, and API communication. They explain trade-offs (Promises vs async/await), modular code organization, error handling strategies, scalability, and maintainability. They can predict failure cases, data inconsistencies, and performance implications like a professional engineer."
  },
  {
    "Parameter": "Technical Robustness",
    "Prompts": "1. Show me how you handled errors and what happens if Gemini fails? 2. How did you manage loading states in the UI? 3. What breaks if this function receives undefined/null? 4. Why use destructuring here? 5. How would you extend this feature to support more prompts?",
    "Weight": 60,
    "Beginner": "Code works only in ideal conditions. No proper input validation, error handling, or fallbacks. Async code is handled inconsistently; fetch() is used without understanding. ES6 features are misused or copied. The app breaks easily with empty inputs, network issues, or unexpected API responses. Structure is tightly coupled and difficult to expand.",
    "Intermediate": "The student shows improving organizational skills, with some validation and basic error handling. Async/await is used, but not always cleanly. ES6 features appear correctly in some places but not consistently. The project works for normal use cases but often breaks under edge cases, slow networks, or invalid API responses.",
    "Advanced": "The student builds a stable, reliable app with thoughtful async handling, clean ES6 use, and modular functions. They manage loading states, success/error messages, and default values well. Code is readable and extendable. API responses are parsed safely using destructuring and checks. UI behavior feels smooth and predictable even under stress.",
    "Expert": "The student's implementation is robust, scalable, and professionally structured. They use modular architecture, reusable async functions, strict error handling, defensive coding, deep validation, and optimized logic. Their ES6 usage is elegant (spread/rest, map/filter/reduce, destructuring). They consider performance, maintainability, edge cases, accessibility, and cross-browser behavior."
  },
  {
    "Parameter": "Solution Explanation",
    "Prompts": "1. Why did you design your UI this way? 2. How does the user understand what your app is doing? 3. Explain why you placed this logic in a separate function. 4. What would happen if the screen became very narrow? 5. How does your design improve user experience?",
    "Weight": 20,
    "Beginner": "The student cannot clearly explain why they wrote their code the way they did. Their reasoning is unclear or mixed up. They struggle to describe how their JS decisions affect user experience or API behavior.",
    "Intermediate": "The student provides a basic explanation of what they built and some reasoning behind their choices. They can describe their logic but not deeply justify it. Their explanation lacks flow or user-centered thinking.",
    "Advanced": "The student clearly explains their technical and design decisions, connecting ES6 choices, async logic, and UI behavior. They articulate how their structure improves readability, scalability, and user experience. Their reasoning is organized and confident.",
    "Expert": "The student offers thoughtful, precise, and intuitive explanations. They justify architectural choices, async handling, user flows, error handling, and UI design with clarity. They communicate like someone who deeply understands their project and could teach it to others."
  }
];

// Phase 5 Rubric - Backend with Node.js & Express Evaluation
export const Phase5Rubric = [
  // Add Phase 5 rubric here when available
];

// Phase 6 Rubric - MongoDB & Mongoose Evaluation
export const Phase6Rubric = [
  // Add Phase 6 rubric here when available
];
