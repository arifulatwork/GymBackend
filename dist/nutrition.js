"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
const DATA_DIR = path_1.default.join(process.cwd(), "data");
const NUTRITION_FILE = path_1.default.join(DATA_DIR, "nutrition.json");
function ensureNutritionFile() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs_1.default.existsSync(NUTRITION_FILE)) {
        fs_1.default.writeFileSync(NUTRITION_FILE, "[]", "utf-8");
    }
}
function readNutrition() {
    ensureNutritionFile();
    const raw = fs_1.default.readFileSync(NUTRITION_FILE, "utf-8");
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function writeNutrition(entries) {
    ensureNutritionFile();
    fs_1.default.writeFileSync(NUTRITION_FILE, JSON.stringify(entries, null, 2), "utf-8");
}
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
function getUserIdFromToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Unauthorized");
    }
    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET || "supersecretkey";
    const decoded = jsonwebtoken_1.default.verify(token, secret);
    return decoded.userId;
}
/* ================= AI ANALYZE NUTRITION ================= */
router.post("/analyze", async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({
                error: "Food text is required",
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
                        content: "You are a nutrition assistant. Estimate calories and macros from food text. Return only valid JSON. No markdown.",
                    },
                    {
                        role: "user",
                        content: `
Analyze this food:

${text}

Return JSON only in this exact format:
{
  "meal": "Breakfast/Lunch/Dinner/Snack",
  "food": "clean short food description",
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0
}
              `,
                    },
                ],
                temperature: 0.2,
            }),
        });
        const data = await response.json();
        if (!response.ok) {
            console.error("OpenRouter nutrition error:", data);
            return res.status(500).json({
                error: "Failed to analyze nutrition",
                details: data,
            });
        }
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
            return res.status(500).json({
                error: "AI response empty",
            });
        }
        const parsed = extractJson(content);
        return res.json({
            meal: parsed.meal || "Meal",
            food: parsed.food || text,
            calories: Number(parsed.calories) || 0,
            protein: Number(parsed.protein) || 0,
            carbs: Number(parsed.carbs) || 0,
            fat: Number(parsed.fat) || 0,
        });
    }
    catch (error) {
        console.error("Nutrition analyze error:", error);
        return res.status(500).json({
            error: "Nutrition AI failed",
        });
    }
});
/* ================= GET USER NUTRITION ================= */
router.get("/", (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        const entries = readNutrition().filter((entry) => entry.userId === userId);
        return res.json({ entries });
    }
    catch {
        return res.status(401).json({ error: "Unauthorized" });
    }
});
/* ================= SAVE NUTRITION ================= */
router.post("/", (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        const { meal, food, calories, protein = 0, carbs = 0, fat = 0, } = req.body;
        if (!meal || !food || calories === undefined) {
            return res.status(400).json({
                error: "Meal, food, and calories are required",
            });
        }
        const entries = readNutrition();
        const newEntry = {
            id: Date.now().toString(),
            userId,
            meal,
            food,
            calories: Number(calories),
            protein: Number(protein),
            carbs: Number(carbs),
            fat: Number(fat),
            createdAt: new Date().toISOString(),
        };
        entries.push(newEntry);
        writeNutrition(entries);
        return res.status(201).json({
            message: "Nutrition entry saved",
            entry: newEntry,
        });
    }
    catch {
        return res.status(401).json({ error: "Unauthorized" });
    }
});
/* ================= DELETE NUTRITION ================= */
router.delete("/:id", (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        const { id } = req.params;
        const entries = readNutrition();
        const entry = entries.find((item) => item.id === id && item.userId === userId);
        if (!entry) {
            return res.status(404).json({
                error: "Nutrition entry not found",
            });
        }
        const updatedEntries = entries.filter((item) => !(item.id === id && item.userId === userId));
        writeNutrition(updatedEntries);
        return res.json({
            message: "Nutrition entry deleted",
        });
    }
    catch {
        return res.status(401).json({ error: "Unauthorized" });
    }
});
exports.default = router;
//# sourceMappingURL=nutrition.js.map