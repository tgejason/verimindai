// Import necessary Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";


// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDW7WeO3Lk1_V-pG3GX8_77Wo2LX6rxBt4",
    authDomain: "coin-service-326121.firebaseapp.com",
    projectId: "coin-service-326121",
    storageBucket: "coin-service-326121.firebasestorage.app",
    messagingSenderId: "204479413902",
    appId: "1:204479413902:web:53ac88c1832267ede493df",
    measurementId: "G-ZFV7G0S6VC"
};

// Initialize Firebase App, Auth, and Firestore
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// Callable functions
const generateImageCallable = httpsCallable(functions, 'generateExperienceImage');
const generateQuestionCallable = httpsCallable(functions, 'generateQuestion');

// DOM elements
const loadingMessage = document.getElementById('loading-message');
const resumeContainer = document.getElementById('resume-container');
const skillsContainer = document.getElementById('skills-container');
const experienceContainer = document.getElementById('experience-container');
const timelineContainer = document.getElementById('timeline');
const logoutBtn = document.getElementById('logoutBtn');

// State variables for highlighting
let isSkillClicked = false;
let currentHighlightedExperiences = new Set();
let isHighlightingInProgress = false;
let selectedSkillName = null;


// Logout functionality
logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error("Logout failed:", error);
    });
});

// Toggle logout button visibility
onAuthStateChanged(auth, (user) => {
    if (user) {
        logoutBtn.style.display = 'block';
    } else {
        logoutBtn.style.display = 'none';
    }
});

// Function to handle highlighting of experiences
function highlightExperiences(experienceIndices) {
    // Clear previous highlights
    document.querySelectorAll('.job-entry.highlight').forEach(el => el.classList.remove('highlight'));

    if (experienceIndices.length === 0) {
        return;
    }

    experienceIndices.forEach(index => {
        const jobElement = document.getElementById(`job-${index}`);
        if (jobElement) {
            jobElement.classList.add('highlight');
        }
    });
}

            // Create this helper function to handle showing descriptions
function showDescriptionsForIndices(indices) {
    const allDescriptions = document.querySelectorAll('.job-description-container');
    allDescriptions.forEach(desc => desc.style.display = 'none'); // Hide all descriptions first

    indices.forEach(index => {
        const jobEntry = document.getElementById(`job-${index}`);
        if (jobEntry) {
            const descriptionContainer = jobEntry.querySelector('.job-description-container');
            if (descriptionContainer) {
                descriptionContainer.style.display = 'block'; // Show the relevant descriptions
            }
        }
    });
}

// Create this helper function to hide all descriptions
function hideAllDescriptions() {
    document.querySelectorAll('.job-description-container').forEach(desc => {
        desc.style.display = 'none';
    });
}

// Function to handle the generation of a question

async function generateAndDisplayQuestion(skill, jobTitle, jobEntryElement) {
    // 1. Remove any existing question boxes to prevent duplicates
    console.log(`generateAndDisplayQuestion called with: skill=${skill}, jobTitle=${jobTitle}`);

    const existingBox = jobEntryElement.querySelector('.question-box');
    if (existingBox) {
        existingBox.remove();
        return; // Clicking again on the same box will close it
    }

    // 2. Create and show a "loading" message
    const loadingBox = document.createElement('div');
    loadingBox.classList.add('question-box');
    loadingBox.textContent = 'Generating question...';
    jobEntryElement.appendChild(loadingBox);

    try {
        const result = await generateQuestionCallable({ skill, jobTitle });
        console.log(result)
        const question = result.data.question;
        
        // 3. Update the box with the generated question
        loadingBox.textContent = question;
        
    } catch (error) {
        console.error('Error generating question:', error);
        loadingBox.textContent = 'Failed to generate question. Please try again.';
    }
}

// Function to render skills with interactive functionality
function renderSkills(skills) {
    skillsContainer.innerHTML = '<h2>Skills</h2>';
    const skillsList = document.createElement('div');
    skillsList.classList.add('skills-list');

    skills.forEach(skill => {
        const skillElement = document.createElement('span');
        skillElement.classList.add('skill-tag');
        skillElement.textContent = skill.name;
        skillElement.dataset.experienceIndices = JSON.stringify(skill.experienceIndex);

        // Add mouseover/mouseout for hover effect
        skillElement.addEventListener('mouseover', () => {
            if (!isSkillClicked) {
                const indices = JSON.parse(skillElement.dataset.experienceIndices);
                highlightExperiences(indices);
            }
        });

        skillElement.addEventListener('mouseout', () => {
            if (!isSkillClicked) {
                highlightExperiences([]);
            }
        });

        // Add click for persistent highlight and question generation
        skillElement.addEventListener('click', () => {
            const indices = JSON.parse(skillElement.dataset.experienceIndices);
            
            // First, remove the 'selected' class from all skill tags
            document.querySelectorAll('.skill-tag.selected').forEach(el => el.classList.remove('selected'));
            
            // Toggle the selection state
            if (selectedSkillName === skill.name) {
                // User clicked the same skill, so deselect it
                selectedSkillName = null;
                highlightExperiences([]);
                hideAllDescriptions();
            } else {
                // User clicked a new skill, so select it
                selectedSkillName = skill.name;
                skillElement.classList.add('selected'); // Add the new class
                highlightExperiences(indices);
                showDescriptionsForIndices(indices);
            }
            

        });

        skillsList.appendChild(skillElement);
    });

    skillsContainer.appendChild(skillsList);
}

