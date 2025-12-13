import dotenv from 'dotenv';
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;
import { GoogleGenAI, Type } from '@google/genai';

// Load environment variables from .env when running via node
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3001;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.PG_HOST,
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000, // 5 second connection timeout
  idleTimeoutMillis: 30000, // 30 second idle timeout
  max: 10 // Maximum number of clients in the pool
};

// Create PostgreSQL client pool for better connection management
const { Pool } = pkg;
const pgPool = new Pool(pgConfig);

// Test database connection
pgPool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('PostgreSQL connection error:', err);
  } else {
    console.log('Connected to PostgreSQL database');
  }
});

// Handle pool errors
pgPool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Log whether GEMINI key was loaded (masked) to help debugging local env issues
if (GEMINI_KEY) {
  try {
    const masked = `${GEMINI_KEY.slice(0,4)}...${GEMINI_KEY.slice(-4)}`;
    console.log('GEMINI_KEY loaded from environment (masked):', masked);
  } catch (e) {
    console.log('GEMINI_KEY loaded (length):', GEMINI_KEY.length || 'unknown');
  }
} else {
  console.log('GEMINI_KEY not provided in environment');
}

app.post('/evaluate', async (req, res) => {
  try {
    const { videoUrl, videoDetails, promptbegining, rubric, evaluationType, structuredreturnedconfig } = req.body;

    if (!videoUrl) return res.status(400).json({ error: 'Missing videoUrl' });
    if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    // Initialize Google GenAI client
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
    const model = 'gemini-2.5-flash';
    let contents;
    let config;
      // Build the prompt for accuracy evaluation
      const rubricContent = (rubric && Object.keys(rubric).length > 0) 
        ? `RUBRIC:\n${JSON.stringify(rubric)}`
        : '';

    // Handle different config formats
    // Some configs have generationConfig wrapper, others don't
    let apiConfig;
    if (structuredreturnedconfig.generationConfig) {
      // New format with generationConfig wrapper
      apiConfig = structuredreturnedconfig.generationConfig;
    } else {
      // Old format with direct responseMimeType and responseSchema
      apiConfig = structuredreturnedconfig;
    }

    const promptText = promptbegining+`
          VIDEO DETAILS:
          ${videoDetails}

          ${rubricContent}`;

      contents = [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                fileUri: videoUrl,
                mimeType: 'video/*',
              }
            },
            {
              text: promptText
            }
          ],
        },
      ];
   
    console.log(`--- Calling Gemini API to evaluate video (${evaluationType} evaluation, streaming response) ---`);

    try {
      // Call the streaming API using @google/genai SDK

      const response = await ai.models.generateContentStream({
        model,
        config: apiConfig,
        contents,
      });

      // Collect the streaming response chunks
      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.text) {
          fullResponse += chunk.text;
        }
      }

      console.log('--- Stream finished ---');
      //console.log('Full response received:', fullResponse);

      // Parse the JSON response
      let parsed = null;
      try {
        parsed = JSON.parse(fullResponse);
        //console.log('Parsed JSON:', JSON.stringify(parsed, null, 2));
      } catch (err) {
        console.warn('Failed to parse JSON from response:', err);
        // If parsing fails, try to extract JSON from the text
        const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error('Failed to parse extracted JSON:', e);
          }
        }
      }

      return res.json({ 
        raw: fullResponse, 
        text: fullResponse, 
        parsed 
      });
    } catch (error) {
      console.error('An error occurred during the API call:', error);
      return res.status(502).json({ 
        error: 'Upstream model API error', 
        message: error.message || String(error)
      });
    }
  } catch (err) {
    console.error('evaluate error', err);
    res.status(500).json({ error: String(err) });
  }
});

