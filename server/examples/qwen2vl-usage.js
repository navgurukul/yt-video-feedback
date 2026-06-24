/**
 * Example: Using Qwen2-VL-7B-Instruct for Video Analysis
 * 
 * This file demonstrates how to call the /analyze-video endpoint
 * from a Node.js application.
 */

// Example 1: Basic Analysis with Image URLs
async function basicExample() {
  const response = await fetch('http://localhost:3001/analyze-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      frames: [
        'https://example.com/frame1.jpg',
        'https://example.com/frame2.jpg',
        'https://example.com/frame3.jpg'
      ],
      transcript: `Welcome to this HTML tutorial. Today we'll learn about semantic HTML elements.
      
Semantic HTML elements clearly describe their meaning in both human and machine-readable ways.

For example, <header>, <nav>, <main>, and <footer> are semantic elements that describe
the structure of a web page. These elements make your HTML more readable and accessible.

Let's look at some examples of how to use these elements in practice...`
    })
  });

  const result = await response.json();
  
  if (result.success) {
    console.log('Analysis Results:');
    console.log('================');
    console.log('Quality Score:', result.parsed.content_quality_score, '/10');
    console.log('\nSummary:', result.parsed.summary);
    console.log('\nKey Learning Points:');
    result.parsed.key_learning_points.forEach((point, i) => {
      console.log(`${i + 1}. ${point}`);
    });
    console.log('\nSuggestions:');
    result.parsed.suggestions_for_improvement.forEach((suggestion, i) => {
      console.log(`${i + 1}. ${suggestion}`);
    });
  } else {
    console.error('Analysis failed:', result.error);
  }
}

// Example 2: Convert YouTube Video to Frames + Transcript
async function youtubeVideoExample() {
  // Pseudocode - you'll need to implement video processing
  const videoUrl = 'https://www.youtube.com/watch?v=xxxxx';
  
  // 1. Extract frames from video (use ffmpeg or similar)
  const frames = await extractFramesFromVideo(videoUrl, {
    interval: 5,  // Every 5 seconds
    maxFrames: 8  // Maximum 8 frames
  });
  
  // 2. Get transcript (YouTube API or speech-to-text)
  const transcript = await getYouTubeTranscript(videoUrl);
  
  // 3. Analyze with Qwen2-VL
  const response = await fetch('http://localhost:3001/analyze-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      frames,
      transcript,
      timeout: 90000,    // 90 seconds for longer videos
      maxRetries: 3
    })
  });
  
  return await response.json();
}

// Example 3: Custom Evaluation for Code Tutorial
async function codeTutorialExample() {
  const customPrompt = `Evaluate this programming tutorial video focusing on:

1. Code Quality: Are best practices demonstrated?
2. Explanation Clarity: Are concepts explained clearly?
3. Pacing: Is the speed appropriate for learners?
4. Examples: Are examples practical and relevant?

Provide response in JSON format:
{
  "summary": "Brief overview",
  "key_learning_points": ["Point 1", "Point 2", "Point 3"],
  "content_quality_score": 1-10,
  "code_quality_rating": "Poor/Average/Good/Excellent",
  "explanation_clarity_rating": "Poor/Average/Good/Excellent",
  "pacing_rating": "Too Fast/Just Right/Too Slow",
  "suggestions_for_improvement": ["Suggestion 1", "Suggestion 2"]
}`;

  const response = await fetch('http://localhost:3001/analyze-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      frames: [
        'https://example.com/code-screenshot-1.png',
        'https://example.com/code-screenshot-2.png'
      ],
      transcript: 'Your code tutorial transcript...',
      customPrompt
    })
  });
  
  return await response.json();
}

// Example 4: Error Handling
async function errorHandlingExample() {
  try {
    const response = await fetch('http://localhost:3001/analyze-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        frames: ['https://example.com/frame.jpg'],
        transcript: 'Video transcript...'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Handle specific error types
      if (response.status === 400) {
        console.error('Invalid request:', error.details);
      } else if (response.status === 500) {
        console.error('Server configuration error:', error.details);
      } else if (response.status === 504) {
        console.error('Request timed out:', error.details);
        console.log('Try: Reduce frame count or increase timeout');
      } else if (response.status === 502) {
        console.error('Service unavailable:', error.details);
        console.log('Try: Wait and retry later');
      }
      
      throw new Error(`Analysis failed: ${error.error}`);
    }

    const result = await response.json();
    return result;
    
  } catch (error) {
    console.error('Request failed:', error.message);
    
    // Implement retry logic
    console.log('Retrying in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Retry with reduced parameters
    return errorHandlingExample(); // Recursive retry (add max attempts in production)
  }
}

// Example 5: Check Service Health Before Analysis
async function healthCheckExample() {
  // Check if service is ready
  const healthResponse = await fetch('http://localhost:3001/qwen2vl-health');
  const health = await healthResponse.json();
  
  console.log('Service Status:', health.status);
  console.log('Token Configured:', health.token_configured);
  
  if (health.status !== 'healthy') {
    console.error('Service is not healthy. Cannot proceed with analysis.');
    console.error('Error:', health.error);
    return;
  }
  
  // Service is healthy, proceed with analysis
  console.log('Service is healthy. Proceeding with analysis...');
  
  const response = await fetch('http://localhost:3001/analyze-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      frames: ['https://example.com/frame.jpg'],
      transcript: 'Video transcript...'
    })
  });
  
  return await response.json();
}

// Export for use in other modules
export {
  basicExample,
  youtubeVideoExample,
  codeTutorialExample,
  errorHandlingExample,
  healthCheckExample
};

// If running directly, execute basic example
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running basic example...\n');
  basicExample()
    .then(() => console.log('\n✅ Example completed'))
    .catch(error => console.error('\n❌ Example failed:', error));
}
