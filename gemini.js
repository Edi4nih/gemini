import express from 'express';
import axios from 'axios';
import fs from 'fs-extra';

const app = express();
const port = 8080;

const maxStorageMessage = 15;

async function fetchData(history) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY'; // Ganti YOUR_API_KEY dengan API key yang valid

    const requestData = {
        contents: history,
        safetySettings: [
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 1000,
            topP: 0.9,
            topK: 16
        }
    };

    try {
        const response = await axios.post(url, requestData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const candidates = response.data.candidates;
        if (!candidates || candidates.length === 0) {
            throw new Error('Invalid response format: missing candidates');
        }

        const content = candidates[0].content;
        if (!content || !content.parts || content.parts.length === 0) {
            throw new Error('Invalid response format: missing content parts');
        }

        return content.parts[0].text;
    } catch (error) {
        console.error('Error fetching data:', error.message);
        throw error;
    }
}

function loadHistory() {
    const historyFilePath = "history.json";
    try {
        if (fs.existsSync(historyFilePath)) {
            const rawData = fs.readFileSync(historyFilePath);
            return JSON.parse(rawData);
        } else {
            return {};
        }
    } catch (error) {
        console.error("Error loading history:", error);
        return {};
    }
}

function saveHistory(history) {
    const historyFilePath = "history.json";
    try {
        fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2));
    } catch (error) {
        console.error("Error saving history:", error);
    }
}

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.get('/gen', async (req, res) => {
    const senderID = req.query.id;
    const prompt = req.query.q;

    if (!senderID || !prompt) {
        return res.status(400).json({ success: false, status: 400, error: 'senderID and prompt are required' });
    }

    const history = loadHistory();
    const userHistory = history[senderID] || [
        { role: "user", parts: [{ text: "Gunakan bahasa yang gaul... (dan seterusnya)" }] },
        { role: "model", parts: [{ text: "ok" }] }
    ];

    userHistory.push({ role: "user", parts: [{ text: prompt }] });

    try {
        const response = await fetchData(userHistory);
        res.json({ success: true, status: 200, message: response });

        userHistory.push({ role: "model", parts: [{ text: response }] });

        if (userHistory.length > maxStorageMessage * 2) {
            userHistory.splice(2, userHistory.length - maxStorageMessage * 2);
        }

        history[senderID] = userHistory;
        saveHistory(history);
    } catch (error) {
        res.status(500).json({ success: false, status: 500, error: error.message });
    }
});

app.get('/clear/:id', (req, res) => {
    const senderID = req.params.id;

    if (!senderID) {
        return res.status(400).json({ error: 'senderID is required' });
    }

    const history = loadHistory();
    if (history[senderID]) {
        delete history[senderID];
        saveHistory(history);
        res.json({ status: 200, data: 'Conversation deleted successfully.', message: 'uhh, my head hurts' });
    } else {
        res.status(404).json({ error: 'Conversation not found.' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
