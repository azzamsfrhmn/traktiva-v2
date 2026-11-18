// Dev check: run the real TikTok profile sync against one profile key without the UI.
// Usage: npx tsx --conditions=react-server scripts/try-sync.mts <cfx_key> <username>
import { syncProfile } from "@/lib/platforms/tiktok";

const [key, username] = process.argv.slice(2);
const t0 = Date.now();
const p = await syncProfile(key, username);
console.log(JSON.stringify({ ...p, videos: p.videos.length, private: p.videos.filter((v) => v.isPrivate).length, sample: p.videos[0], ms: Date.now() - t0 }, null, 2));
process.exit(0);
