const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

const Papa =require('papaparse');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.post('/analyze', async (req, res) => {
    try {
        const { videoUrl, rubric, sheetUrl, evaluationMethod, llmProvider } = req.body;
        
        // Extract video ID from URL
        const videoId = extractVideoId(videoUrl);
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }
        
        // Parse and validate the rubric JSON
        let parsedRubric;
        try {
            // Check if Google Sheet URL is provided and not empty
            if (sheetUrl && sheetUrl.trim() !== '') {
                // Fetch and parse rubric from Google Sheet (this takes priority) using PapaParse
                //parsedRubric = await fetchRubricFromSheetPapa(sheetUrl);
                
                // Fetch and parse rubric from Google Sheet (this takes priority) using Custom function
                parsedRubric = await fetchRubricFromSheet(sheetUrl);
                

            } else if (rubric && rubric.trim() !== '') {
                // Use manual JSON rubric
                parsedRubric = JSON.parse(rubric);
            } else {
                // No rubric provided
                return res.status(400).json({ error: 'Either a rubric JSON or Google Sheet URL must be provided' });
            }
            
            // Validate that we have a rubric
            if (!parsedRubric) {
                return res.status(400).json({ error: 'Failed to obtain a valid rubric' });
            }
            
            // // Additional validation for rubric structure
            // const rubricArray = Array.isArray(parsedRubric) ? parsedRubric : [parsedRubric];
            // if (rubricArray.length === 0) {
            //     return res.status(400).json({ error: 'Rubric contains no criteria' });
            // }
            
            // // Check that each criteria has required fields
            // for (const criteria of rubricArray) {
            //     if (!criteria[" - Criteria"]) {
            //         return res.status(400).json({ error: 'Each rubric criteria must have a " - Criteria" field' });
            //     }
            //     if (typeof criteria["Weight (%)"] !== 'number' || criteria["Weight (%)"] < 0 || criteria["Weight (%)"] > 1) {
            //         return res.status(400).json({ error: 'Each rubric criteria must have a valid "Weight (%)" between 0 and 1' });
            //     }
            // }
        } catch (parseError) {
            console.error('Error parsing or validating rubric:', parseError);
            return res.status(400).json({ error: 'Invalid rubric format: ' + parseError.message });
        }
        
        // Get analysis directly from generative model
        const analysis = await analyzeVideoWithGenerativeModel(videoUrl, parsedRubric, evaluationMethod, llmProvider);
        
        res.render('result', { 
            analysis: analysis,
            rubric: parsedRubric,
            videoUrl: videoUrl
        });
    } catch (error) {
        console.error('Error analyzing video:', error);
        res.status(500).json({ error: 'An error occurred while analyzing the video: ' + error.message });
    }
});

// Helper function to extract video ID from YouTube URL
function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Main function to analyze video using generative models
async function analyzeVideoWithGenerativeModel(videoUrl, rubricJson, evaluationMethod = 'api', llmProvider = 'gemini') {
    try {
        // Check which evaluation method to use
        if (evaluationMethod === 'sdk') {
            // Use SDK evaluation methods
            if (llmProvider === 'openai' && process.env.OPENAI_API_KEY) {
                return await analyzeWithOpenAISDK(videoUrl, rubricJson);
            } else if (llmProvider === 'gemini' && process.env.GEMINI_API_KEY) {
                return await analyzeWithGeminiSDK(videoUrl, rubricJson);
            } else {
                console.warn(`No ${llmProvider} API key found for SDK evaluation, returning mock data`);
                // Return mock data if selected API key is missing
                return getMockData(rubricJson);
            }
        } else {
            // Use existing API evaluation methods
            if (llmProvider === 'gemini' && process.env.GEMINI_API_KEY) {
                return await analyzeWithGemini(videoUrl, rubricJson);
            } else if (llmProvider === 'openai' && process.env.OPENAI_API_KEY) {
                return await analyzeWithOpenAI(videoUrl, rubricJson);
            } else {
                console.warn(`No ${llmProvider} API key found, returning mock data`);
                // Return mock data if selected API key is missing
                return getMockData(rubricJson);
            }
        }
    } catch (error) {
        console.error('Error calling generative model:', error);
        throw error;
    }
}

