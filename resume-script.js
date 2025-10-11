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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

const generateQuestionCallable = httpsCallable(functions, 'generateQuestion');
const generateImageCallable = httpsCallable(functions, 'generateExperienceImage');

const loadingMessage = document.getElementById('loading-message');
const resumeContainer = document.getElementById('resume-container');
const skillsContainer = document.getElementById('skills-container');
const timelineContainer = document.getElementById('timeline');
const questionsContainer = document.getElementById('interview-questions-container');
const logoutBtn = document.getElementById('logoutBtn');

let selectedSkillName = null;

logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error("Logout failed:", error);
    });
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        logoutBtn.style.display = 'block';
        fetchAndRenderResume(user);
    } else {
        window.location.href = 'index.html';
    }
});

function highlightExperiences(indices) {
    const allJobEntries = document.querySelectorAll('.job-entry');
    allJobEntries.forEach(jobEntry => {
        jobEntry.classList.remove('highlight');
    });
    if (indices && indices.length > 0) {
        indices.forEach(index => {
            const jobEntry = document.getElementById(`job-${index}`);
            if (jobEntry) {
                jobEntry.classList.add('highlight');
            }
        });
    }
}

function showDescriptionsForIndices(indices) {
    const allJobDescriptions = document.querySelectorAll('.job-description-container');
    allJobDescriptions.forEach(desc => {
        desc.style.display = 'none';
    });
    if (indices && indices.length > 0) {
        indices.forEach(index => {
            const jobEntry = document.getElementById(`job-${index}`);
            if (jobEntry) {
                const descriptionContainer = jobEntry.querySelector('.job-description-container');
                if (descriptionContainer) {
                    descriptionContainer.style.display = 'block';
                }
            }
        });
    }
}

function hideAllDescriptions() {
    document.querySelectorAll('.job-description-container').forEach(desc => {
        desc.style.display = 'none';
    });
}

function renderSkills(skills) {
    skillsContainer.innerHTML = '<h2>Skills</h2>';
    const skillsList = document.createElement('div');
    skillsList.classList.add('skills-list');
    skills.forEach(skill => {
        const skillElement = document.createElement('span');
        skillElement.classList.add('skill-tag');
        skillElement.textContent = skill.name;
        skillElement.dataset.experienceIndices = JSON.stringify(skill.experienceIndex);
        const hasMatchingExperience = skill.experienceIndex && skill.experienceIndex.length > 0;
        if (hasMatchingExperience) {
            skillElement.addEventListener('mouseover', () => {
                if (selectedSkillName === null) {
                    const indices = JSON.parse(skillElement.dataset.experienceIndices);
                    highlightExperiences(indices);
                }
            });
            skillElement.addEventListener('mouseout', () => {
                if (selectedSkillName === null) {
                    highlightExperiences([]);
                }
            });
            skillElement.addEventListener('click', () => {
                const indices = JSON.parse(skillElement.dataset.experienceIndices);
                document.querySelectorAll('.skill-tag.selected').forEach(el => el.classList.remove('selected'));
                if (selectedSkillName === skill.name) {
                    selectedSkillName = null;
                    highlightExperiences([]);
                    hideAllDescriptions();
                } else {
                    selectedSkillName = skill.name;
                    skillElement.classList.add('selected');
                    highlightExperiences(indices);
                    showDescriptionsForIndices(indices);
                }
            });
        } else {
            skillElement.classList.add('skill-no-match');
        }
        skillsList.appendChild(skillElement);
    });
    skillsContainer.appendChild(skillsList);
}

