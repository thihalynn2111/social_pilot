import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadDir } from "@/lib/config";
import { nextFreeSlot, parseLocal } from "@/lib/slots";
import { done } from "@/lib/respond";

export const dynamic = "force-dynamic";

export async function GET() {
  const posts = await prisma.post.findMany({
    include: { account: { select: { name: true, platform: true } } },
    orderBy: { id: "desc" },
    take: 100,
  });
  return NextResponse.json(posts);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("media");
  const accountIds = form.getAll("accountId").map(Number).filter(Boolean);
  if (!(file instanceof File) || file.size === 0 || accountIds.length === 0) {
    return new NextResponse("Choose a file and at least one account.", { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase() || (file.type.startsWith("video/") ? ".mp4" : ".jpg");
  const name = `${randomUUID()}${ext}`;
  await fs.mkdir(uploadDir(), { recursive: true });
  await fs.writeFile(path.join(uploadDir(), name), Buffer.from(await file.arrayBuffer()));

  const caption = String(form.get("caption") ?? "");
  const when = parseLocal(String(form.get("scheduledAt") ?? ""));
  const mediaType = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";

  for (const accountId of accountIds) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) continue;
    await prisma.post.create({
      data: {
        platform: account.platform,
        accountId,
        caption,
        mediaFile: name,
        mediaType,
        status: "SCHEDULED",
        scheduledAt: when ?? (await nextFreeSlot(accountId)),
      },
    });
  }
  return done(req);
}
