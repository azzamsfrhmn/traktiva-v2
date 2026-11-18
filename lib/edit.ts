// Timeline editor model (Studio → Hasil), shared by the browser editor and the ffmpeg export.
// Times are seconds on the final video's timeline. Volumes are gains (1 = original, max 2).

export type CaptionPreset = "tiktok" | "kotak" | "kuning" | "bersih";
export type CaptionStyle = { preset: CaptionPreset; y: number; size: number; upper: boolean }; // y: 0-1 of height, size: font px / video width
export type EditCaption = { id: string; start: number; end: number; text: string };
export type EditVoice = { id: string; src: string; start: number; dur: number; speed: number; volume: number; text?: string | null };
export type EditClip = { src: string; start: number; dur: number; label: string };
export type EditBgm = { src: string; name: string; dur: number; volume: number; offset: number; fade: boolean };

export type ProjectEdit = {
  base: string; // MEDIA_DIR-relative: raw clips joined (no voice-over, no captions)
  baseKey: string; // clip list the base was built from (rebuilt when clips change)
  duration: number;
  width: number;
  height: number;
  baseAudio: boolean;
  clips: EditClip[];
  clipVolume: number;
  captions: EditCaption[];
  captionStyle: CaptionStyle;
  voices: EditVoice[];
  voiceVolume: number;
  bgm: EditBgm | null;
  exportedAt?: number | null;
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = { preset: "tiktok", y: 0.7, size: 0.062, upper: false };
export const CAPTION_PRESETS: { id: CaptionPreset; label: string }[] = [
  { id: "tiktok", label: "TikTok" },
  { id: "kotak", label: "Kotak" },
  { id: "kuning", label: "Kuning" },
  { id: "bersih", label: "Bersih" },
];

export const uid = () => Math.random().toString(36).slice(2, 9);
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** CapCut-style auto captions: each spoken segment split into chunks of ≤4 words, timed by text length. */
export function autoCaptions(segments: { start: number; dur: number; text: string }[]): EditCaption[] {
  const out: EditCaption[] = [];
  for (const seg of segments) {
    const words = seg.text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    if (!words.length) continue;
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += 4) chunks.push(words.slice(i, i + 4).join(" "));
    const total = chunks.reduce((n, c) => n + c.length, 0);
    let t = seg.start;
    for (const c of chunks) {
      const d = (seg.dur * c.length) / total;
      out.push({ id: uid(), start: round2(t), end: round2(t + d), text: c });
      t += d;
    }
  }
  return out;
}

const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > max) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Draw one caption onto a canvas sized like the video (W×H). The same function draws the live preview and the
 * PNGs burned in on export, so what you see is what gets rendered. Returns the painted box (for cropping).
 */
export function drawCaption(ctx: CanvasRenderingContext2D, W: number, H: number, raw: string, style: CaptionStyle) {
  const text = style.upper ? raw.toUpperCase() : raw;
  const px = Math.round(style.size * W);
  const bold = style.preset === "bersih" ? 600 : 800;
  ctx.font = `${bold} ${px}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const lines = wrap(ctx, text, W * 0.82);
  const lh = px * 1.22;
  const cy = style.y * H;
  const top = cy - (lh * lines.length) / 2;
  let minX = W, maxX = 0;
  lines.forEach((l, i) => {
    const y = top + lh * (i + 0.5);
    const w = ctx.measureText(l).width;
    minX = Math.min(minX, W / 2 - w / 2);
    maxX = Math.max(maxX, W / 2 + w / 2);
    if (style.preset === "kotak") {
      const pad = px * 0.28;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(W / 2 - w / 2 - pad, y - lh / 2, w + pad * 2, lh, px * 0.22);
      ctx.fill();
      ctx.fillStyle = "#111111";
      ctx.fillText(l, W / 2, y + px * 0.03);
      return;
    }
    if (style.preset === "bersih") {
      ctx.shadowColor = "rgba(0,0,0,.75)";
      ctx.shadowBlur = px * 0.25;
      ctx.shadowOffsetY = px * 0.05;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(l, W / 2, y);
      ctx.shadowColor = "transparent";
      return;
    }
    ctx.lineWidth = px * 0.16;
    ctx.strokeStyle = "#000000";
    ctx.strokeText(l, W / 2, y);
    ctx.fillStyle = style.preset === "kuning" ? "#ffe03d" : "#ffffff";
    ctx.fillText(l, W / 2, y);
  });
  const pad = px * 0.45;
  return {
    x: Math.max(0, Math.floor(minX - pad)),
    y: Math.max(0, Math.floor(top - pad)),
    w: Math.min(W, Math.ceil(maxX + pad)) - Math.max(0, Math.floor(minX - pad)),
    h: Math.min(H, Math.ceil(top + lh * lines.length + pad)) - Math.max(0, Math.floor(top - pad)),
  };
}
