export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: { message: "Method not allowed" } });
    }

    const { prompt, aspect_ratio } = req.body || {};

    if (!prompt) {
        return res.status(400).json({ error: { message: "Missing prompt" } });
    }

    const HACKCLUB_API_KEY = process.env.HACKCLUB_API_KEY;
    if (!HACKCLUB_API_KEY) {
        return res.status(500).json({
            error: { message: "No Hack Club AI key set on the server." }
        });
    }

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

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: { message: err.message } });
    }
}