// Helper function to get grade label
function getGradeLabel(score) {
    switch(score) {
        case 1: return "Beginner";
        case 2: return "Intermediate";
        case 3: return "Advanced";
        case 4: return "Expert";
        default: return "Unknown";
    }
}

// Analyze video using OpenAI
async function analyzeWithOpenAI(videoUrl, rubricJson) {
    const rubricString = JSON.stringify(rubricJson, null, 2);
    
    const prompt = `You are an expert educational content analyzer. Please analyze this YouTube video according to the provided rubric.

Video URL: ${videoUrl}

Rubric (in JSON format):
${rubricString}

Since you cannot actually access the video, please generate a realistic analysis that would be typical for a YouTube video on this topic.

Please provide an evaluation according to the rubric with the following structure:
1. For each criteria in the rubric, provide a grade based on the performance levels defined
2. Include the weight of each criteria
3. Provide specific feedback explaining why each grade was assigned
4. Calculate an overall grade

Respond in JSON format with this structure:
{
  "rubric": [
    {
      "criteria": "string (name of the criteria)",
      "weight": number (weight of this criteria as defined in the rubric),
      "grade": "string (performance level with score, e.g. 'Advanced (3)')",
      "feedback": "string (explanation of why this grade was given based on the rubric descriptions)"
    }
  ],
  "overallGrade": "string (calculated overall grade with percentage)",
  "feedback": "string (summary feedback explaining the overall evaluation)"
}`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini', // Using a more cost-effective model
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
    }, {
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    try {
        const content = response.data.choices[0].message.content;
        // Try to parse JSON from the response
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}') + 1;
        const jsonString = content.substring(jsonStart, jsonEnd);
        return JSON.parse(jsonString);
    } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        // Return mock data if parsing fails
        const criteriaArray = Array.isArray(rubricJson) ? rubricJson : [rubricJson];
        const mockRubricEvaluation = criteriaArray.map(criteria => {
            const criteriaName = criteria[" - Criteria"] || "Unknown Criteria";
            const score = Math.floor(Math.random() * 4) + 1;
            const weight = criteria["Weight (%)"] || 0.25;
            
            return {
                criteria: criteriaName,
                weight: weight,
                grade: `${getGradeLabel(score)} (${score})`,
                feedback: criteria[`${getGradeLabel(score)} (${score})`] || "No feedback available."
            };
        });
        
        return {
            rubric: mockRubricEvaluation,
            overallGrade: "B+ (85%)",
            feedback: "This is a mock evaluation because the AI response could not be parsed. In a production environment, this would be generated by analyzing the actual video content."
        };
    }
}

// Analyze video using Google Gemini
async function analyzeWithGemini(videoUrl, rubricJson) {
    const rubricString = JSON.stringify(rubricJson, null, 2);
    
    const prompt = `You are an expert educational content analyzer. Please analyze this YouTube video according to the provided rubric.

Video URL: ${videoUrl}

Rubric (in JSON format):
${rubricString}

Since you cannot actually access the video, please generate a realistic analysis that would be typical for a YouTube video on this topic.

Please provide an evaluation according to the rubric with the following structure:
1. For each criteria in the rubric, provide a grade based on the performance levels defined
2. Include the weight of each criteria
3. Provide specific feedback explaining why each grade was assigned
4. Calculate an overall grade

Respond in JSON format with this structure:
{
  "rubric": [
    {
      "criteria": "string (name of the criteria)",
      "weight": number (weight of this criteria as defined in the rubric),
      "grade": "string (performance level with score, e.g. 'Advanced (3)')",
      "feedback": "string (explanation of why this grade was given based on the rubric descriptions)"
    }
  ],
  "overallGrade": "string (calculated overall grade with percentage)",
  "feedback": "string (summary feedback explaining the overall evaluation)"
}`;

    const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        contents: [{
            parts: [{
                text: prompt
            }]
        }]
    });

    try {
        const content = response.data.candidates[0].content.parts[0].text;
        // Try to parse JSON from the response
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}') + 1;
        const jsonString = content.substring(jsonStart, jsonEnd);
        return JSON.parse(jsonString);
    } catch (parseError) {
        console.error('Error parsing Gemini response:', parseError);
        // Return mock data if parsing fails
        const criteriaArray = Array.isArray(rubricJson) ? rubricJson : [rubricJson];
        const mockRubricEvaluation = criteriaArray.map(criteria => {
            const criteriaName = criteria[" - Criteria"] || "Unknown Criteria";
            const score = Math.floor(Math.random() * 4) + 1;
            const weight = criteria["Weight (%)"] || 0.25;
            
            return {
                criteria: criteriaName,
                weight: weight,
                grade: `${getGradeLabel(score)} (${score})`,
                feedback: criteria[`${getGradeLabel(score)} (${score})`] || "No feedback available."
            };
        });
        
        return {
            rubric: mockRubricEvaluation,
            overallGrade: "B+ (85%)",
            feedback: "This is a mock evaluation because the AI response could not be parsed. In a production environment, this would be generated by analyzing the actual video content."
        };
    }
}

