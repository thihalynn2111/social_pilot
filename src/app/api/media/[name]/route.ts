import fs from "node:fs/promises";
import { mediaPath } from "@/lib/config";

const types: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  try {
    const buf = await fs.readFile(mediaPath(name)); // basename() inside prevents path traversal
    const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
    return new Response(buf, { headers: { "Content-Type": types[ext] ?? "application/octet-stream" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
