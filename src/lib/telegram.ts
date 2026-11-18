import { adminIds } from "./config";

type Body = Record<string, unknown>;

/** Minimal Bot API caller, usable from the web app and the worker. */
export async function tg(method: string, body: Body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

export async function notify(text: string, chatId?: string | null, extra: Body = {}) {
  const targets = chatId ? [chatId] : adminIds();
  for (const id of targets) await tg("sendMessage", { chat_id: id, text, ...extra });
}
