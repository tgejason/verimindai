// index.js
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { Storage } = require('@google-cloud/storage');
const { onObjectFinalized, setGlobalOptions } = require('firebase-functions/v2/storage');
const { defineSecret } = require('firebase-functions/params');

// Define the secret
const geminiApiKey = defineSecret('GEMINI_API_KEY');

// Initialize non-AI dependencies globally
const app = initializeApp({
    projectId: 'coin-service-326121',
    storageBucket: 'coin-service-326121.firebasestorage.app'
});
const db = getFirestore(app);
const storage = new Storage();

// Use a dynamic import inside the function to avoid loading issues with ES modules
let genAIModel;

async function getGenerativeAIModel() {
    if (!genAIModel) {
        const { GoogleGenAI } = await import('@google/genai');
        const gen_AI = new GoogleGenAI({ apiKey: geminiApiKey.value() });
        genAIModel = gen_AI.models;
    }
    return genAIModel;
}

exports.processResume = onObjectFinalized({secrets: [geminiApiKey] }, async (event) => {
    try {
        const genAIModel = await getGenerativeAIModel();
        const file = event.data;
        const filePath = file.name;
        const bucketName = file.bucket;

        console.log(`Processing file: ${filePath} in bucket: ${bucketName}`);

        if (!filePath.startsWith('resumes/') || !filePath.endsWith('.pdf')) {
            console.log('Not a resume PDF, exiting.');
            return;
        }

        const [dataBuffer] = await storage.bucket(bucketName).file(filePath).download();

        const pdfPart = {
            inlineData: {
                data: dataBuffer.toString('base64'),
                mimeType: 'application/pdf',
            },
        };

        const prompt = `
        You are a resume analysis expert. I will provide you with the text content of a resume.
        Your task is to extract the following information and return it as a single JSON object.
        Make sure the response is a valid JSON object only, with no other text, comments, or markdown outside the JSON.

        The JSON object should have three top-level keys: "skills", "experience", and "education".

        For the "skills" key, provide a list of all skills found in the resume. This should be an array of objects. Each object should have a "name" property (string) for the skill name, and an "experienceIndex" property (array of numbers) which contains the indices of the jobs in the "experience" array where this skill was utilized. If a skill is a soft skill or a general technical skill and not tied to a specific job, its "experienceIndex" array should be empty.

        For the "experience" key, provide a timeline of the user's jobs, ordered from most recent to oldest. This should be an array of objects. Each object must have a "title", "description", "start_year", and "end_year" string.

        For the "education" key, provide a list of education entries. This should be an array of objects, with each object having a "degree" and "institution" string.

        Example of the desired JSON structure:
        {
          "skills": [
            { "name": "Python", "experienceIndex": [0, 1] },
            { "name": "Teamwork", "experienceIndex": [0] },
            { "name": "Data Analysis", "experienceIndex": [] }
          ],
          "experience": [
            { "title": "Test Engineer", "description": "Wrote and deployed Python code...", "start_year": "2020", "end_year": "2022" },
            { "title": "Senior Technician", "description": "Automated test tools...", "start_year": "2018", "end_year": "2020" }
          ],
          "education": [
            { "degree": "B.S. in Electrical Engineering", "institution": "University of California, Berkeley" }
          ]
        }`;

        const request = {
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: prompt }, pdfPart] }
            ]
        };

        const result = await genAIModel.generateContent(request);

        console.log('Full API Response:', JSON.stringify(result, null, 2));

        // CORRECTED LOGIC: Properly parse the userId and resumeId from the file path
        const pathParts = filePath.split('/');
        const fileNameWithExt = pathParts[pathParts.length - 1];
        const resumeId = fileNameWithExt.split('.').slice(0, -1).join('.');
        const userId = resumeId.split('_')[0];

        
        let parsedContent = {};

        if (result.candidates && result.candidates.length > 0) {
            const rawContent = result.candidates[0].content.parts[0].text;
            
            try {
                // Remove Markdown code block syntax and trim whitespace
                const cleanedContent = rawContent.replace(/```json\n|```/g, '').trim();
                parsedContent = JSON.parse(cleanedContent);
            } catch (parseError) {
                console.error('JSON Parsing Failed:', parseError.message);
                console.log('Raw API response content saved to Firestore:', rawContent);

                // Create a fallback data object with the raw content
                parsedContent = {
                    skills: [],
                    experience: [],
                    education: [],
                    rawContent: rawContent // Store the unparsed content for later
                };
            }
        } else {
            console.error('API did not return a valid response with candidates:', result);
        }
        
        // This is the correct way to save the data in the nested 'data' field
        const docRef = db.collection('users').doc(userId).collection('resumes').doc(resumeId);
        await docRef.set({ data: parsedContent }); // <-- Save as a nested object

        console.log(`Resume data saved to Firestore at users/${userId}/resumes/${resumeId}`);
        
        // ADD THIS NEW LINE:
        console.log('Successfully deployed the corrected processResume function.');

    }
    catch (error) {
        console.error('Error processing resume:', error);
    }
});

// Import and export the new function
const { generateExperienceImage } = require('./generateExperienceImage.cjs');
exports.generateExperienceImage = generateExperienceImage;


const { generateQuestion } = require('./generateQuestion.cjs');
exports.generateQuestion = generateQuestion;