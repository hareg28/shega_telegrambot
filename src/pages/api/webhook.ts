/**
 * Telegram Webhook Endpoint
 * Receives updates from Telegram and forwards them to the grammY bot.
 * All bot logic lives in src/bot/index.ts
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { webhookCallback } from "grammy";
import { createBot } from "@/bot/index";
import { getBotMode } from "@/lib/config";
import { getWebhookSecret } from "@/lib/notifications";

let webhookHandler: any = null;

function getCallback() {
  if (!webhookHandler) {
    const bot = createBot();
    webhookHandler = webhookCallback(bot, "next-js", {
      secretToken: getWebhookSecret(),
    });
  }
  return webhookHandler;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      message: "Shega Interiors PR Bot webhook is ready",
      configured: !!process.env.BOT_TOKEN,
      botMode: getBotMode(),
    });
  }

  if (req.method === "POST") {
    try {
      const cb = getCallback();
      return await cb(req, res);
    } catch (err: any) {
      console.error("[webhook] Error processing update:", err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Internal server error", details: err?.message || String(err) });
      }
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}