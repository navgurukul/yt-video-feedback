export interface VideoDetails {
  title: string;
  whatToCover: string;
  questionsToAnswer: string[];
}

export interface PhaseData {
  phase: string;
  videos: VideoDetails[];
}



export const videoDataStructure: PhaseData[] = [
  {
    phase: "Phase 1: HTML Only — Student Profile & Course Portal",
    videos: [
      {
        title: "Let's Build Your First Website: The Home Page",
        whatToCover: "Walk through the process of creating a basic homepage using only HTML. Add a title, heading, some paragraph text, and navigation links.",
        questionsToAnswer: [
          "What is the purpose of the <head>, <body>, and <title> tags?",
          "How do we add links to other pages using <a> tags?",
          "What tags are necessary for structuring a home page?",
          "How do you create headings (<h1>, <h2>, etc.) and paragraphs (<p>)?"
        ]
      },
      {
        title: "Creating Your Personal Profile Page with HTML",
        whatToCover: "Build a student profile page with an image, an \"about me\" section, and a list of hobbies.",
        questionsToAnswer: [
          "How do we embed an image with <img> and what are the essential attributes (src, alt)?",
          "What tags help organize sections like hobbies or personal details (e.g., <section>, <div>)?",
          "How do unordered lists <ul> and ordered lists <ol> work, and when would you use each?",
          "How can you add a line break (<br>) or a horizontal rule (<hr>)?"
        ]
      },
      {
        title: "Listing Your Courses: The Course Page",
        whatToCover: "Create a \"My Courses\" page that lists all the courses a student is enrolled in, with links to each course's specific page (even if those pages don't exist yet).",
        questionsToAnswer: [
          "How do you structure a list of items that each have a title and a short description?",
          "How can you use <a> tags to create placeholder links for future pages?",
          "What is the difference between an absolute URL and a relative URL in a link's href attribute?",
          "How can you use heading tags to create a clear hierarchy on the page?"
        ]
      },
      {
        title: "How to Make a Simple Feedback Form in HTML",
        whatToCover: "Build an HTML form that allows students to submit feedback. Include a text area for comments and a submit button.",
        questionsToAnswer: [
          "What is the purpose of the <form> tag and what are the action and method attributes?",
          "How do you create a multi-line text input using <textarea>?",
          "What are the different types of <input> tags (e.g., text, email, submit)?",
          "How does the <label> tag improve accessibility and user experience?"
        ]
      },
      {
        title: "Displaying Your Grades with HTML Tables",
        whatToCover: "Create a \"Grades\" page that displays course grades in a structured table format with columns for Course Name, Grade, and Comments.",
        questionsToAnswer: [
          "What are the essential tags for creating a table (<table>, <tr>, <th>, <td>)?",
          "What is the difference between <th> (table header) and <td> (table data)?",
          "How do you define the header row of a table?",
          "How does the scope attribute (col or row) in a <th> tag help with accessibility?"
        ]
      },
      {
        title: "Building a 'Contact Us' Page",
        whatToCover: "Create a simple \"Contact Us\" page with an address, a \"mailto\" link for email, and a \"tel\" link for a phone number.",
        questionsToAnswer: [
          "How do you create a link that opens the user's default email client using mailto:?",
          "How do you create a clickable phone number link using tel:?",
          "What is the best way to format a physical address in HTML for readability?",
          "How can you use the <address> tag semantically?"
        ]
      },
      {
        title: "Linking It All Together: Website Navigation",
        whatToCover: "Create a consistent navigation bar using an unordered list within a <nav> tag that appears on every page of the student portal.",
        questionsToAnswer: [
          "Why should you use the <nav> tag for your main navigation?",
          "How do you create a list of links for a navigation menu?",
          "How do you ensure the navigation links work correctly from any page in your site (relative paths)?",
          "How can you create a \"Home\" link that always takes the user back to the main page?"
        ]
      },
      {
        title: "HTML Mini-Project: A Simple Recipe Page",
        whatToCover: "Build a single-page recipe website. Include a title, an image of the dish, an unordered list for ingredients, and an ordered list for the steps.",
        questionsToAnswer: [
          "How do you semantically structure a recipe with headings, paragraphs, and lists?",
          "Why is an <ul> better for ingredients and an <ol> better for instructions?",
          "How can you add emphasis to certain words using <strong> or <em>?"
        ]
      },
      {
        title: "HTML Mini-Project: Your First Blog Post",
        whatToCover: "Create a webpage that looks like a blog post. It should have a main title, a publication date, and several paragraphs of text.",
        questionsToAnswer: [
          "What is the purpose of the <article> tag in structuring a blog post?",
          "How can you use <header> and <footer> tags within an <article>?",
          "How do you represent the publication date and time using the <time> tag?"
        ]
      },
      {
        title: "HTML Mini-Project: An Event Announcement Page",
        whatToCover: "Design a page for a college event. Include the event title, a banner image, date, time, location, and a short description.",
        questionsToAnswer: [
          "How do you structure event details for clarity?",
          "What HTML tags are best for displaying key information like date, time, and location?",
          "How can you use headings and paragraphs to separate different pieces of information effectively?"
        ]
      }
    ]
  },
  {
    phase: "Phase 2: CSS Styling — Design & Layout Fundamentals",
    videos: [
      {
        title: "Your First Stylesheet: Global CSS for Your Website",
        whatToCover: "Create a style.css file and link it to all HTML pages. Apply basic resets and body-level styling like font and background color.",
        questionsToAnswer: [
          "How do you link an external CSS file to an HTML document using the <link> tag?",
          "What is box-sizing: border-box; and why is it a best practice to apply it to all elements?",
          "Why do developers often apply margin: 0 and padding: 0 to the * selector (universal selector)?",
          "How do you set a default font-family and background-color for the entire website on the body tag?"
        ]
      },
      {
        title: "Styling Your Profile Page: Images and Text",
        whatToCover: "Style the student profile page. Make the profile image circular, center the text, and change font sizes and colors.",
        questionsToAnswer: [
          "How do you target specific HTML elements with CSS selectors (e.g., element, class, ID)?",
          "How can you make a square image appear as a circle using border-radius?",
          "What are the common CSS properties for changing text appearance (color, font-size, font-weight, text-align)?",
          "What is the difference between a class selector (.) and an ID selector (#), and when should you use each?"
        ]
      },
      {
        title: "Creating Course 'Cards' with Flexbox",
        whatToCover: "Use Flexbox to arrange the course listings on the \"My Courses\" page into a flexible grid of \"cards.\"",
        questionsToAnswer: [
          "What is the display: flex; property and what does it do to the child elements of a container?",
          "How do you use justify-content and align-items to position items along the main and cross axes?",
          "What is the purpose of the flex-wrap property?",
          "How can you give each \"card\" a border, padding, and a box shadow to make it stand out?"
        ]
      },
      {
        title: "Making Forms Look Good: Styling the Feedback Page",
        whatToCover: "Apply CSS to the feedback form to make it user-friendly. Style the input fields, textarea, and submit button.",
        questionsToAnswer: [
          "How do you style <input> and <textarea> elements to have consistent width and padding?",
          "How can you change the appearance of a button, including its background color, text color, and border?",
          "What are the :hover and :focus pseudo-classes, and how can they improve form usability?",
          "How do you use display: block; on labels to place them on their own line above the input fields?"
        ]
      },
      {
        title: "How to Style Tables for Readability",
        whatToCover: "Style the grades table to be clean and easy to read. Add borders, padding, and alternating row colors.",
        questionsToAnswer: [
          "How do you add borders to a table and its cells using the border property?",
          "What is the border-collapse property and why is it useful for tables?",
          "How do you use the :nth-child(even) or :nth-child(odd) pseudo-class to create \"zebra stripes\" on table rows?",
          "How can you align text within table cells using text-align?"
        ]
      },
      {
        title: "Responsive Design 101: Media Queries",
        whatToCover: "Introduce media queries to make the student portal layout adapt to different screen sizes, like mobile phones.",
        questionsToAnswer: [
          "What is a media query and what is its syntax (@media)?",
          "How do you define a \"breakpoint\" for a specific screen width (e.g., max-width: 600px)?",
          "How would you change the flexbox direction from row to column on smaller screens?",
          "Why is it important to include the viewport meta tag (<meta name=\"viewport\" ...>) in your HTML?"
        ]
      },
      {
        title: "CSS Mini-Project: A Stylish Online Resume",
        whatToCover: "Build and style a one-page online resume. Use CSS to create a two-column layout, with personal info on one side and professional experience on the other.",
        questionsToAnswer: [
          "How can you create a two-column layout using Flexbox or CSS Grid?",
          "How do you use CSS to create visual separation between different sections of the resume?",
          "What are some good font choices for a professional resume and how do you apply them?",
          "How can you use padding and margin to create white space and improve readability?"
        ]
      },
      {
        title: "Understanding the CSS Box Model",
        whatToCover: "A focused explanation of the CSS box model: content, padding, border, and margin. Visually demonstrate how each property affects an element's size and position.",
        questionsToAnswer: [
          "What are the four parts of the CSS box model?",
          "What is the difference between padding and margin?",
          "How does the border property add to the total size of an element?",
          "How does box-sizing: border-box; change the way the box model is calculated?"
        ]
      },
      {
        title: "Flexbox vs. Grid: Which One to Use?",
        whatToCover: "Compare and contrast CSS Flexbox and CSS Grid with practical examples. Explain the ideal use cases for each.",
        questionsToAnswer: [
          "What is the main difference between Flexbox (one-dimensional) and Grid (two-dimensional)?",
          "When is Flexbox the better choice for layout? (e.g., distributing items in a line, navigation bars)",
          "When is Grid the better choice for layout? (e.g., overall page structure, complex grids)",
          "Show a simple layout created with both Flexbox and Grid to highlight the differences."
        ]
      },
      {
        title: "CSS Transitions and Animations for Beginners",
        whatToCover: "Add simple, tasteful animations to the UI. Make buttons change color smoothly on hover and have elements fade in.",
        questionsToAnswer: [
          "What is the transition property and how does it work?",
          "How do you specify which CSS property to animate and the duration of the animation?",
          "What is the difference between a transition and a @keyframes animation?",
          "How can you create a simple \"fade-in\" effect using @keyframes and opacity?"
        ]
      }
    ]
  },
  {
    phase: "Phase 3: JavaScript — Bringing Websites to Life",
    videos: [
      {
        title: "Your First JavaScript Project: A Simple Quiz App",
        whatToCover: "Set up the HTML and CSS for a simple quiz and write the first lines of JavaScript to select elements from the DOM.",
        questionsToAnswer: [
          "How do you link a JavaScript file to your HTML using the <script> tag?",
          "What is the Document Object Model (DOM)?",
          "How do you select an HTML element by its ID using document.getElementById()?",
          "How can you test if your JavaScript is working using console.log()?"
        ]
      },
      {
        title: "Storing Quiz Questions with JavaScript Arrays and Objects",
        whatToCover: "Create a JavaScript array of objects, where each object represents a quiz question with its text and a list of possible answers.",
        questionsToAnswer: [
          "How do you declare an array in JavaScript?",
          "How do you create an object with key-value pairs?",
          "How can you store multiple question objects inside a single array?",
          "How do you access a specific question or answer from your data structure?"
        ]
      },
      {
        title: "Dynamically Displaying Questions with JavaScript",
        whatToCover: "Write a function that takes a question object from your array and displays its text and answer choices on the webpage.",
        questionsToAnswer: [
          "How do you create a function in JavaScript?",
          "How do you change the text content of an HTML element using the .innerText or .textContent property?",
          "How can you loop through an array of answers to display them?",
          "How do you call a function to make it run?"
        ]
      },
      {
        title: "Checking User Answers and Keeping Score",
        whatToCover: "Add event listeners to the answer buttons. When a user clicks, check if their answer is correct and update a score variable.",
        questionsToAnswer: [
          "How do you add a click event listener to a button using .addEventListener()?",
          "How do you use an if/else statement to check if an answer is correct?",
          "How do you declare and update a variable to keep track of the score?",
          "How can you give the user visual feedback (e.g., changing the button color) based on their answer?"
        ]
      },
      {
        title: "Calculating and Displaying Final Quiz Results",
        whatToCover: "After the last question, hide the quiz section and display a results section showing the user's final score.",
        questionsToAnswer: [
          "How do you keep track of which question the user is on?",
          "How can you change the CSS display property with JavaScript to show and hide elements?",
          "How do you display the final score on the page?",
          "How can you add a \"Try Again\" button to reload the page and restart the quiz?"
        ]
      },
      {
        title: "JavaScript Events: Making Your Website Interactive",
        whatToCover: "A focused look at different types of events beyond 'click', such as 'mouseover', 'mouseout', and 'submit'.",
        questionsToAnswer: [
          "What is an event listener and how does it work?",
          "What is the difference between a 'click' event and a 'submit' event on a form?",
          "How can you use 'mouseover' to change an element's style when the user's mouse hovers over it?",
          "What is the event object that gets passed to an event listener function?"
        ]
      },
      {
        title: "DOM Manipulation: Changing Your Web Page with Code",
        whatToCover: "Go deeper into DOM manipulation. Create new HTML elements from scratch in JavaScript and add them to the page.",
        questionsToAnswer: [
          "How do you create a new element using document.createElement()?",
          "How do you add a newly created element to the DOM using .append() or .appendChild()?",
          "How can you add or remove CSS classes from an element using .classList.add() and .classList.remove()?",
          "How do you remove an element from the DOM?"
        ]
      },
      {
        title: "JavaScript Mini-Project: A To-Do List App",
        whatToCover: "Build a functional to-do list. Users can type a task into an input field, press a button, and see the task added to a list on the page.",
        questionsToAnswer: [
          "How do you get the value from an input field when a form is submitted?",
          "How do you prevent a form from refreshing the page on submission? (event.preventDefault())",
          "How do you create a new list item (<li>) with the user's text and add it to the <ul>?",
          "How can you add a \"delete\" button next to each task?"
        ]
      },
      {
        title: "Understanding JavaScript Functions",
        whatToCover: "A clear explanation of functions, including parameters, arguments, and return values. Show how to write reusable code.",
        questionsToAnswer: [
          "What is the difference between a function parameter and an argument?",
          "How does the return keyword work and what does it do?",
          "How can you write a function that performs a calculation and returns the result?",
          "What is the benefit of putting reusable code into a function?"
        ]
      },
      {
        title: "How to Debug Your JavaScript Code",
        whatToCover: "Teach students how to use the browser's developer tools to find and fix common JavaScript errors.",
        questionsToAnswer: [
          "How do you open the developer console in your browser?",
          "What are some common types of errors you'll see in the console (e.g., ReferenceError, TypeError)?",
          "How can you use console.log() to check the value of variables at different points in your code?",
          "What is a breakpoint and how can you use the \"Sources\" tab to step through your code line by line?"
        ]
      }
    ]
  },
  {
    phase: "Phase 4: Advanced JavaScript & Gemini API Integration",
    videos: [
      {
        title: "What is an API? Your First Gemini API Call",
        whatToCover: "Explain what an API is in simple terms. Guide the student through getting a Gemini API key and making their first successful API request using the fetch() method.",
        questionsToAnswer: [
          "What is an API and why is it useful?",
          "What is an API key and why do you need one?",
          "What is the basic syntax of a fetch() request?",
          "How do you handle the response from an API call?"
        ]
      },
      {
        title: "Building an AI-Powered 'Ask Me Anything' App",
        whatToCover: "Create a simple web app with a text input where a user can ask a question, send it to the Gemini API, and display the answer on the page.",
        questionsToAnswer: [
          "How do you send user input to an API?",
          "How do you parse the JSON response from the Gemini API?",
          "How do you display the API's response on your webpage?",
          "How can you show a \"loading\" message while waiting for the API response?"
        ]
      },
      {
        title: "Creating a Quick Summarizer with the Gemini API",
        whatToCover: "Build a tool where a user can paste a long piece of text into a <textarea>, and the Gemini API will return a concise summary.",
        questionsToAnswer: [
          "How do you structure a prompt for the Gemini API to request a summary?",
          "How do you handle larger amounts of text being sent to the API?",
          "What are some ways to display the summarized text clearly to the user?",
          "How can you add a button to copy the summary to the clipboard?"
        ]
      },
      {
        title: "Let's Build an 'Idea Spark' App with Gemini",
        whatToCover: "Create an \"Idea Spark\" app. The user inputs a topic (e.g., \"healthy breakfast\"), and Gemini provides a list of related ideas (e.g., recipes, ingredients).",
        questionsToAnswer: [
          "How do you design a prompt that asks for creative ideas in a list format?",
          "How can you parse the API response to display the ideas as an HTML list?",
          "How can you add a feature to get new ideas on the same topic?",
          "What are the key components of the request body for the Gemini API?"
        ]
      },
      {
        title: "ES6+ Features You Need to Know: let, const, and Arrow Functions",
        whatToCover: "Explain the difference between var, let, and const. Introduce the modern, cleaner syntax of arrow functions.",
        questionsToAnswer: [
          "What is the difference in scope between var, let, and const?",
          "When should you use let vs. const?",
          "How do you convert a regular function into an arrow function?",
          "What is the \"implicit return\" feature of arrow functions?"
        ]
      },
      {
        title: "Working with API Data: JavaScript fetch() and Promises",
        whatToCover: "A deeper dive into fetch(). Explain what Promises are and how .then() and .catch() are used to handle asynchronous operations.",
        questionsToAnswer: [
          "What does it mean for code to be \"asynchronous\"?",
          "What is a Promise in JavaScript?",
          "How do you chain multiple .then() blocks to process a fetch response?",
          "How does .catch() help you handle errors when an API call fails?"
        ]
      },
      {
        title: "ES6 Mini-Project: Daily Affirmation Generator",
        whatToCover: "Build a simple page that displays a new positive affirmation each time a button is clicked. Use an array of strings and modern JS syntax.",
        questionsToAnswer: [
          "How can you use const to store an array of affirmations?",
          "How do you write an arrow function for your event listener?",
          "How do you select a random item from an array?",
          "How can you use template literals to display the affirmation in a sentence?"
        ]
      },
      {
        title: "Template Literals and Destructuring in JavaScript",
        whatToCover: "Show how to use template literals (backticks) to create strings with embedded variables. Explain how to use destructuring to extract values from objects and arrays.",
        questionsToAnswer: [
          "What is the syntax for template literals and how do you embed variables in them?",
          "How does destructuring make it easier to access properties from an object?",
          "How can you destructure an array?",
          "Provide a practical example of using both to format an API response for display."
        ]
      },
      {
        title: "How to Use map, filter, and reduce in JavaScript",
        whatToCover: "Explain and demonstrate the three most common and powerful array methods: map, filter, and reduce.",
        questionsToAnswer: [
          "What is the purpose of .map()? (Transforming each item in an array).",
          "What is the purpose of .filter()? (Creating a new array with items that pass a test).",
          "What is the purpose of .reduce()? (Calculating a single value from an array).",
          "Show a real-world example for each, like transforming API data."
        ]
      },
      {
        title: "Building a Simple Weather App with a Public API",
        whatToCover: "Use a free public weather API to build an app where a user can enter a city and get the current temperature and weather conditions.",
        questionsToAnswer: [
          "How do you find and sign up for a free public API?",
          "How do you include an API key in your request securely? (Mention environment variables, but use a simple variable for the demo).",
          "How do you parse the weather data to find the information you need?",
          "How do you display the weather information, including a weather icon?"
        ]
      }
    ]
  },
  {
    phase: "Phase 5: Backend with Node.js & Express",
    videos: [
      {
        title: "Your First Backend Server with Node.js and Express",
        whatToCover: "Explain what Node.js and Express are. Guide students through setting up a new project (npm init), installing Express, and creating a basic \"Hello World\" server.",
        questionsToAnswer: [
          "What is Node.js? What is Express?",
          "How do you initialize a Node.js project using npm init -y?",
          "How do you install a package like Express using npm install express?",
          "How do you create a simple Express server and make it listen on a port?"
        ]
      },
      {
        title: "Creating Your First API Endpoint",
        whatToCover: "Create a simple API endpoint that sends back a JSON object when a user visits a specific URL (e.g., /api/courses).",
        questionsToAnswer: [
          "What is an API endpoint (or route)?",
          "How do you define a GET route in Express using app.get()?",
          "How do you send a JSON response from an Express route using res.json()?",
          "How can you test your new endpoint using a browser or a tool like Postman?"
        ]
      },
      {
        title: "Connecting Your Frontend to Your Backend",
        whatToCover: "Modify the frontend JavaScript to fetch data from the new local Express backend server instead of a public API.",
        questionsToAnswer: [
          "How do you use fetch() in your frontend code to call an endpoint on your own backend (e.g., http://localhost:3000/api/courses)?",
          "What is CORS (Cross-Origin Resource Sharing) and why might you encounter a CORS error?",
          "How do you enable CORS in your Express app using the cors middleware?",
          "How do you display the data fetched from your backend on your frontend page?"
        ]
      },
      {
        title: "Building an 'Ask Gemini' Web App with a Backend",
        whatToCover: "Move the Gemini API call from the frontend to the backend. The frontend will send a question to the Express server, which then calls the Gemini API and returns the result.",
        questionsToAnswer: [
          "Why is it more secure to call external APIs (especially with secret keys) from the backend instead of the frontend?",
          "How do you make a fetch request from within a Node.js/Express application?",
          "How do you securely store your API key using environment variables (.env file)?",
          "How do you set up a POST route in Express to receive data from your frontend?"
        ]
      },
      {
        title: "How to Handle User Input on the Backend",
        whatToCover: "Show how to get data that the frontend sends to the backend. Specifically, how to read the request body from a POST request.",
        questionsToAnswer: [
          "How do you configure your Express server to parse JSON request bodies (express.json() middleware)?",
          "How do you access the data sent from the frontend using req.body?",
          "How can you use the data from req.body to customize the logic in your route handler?",
          "Show a complete flow: user types in a form, clicks submit, data goes to the backend, backend logs the data."
        ]
      },
      {
        title: "Making API Calls from Your Node.js Server",
        whatToCover: "A more focused look at making fetch requests inside Node.js. Introduce node-fetch or discuss the built-in fetch in recent Node versions.",
        questionsToAnswer: [
          "How does the syntax for fetch in Node.js compare to the browser?",
          "How do you handle the asynchronous nature of API calls on the backend using async/await?",
          "How do you properly handle potential errors from the external API call within your Express route?",
          "How do you send the data received from the external API back to your own frontend?"
        ]
      },
      {
        title: "Understanding Express Routes: GET and POST Requests",
        whatToCover: "A clear comparison between GET and POST requests. Explain when and why to use each one.",
        questionsToAnswer: [
          "What is the fundamental difference between a GET and a POST request?",
          "When should you use a GET request? (e.g., retrieving data)",
          "When should you use a POST request? (e.g., creating new data, submitting a form)",
          "What are URL parameters (e.g., /users/:id) and how do you access them in Express with req.params?"
        ]
      },
      {
        title: "Introduction to Middleware in Express",
        whatToCover: "Explain the concept of middleware in Express. Show how to create a simple logger middleware that prints information about every incoming request to the console.",
        questionsToAnswer: [
          "What is middleware in the context of Express?",
          "What are the req, res, and next parameters in a middleware function?",
          "How do you tell Express to use your middleware with app.use()?",
          "What happens if you forget to call next() in a middleware function?"
        ]
      },
      {
        title: "Serving Static Files (HTML, CSS, JS) with Express",
        whatToCover: "Configure the Express server to serve the static frontend files (HTML, CSS, JavaScript) directly.",
        questionsToAnswer: [
          "What are \"static files\" in a web application?",
          "How do you use the express.static() built-in middleware?",
          "How do you specify the folder (e.g., 'public') where your static files are located?",
          "How does this change the way you run your full-stack application (one server for both backend and frontend)?"
        ]
      },
      {
        title: "Deploying Your First Node.js App",
        whatToCover: "A beginner's guide to deploying a simple Node.js application to a service like Render or Heroku.",
        questionsToAnswer: [
          "What is deployment?",
          "How do you prepare your app for deployment (e.g., specifying a start script in package.json)?",
          "How do you handle port numbers in a deployed environment using process.env.PORT?",
          "What are the basic steps to deploy an app on a platform like Render?"
        ]
      }
    ]
  },
  {
    phase: "Phase 6: MongoDB & Mongoose — Student Feedback Manager",
    videos: [
      {
        title: "What is MongoDB? Setting Up Your First Database",
        whatToCover: "Explain what a NoSQL database is and introduce MongoDB. Walk through the process of creating a free cloud database on MongoDB Atlas.",
        questionsToAnswer: [
          "What is the difference between a SQL and a NoSQL database?",
          "What is MongoDB Atlas?",
          "How do you create a new project and cluster on MongoDB Atlas?",
          "How do you get the connection string (URI) to connect your application to the database?"
        ]
      },
      {
        title: "Introduction to Mongoose: Schemas and Models",
        whatToCover: "Introduce Mongoose as an ODM (Object Data Modeling) library for MongoDB. Explain how to define a Schema and create a Model for the student feedback data.",
        questionsToAnswer: [
          "What is Mongoose and why is it useful?",
          "How do you connect your Express app to your MongoDB database using Mongoose?",
          "What is a Mongoose Schema and how do you define one?",
          "What is a Mongoose Model and how do you create one from a schema?"
        ]
      },
      {
        title: "Building a Feedback Manager: The Backend API",
        whatToCover: "Set up the basic Express routes (GET, POST, PUT, DELETE) for managing feedback, but without the database logic yet.",
        questionsToAnswer: [
          "What are the four main operations in a CRUD application? (Create, Read, Update, Delete)",
          "How do these CRUD operations map to HTTP methods? (POST, GET, PUT/PATCH, DELETE)",
          "How do you structure your files to organize your routes?",
          "What placeholder logic can you use before implementing the database functions?"
        ]
      },
      {
        title: "Creating Feedback: The POST Request",
        whatToCover: "Implement the logic for the POST route. Take the feedback data from the request body, create a new document using the Mongoose model, and save it to the database.",
        questionsToAnswer: [
          "How do you use a Mongoose model to create a new document?",
          "How do you save a new document to the MongoDB database?",
          "How do you use async/await to handle the asynchronous nature of database operations?",
          "How do you send a confirmation response back to the client after successfully saving the data?"
        ]
      },
      {
        title: "Reading Feedback: The GET Request",
        whatToCover: "Implement the logic for the GET route to fetch all the feedback documents from the database and send them back to the client.",
        questionsToAnswer: [
          "How do you use a Mongoose model to find all documents in a collection (.find())?",
          "How do you handle the case where there is no feedback in the database?",
          "How do you send the array of feedback documents as a JSON response?",
          "How do you test this endpoint to see the data from your database?"
        ]
      },
      {
        title: "Updating and Deleting Feedback: PUT and DELETE Requests",
        whatToCover: "Implement the logic for the PUT (or PATCH) and DELETE routes. Use the document ID to find, update, or delete a specific piece of feedback.",
        questionsToAnswer: [
          "How do you get the ID of a specific document from the URL parameters (req.params.id)?",
          "How do you use Mongoose methods like .findByIdAndUpdate() and .findByIdAndDelete()?",
          "How do you get the updated data from the request body for an update operation?",
          "What kind of response should you send to the client to confirm an update or deletion?"
        ]
      },
      {
        title: "Connecting Your Frontend to the Feedback API",
        whatToCover: "Modify the frontend JavaScript to make API calls to your new backend endpoints for creating, reading, updating, and deleting feedback.",
        questionsToAnswer: [
          "How do you make a POST request with a JSON body using fetch?",
          "How do you make DELETE and PUT requests using fetch?",
          "How do you dynamically get the ID of a piece of feedback on the frontend to use in your API calls?",
          "How can you organize your frontend code to handle these different API calls?"
        ]
      },
      {
        title: "Displaying Feedback on Your Website",
        whatToCover: "When the page loads, fetch all the feedback from the backend and dynamically create HTML elements to display each piece of feedback.",
        questionsToAnswer: [
          "How do you call your GET endpoint when the page first loads?",
          "How do you loop through the array of feedback data received from the backend?",
          "For each piece of feedback, how do you create the necessary HTML elements (e.g., a div or li)?",
          "How do you add \"delete\" and \"edit\" buttons to each piece of feedback displayed on the page?"
        ]
      },
      {
        title: "Submitting Feedback from Your Frontend Form",
        whatToCover: "Wire up the HTML form on the frontend so that when a user submits it, the data is sent to the POST endpoint and the new feedback appears on the page without a full refresh.",
        questionsToAnswer: [
          "How do you add an event listener to the form's submit event?",
          "How do you prevent the default form submission behavior (event.preventDefault())?",
          "After successfully posting the new feedback, how do you update the UI to show it?",
          "How can you clear the form fields after a successful submission?"
        ]
      },
      {
        title: "Putting It All Together: A Full-Stack Feedback App",
        whatToCover: "A final review of the complete full-stack application. Walk through the entire data flow: from the user typing in the frontend, to the request hitting the backend, the database being updated, and the response updating the UI.",
        questionsToAnswer: [
          "Can you trace a POST request from the browser's form all the way to the MongoDB database and back?",
          "Can you trace a GET request from the page load event to the database and see how it populates the page?",
          "What are the distinct roles of the frontend, the backend (Express), and the database (MongoDB)?",
          "What are the next steps a student could take to improve this application?"
        ]
      }
    ]
  }
];

// Helper function to get phase names
export const getPhaseNames = (): string[] => {
  return videoDataStructure.map(phase => phase.phase);
};

// Helper function to get video titles for a specific phase
export const getVideoTitlesForPhase = (phaseName: string): string[] => {
  const phase = videoDataStructure.find(p => p.phase === phaseName);
  return phase ? phase.videos.map(video => video.title) : [];
};

// Helper function to get video details
export const getVideoDetailsForTitle = (phaseName: string, videoTitle: string): VideoDetails | null => {
  const phase = videoDataStructure.find(p => p.phase === phaseName);
  if (!phase) return null;
  
  const video = phase.videos.find(v => v.title === videoTitle);
  return video || null;
};
