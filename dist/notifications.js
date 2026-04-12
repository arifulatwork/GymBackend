"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const expo_server_sdk_1 = require("expo-server-sdk");
const router = (0, express_1.Router)();
const expo = new expo_server_sdk_1.Expo();
const DATA_DIR = path_1.default.join(process.cwd(), "data");
const TOKENS_FILE = path_1.default.join(DATA_DIR, "pushTokens.json");
function ensureTokensFile() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs_1.default.existsSync(TOKENS_FILE)) {
        fs_1.default.writeFileSync(TOKENS_FILE, "[]", "utf-8");
    }
}
function readTokens() {
    ensureTokensFile();
    const raw = fs_1.default.readFileSync(TOKENS_FILE, "utf-8");
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function writeTokens(tokens) {
    ensureTokensFile();
    fs_1.default.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf-8");
}
router.post("/register-token", (req, res) => {
    try {
        const { expoPushToken } = req.body;
        if (!expoPushToken) {
            return res.status(400).json({
                error: "Expo push token is required",
            });
        }
        if (!expo_server_sdk_1.Expo.isExpoPushToken(expoPushToken)) {
            return res.status(400).json({
                error: "Invalid Expo push token format",
            });
        }
        const tokens = readTokens();
        const exists = tokens.find((item) => item.expoPushToken === expoPushToken);
        if (!exists) {
            tokens.push({
                expoPushToken,
                updatedAt: new Date().toISOString(),
            });
            writeTokens(tokens);
        }
        return res.json({
            message: "Token saved",
        });
    }
    catch (error) {
        console.error("Register token error:", error);
        return res.status(500).json({
            error: "Failed to save token",
        });
    }
});
router.get("/tokens", (_req, res) => {
    try {
        const tokens = readTokens();
        return res.json({ tokens });
    }
    catch (error) {
        console.error("Get tokens error:", error);
        return res.status(500).json({
            error: "Failed to get tokens",
        });
    }
});
router.post("/send", async (req, res) => {
    try {
        const { expoPushToken, title, body, data } = req.body;
        if (!expoPushToken || !title || !body) {
            return res.status(400).json({
                error: "expoPushToken, title and body are required",
            });
        }
        if (!expo_server_sdk_1.Expo.isExpoPushToken(expoPushToken)) {
            return res.status(400).json({
                error: "Invalid Expo push token",
            });
        }
        const message = {
            to: expoPushToken,
            sound: "default",
            title,
            body,
            data: data || {},
        };
        const chunks = expo.chunkPushNotifications([message]);
        const tickets = [];
        for (const chunk of chunks) {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
        }
        return res.json({
            message: "Notification sent",
            tickets,
        });
    }
    catch (error) {
        console.error("Send notification error:", error);
        return res.status(500).json({
            error: "Failed to send notification",
        });
    }
});
router.post("/send-all", async (req, res) => {
    try {
        const { title, body, data } = req.body;
        if (!title || !body) {
            return res.status(400).json({
                error: "title and body are required",
            });
        }
        const tokens = readTokens();
        const validTokens = tokens
            .map((item) => item.expoPushToken)
            .filter((token) => expo_server_sdk_1.Expo.isExpoPushToken(token));
        if (validTokens.length === 0) {
            return res.status(404).json({
                error: "No valid saved tokens found",
            });
        }
        const messages = validTokens.map((token) => ({
            to: token,
            sound: "default",
            title,
            body,
            data: data || {},
        }));
        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];
        for (const chunk of chunks) {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
        }
        return res.json({
            message: "Notifications sent",
            total: validTokens.length,
            tickets,
        });
    }
    catch (error) {
        console.error("Send all notifications error:", error);
        return res.status(500).json({
            error: "Failed to send notifications",
        });
    }
});
router.get("/admin", (_req, res) => {
    const tokens = readTokens();
    const options = tokens
        .map((item) => `<option value="${item.expoPushToken}">${item.expoPushToken} (${item.updatedAt})</option>`)
        .join("");
    res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Push Notification Admin</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 700px;
            margin: 40px auto;
            padding: 20px;
          }
          input, textarea, select, button {
            width: 100%;
            margin-top: 10px;
            margin-bottom: 16px;
            padding: 10px;
            font-size: 16px;
          }
          button {
            cursor: pointer;
          }
          .token-box {
            background: #f4f4f4;
            padding: 10px;
            margin-bottom: 8px;
            border-radius: 8px;
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        <h1>Push Notification Admin</h1>

        <h2>Saved Tokens</h2>
        ${tokens.length === 0 ? "<p>No tokens saved yet.</p>" : ""}
        ${tokens
        .map((item) => `<div class="token-box">${item.expoPushToken}<br/><small>${item.updatedAt}</small></div>`)
        .join("")}

        <h2>Send to One Token</h2>
        <form method="POST" action="/notifications/admin/send-one">
          <label>Choose Token</label>
          <select name="expoPushToken" required>
            <option value="">Select a token</option>
            ${options}
          </select>

          <label>Title</label>
          <input name="title" placeholder="Notification title" required />

          <label>Body</label>
          <textarea name="body" placeholder="Notification body" required></textarea>

          <button type="submit">Send Notification</button>
        </form>

        <h2>Send to All Tokens</h2>
        <form method="POST" action="/notifications/admin/send-all">
          <label>Title</label>
          <input name="title" placeholder="Notification title" required />

          <label>Body</label>
          <textarea name="body" placeholder="Notification body" required></textarea>

          <button type="submit">Send To All</button>
        </form>
      </body>
    </html>
  `);
});
router.post("/admin/send-one", async (req, res) => {
    try {
        const { expoPushToken, title, body } = req.body;
        if (!expoPushToken || !title || !body) {
            return res.status(400).send("Missing required fields");
        }
        if (!expo_server_sdk_1.Expo.isExpoPushToken(expoPushToken)) {
            return res.status(400).send("Invalid Expo push token");
        }
        const message = {
            to: expoPushToken,
            sound: "default",
            title,
            body,
            data: {},
        };
        const chunks = expo.chunkPushNotifications([message]);
        for (const chunk of chunks) {
            await expo.sendPushNotificationsAsync(chunk);
        }
        return res.send(`
      <h2>Notification sent successfully</h2>
      <p><a href="/notifications/admin">Go back</a></p>
    `);
    }
    catch (error) {
        console.error("Admin send one error:", error);
        return res.status(500).send("Failed to send notification");
    }
});
router.post("/admin/send-all", async (req, res) => {
    try {
        const { title, body } = req.body;
        if (!title || !body) {
            return res.status(400).send("Missing required fields");
        }
        const tokens = readTokens()
            .map((item) => item.expoPushToken)
            .filter((token) => expo_server_sdk_1.Expo.isExpoPushToken(token));
        if (tokens.length === 0) {
            return res.status(404).send("No valid tokens found");
        }
        const messages = tokens.map((token) => ({
            to: token,
            sound: "default",
            title,
            body,
            data: {},
        }));
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
            await expo.sendPushNotificationsAsync(chunk);
        }
        return res.send(`
      <h2>Notifications sent to ${tokens.length} device(s)</h2>
      <p><a href="/notifications/admin">Go back</a></p>
    `);
    }
    catch (error) {
        console.error("Admin send all error:", error);
        return res.status(500).send("Failed to send notifications");
    }
});
exports.default = router;
//# sourceMappingURL=notifications.js.map