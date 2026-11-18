// One runnable check: ffmpeg-static exists and the concat recipe used by lib/projects.ts joins clips.
// Run: npx tsx scripts/try-concat.mts <empty-temp-dir>
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";

const dir = process.argv[2];
if (!dir || !ffmpeg) throw new Error("usage: try-concat.mts <dir> (and ffmpeg-static must be installed)");
const clips = [0, 1].map((i) => {
  const f = path.join(dir, `c${i}.mp4`);
  execFileSync(ffmpeg!, ["-y", "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=24:duration=2", "-f", "lavfi", "-i", "sine=duration=2", "-shortest", "-pix_fmt", "yuv420p", f], { stdio: "ignore" });
  return f;
});
const list = path.join(dir, "list.txt");
fs.writeFileSync(list, clips.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
const out = path.join(dir, "final.mp4");
execFileSync(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", out], { stdio: "ignore" });
const info = (() => {
  try {
    execFileSync(ffmpeg, ["-i", out], { stdio: "pipe" });
  } catch (e) {
    return String((e as { stderr?: Buffer }).stderr ?? ""); // ffmpeg -i without output exits 1 but prints stream info
  }
  return "";
})();
const duration = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
const secs = duration ? Number(duration[3]) : 0;
if (secs < 3.5 || /Audio:/.test(info)) throw new Error(`concat check failed: ${secs}s, audio=${/Audio:/.test(info)}`);
console.log(`concat ok: ${secs}s, silent, ${fs.statSync(out).size} bytes`);
