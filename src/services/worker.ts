import { prisma } from "@/lib/db";
import { fmt } from "@/lib/config";
import { notify } from "@/lib/telegram";
import { publishers } from "@/lib/publishers";

const MAX_ATTEMPTS = 3;

async function runOnce() {
  // Recover jobs stuck in PUBLISHING (e.g. process crashed mid-upload).
  await prisma.post.updateMany({
    where: { status: "PUBLISHING", updatedAt: { lt: new Date(Date.now() - 20 * 60_000) } },
    data: { status: "SCHEDULED" },
  });

  const due = await prisma.post.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    include: { account: true },
    orderBy: { scheduledAt: "asc" },
    take: 5,
  });

  for (const post of due) {
    // Claim the job so two workers never publish the same post.
    const claim = await prisma.post.updateMany({
      where: { id: post.id, status: "SCHEDULED" },
      data: { status: "PUBLISHING" },
    });
    if (claim.count === 0) continue;

    const label = `${post.platform} · ${post.account.name} · #${post.id}`;
    try {
      const externalId = await publishers[post.platform](post);
      await prisma.post.update({
        where: { id: post.id },
        data: { status: "PUBLISHED", externalId, publishedAt: new Date(), error: null },
      });
      await notify(`✅ Published: ${label}\nID: ${externalId}`, post.telegramChatId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const attempts = post.attempts + 1;
      if (attempts < MAX_ATTEMPTS) {
        const retryAt = new Date(Date.now() + attempts * 5 * 60_000);
        await prisma.post.update({
          where: { id: post.id },
          data: { status: "SCHEDULED", attempts, scheduledAt: retryAt, error: msg },
        });
        await notify(`⚠️ ${label} failed (attempt ${attempts}/${MAX_ATTEMPTS}), retrying at ${fmt(retryAt)}\n${msg.slice(0, 300)}`, post.telegramChatId);
      } else {
        await prisma.post.update({ where: { id: post.id }, data: { status: "FAILED", attempts, error: msg } });
        await notify(`❌ ${label} failed permanently\n${msg.slice(0, 500)}`, post.telegramChatId, {
          reply_markup: { inline_keyboard: [[{ text: "🔁 Retry", callback_data: `retry:${post.id}` }]] },
        });
      }
    }
  }
}

export function startWorker(intervalMs = 30_000) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runOnce();
    } catch (e) {
      console.error("[worker]", e);
    } finally {
      running = false;
    }
  };
  void tick();
  setInterval(tick, intervalMs);
  console.log(`[worker] started, polling every ${intervalMs / 1000}s`);
}
