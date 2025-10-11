const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Use this check to ensure the app is only initialized once
if (!admin.apps.length) {
    admin.initializeApp();
}

// Define the secret for your Gemini API key
const geminiApiKey = defineSecret('GEMINI_API_KEY');

// Initialize a single instance of the Gemini model to be reused
let genAI;

async function getGenerativeAIModel() {
    if (!genAI) {
        // Initialize the client correctly
        genAI = new GoogleGenerativeAI(geminiApiKey.value());
    }
    // Set the correct model name as per your request
    return genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image-preview' });
}

exports.generateExperienceImage = onCall({ secrets: [geminiApiKey] }, async (request) => {
    try {
        console.log('Function called. Request data:', request.data);
        const { resumeId, jobIndex, title, description } = request.data;
        
        if (!resumeId || jobIndex === undefined || !title || !description) {
            console.error('Missing required data.');
            throw new HttpsError('invalid-argument', 'Missing required data.');
        }

        const model = await getGenerativeAIModel();
        console.log('Generative AI model initialized successfully.');

        
        const prompt = `Generate a single, high-quality, abstract or symbolic image that visually represents a professional role with the title "${title}" and description "${description}". The image should be visually interesting and relevant to the professional context.`;
        
        // ... existing prompt code
        console.log('Sending prompt to Gemini API.');

        const result = await model.generateContent(prompt);
        console.log('Received response from Gemini API.');

        // Add a log for the raw response from Gemini
        console.log("Gemini API raw response:", JSON.stringify(result.response.candidates));

        const imagePart = result.response.candidates[0].content.parts.find(part => part.inlineData);

        if (!imagePart || !imagePart.inlineData) {
            throw new HttpsError('internal', 'Image generation failed, no inline data found.');
        }
        // --- END NEW LOGIC ---


        const base64Data = imagePart.inlineData.data;
        const mimeType = imagePart.inlineData.mimeType;

        // Normalize the file extension to a known format
        let fileExtension = 'jpg'; // Default to a common format
        if (mimeType.includes('jpeg')) {
            fileExtension = 'jpeg';
        } else if (mimeType.includes('png')) {
            fileExtension = 'png';
        } else if (mimeType.includes('webp')) {
            fileExtension = 'webp';
        }
        // Add other supported formats if needed

        // Define file path in Firebase Storage
        const filePath = `resumes/${resumeId}/images/experience_${jobIndex}.${fileExtension}`;
        const bucket = admin.storage().bucket();
        const file = bucket.file(filePath);

        console.log(`Attempting to save image to path: ${filePath}`);
        // Upload the base64 data to Firebase Storage
        const imageBuffer = Buffer.from(base64Data, 'base64');
        await file.save(imageBuffer, {
            metadata: { contentType: mimeType }
        });
        
        // Make the file publicly readable
        await file.makePublic();

        const publicUrl = file.publicUrl();
        
        

        console.log(`Image saved to Storage and public URL obtained: ${publicUrl}`);
        console.log("Function completed successfully, returning public URL.");
        return { imageUrl: publicUrl };

    } catch (error) {
        console.error('Error in generateExperienceImage:', error);
        throw new HttpsError('internal', `Failed to generate experience image: ${error.message}`);
    }
});

