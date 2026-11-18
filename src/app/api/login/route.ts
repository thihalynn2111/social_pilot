import { NextResponse } from "next/server";
import { COOKIE, makeSession } from "@/lib/session";

export async function POST(req: Request) {
  const f = await req.formData();
  const user = String(f.get("username") ?? "");
  const pass = String(f.get("password") ?? "");
  const ok = !!process.env.ADMIN_PASSWORD && user === (process.env.ADMIN_USER ?? "admin") && pass === process.env.ADMIN_PASSWORD;
  if (!ok) return NextResponse.redirect(new URL("/login?error=1", req.url), 303);

  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(COOKIE, await makeSession(user), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  return res;
}
