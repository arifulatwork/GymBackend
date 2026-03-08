import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

type ExerciseRequest = {
  name: string;
  bodyPart?: string;
  equipment?: string;
  target?: string;
};

type ExerciseChatRequest = {
  question: string;
  name: string;
  bodyPart?: string;
  equipment?: string;
  target?: string;
  instructions?: string[];
};

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "GymFitness AI backend running 🚀" });
});

function extractJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("No valid JSON found in AI response");
    }
    return JSON.parse(match[0]);
  }
}

app.post("/ai/instructions", async (req: Request, res: Response) => {
  try {
    const { name, bodyPart, equipment, target } = req.body as ExerciseRequest;

    if (!name) {
      return res.status(400).json({ error: "Exercise name is required" });
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
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
              content:
                "You are a professional fitness coach. Return only valid JSON with short, clear, beginner-friendly exercise instructions.",
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
      }
    );

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
  } catch (error) {
    console.error("Instructions error:", error);
    return res.status(500).json({ error: "AI generation failed" });
  }
});

app.post("/ai/exercise-chat", async (req: Request, res: Response) => {
  try {
    const {
      question,
      name,
      bodyPart,
      equipment,
      target,
      instructions,
    } = req.body as ExerciseChatRequest;

    if (!question || !name) {
      return res.status(400).json({
        error: "Both question and exercise name are required",
      });
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
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
              content:
                "You are a helpful fitness coach. Explain exercises in simple, short, beginner-friendly language. Return only valid JSON.",
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
      }
    );

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
  } catch (error) {
    console.error("Exercise chat error:", error);
    return res.status(500).json({ error: "AI chat failed" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on http://0.0.0.0:${PORT}`);
});