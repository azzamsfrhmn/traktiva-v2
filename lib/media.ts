import "server-only";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Generated images/videos live as plain files in a folder the user can open (default: ~/Videos/Traktiva),
// never as blobs in the database. The DB only keeps paths relative to MEDIA_DIR.
export const MEDIA_DIR = process.env.TRAKTIVA_MEDIA_DIR || path.join(os.homedir(), "Videos", "Traktiva");

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
};
export const mimeOf = (file: string) => MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";

/** Resolve a MEDIA_DIR-relative path, refusing anything that escapes the folder (../, absolute paths). */
export function resolveMedia(rel: string) {
  const abs = path.resolve(MEDIA_DIR, rel);
  if (abs !== MEDIA_DIR && !abs.startsWith(MEDIA_DIR + path.sep)) throw new Error("Path media tidak valid");
  return abs;
}

export const toRel = (abs: string) => path.relative(MEDIA_DIR, abs).split(path.sep).join("/");

const slug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "proyek";

/** Folder for one video project, e.g. ~/Videos/Traktiva/2026-11-18 jj-lipstik-matte (12)/ */
export async function createProjectFolder(id: number, title: string) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const dir = path.join(MEDIA_DIR, `${day} ${slug(title)} (${id})`);
  await Promise.all(["produk", "gambar", "klip"].map((d) => fs.mkdir(path.join(dir, d), { recursive: true })));
  return toRel(dir);
}

export async function writeMedia(rel: string, data: Buffer) {
  const abs = resolveMedia(rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
  return rel;
}

/** Local file → data URL, for sending reference images to Flow. */
export async function mediaDataUrl(rel: string) {
  const buf = await fs.readFile(resolveMedia(rel));
  return `data:${mimeOf(rel)};base64,${buf.toString("base64")}`;
}

export async function removeMedia(rel: string) {
  await fs.rm(resolveMedia(rel), { recursive: true, force: true });
}

const EXT: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "video/mp4": ".mp4" };

/** Save a generation result (http URL or data URL) as `<relBase><ext>`; ext comes from the real content type. */
export async function saveResult(url: string, relBase: string, fallbackExt: string) {
  const data = url.match(/^data:([^;,]+);base64,([\s\S]*)$/);
  if (data) return writeMedia(relBase + (EXT[data[1]] ?? fallbackExt), Buffer.from(data[2], "base64"));
  const res = await fetch(url, { signal: AbortSignal.timeout(5 * 60_000) });
  if (!res.ok) throw new Error(`Gagal mengunduh hasil (${res.status})`);
  const type = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
  return writeMedia(relBase + (EXT[type] ?? fallbackExt), Buffer.from(await res.arrayBuffer()));
}

/** Grab still frames from a video at relative positions (0–1) → JPEGs; returns their MEDIA_DIR-relative paths. */
export async function extractFrames(videoRel: string, outBase: string, positions: number[]) {
  const ffmpeg = (await import("ffmpeg-static")).default;
  if (!ffmpeg) throw new Error("ffmpeg tidak tersedia di perangkat ini.");
  const { execFile } = await import("node:child_process");
  const run = (args: string[]) =>
    new Promise<string>((resolve) => execFile(ffmpeg, args, { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (_e, _o, err) => resolve(String(err ?? ""))));
  const src = resolveMedia(videoRel);
  const info = await run(["-i", src]); // prints stream info to stderr (and "exits 1", which is fine)
  const d = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const seconds = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 10;
  const out: string[] = [];
  for (const [i, pos] of positions.entries()) {
    const rel = `${outBase}-${i + 1}.jpg`;
    const abs = resolveMedia(rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await run(["-y", "-ss", (seconds * pos).toFixed(2), "-i", src, "-frames:v", "1", "-q:v", "3", "-vf", "scale=720:-2", abs]);
    if (await fs.stat(abs).then(() => true, () => false)) out.push(rel);
  }
  return out;
}

/** Seconds of a media file (from ffmpeg's stream info) and whether it has an audio track. */
export async function probeMedia(rel: string) {
  const ffmpeg = (await import("ffmpeg-static")).default;
  if (!ffmpeg) throw new Error("ffmpeg tidak tersedia di perangkat ini.");
  const { execFile } = await import("node:child_process");
  const info = await new Promise<string>((resolve) => execFile(ffmpeg, ["-i", resolveMedia(rel)], { windowsHide: true }, (_e, _o, err) => resolve(String(err ?? ""))));
  const d = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const size = info.match(/Stream #[^\n]*Video:[^\n]*?(\d{2,5})x(\d{2,5})/);
  return {
    seconds: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0,
    hasAudio: /Stream #[^\n]*Audio:/.test(info),
    width: size ? Number(size[1]) : 0,
    height: size ? Number(size[2]) : 0,
  };
}

/**
 * Lay a voice-over (WAV) onto a clip: the clip's own sound is ducked to 25%, the voice starts after 0.3 s and is
 * sped up slightly (max 1.35×) when it would run past the end of the clip. Video is copied, not re-encoded.
 */
export async function mixVoiceOver(clipRel: string, voiceRel: string, outRel: string) {
  const ffmpeg = (await import("ffmpeg-static")).default;
  if (!ffmpeg) throw new Error("ffmpeg tidak tersedia di perangkat ini.");
  const { execFile } = await import("node:child_process");
  const [clip, voice] = await Promise.all([probeMedia(clipRel), probeMedia(voiceRel)]);
  const room = Math.max(1, clip.seconds - 0.5);
  const tempo = voice.seconds > room ? Math.min(1.35, voice.seconds / room) : 1;
  const vo = `[1:a]${tempo > 1 ? `atempo=${tempo.toFixed(3)},` : ""}adelay=300|300,volume=1.15[vo]`;
  const filter = clip.hasAudio ? `[0:a]volume=0.25[bg];${vo};[bg][vo]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]` : `${vo};[vo]apad[a]`;
  const out = resolveMedia(outRel);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await new Promise<void>((resolve, reject) =>
    execFile(
      ffmpeg,
      ["-y", "-i", resolveMedia(clipRel), "-i", resolveMedia(voiceRel), "-filter_complex", filter, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", out],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (e, _o, err) => (e ? reject(new Error(`Gagal menggabung suara: ${String(err).slice(-200)}`)) : resolve()),
    ),
  );
  return outRel;
}
