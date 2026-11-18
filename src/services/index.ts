import "dotenv/config";
import { createBot } from "./bot";
import { startWorker } from "./worker";

startWorker();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (token) {
  const bot = createBot(token);
  void bot.start({ onStart: (me) => console.log(`[bot] @${me.username} running`) });
} else {
  console.warn("[bot] TELEGRAM_BOT_TOKEN not set — Telegram control disabled");
}
