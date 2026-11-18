import { prisma } from "./db";
import { tzOffsetMin } from "./config";

const MIN_LEAD_MS = 11 * 60 * 1000; // Facebook needs >10 min lead time

/** Next configured daily slot (POST_TIMES, local time) strictly after `after` + lead time. */
export function nextSlot(after: Date): Date {
  const times = (process.env.POST_TIMES ?? "09:00,13:00,19:00")
    .split(",")
    .map((t) => t.trim().split(":").map(Number))
    .filter(([h, m]) => Number.isFinite(h) && Number.isFinite(m))
    .sort((a, b) => a[0] * 60 + a[1] - (b[0] * 60 + b[1]));
  const off = tzOffsetMin() * 60000;
  const local = new Date(after.getTime() + off);
  const y = local.getUTCFullYear();
  const mo = local.getUTCMonth();
  const d = local.getUTCDate();
  const earliest = after.getTime() + MIN_LEAD_MS;
  for (let day = 0; day < 30; day++) {
    for (const [h, m] of times) {
      const t = Date.UTC(y, mo, d + day, h, m) - off;
      if (t >= earliest) return new Date(t);
    }
  }
  return new Date(earliest);
}

/** Next slot that is after every post already scheduled for this account. */
export async function nextFreeSlot(accountId: number): Promise<Date> {
  const last = await prisma.post.findFirst({
    where: { accountId, status: "SCHEDULED", scheduledAt: { not: null } },
    orderBy: { scheduledAt: "desc" },
  });
  const base = last?.scheduledAt && last.scheduledAt > new Date() ? last.scheduledAt : new Date();
  return nextSlot(base);
}

/** Parse "YYYY-MM-DDTHH:mm" (datetime-local) as local time in TZ_OFFSET_MIN. */
export function parseLocal(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - tzOffsetMin() * 60000);
}
