import type { Account, Post } from "@prisma/client";

export type PostWithAccount = Post & { account: Account };
/** Returns the platform's id for the published (or submitted) item. */
export type Publisher = (post: PostWithAccount) => Promise<string>;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
