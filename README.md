# YouTube Video Feedback***

A Node.js application that evaluate YouTube videos using generative AI models to provide assessments according to the Rubric input.

## Features

- Simple web interface to input YouTube video URL and Rubric
- Uses generative AI models (OpenAI GPT or Google Gemini) for video evaluation using given rubric
- Evaluate video content against the rubric
- Provides scores for each rubric item and an overall grade
- Displays results in a clean, tabular format

## Tech Stack

- **Backend**: Node.js with Express
- **Frontend**: EJS templates with HTML/CSS
- **Generative AI Models**: 
  - OpenAI GPT-4o-mini (primary model)
  - Google Gemini 1.5 Flash (alternative model)
- **Other**: Axios for HTTP requests, Dotenv for environment management

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Add your API keys:
     ```
     OPENAI_API_KEY=your_openai_api_key_here
     GEMINI_API_KEY=your_gemini_api_key_here
     ```
4. Start the server:
   ```bash

   npm start
   ```
5. Visit `http://localhost:3000` in your browser

## Development

For development with auto-restart:
```bash
npm run dev
```

## How It Works

1. User submits a YouTube video URL and Rubric in Json format
2. The app uses a generative AI model to evaluate the video content
3. The AI generates the grades the video according to the rubric
4. Results are displayed in a table format

## Generative AI Model Configuration

The application supports both OpenAI and Google Gemini generative models:

- If `OPENAI_API_KEY` is provided, it will use OpenAI's GPT-4o-mini for analysis
- If `GEMINI_API_KEY` is provided, it will use Google's Gemini 1.5 Flash for analysis
- If neither is provided, it will return mock data for demonstration

## Example Usage

1. Enter a YouTube URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
2. Enter a rubric: `[
  {
    " - Criteria": "1. Understanding the Problem / Problem Articulation \n\n🔹 Does the student clearly understand the requirements of building a multi-page HTML-only portal? \n\nSample Questions: \n• Can you tell me what your website is about? \n• What pages did you create and why? \n• How are your pages connected? \n• Why are we using only HTML in this project?",
    "Weight (%)": 0.15,
    "Beginner (1)": "Very limited clarity: Student can name 1–2 pages but cannot explain their purpose; shows little awareness of project goal.",
    "Intermediate (2)": "Partial clarity: Student explains some pages’ purpose but misses connections or the overall project objective.",
    "Advanced (3)": "Good clarity: Student explains all pages with purpose and connections; shows basic semantic awareness.",
    "Expert (4)": "Complete clarity: Student confidently explains purpose of all pages, connects project goal to HTML foundations (structure vs. styling), and justifies the “HTML-only” restriction."
  },
  {
    " - Criteria": "2. Robustness of the Solution – Conceptual Clarity / Robustness / Visual Appeal \n\n🔹 Is the website structurally sound, complete, and semantically correct? \n\nSample Questions: \n• Can you walk me through the tags you used on this page? \n• Why did you choose <ul> vs <ol> here? \n• How does your navigation work? \n• Can all pages be accessed easily?\n- Can you show me how many pages you built? \n- Do your navigation links work, or do some give errors? \n- Why did you put everything inside <p> instead of using <h1>, <h2>, <ul>? \n- Does your table have headers, or is it only rows of data?\n- Why did you use <ul> for hobbies instead of <ol> on the Profile page? \n- Does your navigation menu look the same on all pages, or are some links missing? \n- Can you walk me through the form tags you used on the Feedback page? \n- Did you use <th> or <td> for your table headings—and why?\n- How did you ensure <header>, <nav>, <main>, <footer> are placed consistently across all pages? \n- Why did you include <caption> in your Grades table? \n- Can you explain how <label> improves accessibility in your Feedback form? \n- If I add a new course, how would your Courses page handle it structurally?\n- Why is <thead>/<tbody>/<tfoot> important for your table even if it works without them? \n- How does your navigation ensure every page can be reached with minimal effort? \n- Why did you use <address> on the Contact page instead of just <p>? \n- If you were teaching HTML best practices, how does your site demonstrate semantic correctness? \n- How would your structure scale if more pages were added in the future?",
    "Weight (%)": 0.7,
    "Beginner (1)": "Weak structure: Pages incomplete or missing; frequent misuse of tags; navigation does not work properly.",
    "Intermediate (2)": "Basic structure: Most pages exist; some tags misused; navigation works at a basic level but lacks consistency.",
    "Advanced (3)": "Strong structure: All required pages complete; correct tags used; navigation works smoothly; shows awareness of semantic HTML.",
    "Expert (4)": "Exceptional structure: Website fully complete, robust, semantically consistent; smooth navigation; shows thoughtful structure and best practices (even without CSS/JS)."
  },
  {
    " - Criteria": "3. Solution Explanation – Communication \n\n🔹 Does the student explain their choices in video submissions? Do they demonstrate independent understanding?\n\nSample Questions: \n• Can you explain how <table> and <th> are different? \n• Why did you include <label> with your form inputs? \n• How does a relative link differ from an absolute link? \n• If you were teaching this page to a friend, how would you explain it?",
    "Weight (%)": 0.15,
    "Beginner (1)": "Minimal explanation: Struggles to explain choices; relies on guesswork; unclear or incomplete communication.",
    "Intermediate (2)": "Basic explanation: Explains some choices but lacks depth or reasoning; communication is somewhat clear.",
    "Advanced (3)": "Clear explanation: Explains most tag choices with reasoning; demonstrates solid understanding and clear communication.",
    "Expert (4)": "Insightful explanation: Explains all choices confidently; justifies every tag with purpose; communicates with teaching-level clarity and independence."
  }
]`
3. Submit the form
4. View the rubric and grades in the results table

## Project Structure

```
yt-grade-analyzer/
├── server.js          # Main server file
├── views/             # EJS templates
│   ├── index.ejs      # Input form
│   └── result.ejs     # Results display
├── public/            # Static assets (CSS, JS, images)
├── .env               # Environment variables
├── package.json       # Project dependencies and scripts
└── README.md          # This file
```
