import { prisma } from "@/lib/db";
import { fmt } from "@/lib/config";
import Top from "./Top";

export const dynamic = "force-dynamic";

const color: Record<string, string> = {
  PUBLISHED: "#15803d", FAILED: "#b42318", REJECTED: "#b42318",
  PENDING_APPROVAL: "#b45309", PUBLISHING: "#b45309", SCHEDULED: "#0f766e",
};

const actionsFor = (status: string) => {
  const a: [string, string, boolean][] = [];
  if (status === "PENDING_APPROVAL") a.push(["approve", "Approve", true]);
  if (status === "FAILED") a.push(["retry", "Retry", true]);
  if (!["PUBLISHING", "PUBLISHED", "REJECTED"].includes(status)) a.push(["reject", "Reject", false]);
  if (status !== "PUBLISHING") a.push(["delete", "Delete", false]);
  return a;
};

export default async function QueuePage() {
  const posts = await prisma.post.findMany({ include: { account: true }, orderBy: { id: "desc" }, take: 60 });
  return (
    <>
      <Top title="Queue" signOut />
      <div className="body">
        {posts.length === 0 && <p className="empty">No posts yet. Create one in the New post tab or send a video to your Telegram bot.</p>}
        {posts.map((p) => (
          <article key={p.id} className="card">
            <div className="row">
              <span className="t">#{p.id} {p.platform === "FACEBOOK" ? "Facebook" : "TikTok"} · {p.account.name}</span>
              <span className="st" style={{ color: color[p.status] }}>{p.status.replace("_", " ").toLowerCase()}</span>
            </div>
            <p className="cap">{p.caption || "No caption"} ({p.mediaType.toLowerCase()})</p>
            <p className="m">{p.publishedAt || p.scheduledAt ? fmt(p.publishedAt ?? p.scheduledAt) : "Not scheduled"}</p>
            {p.error && <p className="err">{p.error}</p>}
            <div className="btns">
              {actionsFor(p.status).map(([action, label, solid]) => (
                <form key={action} action={`/api/posts/${p.id}`} method="post">
                  <input type="hidden" name="action" value={action} />
                  <button type="submit" className={solid ? "s" : ""}>{label}</button>
                </form>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
