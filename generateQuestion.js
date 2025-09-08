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
        const { skill, jobTitle } = request.data;
        
        if (!skill || !jobTitle) {
            throw new HttpsError('invalid-argument', 'The skill and job title are required.');
        }

        const model = await getGenerativeAIModel();
        
        const prompt = `Based on the job title "${jobTitle}" and the skill "${skill}", generate a single, concise question about how the skill was likely used in that role. The question should be suitable for an interview setting. Do not include any other text, just the question itself.`;

        const result = await model.generateContent(prompt);
        const question = result.response.text().trim().replace(/['"]+/g, '');

        console.log(`Generated question: ${question}`);
        return { question: question };

    } catch (error) {
        console.error('Error in generateQuestion:', error);
        throw new HttpsError('internal', `Failed to generate question: ${error.message}`);
    }
});