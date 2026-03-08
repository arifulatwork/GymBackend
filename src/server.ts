import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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

type SignupRequest = {
  name: string;
  email: string;
  password: string;
};

type LoginRequest = {
  email: string;
  password: string;
};

type User = {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
};

const users: User[] = [];

const createToken = (user: { id: number; name: string; email: string }) => {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    process.env.JWT_SECRET || "dev_secret_change_me",
    { expiresIn: "7d" }
  );
};

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "GymFitness AI backend running 🚀" });
});

app.post("/auth/signup", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body as SignupRequest;

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({
        error: "Name, email, and password are required",
      });
    }

    if (password.trim().length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = users.find((user) => user.email === normalizedEmail);

    if (existingUser) {
      return res.status(409).json({
        error: "User already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password.trim(), 10);

    const newUser: User = {
      id: users.length + 1,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
    };

    users.push(newUser);

    const token = createToken({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
    });

    return res.status(201).json({
      message: "Signup successful",
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest;

    if (!email?.trim() || !password?.trim()) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = users.find((u) => u.email === normalizedEmail);

    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password.trim(),
      user.passwordHash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    const token = createToken({
      id: user.id,
      name: user.name,
      email: user.email,
    });

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed" });
  }
});

app.post("/ai/instructions", async (req: Request, res: Response) => {
  try {
    const { name, bodyPart, equipment, target } =
      req.body as ExerciseRequest;

    if (!name?.trim()) {
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
                "You are a professional fitness coach. Return only valid JSON.",
            },
            {
              role: "user",
              content: `
Generate instructions for this exercise.

Name: ${name}
Body part: ${bodyPart || "unknown"}
Equipment: ${equipment || "unknown"}
Target muscle: ${target || "unknown"}

Return JSON in this format only:

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
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: "AI response empty" });
    }

    const parsed = JSON.parse(content);

    return res.json(parsed);
  } catch (error) {
    console.error("AI generation error:", error);
    return res.status(500).json({ error: "AI generation failed" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on http://0.0.0.0:${PORT}`);
});