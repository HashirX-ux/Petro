// Tiny local proxy so the browser never talks to ai.hackclub.com directly.
// Run this alongside your Live Server (or whatever serves index.html).
//
// Setup:
//   1. npm install
//   2. Set your key as an environment variable (do NOT hardcode it here —
//      anything committed to source control or pasted in chat should be
//      treated as leaked):
//        HACKCLUB_API_KEY=sk-hc-v1-xxxx node server.js
//   3. node server.js
//   4. Keep Live Server (or your frontend) running as usual — File1.js
//      now calls http://localhost:3001/api/generate-image instead of
//      ai.hackclub.com directly.

import express from "express";
import cors from "cors";

const app = express();
app.use(cors());            // allow requests from your local frontend origin
app.use(express.json());

// FIX: no hardcoded fallback key. The previous default was an actual
// working-looking key baked into source, AND the "is it set?" check below
// compared against that same literal string — meaning even a real key
// dropped in as the default would always be reported as "not set". Reading
// only from the environment removes both problems at once.
const HACKCLUB_API_KEY = process.env.HACKCLUB_API_KEY;
const HACKCLUB_ENDPOINT = "https://ai.hackclub.com/proxy/v1/chat/completions";
const HACKCLUB_IMAGE_MODEL = "google/gemini-2.5-flash-image";

app.post("/api/generate-image", async (req, res) => {
    const { prompt, aspect_ratio } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: { message: "Missing prompt" } });
    }

    if (!HACKCLUB_API_KEY) {
        return res.status(500).json({
            error: { message: "No Hack Club AI key set on the server. Set the HACKCLUB_API_KEY environment variable." }
        });
    }

    try {
            const response = await fetch(HACKCLUB_ENDPOINT, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HACKCLUB_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: HACKCLUB_IMAGE_MODEL,
                modalities: ["image", "text"],
                messages: [{ role: "user", content: prompt }],
                image_config: { aspect_ratio }
            })
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const rawText = await response.text();
            throw new Error(`API returned HTML (Status ${response.status}). Preview: ${rawText.substring(0, 150)}`);
        }

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (err) {
        console.error("Hack Club AI proxy error:", err.message);
        res.status(500).json({ error: { message: err.message } });
    }
});

const PORT = process.env.PORT || 3001;
export default app;