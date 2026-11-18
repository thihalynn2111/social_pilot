import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifySession } from "@/lib/session";

/** Browser: login page + cookie. Mobile app / scripts: HTTP basic auth. */
export async function middleware(req: NextRequest) {
  const pass = process.env.ADMIN_PASSWORD;
  const user = process.env.ADMIN_USER ?? "admin";

  if (await verifySession(req.cookies.get(COOKIE)?.value)) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (pass && header?.startsWith("Basic ")) {
    const [u, ...rest] = atob(header.slice(6)).split(":");
    if (u === user && rest.join(":") === pass) return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Social Autopilot"' },
    });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

// /api/media stays public so TikTok can pull photos.
export const config = { matcher: ["/((?!_next/|login|api/login|api/media/|favicon.ico).*)"] };
