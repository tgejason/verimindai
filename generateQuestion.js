// generateQuestion.cjs
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Define the secret for your Gemini API key
const geminiApiKey = defineSecret('GEMINI_API_KEY');

// Initialize a single instance of the Gemini model to be reused
let genAI;

async function getGenerativeAIModel() {
    if (!genAI) {
        genAI = new GoogleGenerativeAI(geminiApiKey.value());
    }
    return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

exports.generateQuestion = onCall({ secrets: [geminiApiKey] }, async (request) => {
    try {
        console.log('generateQuestion function started.'); // <-- New log to confirm execution
        
        const { skill, jobTitle } = request.data;
        
        if (!skill || !jobTitle) {
            throw new HttpsError('invalid-argument', 'The skill and job title are required.');
        }

        const model = await getGenerativeAIModel();
        
        const prompt = `Based on the job title "${jobTitle}" and the skill "${skill}", generate a JSON object containing a tree of interview questions. The object must have three keys: 'warmup', 'manager', and 'legendary'. The value for each key should be a list of 5-7 relevant questions. Ensure the questions increase in complexity and technicality from 'warmup' to 'legendary'. Do not include any other text or formatting.`;
        
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        
        // Sanitize the text to remove any leading/trailing backticks and "json" tag
        const sanitizedText = text.replace(/```json\s*|```/g, '').trim();

        // Attempt to parse the sanitized JSON response
        const questionsData = JSON.parse(sanitizedText);

        console.log(`Generated structured questions: ${JSON.stringify(questionsData, null, 2)}`);
        return questionsData;

    } catch (error) {
        // Log a detailed error message for better debugging
        console.error('Error in generateQuestion:', error);
        
        // Check for the 503 "Service Unavailable" error and provide a user-friendly message
        if (error.status === 503) {
            throw new HttpsError('unavailable', 'The AI model is currently swamped with brilliant ideas. Please give it a moment to catch its breath.');
        }
        
        // For all other errors, use a generic message
        throw new HttpsError('internal', `Failed to generate question: ${error.message}`);
    }
});