import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nextFreeSlot } from "@/lib/slots";
import { done } from "@/lib/respond";

/** Form action endpoint: approve | reject | retry | delete */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const action = String((await req.formData()).get("action"));
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return new NextResponse("Not found", { status: 404 });

  if (action === "approve" && post.status === "PENDING_APPROVAL") {
    await prisma.post.update({
      where: { id },
      data: { status: "SCHEDULED", scheduledAt: await nextFreeSlot(post.accountId) },
    });
  } else if (action === "reject" && post.status !== "PUBLISHING" && post.status !== "PUBLISHED") {
    await prisma.post.update({ where: { id }, data: { status: "REJECTED" } });
  } else if (action === "retry" && post.status === "FAILED") {
    await prisma.post.update({
      where: { id },
      data: { status: "SCHEDULED", attempts: 0, error: null, scheduledAt: new Date(Date.now() + 60_000) },
    });
  } else if (action === "delete" && post.status !== "PUBLISHING") {
    await prisma.post.delete({ where: { id } });
  }
  return done(req);
}
