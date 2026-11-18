// Dev check: read the real TikTok Shop showcase, optionally try adding links (prints TikTok's per-item answer).
// Usage: npx tsx --conditions=react-server scripts/try-showcase.mts [add <link-or-id>...]
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { addToShowcase, fetchShowcase } from "@/lib/platforms/tiktok-shop";

const [cmd, ...rest] = process.argv.slice(2);
const acc = (await db.select().from(accounts).where(eq(accounts.platform, "tiktok")))[0];
if (!acc?.sessionKey) throw new Error("no tiktok account with a session");
const t0 = Date.now();
if (cmd === "add") {
  const r = await addToShowcase(acc.sessionKey, rest);
  console.log(JSON.stringify({ results: r.results, showcaseCount: r.showcase.products.length, ms: Date.now() - t0 }, null, 2));
} else {
  const r = await fetchShowcase(acc.sessionKey);
  console.log(JSON.stringify({ account: acc.username, total: r.total, got: r.products.length, first: r.products[0]?.title, ms: Date.now() - t0 }, null, 2));
}
process.exit(0);
