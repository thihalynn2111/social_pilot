import fs from "node:fs/promises";
import { mediaPath } from "../config";
import { sleep, type Publisher } from "./types";

const GRAPH = () => `https://graph.facebook.com/${process.env.FB_GRAPH_VERSION ?? "v25.0"}`;

async function json(res: Response) {
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || data.error) {
    throw new Error(`Facebook API ${res.status}: ${data.error?.message ?? JSON.stringify(data)}`);
  }
  return data;
}

/** Photo post to a Page. */
async function publishPhoto(pageId: string, token: string, caption: string, file: string) {
  const buf = await fs.readFile(mediaPath(file));
  const form = new FormData();
  form.set("access_token", token);
  form.set("caption", caption);
  form.set("source", new Blob([buf]), file);
  const data = await json(await fetch(`${GRAPH()}/${pageId}/photos`, { method: "POST", body: form }));
  return String(data.post_id ?? data.id);
}

/** Reel to a Page: start -> upload binary to rupload host -> finish -> poll. */
async function publishReel(pageId: string, token: string, caption: string, file: string) {
  const buf = await fs.readFile(mediaPath(file));

  const start = await json(
    await fetch(`${GRAPH()}/${pageId}/video_reels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upload_phase: "start", access_token: token }),
    }),
  );
  const videoId = String(start.video_id);

  if (!start.upload_url) throw new Error("Facebook did not return an upload_url");
  const up = await fetch(String(start.upload_url), {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, offset: "0", file_size: String(buf.byteLength) },
    body: buf,
  });
  const upData = (await up.json().catch(() => ({}))) as any;
  if (!up.ok || upData.success === false) throw new Error(`Facebook upload failed: ${JSON.stringify(upData)}`);

  await json(
    await fetch(`${GRAPH()}/${pageId}/video_reels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        upload_phase: "finish",
        video_id: videoId,
        video_state: "PUBLISHED",
        description: caption,
        access_token: token,
      }),
    }),
  );

  // Poll processing/publishing status (up to ~5 min).
  for (let i = 0; i < 30; i++) {
    await sleep(10_000);
    const s = await json(await fetch(`${GRAPH()}/${videoId}?fields=status&access_token=${token}`));
    const st = s.status ?? {};
    if (st.video_status === "error" || st.publishing_phase?.status === "error") {
      throw new Error(`Facebook processing error: ${JSON.stringify(st)}`);
    }
    if (st.publishing_phase?.status === "complete" || st.video_status === "ready") return videoId;
  }
  throw new Error("Facebook reel still processing after 5 minutes; check the Page manually.");
}

export const publishFacebook: Publisher = async (post) => {
  const { account } = post;
  return post.mediaType === "VIDEO"
    ? publishReel(account.externalId, account.accessToken, post.caption, post.mediaFile)
    : publishPhoto(account.externalId, account.accessToken, post.caption, post.mediaFile);
};
