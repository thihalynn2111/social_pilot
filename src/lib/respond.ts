import { NextResponse } from "next/server";

/** JSON for API clients (mobile app), redirect back to the dashboard for HTML forms. */
export function done(req: Request, body: unknown = { ok: true }, to = "/") {
  if (req.headers.get("accept")?.includes("application/json")) return NextResponse.json(body);
  return NextResponse.redirect(new URL(to, req.url), 303);
}
