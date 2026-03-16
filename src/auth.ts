import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

const router = Router();

type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: string;
};

type SignupBody = {
  name: string;
  email: string;
  password: string;
};

type LoginBody = {
  email: string;
  password: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function ensureUsersFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]", "utf-8");
  }
}

function readUsers(): User[] {
  ensureUsersFile();
  const raw = fs.readFileSync(USERS_FILE, "utf-8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users: User[]) {
  ensureUsersFile();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

function generateToken(user: User) {
  const secret = process.env.JWT_SECRET || "supersecretkey";
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
    },
    secret,
    { expiresIn: "7d" }
  );
}

router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body as SignupBody;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Name, email, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    const users = readUsers();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = users.find(
      (user) => user.email.toLowerCase() === normalizedEmail
    );

    if (existingUser) {
      return res.status(409).json({
        error: "User already exists with this email",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser: User = {
      id: Date.now().toString(),
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    writeUsers(users);

    const token = generateToken(newUser);

    return res.status(201).json({
      message: "User created successfully",
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

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginBody;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const users = readUsers();
    const normalizedEmail = email.trim().toLowerCase();

    const user = users.find(
      (item) => item.email.toLowerCase() === normalizedEmail
    );

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = generateToken(user);

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

export default router;