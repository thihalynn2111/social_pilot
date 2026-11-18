import { Bot, InlineKeyboard } from "grammy";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { adminIds, fmt, uploadDir } from "@/lib/config";
import { nextFreeSlot, nextSlot } from "@/lib/slots";
import { generateIdeas, writeCaption } from "@/lib/ai";

/** Caption written from an idea, waiting for the media to be sent. */
const pendingCaption = new Map<number, string>();

export function createBot(token: string) {
  const bot = new Bot(token);
  const admins = new Set(adminIds());

  // /start is open so you can read your own Telegram ID; everything else is allowlisted.
  bot.command("start", (ctx) =>
    ctx.reply(
      `Your Telegram ID: ${ctx.from?.id}\n\n` +
        `Commands:\n/idea <topic> – get post ideas\n/queue – upcoming posts\n/stats – last 7 days\n\n` +
        `Send a video or photo (with a caption) to create a post.`,
    ),
  );

  bot.use(async (ctx, next) => {
    if (ctx.from && admins.has(String(ctx.from.id))) return next();
  });

  bot.command("queue", async (ctx) => {
    const posts = await prisma.post.findMany({
      where: { status: { in: ["PENDING_APPROVAL", "SCHEDULED", "PUBLISHING"] } },
      include: { account: true },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    });
    if (!posts.length) return ctx.reply("Queue is empty. Send a video or photo to add a post.");
    await ctx.reply(
      posts
        .map((p) => `#${p.id} ${p.platform} (${p.account.name}) · ${p.status} · ${fmt(p.scheduledAt)}`)
        .join("\n"),
    );
  });

  bot.command("stats", async (ctx) => {
    const since = new Date(Date.now() - 7 * 86400_000);
    const rows = await prisma.post.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: true });
    await ctx.reply(rows.length ? rows.map((r) => `${r.status}: ${r._count}`).join("\n") : "No posts in the last 7 days.");
  });

  bot.command("idea", async (ctx) => {
    const topic = ctx.match.trim();
    if (!topic) return ctx.reply("Usage: /idea <topic>");
    await ctx.reply("Thinking of ideas…");
    try {
      const drafts = await generateIdeas(topic);
      const kb = new InlineKeyboard();
      const lines: string[] = [];
      for (const [i, d] of drafts.entries()) {
        const row = await prisma.idea.create({ data: { topic, title: d.title, hook: d.hook } });
        lines.push(`${i + 1}. ${d.title}\n   ${d.hook}`);
        kb.text(`Write caption ${i + 1}`, `idea:${row.id}`).row();
      }
      await ctx.reply(lines.join("\n\n"), { reply_markup: kb });
    } catch (e) {
      await ctx.reply(`Could not generate ideas: ${e instanceof Error ? e.message : e}`);
    }
  });

  bot.callbackQuery(/^idea:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery("Writing…");
    const idea = await prisma.idea.findUnique({ where: { id: Number(ctx.match[1]) } });
    if (!idea) return;
    const caption = await writeCaption({ title: idea.title, hook: idea.hook });
    pendingCaption.set(ctx.chat!.id, caption);
    await ctx.reply(`${caption}\n\n— Now send the video or photo to attach it to this caption.`);
  });

  // Media -> one pending post per connected account.
  bot.on(["message:video", "message:photo"], async (ctx) => {
    const isVideo = Boolean(ctx.message.video);
    const file = await ctx.getFile();
    if (!file.file_path) return ctx.reply("Telegram did not give a download path. Files over 20 MB must be uploaded in the web panel.");

    const ext = path.extname(file.file_path) || (isVideo ? ".mp4" : ".jpg");
    const name = `${randomUUID()}${ext}`;
    const res = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
    if (!res.ok) return ctx.reply("Download from Telegram failed.");
    await fs.mkdir(uploadDir(), { recursive: true });
    await fs.writeFile(path.join(uploadDir(), name), Buffer.from(await res.arrayBuffer()));

    const caption = ctx.message.caption?.trim() || pendingCaption.get(ctx.chat.id) || "";
    pendingCaption.delete(ctx.chat.id);

    const accounts = await prisma.account.findMany();
    if (!accounts.length) return ctx.reply("No accounts connected yet. Add one in the web panel.");

    const posts = await Promise.all(
      accounts.map((a) =>
        prisma.post.create({
          data: {
            platform: a.platform,
            accountId: a.id,
            caption,
            mediaFile: name,
            mediaType: isVideo ? "VIDEO" : "IMAGE",
            status: "PENDING_APPROVAL",
            telegramChatId: String(ctx.chat.id),
          },
        }),
      ),
    );
    const ids = posts.map((p) => p.id).join(",");
    const kb = new InlineKeyboard()
      .text("✅ Approve (next slot)", `ap:${ids}`)
      .text("🕒 In 1 hour", `h1:${ids}`)
      .row()
      .text("❌ Reject", `rj:${ids}`);
    await ctx.reply(
      `New ${isVideo ? "video" : "photo"} post for ${accounts.map((a) => `${a.platform}/${a.name}`).join(", ")}\n\n` +
        (caption || "(no caption — you can add one in the web panel)"),
      { reply_markup: kb },
    );
  });

  const idsOf = (m: RegExpMatchArray | string) => String(Array.isArray(m) ? m[1] : m).split(",").map(Number);

  bot.callbackQuery(/^(?:ap|h1):([\d,]+)$/, async (ctx) => {
    const inOneHour = ctx.callbackQuery.data.startsWith("h1:");
    const posts = await prisma.post.findMany({ where: { id: { in: idsOf(ctx.match) }, status: "PENDING_APPROVAL" } });
    const when: string[] = [];
    for (const p of posts) {
      const at = inOneHour ? nextSlot(new Date(Date.now() + 49 * 60_000)) : await nextFreeSlot(p.accountId);
      const when1 = inOneHour ? new Date(Date.now() + 60 * 60_000) : at;
      await prisma.post.update({ where: { id: p.id }, data: { status: "SCHEDULED", scheduledAt: when1 } });
      when.push(`#${p.id}: ${fmt(when1)}`);
    }
    await ctx.answerCallbackQuery("Scheduled");
    await ctx.editMessageText(`✅ Scheduled\n${when.join("\n") || "Nothing pending."}`);
  });

  bot.callbackQuery(/^rj:([\d,]+)$/, async (ctx) => {
    await prisma.post.updateMany({ where: { id: { in: idsOf(ctx.match) }, status: "PENDING_APPROVAL" }, data: { status: "REJECTED" } });
    await ctx.answerCallbackQuery("Rejected");
    await ctx.editMessageText("❌ Rejected");
  });

  bot.callbackQuery(/^retry:(\d+)$/, async (ctx) => {
    await prisma.post.update({
      where: { id: Number(ctx.match[1]) },
      data: { status: "SCHEDULED", attempts: 0, error: null, scheduledAt: new Date(Date.now() + 60_000) },
    });
    await ctx.answerCallbackQuery("Retrying in ~1 min");
  });

  bot.catch((err) => console.error("[bot]", err.error));
  return bot;
}
