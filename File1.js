// Requests go through a local proxy server (see server.js) instead of
// straight to ai.hackclub.com — that API only allows browser requests from
// its own allow-listed origins, so a direct fetch from your dev server gets
// blocked by CORS. The proxy also keeps the API key off the client.
const IMAGE_PROXY_ENDPOINT = "/api/generate-image";

// Maps your Resolution dropdown to the aspect ratio Gemini image gen accepts.
function resolutionToAspectRatio(width, height) {
    const ratio = Number(width) / Number(height);
    if (ratio > 1.3) return "16:9";
    if (ratio < 0.8) return "9:16";
    return "1:1";
}

// Escapes text before it goes into innerHTML, so a prompt like
// "<img src=x onerror=alert(1)>" gets displayed as text instead of executed.
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// All the constants for the html classes for the DOM..
const inputPrompt = document.getElementById("prompt-input");
const modeSelect = document.getElementById("Mode");
const styleSelect = document.getElementById("style");
const qualitySelect = document.getElementById("quality");
const resolutionSelect = document.getElementById("resolution");
const generateBtn = document.getElementById("generateBtn");
const resultsDiv = document.getElementById("results");
const loadingSpinner = document.querySelector(".loading-spinner");
const btnText = document.querySelector(".btn-text");


let isGenerating = false;

// generateImage => function that will generate the image..
generateBtn.addEventListener("click", generateImages);


inputPrompt.addEventListener("keypress", (e) => {
    if(e.key === "Enter" && e.ctrlKey) {
        generateImages()
    }
})

// Image Generating function:
// FIX: this used to be wrapped in a setTimeout() whose callback wasn't
// awaited, so the button/spinner got reset to "ready" the instant the
// (fire-and-forget) generation kicked off, not when it actually finished.
// Now it's a proper async function that awaits the real work and only
// resets the UI in a finally block once everything is done.
async function generateImages() {
    const prompt = inputPrompt.value.trim();

    if(!prompt) {
        showStatusMessage("error", "Please enter a description for the image...");
        return;
    }

    if(isGenerating) return

    isGenerating = true;
    generateBtn.disabled = true;
    loadingSpinner.style.display = "inline-block";
    btnText.textContent = "Generating...";

    // results set to none...
    resultsDiv.innerHTML = '';

    showStatusMessage("info", "Generating your image.... Stay here or your dog will eat your homework");

    const Mode = modeSelect.value;
    const style = styleSelect.value;
    const quality = qualitySelect.value;
    const resolution = resolutionSelect.value;

    try {
        // Number is parameters to pass...
        await generateImageCards(prompt, Mode, style, quality, resolution);
    } finally {
        isGenerating = false;
        generateBtn.disabled = false;
        loadingSpinner.style.display = "none";
        btnText.textContent = "Generate Images";
    }
}