// New endpoint to store evaluation results in PostgreSQL
app.post('/store-evaluation', async (req, res) => {
  try {
    const { userId, userEmail, videoUrl, videoType, evaluationData, videoDetails,selectedPhase,selectedVideoTitle } = req.body;

    console.log('Received request to store evaluation:', { userId, userEmail, videoUrl, videoDetails, selectedPhase, selectedVideoTitle });
    //console.log('Full request body:', JSON.stringify(req.body, null, 2));
    //console.log('Evaluation data:', JSON.stringify(evaluationData, null, 2));
    
    // Log the structure of evaluation_result specifically
    if (evaluationData && evaluationData.evaluation_result) {
      //console.log('Evaluation result structure:', JSON.stringify(evaluationData.evaluation_result, null, 2));
      
      // Log accuracy and abilityToExplain separately
      if (evaluationData.evaluation_result.accuracy) {
        console.log('Accuracy evaluation:', JSON.stringify(evaluationData.evaluation_result.accuracy, null, 2));
      }
      if (evaluationData.evaluation_result.abilityToExplain) {
        console.log('Ability evaluation:', JSON.stringify(evaluationData.evaluation_result.abilityToExplain, null, 2));
      }
    }

    if (!userId || !userEmail || !videoUrl) {
      return res.status(400).json({ error: 'Missing required fields: userId, userEmail, videoUrl' });
    }

    // Store evaluation data in separate tables based on video type
    if (videoType === 'concept') {
      console.log('Storing concept evaluation data:', JSON.stringify(evaluationData, null, 2));
      
      // For concept explanation, we have two evaluations: accuracy and ability to explain
      const accuracyEvaluation = evaluationData.evaluation_result.accuracy;
      const abilityEvaluation = evaluationData.evaluation_result.abilityToExplain;
      
      // Calculate accuracy score and feedback from the new structured format
      let accuracyScore = null;
      let accuracyFeedback = '';
      
      // Extract accuracy score and feedback from the evaluation result
      if (accuracyEvaluation) {
        console.log('Processing accuracy evaluation:', JSON.stringify(accuracyEvaluation, null, 2));
        try {
          // First, check if it's the parsed response object with "Accuracy Level" array
          const parsedAccuracy = accuracyEvaluation.parsed || accuracyEvaluation;
          
          if (parsedAccuracy && parsedAccuracy["Accuracy Level"] && Array.isArray(parsedAccuracy["Accuracy Level"]) && parsedAccuracy["Accuracy Level"].length > 0) {
            // New structured format: Extract from "Accuracy Level" array
            const accuracyItem = parsedAccuracy["Accuracy Level"][0];
            const accuracyLevelString = accuracyItem["Accuracy Level"] || '';
            const feedbackObj = accuracyItem["Feedback"] || {};
            
            // Handle structured feedback (new format with three fields)
            if (typeof feedbackObj === 'object' && feedbackObj !== null) {
              // Store structured feedback as JSON string
              accuracyFeedback = JSON.stringify(feedbackObj);
            } else {
              // Fallback for simple string feedback (backward compatibility)
              accuracyFeedback = feedbackObj || '';
            }
            
            // Try to extract numeric percentage from the accuracy level string
            // Expected format: "85%" or "85 out of 100" or "85/100"
            const percentMatch = accuracyLevelString.match(/(\d+)\s*%/);
            const outOfMatch = accuracyLevelString.match(/(\d+)\s*(?:out of|\/)\s*100/);
            
            if (percentMatch) {
              accuracyScore = parseInt(percentMatch[1], 10);
            } else if (outOfMatch) {
              accuracyScore = parseInt(outOfMatch[1], 10);
            } else {
              // If no numeric value found, try to parse the string as a number
              const numericValue = parseFloat(accuracyLevelString);
              if (!isNaN(numericValue)) {
                accuracyScore = numericValue;
              } else {
                // Store as null if we can't extract a number
                accuracyScore = null;
              }
            }
            
            console.log('Extracted accuracy from structured format:', { accuracyScore, accuracyFeedback });
          }
          // Fallback to old format for backward compatibility
          else if (accuracyEvaluation.criteria && accuracyEvaluation.criteria.length > 0) {
            // Ensure score is between 1-10
            const rawScore = accuracyEvaluation.criteria[0].score;
            accuracyScore = (rawScore >= 1 && rawScore <= 10) ? rawScore : 
                           (rawScore > 10 ? 10 : 
                           (rawScore < 1 ? 1 : rawScore)) || 1;
            accuracyFeedback = accuracyEvaluation.criteria[0].feedback || '';
          } 
          // Fallback to overallScore if criteria is not available
          else if (accuracyEvaluation.overallScore !== undefined) {
            // Ensure score is between 1-10
            const rawScore = accuracyEvaluation.overallScore;
            accuracyScore = (rawScore >= 1 && rawScore <= 10) ? rawScore : 
                           (rawScore > 10 ? 10 : 
                           (rawScore < 1 ? 1 : rawScore)) || 1;
            accuracyFeedback = accuracyEvaluation.overallFeedback || '';
          }
          // Handle text-based evaluations (legacy support)
          else if (accuracyEvaluation.text) {
            console.log('Processing text-based accuracy evaluation');
            // Try to extract JSON from markdown code block
            const codeBlockMatch = accuracyEvaluation.text.match(/```json\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
              const jsonText = codeBlockMatch[1];
              console.log('Extracted JSON text from accuracy evaluation:', jsonText);
              const parsedJson = JSON.parse(jsonText);
              console.log('Parsed JSON from accuracy evaluation:', JSON.stringify(parsedJson, null, 2));
              
              // Look for content_evaluation object (based on the actual structure you provided)
              if (parsedJson.content_evaluation) {
                const ce = parsedJson.content_evaluation;
                // Create a composite feedback from the various fields
                const feedbackParts = [];
                if (ce.accuracy) feedbackParts.push(ce.accuracy);
                if (ce.completeness) feedbackParts.push(ce.completeness);
                if (ce.clarity) feedbackParts.push(ce.clarity);
                if (ce.depth) feedbackParts.push(ce.depth);
                if (ce.engagement) feedbackParts.push(ce.engagement);
                
                accuracyFeedback = feedbackParts.join(' ');
                // If the model provided a numeric score field, use it; otherwise leave as null
                if (ce.score !== undefined && !isNaN(Number(ce.score))) {
                  accuracyScore = Number(ce.score);
                } else if (parsedJson.overallScore !== undefined && !isNaN(Number(parsedJson.overallScore))) {
                  accuracyScore = Number(parsedJson.overallScore);
                } else {
                  accuracyScore = null;
                }
                console.log('Extracted accuracy from content_evaluation:', { accuracyScore, accuracyFeedback });
              }
              // Fallback to looking for video_evaluation object (previous structure)
              else if (parsedJson.video_evaluation) {
                const ve = parsedJson.video_evaluation;
                // Create a composite feedback from the various fields
                const feedbackParts = [];
                if (ve.relevance_to_content_type) feedbackParts.push(ve.relevance_to_content_type);
                if (ve.relevance_to_page_details) feedbackParts.push(ve.relevance_to_page_details);
                
                // Handle content_coverage object
                if (ve.content_coverage) {
                  const cc = ve.content_coverage;
                  if (cc.build_profile_page_elements) feedbackParts.push(cc.build_profile_page_elements);
                  
                  if (cc.image_embedding_attributes && cc.image_embedding_attributes.details) {
                    feedbackParts.push(cc.image_embedding_attributes.details);
                  }
                  
                  if (cc.section_organization_tags && cc.section_organization_tags.details) {
                    feedbackParts.push(cc.section_organization_tags.details);
                  }
                  
                  if (cc.unordered_ordered_lists && cc.unordered_ordered_lists.details) {
                    feedbackParts.push(cc.unordered_ordered_lists.details);
                  }
                }
                
                accuracyFeedback = feedbackParts.join(' ');
                // If the model provided numeric fields use them, otherwise leave null
                if (ve.overallScore !== undefined && !isNaN(Number(ve.overallScore))) {
                  accuracyScore = Number(ve.overallScore);
                } else if (ve.score !== undefined && !isNaN(Number(ve.score))) {
                  accuracyScore = Number(ve.score);
                } else {
                  accuracyScore = null;
                }
                console.log('Extracted accuracy from video_evaluation:', { accuracyScore, accuracyFeedback });
              }
            }
          }
        } catch (e) {
          console.warn('Failed to parse accuracy evaluation:', e);
          // Set default values if parsing fails
          accuracyScore = null;
          accuracyFeedback = '';
        }
        console.log('Final accuracy values:', { accuracyScore, accuracyFeedback });
      }
      
      // Get ability to explain evaluation level and feedback
      let abilityEvaluationText = '';
      let abilityFeedback = '';
      
      if (abilityEvaluation) {
        console.log('Processing ability evaluation:', JSON.stringify(abilityEvaluation, null, 2));
        try {
          // First, check if it's the parsed response object with "Ability to explain" array
          const parsedAbility = abilityEvaluation.parsed || abilityEvaluation;
          
          if (parsedAbility && parsedAbility["Ability to explain"] && Array.isArray(parsedAbility["Ability to explain"]) && parsedAbility["Ability to explain"].length > 0) {
            // New structured format: Extract from "Ability to explain" array
            const abilityItem = parsedAbility["Ability to explain"][0];
            abilityEvaluationText = abilityItem["Ability to explain"] || '';
            const feedbackObj = abilityItem["Structured Feedback"] || abilityItem["Feedback"] || {};
            
            // Handle structured feedback (new format with three fields)
            if (typeof feedbackObj === 'object' && feedbackObj !== null) {
              // Store structured feedback as JSON string
              abilityFeedback = JSON.stringify(feedbackObj);
            } else {
              // Fallback for simple string feedback (backward compatibility)
              abilityFeedback = feedbackObj || '';
            }
            
            console.log('Extracted ability from structured format:', { abilityEvaluationText, abilityFeedback });
          }
          // Fallback to old format for backward compatibility
          else if (abilityEvaluation.criteria && abilityEvaluation.criteria.length > 0) {
            // The level is in the "name" field of the first criterion
            abilityEvaluationText = abilityEvaluation.criteria[0].name || '';
            abilityFeedback = abilityEvaluation.criteria[0].feedback || '';
          } else if (abilityEvaluation.level) {
            // Fallback to level property if available
            abilityEvaluationText = abilityEvaluation.level;
            abilityFeedback = abilityEvaluation.overallFeedback || '';
          }
        } catch (e) {
          console.warn('Failed to parse ability evaluation:', e);
          // Set default values if parsing fails
          abilityEvaluationText = '';
          abilityFeedback = '';
        }
        console.log('Final ability values:', { abilityEvaluationText, abilityFeedback });
      }
      
      // Insert concept evaluation data into PostgreSQL
      const query = `
        INSERT INTO tbl_ailabs_ytfeedback_concept_evaluations (
          email,
          project_name,
          page_name,
          video_url,
          concept_explanation_accuracy,
          concept_explanation_feedback,
          ability_to_explain_evaluation,
          ability_to_explain_feedback,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id
      `;
      const values = [
        userEmail,
        selectedPhase || '',
        selectedVideoTitle || '',
        videoUrl,
        accuracyScore,
        accuracyFeedback,
        abilityEvaluationText,
        abilityFeedback
      ];

      console.log('Final concept evaluation values to be stored:', {
        accuracyScore,
        accuracyFeedback,
        abilityEvaluationText,
        abilityFeedback
      });
      console.log('Executing concept evaluation database query with values:', values);

      const result = await pgPool.query(query, values);
      
      console.log('Successfully inserted concept evaluation with ID:', result.rows[0].id);
      
      res.json({ 
        success: true, 
        id: result.rows[0].id,
        message: 'Concept evaluation stored successfully' 
      });
    } else {
      // For project explanation with new structured format
      const projectEvaluation = evaluationData.evaluation_result;
      
     // console.log('Storing project evaluation data:', JSON.stringify(projectEvaluation, null, 2));
      
      // Extract data from the new structured format
      let evaluationText = '';
      let feedbackText = '';
      let evaluationJson = '';
      
      if (projectEvaluation) {
        // The projectEvaluation should contain the parameters array directly
        if (projectEvaluation.parameters && Array.isArray(projectEvaluation.parameters)) {
          // New structured format: Extract from "parameters" array
          evaluationJson = JSON.stringify(projectEvaluation);
          
          // Create a summary text from parameters
          const parameterSummaries = projectEvaluation.parameters.map(param => {
            return `${param.name} (${param.weightage}%): ${param.level}`;
          }).join('; ');
          
          evaluationText = parameterSummaries;
          
          // Combine all feedback into one text - handle both old and new feedback structure
          const allFeedback = projectEvaluation.parameters.map(param => {
            const fb = param.feedback || {};
            
            // Check if it's the new structured format with three specific fields
            if (fb["What could you do well?"] || fb["What can you do better?"] || fb["Next Suggested Deep Dive?"]) {
              return `${param.name}:\n  ✓ What could you do well?: ${fb["What could you do well?"] || 'N/A'}\n  ✗ What can you do better?: ${fb["What can you do better?"] || 'N/A'}\n  ⚠ Next Suggested Deep Dive?: ${fb["Next Suggested Deep Dive?"] || 'N/A'}`;
            }
            // Fallback to old format (good/bad/ugly)
            else {
              return `${param.name}:\n  ✓ Good: ${fb.good || 'N/A'}\n  ✗ Bad: ${fb.bad || 'N/A'}\n  ⚠ Improvements: ${fb.ugly || 'N/A'}`;
            }
          }).join('\n\n');
          
          feedbackText = allFeedback;
          
          // Extracted project data from structured format
          console.log('Extracted project evaluation data');
        }
        // Fallback to old format for backward compatibility
        else {
          evaluationJson = JSON.stringify(projectEvaluation);
          evaluationText = projectEvaluation.overallScore ? `Overall Score: ${projectEvaluation.overallScore}` : '';
          feedbackText = projectEvaluation.overallFeedback || '';
        }
      }
      
      console.log('Final project evaluation values to be stored:', {
        evaluationText: evaluationText.substring(0, 100),
        feedbackText: feedbackText.substring(0, 100),
        evaluationJsonLength: evaluationJson.length
      });
      
      // Insert project evaluation data into PostgreSQL
      const query = `
        INSERT INTO tbl_ailabs_ytfeedback_project_evaluation (
          email,
          project_name,
          video_url,
          project_explanation_evaluation,
          project_explanation_feedback,
          project_explanation_evaluationjson,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id
      `;
      const values = [
        userEmail,
        selectedPhase,
        videoUrl,
        evaluationText,
        feedbackText,
        evaluationJson
      ];

      //console.log('Executing project evaluation database query with values:', values);

      const result = await pgPool.query(query, values);
      
      console.log('Successfully inserted project evaluation with ID:', result.rows[0].id);
      
      res.json({ 
        success: true, 
        id: result.rows[0].id,
        message: 'Project evaluation stored successfully' 
      });
    }
  } catch (err) {
    console.error('Error storing evaluation:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Fetch concept evaluations history
app.get('/concept-history', async (req, res) => {
  try {
    const userEmail = req.query.email;
    
    console.log('Concept history request for email:', userEmail);
    
    if (!userEmail) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    const query = `
      SELECT 
        id,
        email,
        project_name,
        page_name,
        video_url,
        concept_explanation_accuracy,
        concept_explanation_feedback,
        ability_to_explain_evaluation,
        ability_to_explain_feedback,
        created_at
      FROM tbl_ailabs_ytfeedback_concept_evaluations
      WHERE email = $1
      ORDER BY created_at DESC
    `;
    
    const result = await pgPool.query(query, [userEmail]);
    console.log('Concept history found:', result.rows.length, 'records');
    
    res.json({ 
      success: true, 
      data: result.rows 
    });
  } catch (err) {
    console.error('Error fetching concept history:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Fetch project evaluations history
app.get('/project-history', async (req, res) => {
  try {
    const userEmail = req.query.email;
    
    console.log('Project history request for email:', userEmail);
    
    if (!userEmail) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    const query = `
      SELECT 
        id,
        email,
        project_name,
        video_url,
        project_explanation_evaluation,
        project_explanation_feedback,
        project_explanation_evaluationjson,
        created_at
      FROM tbl_ailabs_ytfeedback_project_evaluation
      WHERE email = $1
      ORDER BY created_at DESC
    `;
    
    const result = await pgPool.query(query, [userEmail]);
    console.log('Project history found:', result.rows.length, 'records');
    
    res.json({ 
      success: true, 
      data: result.rows 
    });
  } catch (err) {
    console.error('Error fetching project history:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Fetch single concept evaluation by ID
app.get('/concept-evaluation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        id,
        email,
        project_name,
        page_name,
        video_url,
        concept_explanation_accuracy,
        concept_explanation_feedback,
        ability_to_explain_evaluation,
        ability_to_explain_feedback,
        created_at
      FROM tbl_ailabs_ytfeedback_concept_evaluations
      WHERE id = $1
    `;
    
    const result = await pgPool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Concept evaluation not found' });
    }
    
    res.json({ 
      success: true, 
      data: result.rows[0] 
    });
  } catch (err) {
    console.error('Error fetching concept evaluation:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Fetch single project evaluation by ID
app.get('/project-evaluation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        id,
        email,
        project_name,
        video_url,
        project_explanation_evaluation,
        project_explanation_feedback,
        project_explanation_evaluationjson,
        created_at
      FROM tbl_ailabs_ytfeedback_project_evaluation
      WHERE id = $1
    `;
    
    const result = await pgPool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project evaluation not found' });
    }
    
    res.json({ 
      success: true, 
      data: result.rows[0] 
    });
  } catch (err) {
    console.error('Error fetching project evaluation:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Delete concept evaluation
app.delete('/concept-evaluation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      DELETE FROM tbl_ailabs_ytfeedback_concept_evaluations
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pgPool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Concept evaluation not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Concept evaluation deleted successfully' 
    });
  } catch (err) {
    console.error('Error deleting concept evaluation:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Delete project evaluation
app.delete('/project-evaluation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      DELETE FROM tbl_ailabs_ytfeedback_project_evaluation
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pgPool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project evaluation not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Project evaluation deleted successfully' 
    });
  } catch (err) {
    console.error('Error deleting project evaluation:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Health endpoint for readiness checks
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Evaluation API listening on http://localhost:${PORT}`);
});
