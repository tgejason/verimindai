// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";


// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

  const firebaseConfig = {
    apiKey: "keyhere",
    authDomain: "coin-service-326121.firebaseapp.com",
    projectId: "coin-service-326121",
    storageBucket: "coin-service-326121.firebasestorage.app",
    messagingSenderId: "204479413902",
    appId: "1:204479413902:web:53ac88c1832267ede493df",
    measurementId: "G-ZFV7G0S6VC"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// DOM elements
const signInBtn = document.getElementById('signInBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authSection = document.getElementById('auth-section');
const uploadSection = document.getElementById('upload-section');
const resumeFileInput = document.getElementById('resumeFileInput');
const fileLabel = document.getElementById('fileLabel');
const uploadBtn = document.getElementById('uploadBtn');
const statusMessage = document.getElementById('status-message');

// Event listeners
signInBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider)
        .then((result) => {
            // User signed in
            console.log("User signed in:", result.user.displayName);
        })
        .catch((error) => {
            console.error("Sign-in error:", error);
        });
});

logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        console.log("User signed out.");
    }).catch((error) => {
        console.error("Sign-out error:", error);
    });
});

resumeFileInput.addEventListener('change', () => {
    if (resumeFileInput.files.length > 0) {
        fileLabel.innerHTML = `<span class="file-icon">✅</span> ${resumeFileInput.files[0].name}`;
        uploadBtn.disabled = false;
    } else {
        fileLabel.innerHTML = `<span class="file-icon">📁</span> Choose a file...`;
        uploadBtn.disabled = true;
    }
});

// Authentication state listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in, show upload section
        authSection.style.display = 'none';
        uploadSection.style.display = 'block';
        logoutBtn.style.display = 'block';
    } else {
        // User is signed out, show sign-in section
        authSection.style.display = 'block';
        uploadSection.style.display = 'none';
        logoutBtn.style.display = 'none';
    }
});

// Main logic for file upload using a pre-signed URL from a Cloud Function

// Function to get the signed URL from your Cloud Function
async function getSignedUrl(fileName, userId, resumeId) {
    const cloudFunctionUrl = 'https://generatesignedurl-toaed52hnq-uc.a.run.app';

    try {
        const response = await fetch(`${cloudFunctionUrl}?fileName=${fileName}&userId=${userId}&resumeId=${resumeId}`);
        if (!response.ok) {
            throw new Error(`Error getting signed URL: ${response.statusText}`);
        }
        const data = await response.json();
        return data.signedUrl;
    } catch (error) {
        console.error('Failed to get signed URL:', error);
        throw error;
    }
}

// Function to upload the file to Google Cloud Storage
async function uploadFile(file, signedUrl) {
    try {
        const response = await fetch(signedUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': 'application/pdf',
            },
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        console.log('File uploaded successfully to GCP bucket.');
        return true;
    } catch (error) {
        console.error('Failed to upload file:', error);
        throw error;
    }
}

// Handle form submission
uploadBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const file = resumeFileInput.files[0];
    const user = auth.currentUser;

    if (!user || !file) {
        statusMessage.textContent = 'Please sign in and select a PDF file to upload.';
        return;
    }
    
    // Use the Firebase user UID to create a unique path
    const userId = user.uid;
    // Create a unique ID for the resume that will be used for both the file and the Firestore document
    const fileNameWithExt = file.name;
    const resumeId = `${userId}_${new Date().getTime()}_${fileNameWithExt}`;


    statusMessage.textContent = 'Uploading...';
    statusMessage.className = 'status-message loading';
    uploadBtn.disabled = true;

    try {
        // Pass the resumeId to the function to include it in the signed URL's metadata
        const signedUrl = await getSignedUrl(file.name, userId, resumeId);
        
        await uploadFile(file, signedUrl);
        statusMessage.textContent = 'Upload successful!';
        statusMessage.className = 'status-message success';

        // Redirect the user to the new resume page using the correct resumeId
        
        const resumeIdWithoutExt = resumeId.split('.').slice(0, -1).join('.');
        window.location.href = `resume.html?id=${resumeIdWithoutExt}`;

    } catch (error) {
        statusMessage.textContent = `Upload failed: ${error.message}`;
        statusMessage.className = 'status-message error';
    } finally {
        uploadBtn.disabled = false;
    }

});