// The Actual functuon that is gonna generate the image:
// Call an API that is gonna generate the image
// Image generation function/div..
// FIX: now returns a promise that resolves once every card has finished
// loading (or failed), so the caller can actually await it.
async function generateImageCards(prompt, Mode, style, quality, resolution) {
    const imageGrid = document.createElement('div');
    imageGrid.className = "image-grid";

    let count = 0;
    const loadPromises = [];

    for(let i = 0; i <= count; i++) {
        const imageCard = document.createElement('div');
        imageCard.className = "image-card";

        // Keep prompt simple and clean
        const cleanPrompt = `${prompt}, ${style} style`;

        const width = resolution.split('x')[0];
        const height = resolution.split('x')[1];

        const imgId = `gen-img-${Date.now()}-${i}`;
        const loaderId = `gen-loader-${Date.now()}-${i}`;
        const downloadId = `dl-btn-${Date.now()}-${i}`;
        const fullscreenId = `fs-btn-${Date.now()}-${i}`;

        // Note: no image URL exists yet — Hugging Face's API is a POST request,
        // so the actual image only exists after loadCardImage() below fetches it.
        // FIX: prompt is user-controlled text, so it's escaped before going
        // into innerHTML (both in the alt attribute and the prompt caption)
        // to prevent HTML/script injection.
        imageCard.innerHTML = `
        <div class="image-container" style="position: relative; overflow: hidden; background: #222; border-radius: 8px 8px 0 0; min-height: 300px; display: flex; align-items: center; justify-content: center;">
            <div class="img-loader" id="${loaderId}" style="position: absolute; color: #88f; font-size: 0.9rem; text-align: center; padding: 0 1rem;">
                Generating image...
            </div>
            
            <img 
                id="${imgId}"
                alt="Generated Image: ${escapeHtml(prompt)}"
                style="width: 100%; height: 300px; object-fit: cover; display: block; position: relative; z-index: 2; opacity: 0; transition: opacity 0.5s ease;"
            /> 

            <div class="image-overlay" 
                 style="
                 position: absolute; 
                 top: 0; left: 0; right: 0; bottom: 0; 
                 background: rgba(0, 0, 0, 0.7); 
                 opacity: 0; 
                 z-index: 3;
                 transition: 0.3s ease; 
                 display: flex; 
                 align-items: center; 
                 justify-content: center; 
                 color: white; 
                 font-size: 0.9rem;
                 cursor: pointer;">
                Click for fullscreen
            </div>
        </div>
        
        <div class="image-info" style="padding: 1rem; background: #1a1a1a; border-radius: 0 0 8px 8px;">
            <div class="image-prompt" style="font-weight: bold; margin-bottom: 0.5rem; color: #fff;">${escapeHtml(prompt)}</div>
            <div class="image-details" style="display: flex; gap: 0.5rem; font-size: 0.8rem; color: #aaa; margin-bottom: 0.5rem;">
                <span>Mode: ${Mode}</span>
                <span>• Quality: ${quality}</span>
                <span>• Style: ${style}</span>
            </div>

            <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
                <button id="${downloadId}" disabled
                    style="flex: 1; padding: 0.5rem; background: #4a9eff; color: black; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: bold;">
                    Download 
                </button>
                <button id="${fullscreenId}" disabled
                    style="flex: 1; padding: 0.5rem; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                    FullScreen
                </button>
            </div>
        </div>`;

        imageCard.addEventListener("mouseenter", () => {
            const overlay = imageCard.querySelector(".image-overlay");
            if(overlay) overlay.style.opacity = '1';
        });

        imageCard.addEventListener("mouseleave", () => {
            const overlay = imageCard.querySelector(".image-overlay");
            if(overlay) overlay.style.opacity = '0';
        });

        imageGrid.appendChild(imageCard);

        // Kick off generation for this card right away (references are still
        // valid even though imageCard isn't attached to the document yet).
        const imgEl = imageCard.querySelector(`#${imgId}`);
        const loaderEl = imageCard.querySelector(`#${loaderId}`);
        const downloadBtn = imageCard.querySelector(`#${downloadId}`);
        const fullscreenBtn = imageCard.querySelector(`#${fullscreenId}`);
        loadPromises.push(
            loadCardImage(imgEl, loaderEl, downloadBtn, fullscreenBtn, cleanPrompt, prompt, width, height)
        );
    }

    resultsDiv.appendChild(imageGrid);

    // loadCardImage catches its own errors (shown inline per-card), so this
    // just waits for every card to settle before resolving.
    await Promise.allSettled(loadPromises);
}

// Generates one image via Hack Club AI's free proxy (Gemini 2.5 Flash Image,
// aka Nano Banana) and wires up the download / fullscreen buttons once ready.
async function loadCardImage(imgEl, loaderEl, downloadBtn, fullscreenBtn, prompt, displayPrompt, width, height) {
    try {
        const response = await fetch(IMAGE_PROXY_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: prompt,
                aspect_ratio: resolutionToAspectRatio(width, height)
            })
        });

        if(!response.ok) {
            let detail = `${response.status} ${response.statusText}`;
            try {
                const errJson = await response.json();
                if(errJson && errJson.error) detail = errJson.error.message || errJson.error;
            } catch(_) { /* body wasn't JSON, keep the status text */ }
            throw new Error(detail);
        }

        const data = await response.json();
        const message = data.choices && data.choices[0] && data.choices[0].message;
        const images = message && message.images;

        if(!images || !images.length) {
            // Model sometimes replies with text only (e.g. it refused the prompt).
            throw new Error(message && message.content ? message.content : "No image returned");
        }

        const dataUrl = images[0].image_url.url; // "data:image/png;base64,...."

        imgEl.onload = () => {
            imgEl.style.opacity = '1';
            loaderEl.style.display = 'none';
        };
        imgEl.src = dataUrl;

        const safeName = displayPrompt.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        downloadBtn.disabled = false;
        downloadBtn.onclick = () => downloadImage(dataUrl, safeName);

        fullscreenBtn.disabled = false;
        // FIX: displayPrompt is passed as-is now — openImageModel escapes it
        // for HTML on its own. The old .replace(/'/g, "\\'") was left over
        // from a string-eval-style onclick and just corrupted the caption
        // (real apostrophes turned into a literal backslash + quote).
        fullscreenBtn.onclick = () => openImageModel(dataUrl, displayPrompt);

    } catch (err) {
        console.error('Hack Club AI image generation failed:', err.message);
        loaderEl.textContent = `Failed to generate image (${err.message}). Open the console (F12) for details.`;
    }
}

// Status Message function: 
function showStatusMessage(type, message) {
    const existingMessage = document.querySelector(".status-message");
    if(existingMessage) {
        existingMessage.remove();
    }

    // For the status elaboration..
    const statusDiv = document.createElement('div');
    statusDiv.className = `status-message status-${type}`;
    statusDiv.textContent = message;
    
    resultsDiv.insertBefore(statusDiv, resultsDiv.firstChild); // This is just a product name and does not represent its true nature..
    
    if(type === "success" ||  type === "info") {
        setTimeout(() => {
           if(statusDiv.parentNode)  {
            statusDiv.remove();
           }
        }, 5000); // Setting the timeout so gonna run after 5s 
         
    }
}

