export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: { message: "Method not allowed" } });

    const { prompt, aspect_ratio = "1:1" } = req.body || {};

    if (!prompt) return res.status(400).json({ error: { message: "Missing prompt" } });

    const HACKCLUB_API_KEY = process.env.HACKCLUB_API_KEY;
    if (!HACKCLUB_API_KEY) return res.status(500).json({ error: { message: "API key not configured" } });

    // Retry logic
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch("https://ai.hackclub.com/proxy/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${HACKCLUB_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "google/gemini-2.5-flash-image",
                    modalities: ["image", "text"],
                    messages: [{ role: "user", content: prompt }],
                    image_config: { aspect_ratio }
                })
            });

            const data = await response.json();

            if (response.ok) {
                return res.json(data);
            }

            if (attempt === maxRetries) {
                return res.status(response.status).json(data);
            }

            // Wait before retry
            await new Promise(r => setTimeout(r, 1000 * attempt));

        } catch (err) {
            if (attempt === maxRetries) {
                return res.status(500).json({ error: { message: err.message } });
            }
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
}