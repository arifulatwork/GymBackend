"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./auth"));
const nutrition_1 = __importDefault(require("./nutrition"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use("/auth", auth_1.default);
app.use("/nutrition", nutrition_1.default);
app.get("/", (_req, res) => {
    res.json({ message: "GymFitness AI backend running 🚀" });
});
function extractJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) {
            throw new Error("No valid JSON found in AI response");
        }
        return JSON.parse(match[0]);
    }
}
app.post("/ai/instructions", async (req, res) => {
    try {
        const { name, bodyPart, equipment, target } = req.body;
        if (!name) {
            return res.status(400).json({ error: "Exercise name is required" });
        }
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "openai/gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a professional fitness coach. Return only valid JSON with short, clear, beginner-friendly exercise instructions.",
                    },
                    {
                        role: "user",
                        content: `
Generate instructions for this exercise.

Name: ${name}
Body part: ${bodyPart || "unknown"}
Equipment: ${equipment || "unknown"}
Target muscle: ${target || "unknown"}

Return JSON in this exact format:
{
  "instructions": [
    "step 1",
    "step 2",
    "step 3",
    "step 4"
  ]
}
              `,
                    },
                ],
                temperature: 0.4,
            }),
        });
        const data = await response.json();
        if (!response.ok) {
            console.error("OpenRouter error:", data);
            return res.status(500).json({
                error: "Failed to get AI instructions",
                details: data,
            });
        }
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
            return res.status(500).json({ error: "AI response empty" });
        }
        const parsed = extractJson(content);
        return res.json({
            instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
        });
    }
    catch (error) {
        console.error("Instructions error:", error);
        return res.status(500).json({ error: "AI generation failed" });
    }
});
app.post("/ai/exercise-chat", async (req, res) => {
    try {
        const { question, name, bodyPart, equipment, target, instructions, } = req.body;
        if (!question || !name) {
            return res.status(400).json({
                error: "Both question and exercise name are required",
            });
        }
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "openai/gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful fitness coach. Explain exercises in simple, short, beginner-friendly language. Return only valid JSON.",
                    },
                    {
                        role: "user",
                        content: `
Exercise details:
Name: ${name}
Body part: ${bodyPart || "unknown"}
Equipment: ${equipment || "unknown"}
Target muscle: ${target || "unknown"}
Instructions: ${JSON.stringify(instructions || [])}

User question:
${question}

Return JSON in this exact format:
{
  "answer": "clear helpful answer here"
}
              `,
                    },
                ],
                temperature: 0.5,
            }),
        });
        const data = await response.json();
        if (!response.ok) {
            console.error("OpenRouter error:", data);
            return res.status(500).json({
                error: "Failed to get AI answer",
                details: data,
            });
        }
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
            return res.status(500).json({ error: "AI response empty" });
        }
        const parsed = extractJson(content);
        return res.json({
            answer: parsed.answer || "Sorry, I could not generate an answer.",
        });
    }
    catch (error) {
        console.error("Exercise chat error:", error);
        return res.status(500).json({ error: "AI chat failed" });
    }
});
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running on http://0.0.0.0:${PORT}`);
});
//# sourceMappingURL=server.js.map