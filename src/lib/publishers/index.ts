import { publishFacebook } from "./facebook";
import { publishTikTok } from "./tiktok";
import type { Publisher } from "./types";

export const publishers: Record<"FACEBOOK" | "TIKTOK", Publisher> = {
  FACEBOOK: publishFacebook,
  TIKTOK: publishTikTok,
};
