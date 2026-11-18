// Edge + Node compatible (Web Crypto only).
const enc = new TextEncoder();

export const COOKIE = "sess";
const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";

async function hmac(value: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function makeSession(user: string) {
  return `${user}.${await hmac(user)}`;
}

export async function verifySession(cookie: string | undefined) {
  if (!cookie || !secret()) return false;
  const i = cookie.lastIndexOf(".");
  if (i < 1) return false;
  return (await hmac(cookie.slice(0, i))) === cookie.slice(i + 1);
}