// Corrected function signature to accept resumeId
function renderResume(resumeData, resumeId) {
    console.log("Starting renderResume function.");

    const skills = resumeData.skills || [];
    const experience = resumeData.experience || [];
    const education = resumeData.education || [];

    // Check if data is empty before rendering
    if (experience.length === 0) {
        loadingMessage.textContent = "Resume data is incomplete or unavailable.";
        loadingMessage.classList.remove('loading-animation');
        return;
    }

    loadingMessage.style.display = 'none';
    resumeContainer.style.display = 'block';

    // Clear existing content
    skillsContainer.innerHTML = '<h2>Skills</h2>';
    timelineContainer.innerHTML = '';

    // Render skills
    renderSkills(skills);

    // Render experience as a timeline
    console.log(`Starting to render experience section with ${experience.length} job entries.`);
    experience.forEach((job, index) => {
        
        const jobEntry = document.createElement('div');
        jobEntry.classList.add('job-entry');
        jobEntry.id = `job-${index}`;
        jobEntry.dataset.jobTitle = job.title;

        // Add the click listener to the entire job entry container
        // This makes the whole card clickable for generating a question
        jobEntry.addEventListener('click', () => {
            const isJobHighlighted = jobEntry.classList.contains('highlight');
            console.log(`jobEntry clicked. selectedSkillName is '${selectedSkillName}', isJobHighlighted is ${isJobHighlighted}`);

            if (selectedSkillName && isJobHighlighted) {
                generateAndDisplayQuestion(selectedSkillName, job.title, jobEntry);
            }
        });

        // Create the image element and its container
        const jobImageContainer = document.createElement('div');
        jobImageContainer.classList.add('job-entry-image-container');

        const jobTitleElement = document.createElement('h3');
        jobTitleElement.textContent = job.title;

        const imageElement = document.createElement('img');
        imageElement.classList.add('experience-image');
        imageElement.alt = `Image for ${job.title}`;
        imageElement.style.display = 'none'; // Initially hide the image

        // Add the onload and onerror listeners here
        imageElement.onload = () => {
            imageElement.style.display = 'block'; // Show image on load
            jobImageContainer.style.animation = 'none'; // Stop the pulse animation
            jobImageContainer.style.background = 'none'; // Remove the background color
        };
        imageElement.onerror = () => {
            console.error('ERROR: Failed to load image from URL.');
            imageElement.alt = "Image not available.";
            imageElement.style.display = 'block'; // Show alt text
            jobImageContainer.style.animation = 'none'; // Stop the pulse animation
            jobImageContainer.style.background = 'none'; // Remove the background color
        };

        jobImageContainer.appendChild(jobTitleElement);
        jobImageContainer.appendChild(imageElement);
        jobEntry.appendChild(jobImageContainer);

        // Fetch image URL from Cloud Function
        generateImageCallable({ resumeId, jobIndex: index, title: job.title, description: job.description })
            .then(result => {
                const imageUrl = result.data.imageUrl;
                console.log(`SUCCESS: Image URL received from function: ${imageUrl}`);
                imageElement.src = imageUrl;
            })
            .catch(error => {
                console.error("Image generation failed:", error);
                imageElement.alt = "Image not available.";
            });

        // Add job details and description
        const jobDescriptionContainer = document.createElement('div');
        jobDescriptionContainer.classList.add('job-description-container');
        jobDescriptionContainer.style.display = 'none';

        const jobDescription = document.createElement('p');
        jobDescription.textContent = job.description;
        jobDescriptionContainer.appendChild(jobDescription);
        jobEntry.appendChild(jobDescriptionContainer);

        // Append to the timeline container
        timelineContainer.appendChild(jobEntry);
    });
}

// Function to poll Firestore for resume data
async function pollForResumeData(resumeRef, resumeId) {
    const maxAttempts = 10;
    const delay = 5000; // 5 seconds

    for (let i = 0; i < maxAttempts; i++) {
        try {
            const docSnap = await getDoc(resumeRef);
            if (docSnap.exists()) {
                const resumeData = docSnap.data().data; // Access the nested 'data' field
                console.log(`Attempt ${i + 1}: Document exists.`);

                // Check if all required keys are present and not empty
                if (resumeData && resumeData.skills && resumeData.experience && resumeData.education) {
                    console.log(`Attempt ${i + 1}: Found non-empty data. Rendering resume.`);
                    // Corrected function call to pass resumeId
                    renderResume(resumeData, resumeId);
                    return; // Exit on success
                } else {
                    console.log(`Attempt ${i + 1}: Document exists but data is incomplete.`);
                }
            } else {
                console.log(`Attempt ${i + 1}: Document does not exist. Retrying...`);
            }
        } catch (error) {
            console.error(`Error fetching document on attempt ${i + 1}: ${error.message}`);
        }

        await new Promise(res => setTimeout(res, delay));
    }

    loadingMessage.textContent = "Error loading resume. Please try again later.";
    loadingMessage.classList.remove('loading-animation');
    console.error("Failed to fetch complete document after multiple retries.");
}

// Main function to fetch and render the resume
async function fetchAndRenderResume() {
    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get('id');

    if (!resumeId) {
        loadingMessage.textContent = "No resume ID provided in the URL.";
        return;
    }
    // Add this line to ensure the loading message is shown from the start
    loadingMessage.textContent = "Processing your resume...";
    loadingMessage.classList.add('loading-animation');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userId = user.uid;
            const resumeRef = doc(db, 'users', userId, 'resumes', resumeId);
            // Corrected function call to pass resumeId
            await pollForResumeData(resumeRef, resumeId);
        } else {
            loadingMessage.textContent = "Please sign in to view this resume.";
        }
    });
}

// Initial call to start the process
fetchAndRenderResume();