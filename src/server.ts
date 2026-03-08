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

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "GymFitness AI backend running 🚀" });
});

app.post("/ai/instructions", async (req: Request, res: Response) => {
  try {
    const { name, bodyPart, equipment, target } =
      req.body as ExerciseRequest;

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
                "You are a professional fitness coach. Return only JSON."
            },
            {
              role: "user",
              content: `
Generate instructions for this exercise.

Name: ${name}
Body part: ${bodyPart}
Equipment: ${equipment}
Target muscle: ${target}

Return JSON:

{
 "instructions": [
  "step 1",
  "step 2",
  "step 3",
  "step 4"
 ]
}
              `
            }
          ],
          temperature: 0.4
        })
      }
    );

    const data = await response.json();

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: "AI response empty" });
    }

    const parsed = JSON.parse(content);

    res.json(parsed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "AI generation failed" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on http://0.0.0.0:${PORT}`);
});