// Analyze video using OpenAI SDK
async function analyzeWithOpenAISDK(videoUrl, rubricJson) {
    try {
        const OpenAI = require('openai');
        
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not set in environment variables');
        }
        
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        const rubricString = JSON.stringify(rubricJson, null, 2);
        
        const prompt = `You are an expert educational content analyzer. Please analyze this YouTube video according to the provided rubric.

Video URL: ${videoUrl}

Rubric (in JSON format):
${rubricString}

Since you cannot actually access the video, please generate a realistic analysis that would be typical for a YouTube video on this topic.

Please provide an evaluation according to the rubric with the following structure:
1. For each criteria in the rubric, provide a grade based on the performance levels defined
2. Include the weight of each criteria
3. Provide specific feedback explaining why each grade was assigned
4. Calculate an overall grade

Respond in JSON format with this structure:
{
  "rubric": [
    {
      "criteria": "string (name of the criteria)",
      "weight": number (weight of this criteria as defined in the rubric),
      "grade": "string (performance level with score, e.g. 'Advanced (3)')",
      "feedback": "string (explanation of why this grade was given based on the rubric descriptions)"
    }
  ],
  "overallGrade": "string (calculated overall grade with percentage)",
  "feedback": "string (summary feedback explaining the overall evaluation)"
}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2
        });

        try {
            const content = response.choices[0].message.content;
            // Try to parse JSON from the response
            const jsonStart = content.indexOf('{');
            const jsonEnd = content.lastIndexOf('}') + 1;
            const jsonString = content.substring(jsonStart, jsonEnd);
            return JSON.parse(jsonString);
        } catch (parseError) {
            console.error('Error parsing OpenAI SDK response:', parseError);
            // Return mock data if parsing fails
            const criteriaArray = Array.isArray(rubricJson) ? rubricJson : [rubricJson];
            const mockRubricEvaluation = criteriaArray.map(criteria => {
                const criteriaName = criteria[" - Criteria"] || "Unknown Criteria";
                const score = Math.floor(Math.random() * 4) + 1;
                const weight = criteria["Weight (%)"] || 0.25;
                
                return {
                    criteria: criteriaName,
                    weight: weight,
                    grade: `${getGradeLabel(score)} (${score})`,
                    feedback: criteria[`${getGradeLabel(score)} (${score})`] || "No feedback available."
                };
            });
            
            return {
                rubric: mockRubricEvaluation,
                overallGrade: "B+ (85%)",
                feedback: "This is a mock evaluation because the AI response could not be parsed. In a production environment, this would be generated by analyzing the actual video content."
            };
        }
    } catch (error) {
        console.error('Error in OpenAI SDK analysis:', error);
        throw error;
    }
}

// Analyze video using Google Gemini SDK
async function analyzeWithGeminiSDK(videoUrl, rubricJson) {
    try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not set in environment variables');
        }
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        const rubricString = JSON.stringify(rubricJson, null, 2);
        
        const prompt = `You are an expert educational content analyzer. Please analyze this YouTube video according to the provided rubric.

Video URL: ${videoUrl}

Rubric (in JSON format):
${rubricString}

Since you cannot actually access the video, please generate a realistic analysis that would be typical for a YouTube video on this topic.

Please provide an evaluation according to the rubric with the following structure:
1. For each criteria in the rubric, provide a grade based on the performance levels defined
2. Include the weight of each criteria
3. Provide specific feedback explaining why each grade was assigned
4. Calculate an overall grade

Respond in JSON format with this structure:
{
  "rubric": [
    {
      "criteria": "string (name of the criteria)",
      "weight": number (weight of this criteria as defined in the rubric),
      "grade": "string (performance level with score, e.g. 'Advanced (3)')",
      "feedback": "string (explanation of why this grade was given based on the rubric descriptions)"
    }
  ],
  "overallGrade": "string (calculated overall grade with percentage)",
  "feedback": "string (summary feedback explaining the overall evaluation)"
}`;

        //const result = await model.generateContent(prompt);

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    {
                        text: prompt
                    }, 
                    {
                        fileData: {
                            mimeType: 'video/mp4',
                            fileUri: videoUrl,
                        }
                    }
                ]
            }]
        });    



        const response = await result.response;
        const content = response.text();
        
        try {
            // Try to parse JSON from the response
            const jsonStart = content.indexOf('{');
            const jsonEnd = content.lastIndexOf('}') + 1;
            const jsonString = content.substring(jsonStart, jsonEnd);
            return JSON.parse(jsonString);
        } catch (parseError) {
            console.error('Error parsing Gemini SDK response:', parseError);
            // Return mock data if parsing fails
            const criteriaArray = Array.isArray(rubricJson) ? rubricJson : [rubricJson];
            const mockRubricEvaluation = criteriaArray.map(criteria => {
                const criteriaName = criteria[" - Criteria"] || "Unknown Criteria";
                const score = Math.floor(Math.random() * 4) + 1;
                const weight = criteria["Weight (%)"] || 0.25;
                
                return {
                    criteria: criteriaName,
                    weight: weight,
                    grade: `${getGradeLabel(score)} (${score})`,
                    feedback: criteria[`${getGradeLabel(score)} (${score})`] || "No feedback available."
                };
            });
            
            return {
                rubric: mockRubricEvaluation,
                overallGrade: "B+ (85%)",
                feedback: "This is a mock evaluation because the AI response could not be parsed. In a production environment, this would be generated by analyzing the actual video content."
            };
        }
    } catch (error) {
        console.error('Error in Gemini SDK analysis:', error);
        throw error;
    }
}

// Helper function to get mock data
function getMockData(rubricJson) {
    // For a single criteria rubric, create a mock evaluation
    const mockRubricEvaluation = [];
    
    // Handle both single criteria object and array of criteria
    const criteriaArray = Array.isArray(rubricJson) ? rubricJson : [rubricJson];
    
    criteriaArray.forEach(criteria => {
        // Extract criteria name from the complex criteria object
        const criteriaName = criteria[" - Criteria"] || "Unknown Criteria";
        // Generate a random score between 1-4
        const score = Math.floor(Math.random() * 4) + 1;
        const weight = criteria["Weight (%)"] || 0.25;
        
        mockRubricEvaluation.push({
            criteria: criteriaName,
            weight: weight,
            grade: `${getGradeLabel(score)} (${score})`,
            feedback: criteria[`${getGradeLabel(score)} (${score})`] || "No feedback available."
        });
    });
    
    return {
        rubric: mockRubricEvaluation,
        overallGrade: "B+ (85%)",
        feedback: "This is a mock evaluation based on the provided rubric. In a production environment with API keys, this would be generated by analyzing the actual video content."
    };
}

//Sachin I : 2025-10-10 : Use papaparse to parse csv, instead of downloading entire csv and then parsing
async function fetchRubricFromSheetPapa(sheetUrl) {

    // Validate URL format
        if (!sheetUrl || typeof sheetUrl !== 'string') {
            throw new Error('Invalid Google Sheet URL provided');
        }
        // Convert Google Sheet URL to CSV export URL
        // const csvPapa = Papa.parse(sheetUrl, {
        //     download: true,
        //     header: true,
        //     dynamicTyping: true // Automatically converts numbers, booleans, and null
        //     });

        // Fetch CSV data with timeout
        const response = await axios.get(sheetUrl, { timeout: 10000 });
        
        // Check if response is valid
        if (!response.data) {
            throw new Error('Empty response from Google Sheets');
        }
        
        // Check if response contains HTML (indicating an error page)
        if (response.data.trim().startsWith('<')) {
            throw new Error('Unable to access Google Sheet. Please ensure the sheet is publicly accessible.');
        }

        const csvPapa = Papa.parse(response.data, {
            header: true,
            dynamicTyping: true // Automatically converts numbers, booleans, and null
            });

            return csvPapa;
}

// Function to fetch and parse rubric from Google Sheet
async function fetchRubricFromSheet(sheetUrl) {
    try {
        // Validate URL format
        if (!sheetUrl || typeof sheetUrl !== 'string') {
            throw new Error('Invalid Google Sheet URL provided');
        }
        
        // Convert Google Sheet URL to CSV export URL
        const csvUrl = convertSheetUrlToCsv(sheetUrl);
        
        // Fetch CSV data with timeout
        const response = await axios.get(csvUrl, { timeout: 10000 });
        
        // Check if response is valid
        if (!response.data) {
            throw new Error('Empty response from Google Sheets');
        }
        
        // Check if response contains HTML (indicating an error page)
        if (response.data.trim().startsWith('<')) {
            throw new Error('Unable to access Google Sheet. Please ensure the sheet is publicly accessible.');
        }
        
        // Parse CSV to JSON
        //const rubricJson = parseCsvToJson(response.data);

        // // Validate parsed rubric
        // if (!rubricJson || (Array.isArray(rubricJson) && rubricJson.length === 0)) {
        //     throw new Error('Parsed rubric is empty or invalid');
        // }

        //return rubricJson;

        const csvPapa = Papa.parse(response.data, {
            header: true,
            dynamicTyping: true // Automatically converts numbers, booleans, and null
            });
        
        // Validate parsed rubric
        if (!csvPapa || (Array.isArray(csvPapa) && csvPapa.length === 0)) {
            throw new Error('Parsed rubric is empty or invalid');
        }
        return csvPapa;
        
    } catch (error) {
        console.error('Error fetching or parsing Google Sheet:', error);
        
        // Provide more specific error messages
        if (error.code === 'ENOTFOUND') {
            throw new Error('Unable to connect to Google Sheets. Please check your internet connection.');
        } else if (error.code === 'ECONNABORTED') {
            throw new Error('Request to Google Sheets timed out. Please try again.');
        } else if (error.response && error.response.status === 404) {
            throw new Error('Google Sheet not found. Please check the URL.');
        } else if (error.response && error.response.status === 403) {
            throw new Error('Access denied to Google Sheet. Please ensure the sheet is publicly accessible.');
        }
        
        throw new Error('Failed to fetch or parse Google Sheet: ' + error.message);
    }
}

// Function to convert Google Sheet URL to CSV export URL
function convertSheetUrlToCsv(sheetUrl) {
    try {
        const url = new URL(sheetUrl);
        
        // Validate it's a Google Sheets URL
        if (!url.hostname.includes('docs.google.com')) {
            throw new Error('Not a valid Google Sheets URL');
        }
        
        const pathParts = url.pathname.split('/');
        
        // Find the spreadsheet ID (should be the 4th part in the path)
        const spreadsheetIdIndex = pathParts.findIndex(part => part === 'd');
        if (spreadsheetIdIndex === -1 || spreadsheetIdIndex + 1 >= pathParts.length) {
            throw new Error('Unable to extract spreadsheet ID from URL');
        }
        
        const spreadsheetId = pathParts[spreadsheetIdIndex + 1];
        if (!spreadsheetId) {
            throw new Error('Invalid spreadsheet ID in URL');
        }
        
        // Extract sheet ID (gid) if present
        let gid = '0'; // Default to first sheet
        if (url.searchParams.has('gid')) {
            gid = url.searchParams.get('gid');
        }
        
        // Construct CSV export URL
        return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error('Invalid URL format');
        }
        throw error;
    }
}

function parseCsvToJson(csvData) {
    try {
        // Split CSV into lines
        const lines = csvData.trim().split('\n');
        
        // Extract headers (first line)
        const headers = lines[0];
        
        // Process data rows
          var jsonData = [];
        
for (var i = 1; i < lines.length; i++) {
    var row = lines[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    jsonData.push(obj);
  }       
        // Return as array if multiple criteria, or single object if only one
        return JSON.stringify(jsonData, null, 2);
    
    } catch (error) {
        throw new Error('Failed to parse CSV data: ' + error.message);
    }
}


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Export functions for testing
module.exports = {
    parseCsvToJson,
    convertSheetUrlToCsv,
    fetchRubricFromSheet,
    fetchRubricFromSheetPapa
};
