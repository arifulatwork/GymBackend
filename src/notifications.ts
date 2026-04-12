import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { Expo, ExpoPushMessage } from "expo-server-sdk";

const router = Router();
const expo = new Expo();

type StoredPushToken = {
  expoPushToken: string;
  updatedAt: string;
};

type RegisterTokenBody = {
  expoPushToken: string;
};

type SendNotificationBody = {
  expoPushToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

const DATA_DIR = path.join(process.cwd(), "data");
const TOKENS_FILE = path.join(DATA_DIR, "pushTokens.json");

function ensureTokensFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(TOKENS_FILE)) {
    fs.writeFileSync(TOKENS_FILE, "[]", "utf-8");
  }
}

function readTokens(): StoredPushToken[] {
  ensureTokensFile();
  const raw = fs.readFileSync(TOKENS_FILE, "utf-8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTokens(tokens: StoredPushToken[]) {
  ensureTokensFile();
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf-8");
}

//
// 🔹 Save token
//
router.post("/register-token", (req: Request, res: Response) => {
  try {
    const { expoPushToken } = req.body as RegisterTokenBody;

    if (!expoPushToken) {
      return res.status(400).json({
        error: "Expo push token is required",
      });
    }

    if (!Expo.isExpoPushToken(expoPushToken)) {
      return res.status(400).json({
        error: "Invalid Expo push token format",
      });
    }

    const tokens = readTokens();

    const exists = tokens.find(
      (item) => item.expoPushToken === expoPushToken
    );

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
  } catch (error) {
    console.error("Register token error:", error);
    return res.status(500).json({
      error: "Failed to save token",
    });
  }
});

//
// 🔹 Send notification (manual token input)
//
router.post("/send", async (req: Request, res: Response) => {
  try {
    const { expoPushToken, title, body, data } =
      req.body as SendNotificationBody;

    if (!expoPushToken || !title || !body) {
      return res.status(400).json({
        error: "expoPushToken, title and body are required",
      });
    }

    if (!Expo.isExpoPushToken(expoPushToken)) {
      return res.status(400).json({
        error: "Invalid Expo push token",
      });
    }

    const message: ExpoPushMessage = {
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
  } catch (error) {
    console.error("Send notification error:", error);
    return res.status(500).json({
      error: "Failed to send notification",
    });
  }
});

export default router;