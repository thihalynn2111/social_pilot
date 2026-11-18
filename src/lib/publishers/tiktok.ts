import fs from "node:fs/promises";
import { prisma } from "../db";
import { mediaPath, publicMediaUrl } from "../config";
import { sleep, type Publisher, type PostWithAccount } from "./types";

const BASE = "https://open.tiktokapis.com";

/** Node's fetch hides the real reason in error.cause. Show the step and the cause. */
async function net<T>(step: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const c = (e as { cause?: { code?: string; message?: string } })?.cause;
    const reason = c ? ` (${c.code ?? ""} ${c.message ?? ""})`.trimEnd() : "";
    throw new Error(`${step}: ${(e as Error).message}${reason}`);
  }
}

async function api(path: string, token: string, body: unknown) {
  const res = await net(`TikTok ${path}`, () =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(body ?? {}),
    }),
  );
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || (data.error?.code && data.error.code !== "ok")) {
    throw new Error(
      `TikTok API ${res.status}: ${data.error?.code ?? ""} ${data.error?.message ?? JSON.stringify(data)} (${path})`,
    );
  }
  return data.data ?? {};
}

/** Access tokens last 24h: refresh when close to expiry. */
async function freshToken(post: PostWithAccount): Promise<string> {
  const a = post.account;
  const soon = a.expiresAt && a.expiresAt.getTime() < Date.now() + 5 * 60_000;
  if (!soon || !a.refreshToken) return a.accessToken;

  const res = await net("TikTok token refresh", () =>
    fetch(`${BASE}/v2/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
        client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: a.refreshToken!,
      }),
    }),
  );
  const d = (await res.json()) as any;
  if (!d.access_token)
    throw new Error(`TikTok token refresh failed: ${JSON.stringify(d)}`);
  await prisma.account.update({
    where: { id: a.id },
    data: {
      accessToken: d.access_token,
      refreshToken: d.refresh_token ?? a.refreshToken,
      expiresAt: new Date(Date.now() + Number(d.expires_in ?? 86400) * 1000),
    },
  });
  return d.access_token as string;
}

async function pollStatus(token: string, publishId: string, direct: boolean) {
  for (let i = 0; i < 40; i++) {
    await sleep(6_000);
    const s = await api("/v2/post/publish/status/fetch/", token, {
      publish_id: publishId,
    });
    if (s.status === "FAILED")
      throw new Error(`TikTok publish failed: ${s.fail_reason ?? "unknown"}`);
    if (s.status === "PUBLISH_COMPLETE")
      return String(s.publicaly_available_post_id?.[0] ?? publishId);
    if (!direct && s.status === "SEND_TO_USER_INBOX") return publishId;
  }
  throw new Error("TikTok still processing after ~4 minutes.");
}

export const publishTikTok: Publisher = async (post) => {
  const token = await freshToken(post);
  const direct = (process.env.TIKTOK_MODE ?? "inbox") === "direct";

  // Creator info is only needed for direct posts (it needs the video.publish scope).
  let privacy = process.env.TIKTOK_PRIVACY ?? "SELF_ONLY";
  if (direct) {
    const info = await api("/v2/post/publish/creator_info/query/", token, {});
    const options: string[] = info.privacy_level_options ?? ["SELF_ONLY"];
    if (!options.includes(privacy)) privacy = options[0];
  }

  if (post.mediaType === "VIDEO") {
    const buf = await fs.readFile(mediaPath(post.mediaFile));
    const size = buf.byteLength;
    if (size > 64 * 1024 * 1024)
      throw new Error(
        "Video over 64 MB: needs chunked upload (not implemented in this starter).",
      );

    const body: Record<string, unknown> = {
      source_info: {
        source: "FILE_UPLOAD",
        video_size: size,
        chunk_size: size,
        total_chunk_count: 1,
      },
    };
    if (direct) {
      body.post_info = {
        title: post.caption.slice(0, 2200),
        privacy_level: privacy,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      };
    }
    const init = await api(
      direct
        ? "/v2/post/publish/video/init/"
        : "/v2/post/publish/inbox/video/init/",
      token,
      body,
    );

    const put = await net(
      `TikTok upload PUT (${Math.round(size / 1024)} KB)`,
      () =>
        fetch(init.upload_url, {
          method: "PUT",
          headers: {
            "Content-Type": "video/mp4",
            "Content-Range": `bytes 0-${size - 1}/${size}`,
          },
          body: buf,
        }),
    );
    if (!put.ok)
      throw new Error(
        `TikTok upload failed: ${put.status} ${await put.text()}`,
      );
    return pollStatus(token, String(init.publish_id), direct);
  }

  // Photo posts: TikTok pulls from a URL on a verified domain/prefix.
  const init = await api("/v2/post/publish/content/init/", token, {
    post_mode: direct ? "DIRECT_POST" : "MEDIA_UPLOAD",
    media_type: "PHOTO",
    post_info: {
      title: post.caption.slice(0, 90),
      description: post.caption.slice(0, 4000),
      ...(direct ? { privacy_level: privacy } : {}),
    },
    source_info: {
      source: "PULL_FROM_URL",
      photo_cover_index: 0,
      photo_images: [publicMediaUrl(post.mediaFile)],
    },
  });
  return pollStatus(token, String(init.publish_id), direct);
};
