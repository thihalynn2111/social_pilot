import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const fail = (error: string, details?: unknown, status = 400) =>
  NextResponse.json({ error, details }, { status });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const tkError = url.searchParams.get("error");
  if (tkError)
    return fail(
      "TikTok returned an error",
      url.searchParams.get("error_description") ?? tkError,
    );
  if (!code) return fail("Authorization code not found");

  const jar = await cookies();
  const savedState = jar.get("tt_state")?.value;
  const verifier = jar.get("tt_verifier")?.value;
  if (!state || !savedState || state !== savedState || !verifier) {
    return fail("Invalid state. Start again from the Accounts page.");
  }

  const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

  try {
    const tokenRes = await fetch(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
          client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
          code,
          grant_type: "authorization_code",
          redirect_uri: `${base}/api/accounts/tiktok/callback`,
          code_verifier: verifier,
        }),
      },
    );
    const raw = await tokenRes.json();
    const t = raw.data ?? raw;
    if (!t.access_token) return fail("Failed to get access token", raw);

    // Shows in the `npm run dev` terminal: which scopes TikTok really granted
    console.log("TikTok granted scope:", t.scope);

    let name = "TikTok User";
    try {
      const u = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=display_name",
        {
          headers: { Authorization: `Bearer ${t.access_token}` },
        },
      );
      name = (await u.json())?.data?.user?.display_name || name;
    } catch {}

    const expiresAt = t.expires_in
      ? new Date(Date.now() + Number(t.expires_in) * 1000)
      : null;
    await prisma.account.upsert({
      where: {
        platform_externalId: { platform: "TIKTOK", externalId: t.open_id },
      },
      create: {
        platform: "TIKTOK",
        externalId: t.open_id,
        name,
        accessToken: t.access_token,
        refreshToken: t.refresh_token ?? null,
        expiresAt,
      },
      update: {
        name,
        accessToken: t.access_token,
        refreshToken: t.refresh_token ?? null,
        expiresAt,
      },
    });

    const res = NextResponse.redirect(new URL("/accounts?success=1", req.url));
    res.cookies.delete("tt_state");
    res.cookies.delete("tt_verifier");
    return res;
  } catch (error) {
    return fail("Internal Server Error", String(error), 500);
  }
}
