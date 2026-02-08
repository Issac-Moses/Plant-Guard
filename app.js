// ==========================================
// CONFIGURATION
// ==========================================
// Using gemini-1.5-flash for vision capabilities
const API_KEY = '';
const API_URL = ``;

// ==========================================
// DOM ELEMENTS
// ==========================================
const imageForm = document.getElementById('imageForm');
const imageInput = document.getElementById('imageInput');
const uploadArea = document.getElementById('uploadArea');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');
const analyzeBtn = document.getElementById('analyzeBtn');

const resultsSection = document.getElementById('resultsSection');
const loadingState = document.getElementById('loadingState');
const resultsContainer = document.getElementById('resultsContainer');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');

// State
let currentBase64Image = null;

// ==========================================
// EVENT LISTENERS
// ==========================================

// Click to upload
if (uploadArea) {
    uploadArea.addEventListener('click', () => {
        imageInput.click();
    });

    // Drag & Drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
}

// File input change
if (imageInput) {
    imageInput.addEventListener('change', handleFileSelect);
}

// Remove Image
if (removeImageBtn) {
    removeImageBtn.addEventListener('click', resetUpload);
}

// Form Submit
if (imageForm) {
    imageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentBase64Image) return;

        showLoadingState();

        try {
            const analysisResult = await analyzePlantWithGemini(currentBase64Image);
            displayResults(analysisResult);
        } catch (error) {
            showError(error.message);
        }
    });
}


// ==========================================
// FILE HANDLING
// ==========================================
function handleFileSelect(e) {
    if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
    }
}

function handleFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please upload a valid image file');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        currentBase64Image = e.target.result;
        showPreview(currentBase64Image);
    };
    reader.readAsDataURL(file);
}

function showPreview(src) {
    imagePreview.src = src;
    uploadArea.style.display = 'none';
    imagePreviewContainer.style.display = 'flex';
    analyzeBtn.disabled = false;
}

function resetUpload() {
    currentBase64Image = null;
    imageInput.value = '';
    imagePreview.src = '';
    imagePreviewContainer.style.display = 'none';
    uploadArea.style.display = 'block';
    analyzeBtn.disabled = true;

    // Hide results if visible
    resultsSection.style.display = 'none';
}

// ==========================================
// GEMINI API INTEGRATION
// ==========================================
async function analyzePlantWithGemini(base64Image) {
    // Extract base64 data (remove "data:image/jpeg;base64," prefix)
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.split(';')[0].split(':')[1];

    const prompt = `
        You are an expert Plant Pathologist. Analyze the provided image of a plant.
        Identify if the plant has any disease or nutritional deficiency.
        
        Return the result in strictly valid JSON format with the following structure:
        {
            "status": "Healthy" or "Diseased",
            "diseaseName": "Name of disease/issue (or 'None' if healthy)",
            "confidence": 0-100,
            "symptoms": ["symptom 1", "symptom 2"],
            "treatment": ["step 1", "step 2"],
            "prevention": ["tip 1", "tip 2"],
            "description": "Brief description of the condition"
        }

        If the image is not a plant, return status: "Error", diseaseName: "Not a plant".
        Return ONLY the JSON. Do not use Markdown formatting.
    `;

    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                    }
                }
            ]
        }]
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || `API Error: ${response.status}`);
        }

        const candidate = data.candidates?.[0];
        const responseText = candidate?.content?.parts?.[0]?.text;

        if (!responseText) {
            throw new Error('Empty response from AI');
        }

        console.log('🤖 AI Response:', responseText);
        return parseResponse(responseText);

    } catch (error) {
        console.error('API Call Failed:', error);
        throw error;
    }
}

function parseResponse(text) {
    try {
        // Clean markdown code blocks just in case
        let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(cleanText);

        if (!json.status) throw new Error('Invalid JSON structure');

        return json;
    } catch (e) {
        console.error('JSON Parse Error:', e);
        throw new Error('Failed to parse diagnosis results');
    }
}

// ==========================================
// UI MANAGEMENT
// ==========================================
function showLoadingState() {
    resultsSection.style.display = 'block';
    loadingState.style.display = 'block';
    resultsContainer.style.display = 'none';
    errorState.style.display = 'none';
    analyzeBtn.disabled = true;
    analyzeBtn.querySelector('.btn-text').textContent = 'Analyzing...';

    // smooth scroll
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function showError(msg) {
    loadingState.style.display = 'none';
    errorState.style.display = 'block';
    errorMessage.textContent = msg;
    analyzeBtn.disabled = false;
    analyzeBtn.querySelector('.btn-text').textContent = 'Identify Disease';
}

function displayResults(data) {
    loadingState.style.display = 'none';
    resultsContainer.style.display = 'grid';
    analyzeBtn.disabled = false;
    analyzeBtn.querySelector('.btn-text').textContent = 'Identify Disease';

    // Check for "Not a plant" or similar errors
    if (data.status === 'Error') {
        showError(data.diseaseName || 'Could not identify plant');
        return;
    }

    const isHealthy = data.status.toLowerCase() === 'healthy';
    const statusClass = isHealthy ? 'healthy' : 'diseased';

    const treatmentHtml = data.treatment && data.treatment.length > 0
        ? `<div class="recommendations">
            <h4>💊 Treatment / Cure</h4>
            <ul>${data.treatment.map(t => `<li>${t}</li>`).join('')}</ul>
           </div>`
        : '';

    const preventionHtml = data.prevention && data.prevention.length > 0
        ? `<div class="recommendations">
            <h4>🛡️ Prevention</h4>
            <ul>${data.prevention.map(p => `<li>${p}</li>`).join('')}</ul>
           </div>`
        : '';

    const html = `
        <div class="result-card ${statusClass}">
            <div class="result-header">
                <h3 class="disease-name">${data.diseaseName}</h3>
                <span class="status-badge ${statusClass}">${data.status}</span>
            </div>
            
            <div class="result-body">
                <div class="info-group">
                    <h4>Description</h4>
                    <p>${data.description}</p>
                </div>

                <div class="info-group">
                    <h4>Symptoms</h4>
                    <p>${data.symptoms ? data.symptoms.join(', ') : 'None listed'}</p>
                </div>
                
                ${treatmentHtml}
                ${preventionHtml}
            </div>
        </div>
    `;

    resultsContainer.innerHTML = html;
}

// Init
// ==========================================
// ANIMATION: FLOWER RAIN
// ==========================================
function initFlowerRain() {
    const container = document.createElement('div');
    container.className = 'rain-container';
    document.body.prepend(container);

    const flowerCount = 20;
    const flowers = ['🌸', '❀', '✿','❁','⋆˚✿˖°','☘︎','𓆩❤︎𓆪'];

    for (let i = 0; i < flowerCount; i++) {
        const flower = document.createElement('div');
        flower.className = 'flower';
        flower.textContent = flowers[Math.floor(Math.random() * flowers.length)];

        // Randomize
        flower.style.left = Math.random() * 100 + 'vw';
        flower.style.animationDuration = Math.random() * 5 + 5 + 's'; // 5-10s
        flower.style.animationDelay = Math.random() * 5 + 's';
        flower.style.opacity = Math.random() * 0.5 + 0.3;
        flower.style.fontSize = Math.random() * 20 + 10 + 'px';

        container.appendChild(flower);
    }
}

// Init
console.log('🌿 PlantGuard Initialized');
initFlowerRain();
