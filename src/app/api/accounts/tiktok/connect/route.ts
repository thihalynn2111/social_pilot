import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  if (!clientKey || !base) {
    return NextResponse.json(
      { error: "TIKTOK_CLIENT_KEY or PUBLIC_BASE_URL missing in .env" },
      { status: 500 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("hex"); // TikTok wants HEX

  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("scope", "user.info.basic,video.upload,video.publish");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", `${base}/api/accounts/tiktok/callback`);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  const res = NextResponse.redirect(url);
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  res.cookies.set("tt_state", state, opts);
  res.cookies.set("tt_verifier", verifier, opts);
  return res;
}