async function generateAndDisplayQuestion(skill, jobTitle) {
    questionsContainer.innerHTML = '<h4>Generating interview questions...</h4>';
    questionsContainer.classList.add('visible');

    try {
        const result = await generateQuestionCallable({ skill, jobTitle });
        const questionsData = result.data;

        const createQuestionHtml = (item) => {
            // Escape single quotes in the question/answer before placing them in HTML attributes or template strings
            const safeQuestion = item.question.replace(/'/g, '&#39;');
            const safeAnswer = item.answer.replace(/'/g, '&#39;');
        
            return `
                <li class="question-item">
                    <h5 class="question-header" onclick="toggleAnswer(this)">
                        ${safeQuestion}
                    </h5>
                    <div class="answer-panel">
                        <p>${safeAnswer}</p>
                    </div>
                </li>
            `;
        };

        questionsContainer.innerHTML = `
            <h3>Interview Questions</h3>
            <div class="question-list-container">
                <div class="question-tier" id="warmup-tier">
                    <h4>Warmup (Foundation)</h4>
                    <ul>${questionsData.warmup.map(createQuestionHtml).join('')}</ul>
                </div>
                <div class="question-tier" id="manager-tier">
                    <h4>Manager (Behavioral & Project)</h4>
                    <ul>${questionsData.manager.map(createQuestionHtml).join('')}</ul>
                </div>
                <div class="question-tier" id="legendary-tier">
                    <h4>Legendary (Deep Technical)</h4>
                    <ul>${questionsData.legendary.map(createQuestionHtml).join('')}</ul>
                </div>
            </div>
        `;
        questionsContainer.scrollIntoView({
            behavior: 'smooth',
            block: 'center' // This centers the element in the viewport
        });
    } catch (error) {
        console.error("Error generating question:", error);
        questionsContainer.innerHTML = '<h4>Failed to generate questions. Please try again.</h4>';
    }
}


function renderTimeline(experiences, resumeId) {
    timelineContainer.innerHTML = ''; // Clear the container first

    // Step 1: Create a single timeline line and add it to the container
    const line = document.createElement('div');
    line.classList.add('timeline-line');
    timelineContainer.appendChild(line);

    // Step 2: Iterate through each experience and create the job entry
    //<button class="generate-questions-btn" style="display: none;">Generate Interview Questions</button>
    experiences.forEach((exp, index) => {
        const jobEntry = document.createElement('div');
        jobEntry.classList.add('job-entry');
        jobEntry.id = `job-${index}`;
        jobEntry.innerHTML = `
            <div class="timeline-dot">
                <span class="timeline-year-range">${exp.start_year} - ${exp.end_year}</span>
            </div>
            <div class="job-entry-image-container">
                <img class="experience-image" src="" alt="Image for ${exp.title}" style="display: none;"/>
            </div>
            <div class="job-description-container" style="display: none;">
                <p>${exp.description}</p>
            </div>
            <div class="job-card-actions">
                <button 
                    class="generate-questions-btn" 
                    data-job-index="${index}" 
                    data-job-title="${exp.title.replace(/"/g, '&quot;')}"
                    style="margin-top: 15px;">
                    Generate Interview Questions
                </button>
            </div>
        `;
        
        const jobImageContainer = jobEntry.querySelector('.job-entry-image-container');
        const imageElement = jobEntry.querySelector('.experience-image');
        
        jobImageContainer.style.background = '#383838';
        jobImageContainer.style.animation = 'pulse-bg 1.5s infinite';

        generateImageCallable({ resumeId, jobIndex: index, title: exp.title, description: exp.description })
            .then(result => {
                const imageUrl = result.data.imageUrl;
                imageElement.src = imageUrl;
                imageElement.onload = () => {
                    imageElement.style.display = 'block';
                    jobImageContainer.style.animation = 'none';
                    jobImageContainer.style.background = 'none';
                };
                imageElement.onerror = () => {
                    console.error('ERROR: Failed to load image from URL.');
                    imageElement.alt = "Image not available.";
                    imageElement.style.display = 'block';
                    jobImageContainer.style.animation = 'none';
                    jobImageContainer.style.background = 'none';
                };
            })
            .catch(error => {
                console.error("Image generation failed:", error);
                imageElement.alt = "Image not available.";
                imageElement.style.display = 'block';
            });

        const generateBtn = jobEntry.querySelector('.generate-questions-btn');
        generateBtn.addEventListener('click', () => {
            if (selectedSkillName) {
                generateAndDisplayQuestion(selectedSkillName, exp.title);
            } else {
                alert("Please select a skill from the list first!");
            }
        });

        timelineContainer.appendChild(jobEntry);
    });
}

async function pollForResumeData(resumeRef, resumeId, retries = 0, maxRetries = 60, delay = 2000) {
    try {
        const docSnap = await getDoc(resumeRef);
        if (docSnap.exists() && docSnap.data().data) {
            return docSnap.data().data;
        } else {
            if (retries < maxRetries) {
                
                //let message = `Processing resume... Please wait. Retrying (${retries + 1}/${maxRetries}).`;
                let message = `Processing resume... Please hodl... .`;

                switch (retries) {

                    case 8:
                    case 9:
                    case 10:
                    case 58:
                    case 59:
                        message = "Taking longer than usual. Verifying Skynet hasn't taken over the world...";
                        break;
                        

                    case 16:
                    case 17:
                    case 18:
                        message = "Still on it... The bits are a bit sticky today. Please hodl...";
                        break;
                        
                    case 28:
                    case 29:
                    case 30:
                        message = "Just warming up the quantum entanglement processor. Your resume is simultaneously here and not here.";
                        break;
                        
                    case 45:
                    case 46:
                    case 47:
                    case 52:
                    case 53:
                        message = "Apologies! Our AI model is stuck in an infinite loop reading your 'Attention to Detail' bullet point.";
                        break;

                    default:
                        // Uses the default message set at the top
                        break;
                }
                
                // Update the loading message
                loadingMessage.textContent = message;
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return pollForResumeData(resumeRef, resumeId, retries + 1, maxRetries, delay);
            } else {
                throw new Error('Timeout: Resume data not found after multiple retries.');
            }
        }
    } catch (e) {
        console.error("Error polling for resume data:", e);
        throw e;
    }
}

async function fetchAndRenderResume(user) {
    const urlParams = new URLSearchParams(window.location.search);
    const resumeId = urlParams.get('id');
    if (!resumeId) {
        loadingMessage.textContent = 'No resume ID provided. Please upload a resume first.';
        loadingMessage.classList.remove('loading-animation');
        return;
    }
    try {
        const resumeRef = doc(db, 'users', user.uid, 'resumes', resumeId);
        const resumeData = await pollForResumeData(resumeRef, resumeId);
        
        if (resumeData && resumeData.experience && resumeData.experience.length > 0) {
            renderSkills(resumeData.skills || []);
            renderTimeline(resumeData.experience, resumeId);
            loadingMessage.style.display = 'none';
            resumeContainer.style.display = 'block';
        } else {
            loadingMessage.textContent = 'Resume data is incomplete or unavailable.';
            loadingMessage.classList.remove('loading-animation');
        }
    } catch (e) {
        console.error("Error fetching or polling for resume:", e);
        loadingMessage.textContent = "An error occurred. Please try again later.";
        loadingMessage.classList.remove('loading-animation');
    }
}

// In resume-script.js (Global Scope)

window.toggleAnswer = function(element) {
    // The answer panel is the sibling element (the one immediately after the question header)
    const answerPanel = element.nextElementSibling;
    
    // Toggle a class on the question header to change its style when active
    element.classList.toggle('active');
    
    // Use maxHeight to create a smooth expand/collapse transition
    if (answerPanel.style.maxHeight) {
        // Collapse the panel
        answerPanel.style.maxHeight = null;
        // Reset padding (optional, but cleaner)
        answerPanel.style.padding = '0 20px'; 
    } else {
        // Expand the panel
        answerPanel.style.maxHeight = answerPanel.scrollHeight + "px";
        // Set padding when expanded
        answerPanel.style.padding = '15px 20px'; 
    }
};

// Initial call to start the process
// This is crucial for when the page loads initially
// and the auth state is already determined.
fetchAndRenderResume();