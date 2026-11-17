# Social Autopilot (starter)

Web admin panel + Telegram bot + scheduler/worker that publishes videos and images to
**Facebook Pages** (Reels / photos) and **TikTok** (Content Posting API).

```
Telegram bot ──┐                      ┌── Facebook Graph API (video_reels / photos)
               ├── MySQL (Prisma) ──► worker (every 30s) ──┤
Web admin ─────┘                      └── TikTok Content Posting API
```

## Setup
0. Start XAMPP (Apache + MySQL), create DB `social_autopilot` in phpMyAdmin.
1. `npm install`
2. Copy `.env.example` to `.env` and fill it in (MySQL URL, admin password, bot token, your Telegram ID, Anthropic key).
3. `npm run db:push`
4. Terminal A: `npm run dev` (admin panel at http://localhost:3000, basic auth)
   Terminal B: `npm run services` (Telegram bot + publishing worker)
5. Send `/start` to your bot to see your Telegram ID, put it in `TELEGRAM_ADMIN_IDS`, restart the services.
6. In the panel, add an account (see below), then upload a post or send a video to the bot.

## Telegram
- Send a video or photo (+ caption): bot creates one pending post per connected account, then **Approve / In 1 hour / Reject** buttons.
- `/idea <topic>`: 5 ideas, tap one to get a caption, then send the media.
- `/queue`, `/stats`. Failed posts get a **Retry** button.
- Bot API downloads are limited to 20 MB; upload bigger files in the web panel.

## Connecting accounts
**Facebook:** Page ID + a long-lived **Page** access token with `pages_show_list`, `pages_read_engagement`,
`pages_manage_posts`. For your own Page you can test in development mode before Meta app review.
Reels can only go to Pages (not profiles), max 30 API reels per 24h.

**TikTok:** `open_id`, access token, refresh token (24h access tokens are refreshed automatically).
- `TIKTOK_MODE=inbox` sends to the creator's drafts (works without audit, but needs a manual tap).
- `TIKTOK_MODE=direct` posts straight away. Until your app passes TikTok's audit, only `SELF_ONLY` (private) is accepted.
- Photo posts use PULL_FROM_URL, so `PUBLIC_BASE_URL` must be a URL prefix you verified in the TikTok portal.
- Videos up to 64 MB (single chunk).

## Not included yet (next steps)
- OAuth login flows (tokens are pasted in manually; stored unencrypted in the DB, encrypt them before production).
- Chunked TikTok upload for large videos, analytics pulling, AI auto-generated video.
- This code has not been run against the live APIs; test with a private Page / SELF_ONLY first.
