import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { done } from "@/lib/respond";

export const dynamic = "force-dynamic";

/** Never returns tokens. */
export async function GET() {
  const rows = await prisma.account.findMany({
    select: {
      id: true,
      platform: true,
      name: true,
      externalId: true,
      expiresAt: true,
    },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const f = await req.formData();
  const platform =
    String(f.get("platform")) === "TIKTOK" ? "TIKTOK" : "FACEBOOK";
  const externalId = String(f.get("externalId") ?? "").trim();
  const accessToken = String(f.get("accessToken") ?? "").trim();
  if (!externalId || !accessToken)
    return new NextResponse("Page/open ID and access token are required.", {
      status: 400,
    });

  const refreshToken = String(f.get("refreshToken") ?? "").trim() || null;
  const expiresIn = Number(f.get("expiresIn") ?? 0);
  const data = {
    name: String(f.get("name") ?? "").trim() || externalId,
    accessToken,
    refreshToken,
    expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null,
  };
  await prisma.account.upsert({
    where: { platform_externalId: { platform, externalId } },
    create: { platform, externalId, ...data },
    update: data,
  });
  return done(req, { ok: true }, "/accounts");
}
