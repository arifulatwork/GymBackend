"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
const DATA_DIR = path_1.default.join(process.cwd(), "data");
const USERS_FILE = path_1.default.join(DATA_DIR, "users.json");
function ensureUsersFile() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs_1.default.existsSync(USERS_FILE)) {
        fs_1.default.writeFileSync(USERS_FILE, "[]", "utf-8");
    }
}
function readUsers() {
    ensureUsersFile();
    const raw = fs_1.default.readFileSync(USERS_FILE, "utf-8");
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function writeUsers(users) {
    ensureUsersFile();
    fs_1.default.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}
function generateToken(user) {
    const secret = process.env.JWT_SECRET || "supersecretkey";
    return jsonwebtoken_1.default.sign({
        userId: user.id,
        email: user.email,
        name: user.name,
    }, secret, { expiresIn: "7d" });
}
router.post("/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;
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
        const existingUser = users.find((user) => user.email.toLowerCase() === normalizedEmail);
        if (existingUser) {
            return res.status(409).json({
                error: "User already exists with this email",
            });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const newUser = {
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
    }
    catch (error) {
        console.error("Signup error:", error);
        return res.status(500).json({ error: "Signup failed" });
    }
});
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password are required",
            });
        }
        const users = readUsers();
        const normalizedEmail = email.trim().toLowerCase();
        const user = users.find((item) => item.email.toLowerCase() === normalizedEmail);
        if (!user) {
            return res.status(401).json({
                error: "Invalid email or password",
            });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
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
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ error: "Login failed" });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map