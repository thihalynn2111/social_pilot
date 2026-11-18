import { prisma } from "@/lib/db";
import { tzName } from "@/lib/config";
import Top from "../Top";

export const dynamic = "force-dynamic";

export default async function NewPost() {
  const accounts = await prisma.account.findMany({ orderBy: { id: "asc" } });

  return (
    <>
      <Top title="New post" />
      <div className="body">
        <form
          action="/api/posts"
          method="post"
          encType="multipart/form-data"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <label className="drop">
            Choose video or image
            <input name="media" type="file" accept="video/*,image/*" required />
          </label>
          <div>
            <label className="l" htmlFor="caption">
              Caption
            </label>
            <textarea
              id="caption"
              name="caption"
              className="in"
              placeholder="Caption and hashtags"
            />
          </div>
          <div>
            <span className="l">Post to</span>
            {accounts.length === 0 ? (
              <p className="m" style={{ color: "orange", marginBottom: 8 }}>
                No accounts connected yet. (Link one in the Accounts tab later)
              </p>
            ) : null}
            {accounts.map((a) => (
              <label key={a.id} className="chip">
                <input
                  type="checkbox"
                  name="accountId"
                  value={a.id}
                  defaultChecked
                />
                {a.platform === "FACEBOOK" ? "Facebook" : "TikTok"} · {a.name}
              </label>
            ))}
          </div>
          <div>
            <label className="l" htmlFor="scheduledAt">
              Publish at (optional, {tzName()})
            </label>
            <input
              id="scheduledAt"
              name="scheduledAt"
              type="datetime-local"
              className="in"
            />
            <p className="m">Leave empty to use the next free slot.</p>
          </div>
          <button type="submit" className="s full">
            Schedule post
          </button>
        </form>
      </div>
    </>
  );
}
