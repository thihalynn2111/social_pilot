import { prisma } from "@/lib/db";
import { fmt } from "@/lib/config";
import Top from "../Top";

export const dynamic = "force-dynamic";

export default async function Accounts() {
  const accounts = await prisma.account.findMany({ orderBy: { id: "asc" } });

  return (
    <>
      <Top title="Accounts" />
      <div className="body">
        {accounts.length === 0 && (
          <p className="empty">No accounts connected yet.</p>
        )}
        {accounts.map((a) => (
          <article key={a.id} className="card">
            <div className="row">
              <span className="t">
                {a.platform === "FACEBOOK" ? "Facebook" : "TikTok"} · {a.name}
              </span>
            </div>
            <p className="m">
              ID {a.externalId}
              {a.expiresAt ? ` · token expires ${fmt(a.expiresAt)}` : ""}
            </p>
          </article>
        ))}

        <div
          className="card"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <span className="t">Connect TikTok Account</span>
          <p className="m">
            Click below to authorize your TikTok Sandbox account.
          </p>
          <a
            href="/api/accounts/tiktok/connect"
            style={{
              textAlign: "center",
              textDecoration: "none",
              display: "block",
              padding: "12px",
              background: "#fe2c55",
              color: "#fff",
              borderRadius: "6px",
              fontWeight: 600,
            }}
          >
            Connect with TikTok
          </a>
        </div>

        <form
          action="/api/accounts"
          method="post"
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 20,
          }}
        >
          <span className="t">Add or update Facebook account</span>
          <div>
            <label className="l" htmlFor="platform">
              Platform
            </label>
            <select id="platform" name="platform" className="in">
              <option value="FACEBOOK">Facebook Page</option>
            </select>
          </div>
          <div>
            <label className="l" htmlFor="name">
              Display name
            </label>
            <input id="name" name="name" className="in" />
          </div>
          <div>
            <label className="l" htmlFor="externalId">
              Page ID (Facebook)
            </label>
            <input id="externalId" name="externalId" className="in" required />
          </div>
          <div>
            <label className="l" htmlFor="accessToken">
              Access token
            </label>
            <input
              id="accessToken"
              name="accessToken"
              type="password"
              className="in"
              required
            />
          </div>
          <button type="submit" className="s full">
            Save Facebook account
          </button>
        </form>
      </div>
    </>
  );
}
