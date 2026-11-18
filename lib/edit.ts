// Timeline editor model (Studio → Hasil), shared by the browser editor and the ffmpeg export.
// Times are seconds on the final video's timeline. Volumes are gains (1 = original, max 2).

export type CaptionPreset = "tiktok" | "kotak" | "kuning" | "bersih";
export type CaptionAnim = "none" | "fade" | "pop" | "naik" | "sapu";
// x/y: center of the text block as 0-1 of width/height, size: font px / video width
export type CaptionStyle = { preset: CaptionPreset; x: number; y: number; size: number; upper: boolean; anim: CaptionAnim };
export type CaptionPos = { x: number; y: number; size: number };
export type EditCaption = { id: string; start: number; end: number; text: string; pos?: CaptionPos | null }; // pos: own position/size
export type EditVoice = { id: string; src: string; start: number; dur: number; speed: number; volume: number; text?: string | null };
export type EditClip = { src: string; start: number; dur: number; label: string };
export type EditBgm = { src: string; name: string; dur: number; volume: number; offset: number; fade: boolean };
export type SafeArea = { top: number; bottom: number; left: number; right: number }; // margins, 0-1 of height/width

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
  safe: SafeArea;
  voices: EditVoice[];
  voiceVolume: number;
  bgm: EditBgm | null;
  exportedAt?: number | null;
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = { preset: "tiktok", x: 0.5, y: 0.7, size: 0.062, upper: false, anim: "pop" };
export const CAPTION_PRESETS: { id: CaptionPreset; label: string }[] = [
  { id: "tiktok", label: "TikTok" },
  { id: "kotak", label: "Kotak" },
  { id: "kuning", label: "Kuning" },
  { id: "bersih", label: "Bersih" },
];
export const CAPTION_ANIMS: { id: CaptionAnim; label: string }[] = [
  { id: "none", label: "Tanpa" },
  { id: "pop", label: "Pop" },
  { id: "fade", label: "Fade" },
  { id: "naik", label: "Naik" },
  { id: "sapu", label: "Sapu" },
];
/** Entrance length (seconds) per animation. The ffmpeg export mirrors animState() with the same numbers. */
export const ANIM_DUR: Record<CaptionAnim, number> = { none: 0, fade: 0.25, pop: 0.3, naik: 0.3, sapu: 0.45 };

// Areas covered by each app's UI (top bar, right-side buttons, bottom caption/description).
export const SAFE_PRESETS: { id: string; label: string; safe: SafeArea }[] = [
  { id: "tiktok", label: "TikTok", safe: { top: 0.09, bottom: 0.2, left: 0.05, right: 0.15 } },
  { id: "reels", label: "Reels", safe: { top: 0.1, bottom: 0.22, left: 0.05, right: 0.13 } },
  { id: "shorts", label: "Shorts", safe: { top: 0.08, bottom: 0.18, left: 0.05, right: 0.14 } },
  { id: "bebas", label: "Bebas", safe: { top: 0.03, bottom: 0.03, left: 0.03, right: 0.03 } },
];
export const DEFAULT_SAFE = SAFE_PRESETS[0].safe;

/** Fill fields added after an edit was saved (older projects). */
export const normalizeEdit = (e: ProjectEdit): ProjectEdit => ({
  ...e,
  captionStyle: { ...DEFAULT_CAPTION_STYLE, ...e.captionStyle },
  safe: e.safe ?? DEFAULT_SAFE,
});

/** Style one caption is drawn with: the shared style, or its own position/size. */
export const styleOf = (s: CaptionStyle, c?: EditCaption | null): CaptionStyle => (c?.pos ? { ...s, ...c.pos } : s);

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

export type Box = { x: number; y: number; w: number; h: number };

/**
 * Draw one caption onto a canvas sized like the video (W×H). The same function draws the live preview and the
 * PNGs burned in on export, so what you see is what gets rendered. Lines wrap to the safe-area width and the
 * block is pushed inside the safe area. Returns the painted box (for cropping and for dragging on the preview).
 */
