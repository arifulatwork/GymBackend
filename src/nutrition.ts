import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

const router = Router();

type NutritionEntry = {
  id: string;
  userId: string;
  meal: string;
  food: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: string;
};

type AddNutritionBody = {
  meal: string;
  food: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

const DATA_DIR = path.join(process.cwd(), "data");
const NUTRITION_FILE = path.join(DATA_DIR, "nutrition.json");

function ensureNutritionFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(NUTRITION_FILE)) {
    fs.writeFileSync(NUTRITION_FILE, "[]", "utf-8");
  }
}

function readNutrition(): NutritionEntry[] {
  ensureNutritionFile();

  const raw = fs.readFileSync(NUTRITION_FILE, "utf-8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNutrition(entries: NutritionEntry[]) {
  ensureNutritionFile();
  fs.writeFileSync(NUTRITION_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

function getUserIdFromToken(req: Request) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET || "supersecretkey";

  const decoded = jwt.verify(token, secret) as {
    userId: string;
    email: string;
    name: string;
  };

  return decoded.userId;
}

router.get("/", (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);

    const entries = readNutrition().filter(
      (entry) => entry.userId === userId
    );

    return res.json({ entries });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

router.post("/", (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);

    const {
      meal,
      food,
      calories,
      protein = 0,
      carbs = 0,
      fat = 0,
    } = req.body as AddNutritionBody;

    if (!meal || !food || calories === undefined) {
      return res.status(400).json({
        error: "Meal, food, and calories are required",
      });
    }

    const entries = readNutrition();

    const newEntry: NutritionEntry = {
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
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

router.delete("/:id", (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    const { id } = req.params;

    const entries = readNutrition();

    const entry = entries.find(
      (item) => item.id === id && item.userId === userId
    );

    if (!entry) {
      return res.status(404).json({ error: "Nutrition entry not found" });
    }

    const updatedEntries = entries.filter(
      (item) => !(item.id === id && item.userId === userId)
    );

    writeNutrition(updatedEntries);

    return res.json({ message: "Nutrition entry deleted" });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

export default router;