// Creating thr sample prompt:
const samplePrompts = [
    "A monkey eating a banana",
    "A lion dancing in a circus",
    "A dog barking at a cat",
    "A cat eating a mouse",
    "A large beautiful penthouse",
    "IronMan fighting Captain America"
]

document.addEventListener('click', (e) => {
    if(e.target.closest('.placeholder') && !inputPrompt.value.trim()) {
        const randomPrompt = samplePrompts[Math.floor(Math.random() * samplePrompts.length)]
        inputPrompt.value = randomPrompt;
        inputPrompt.focus(); // Joining the focus.... 
    }
})


// Creating the dawnload image function..
function downloadImage(imageUrl, filename) {
    const link = document.createElement('a');
    link.href = imageUrl;
    // Dawnloading the image....
    link.download = `ai-generated-${filename.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
  
// Image generation openModel for image generation..
// FIX: prompt is escaped before being dropped into innerHTML — it's raw
// user text, so without this a prompt containing HTML/script tags would
// execute instead of just being displayed as a caption.
function openImageModel(imageUrl, prompt) {
    const model = document.createElement('div');

    model.style.cssText = `
    position: fixed;
    top: 0;
    left: 0%;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    cursor: pointer;
    `;

    model.innerHTML = ` <div style="max-width: 90%; max-height: 90%; position: relative; ">
        <!-- Classifying the image specifications... -->
        <img src="${imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;">
        <div style="position: absolute; top: 40px; left: 0; right: 0; text-align: center; color: white; font-size: 0.9rem;">
            "${escapeHtml(prompt)}"
        </div>



        <button onclick="this.parentElement.parentElement.remove()" style="
        position: absolute; 
        top: -40px; 
        right: 0; 
        background: #ff4444; 
        color: white; 
        border: none; 
        border-radius: 50%; 
        width: 30px; 
        height: 30px; 
        cursor: pointer; 
        font-size: 1.2rem;
        line-height: 1;
        ">
            ×
        </button>
    </div>
    `
    
    model.onclick = (e) => {
     if(e.target === model) model.remove();
    };


    document.body.appendChild(model);
}

const showCase = document.querySelector(".placeholder");
const podImage = document.querySelector(".pod-image");

if (showCase && podImage) {
    showCase.addEventListener('mousemove', (e) => {
        const rect = showCase.getBoundingClientRect();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2; 
        const centerY = rect.height / 2;
        
        const rotateX = ((y - centerY) / centerY) * -15;
        const rotateY = ((x - centerX) / centerX) * 15;

        podImage.style.setProperty('--rotateX', `${rotateX}deg`);
        podImage.style.setProperty('--rotateY', `${rotateY}deg`);
    });

    showCase.addEventListener('mouseleave', () => {
        podImage.style.transition = 'transform 0.5s ease, box-shadow 0.5s ease';
        
        podImage.style.setProperty('--rotateX', '0deg');
        podImage.style.setProperty('--rotateY', '0deg');

        setTimeout(() => {
            podImage.style.transition = 'transform 0.1s linear, box-shadow 0.3s ease';   
        }, 500);
    });
}

const typewriterText = document.getElementById("typewriter-text");

const Statements = [
    "Petro-AI-Image",
    "Bring Ideas to life",
    "Anything you Imagine",
    "IDK what to say next...."
];

const astheticClrs = [
    "linear-gradient(135deg, #ffffff, #888888)",
    "linear-gradient(135deg, #8a55f7, #ec4899)",
    "linear-gradient(135deg, #00c6ff, #0072ff)",
    "linear-gradient(135deg, #11998e, #38ef7d)",
    "linear-gradient(135deg, #ff7e5d, #feb47b)"
];

let statIndex = 0;
let charIndex = Statements[0].length;
let isDeleting = false;

function setAstheticColor(index) {
    const gradient = astheticClrs[index % astheticClrs.length];
    typewriterText.style.background = gradient; 
    typewriterText.style.webkitBackgroundClip = "text";
    typewriterText.style.webkitTextFillColor = "transparent";
}

setAstheticColor(0); 

function typeloop() {
    const currStat = Statements[statIndex];

    if (isDeleting) {
        charIndex--;
    } else {
        charIndex++;
    }
    
    typewriterText.textContent = currStat.substring(0, charIndex);

    let typeSpeed = isDeleting ? 40 : 80;
    
    if (!isDeleting && charIndex === currStat.length) {
        typeSpeed = 2200;
        isDeleting = true;
    }
    else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        statIndex = (statIndex + 1) % Statements.length;

        setAstheticColor(statIndex);
        typeSpeed = 400;
    }

    setTimeout(typeloop, typeSpeed);
}

setTimeout(() => {
    isDeleting = true;
    typeloop(); 
}, 2000);