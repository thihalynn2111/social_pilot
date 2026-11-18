import path from "node:path";

export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
export const mediaPath = (file: string) => path.join(uploadDir(), path.basename(file));
export const publicMediaUrl = (file: string) =>
  `${(process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "")}/api/media/${encodeURIComponent(file)}`;

export const tzOffsetMin = () => Number(process.env.TZ_OFFSET_MIN ?? 390);
export const tzName = () => process.env.TZ_NAME ?? "Asia/Yangon";

export const fmt = (d: Date | null | undefined) =>
  d ? d.toLocaleString("en-GB", { timeZone: tzName(), dateStyle: "medium", timeStyle: "short" }) : "-";

export const adminIds = () =>
  (process.env.TELEGRAM_ADMIN_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