export function drawCaption(ctx: CanvasRenderingContext2D, W: number, H: number, raw: string, style: CaptionStyle, safe: SafeArea = DEFAULT_SAFE): Box {
  const text = style.upper ? raw.toUpperCase() : raw;
  const px = Math.round(style.size * W);
  const bold = style.preset === "bersih" ? 600 : 800;
  ctx.font = `${bold} ${px}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const sl = safe.left * W, sr = W - safe.right * W, st = safe.top * H, sb = H - safe.bottom * H;
  const lines = wrap(ctx, text, Math.max(px * 3, (sr - sl) * 0.96));
  const lh = px * 1.22;
  const widths = lines.map((l) => ctx.measureText(l).width);
  const bw = Math.max(0, ...widths) + px * 0.6;
  const bh = lh * lines.length;
  // keep the block inside the safe area (when it fits)
  const fit = (c: number, half: number, lo: number, hi: number) => (hi - lo < half * 2 ? (lo + hi) / 2 : clamp(c, lo + half, hi - half));
  const cx = fit(style.x * W, bw / 2, sl, sr);
  const cy = fit(style.y * H, bh / 2, st, sb);
  const top = cy - bh / 2;
  let minX = W, maxX = 0;
  lines.forEach((l, i) => {
    const y = top + lh * (i + 0.5);
    const w = widths[i];
    minX = Math.min(minX, cx - w / 2);
    maxX = Math.max(maxX, cx + w / 2);
    if (style.preset === "kotak") {
      const pad = px * 0.28;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(cx - w / 2 - pad, y - lh / 2, w + pad * 2, lh, px * 0.22);
      ctx.fill();
      ctx.fillStyle = "#111111";
      ctx.fillText(l, cx, y + px * 0.03);
      return;
    }
    if (style.preset === "bersih") {
      ctx.shadowColor = "rgba(0,0,0,.75)";
      ctx.shadowBlur = px * 0.25;
      ctx.shadowOffsetY = px * 0.05;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(l, cx, y);
      ctx.shadowColor = "transparent";
      return;
    }
    ctx.lineWidth = px * 0.16;
    ctx.strokeStyle = "#000000";
    ctx.strokeText(l, cx, y);
    ctx.fillStyle = style.preset === "kuning" ? "#ffe03d" : "#ffffff";
    ctx.fillText(l, cx, y);
  });
  const pad = px * 0.45;
  const x0 = Math.max(0, Math.floor(minX - pad)), y0 = Math.max(0, Math.floor(top - pad));
  return { x: x0, y: y0, w: Math.min(W, Math.ceil(maxX + pad)) - x0, h: Math.min(H, Math.ceil(top + bh + pad)) - y0 };
}

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p: number) => 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2);

/** Entrance animation at progress p (0-1). dy is a fraction of the video height. Mirrored by lib/editor.ts. */
export function animState(anim: CaptionAnim, p: number) {
  const q = clamp(p, 0, 1);
  switch (anim) {
    case "fade": return { alpha: q, scale: 1, dy: 0, reveal: 1 };
    case "pop": return { alpha: Math.min(1, q * 4), scale: 0.6 + 0.4 * easeOutBack(q), dy: 0, reveal: 1 };
    case "naik": return { alpha: q, scale: 1, dy: (1 - easeOutCubic(q)) * 0.05, reveal: 1 };
    case "sapu": return { alpha: 1, scale: 1, dy: 0, reveal: q };
    default: return { alpha: 1, scale: 1, dy: 0, reveal: 1 };
  }
}

/** Paint a pre-rendered caption (src = full-frame canvas, box = its painted area) at time t into its life. */
export function blitCaption(ctx: CanvasRenderingContext2D, src: CanvasImageSource, box: Box, H: number, anim: CaptionAnim, t: number) {
  const a = animState(anim, ANIM_DUR[anim] ? t / ANIM_DUR[anim] : 1);
  if (a.alpha <= 0 || a.reveal <= 0) return;
  const w = box.w * a.scale, h = box.h * a.scale;
  ctx.save();
  ctx.globalAlpha = a.alpha;
  ctx.drawImage(src, box.x, box.y, box.w * a.reveal, box.h, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2 + a.dy * H, w * a.reveal, h);
  ctx.restore();
}
