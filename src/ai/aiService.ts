import dotenv from "dotenv";
import path from "path";

dotenv.config({
    path: path.resolve(__dirname, "../../.env")
});

export interface FunctionMeta {
    name: string;
    params: number;
    complexity: number;
    time: string;
    code?: string;
}

export async function generateAIComment(data: FunctionMeta): Promise<string> {
    try {
        const API_KEY = process.env.GEMINI_API_KEY;

        if (!API_KEY) {
            console.error("Missing GEMINI_API_KEY");
            return "AI unavailable (no API key).";
        }

        const prompt = `
You are an expert code reviewer.

Function Name: ${data.name}
Parameters: ${data.params}
Cyclomatic Complexity: ${data.complexity}
Time Complexity: ${data.time}

${data.code ? `Function Code:\n${data.code}` : ""}

Explain clearly in 2–3 lines:
- What the function does
- Performance insight
- Suitability for input size
`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: prompt }]
                        }
                    ]
                })
            }
        );

        // Handle HTTP error
        if (!response.ok) {
            const errText = await response.text();
            console.error("HTTP Error:", errText);
            return "AI request failed.";
        }

        const json = await response.json();

        const text =
            json.candidates?.[0]?.content?.parts?.[0]?.text;

        return text?.trim() || "AI failed.";

    } catch (err) {
        console.error("Gemini Error:", err);
        return "AI request failed.";
    }
}