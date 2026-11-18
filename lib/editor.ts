import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import type { VideoProject } from "@/lib/db/schema";
import { ANIM_DUR, autoCaptions, CAPTION_ANIMS, clamp, DEFAULT_CAPTION_STYLE, DEFAULT_SAFE, normalizeEdit, round2, uid, type EditVoice, type ProjectEdit } from "@/lib/edit";
import { probeMedia, resolveMedia, writeMedia } from "@/lib/media";
import { concat } from "@/lib/projects";
import { isSilent } from "@/lib/presets";
import { voiceLine } from "@/lib/voice";

const run = promisify(execFile);
const exists = (rel: string) => fs.stat(resolveMedia(rel)).then((s) => s.isFile(), () => false);

/**
 * Editor state for a rendered project. The base video is the raw Flow clips joined WITHOUT the Cartesia voice
 * (so voice, captions and music stay separate, editable tracks). Built once; rebuilt when the clips change.
 */
export async function prepareEdit(p: VideoProject): Promise<ProjectEdit> {
  if (p.scenes.some((s) => !s.clip)) throw new Error("Render semua klip dulu.");
  // a Cartesia clip is "<raw>-vo.mp4"; its raw clip and voice WAV (suara/<raw>.wav) are kept next to it
  const parts = await Promise.all(
    p.scenes.map(async (s) => {
      const vo = /-vo\.mp4$/.test(s.clip!);
      const raw = vo ? s.clip!.replace(/-vo\.mp4$/, ".mp4") : s.clip!;
      const wav = `${p.folder}/suara/${path.basename(raw, ".mp4")}.wav`;
      const useRaw = vo && (await exists(raw)) && (await exists(wav));
      return { src: useRaw ? raw : s.clip!, wav: useRaw ? wav : null, label: s.label, line: voiceLine(s.motionPrompt) };
    }),
  );
  const baseKey = parts.map((x) => x.src).join("|");
  const old = p.edit;
  if (old && old.baseKey === baseKey && (await exists(old.base))) return old.safe && old.captionStyle.anim ? old : normalizeEdit(old);

  const probes = await Promise.all(parts.map((x) => probeMedia(x.src)));
  const base = `${p.folder}/edit/base.mp4`;
  await fs.mkdir(path.dirname(resolveMedia(base)), { recursive: true });
  const silent = isSilent(p.presetId, p.options) || !probes.some((x) => x.hasAudio);
  await concat(parts.map((x) => resolveMedia(x.src)), resolveMedia(base), silent);
  const info = await probeMedia(base);

  let t = 0;
  const clips = parts.map((x, i) => {
    const c = { src: x.src, start: round2(t), dur: round2(probes[i].seconds), label: x.label };
    t += probes[i].seconds;
    return c;
  });
  const voices: EditVoice[] = [];
  for (const [i, x] of parts.entries()) {
    if (!x.wav) continue;
    const dur = (await probeMedia(x.wav)).seconds;
    const room = Math.max(1, clips[i].dur - 0.5);
    voices.push({ id: uid(), src: x.wav, start: round2(clips[i].start + 0.3), dur: round2(dur), speed: round2(dur > room ? Math.min(1.35, dur / room) : 1), volume: 1, text: x.line });
  }
  // captions follow the voice-over; with Flow's own voice they follow each clip's spoken line
  const segments = voices.length
    ? voices.map((v) => ({ start: v.start, dur: v.dur / v.speed, text: v.text ?? "" }))
    : silent ? [] : parts.map((x, i) => ({ start: clips[i].start + 0.3, dur: Math.max(0.5, clips[i].dur - 0.8), text: x.line ?? "" }));

  return {
    base,
    baseKey,
    duration: round2(info.seconds || t),
    width: info.width || 720,
    height: info.height || 1280,
    baseAudio: info.hasAudio,
    clips,
    clipVolume: old?.clipVolume ?? (voices.length ? 0.25 : 1),
    captions: old?.captions?.length ? old.captions : autoCaptions(segments),
    captionStyle: { ...DEFAULT_CAPTION_STYLE, ...old?.captionStyle },
    safe: old?.safe ?? DEFAULT_SAFE,
    voices,
    voiceVolume: old?.voiceVolume ?? 1,
    bgm: old?.bgm ?? null,
  };
}

export type CaptionOverlay = { start: number; end: number; x: number; y: number; w: number; h: number; png: string };

/** Burn captions (PNG overlays drawn by the editor) + mix clip sound, voice-over and music → final.mp4. */
export async function exportEdit(p: VideoProject, e: ProjectEdit, overlays: CaptionOverlay[]) {
  if (!ffmpegPath) throw new Error("ffmpeg tidak tersedia di perangkat ini.");
  const D = e.duration;
  const args = ["-y", "-i", resolveMedia(e.base)];
  let n = 1;
  const voiceIn = e.voices.map((v) => (args.push("-i", resolveMedia(v.src)), n++));
  const bgmIn = e.bgm ? (args.push("-stream_loop", "-1", "-ss", String(e.bgm.offset), "-i", resolveMedia(e.bgm.src)), n++) : -1;
  const dir = `${p.folder}/edit`;
  const anim = e.captionStyle.anim ?? "none";
  const pngIn: number[] = [];
  for (const [i, o] of overlays.entries()) {
    const rel = await writeMedia(`${dir}/caption-${i + 1}.png`, Buffer.from(o.png.replace(/^data:image\/png;base64,/, ""), "base64"));
    // animated: a looped still that only exists during the caption (itsoffset = its start on the timeline)
    if (anim !== "none") args.push("-loop", "1", "-framerate", "30", "-t", (o.end - o.start).toFixed(2), "-itsoffset", o.start.toFixed(2));
    args.push("-i", resolveMedia(rel));
    pngIn.push(n++);
  }

  const f: string[] = [];
  let v = "0:v";
  overlays.forEach((o, i) => {
    const x = Math.round(o.x), y = Math.round(o.y);
    if (anim === "none") {
      f.push(`[${v}][${pngIn[i]}:v]overlay=${x}:${y}:enable='between(t,${o.start.toFixed(2)},${o.end.toFixed(2)})'[v${i}]`);
    } else {
      // same curves as animState() in lib/edit.ts
      const d = ANIM_DUR[anim], a = o.start.toFixed(2);
      const P = (tv: string) => `clip((${tv}-${a})/${d},0,1)`;
      let chain = "format=rgba";
      let ox = String(x), oy = String(y);
      if (anim === "fade" || anim === "naik") chain += `,fade=t=in:st=${a}:d=${d}:alpha=1`;
      if (anim === "naik") oy = `'${y}+pow(1-${P("t")},3)*${round2(0.05 * e.height)}'`;
      if (anim === "pop") {
        const sc = `(0.6+0.4*(1+2.70158*pow(${P("t")}-1,3)+1.70158*pow(${P("t")}-1,2)))`;
        chain += `,scale=w='max(2,trunc(iw*${sc}/2)*2)':h=-2:eval=frame,fade=t=in:st=${a}:d=${round2(d / 4)}:alpha=1`;
        ox = `'${x}+(${Math.round(o.w)}-overlay_w)/2'`;
        oy = `'${y}+(${Math.round(o.h)}-overlay_h)/2'`;
      }
      if (anim === "sapu") chain += `,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X,W*${P("T")}),alpha(X,Y),0)'`;
      f.push(`[${pngIn[i]}:v]${chain}[c${i}]`, `[${v}][c${i}]overlay=x=${ox}:y=${oy}:eof_action=pass[v${i}]`);
    }
    v = `v${i}`;
  });
  const mix: string[] = ["[a0]"];
  f.push(e.baseAudio ? `[0:a]volume=${clamp(e.clipVolume, 0, 2)}[a0]` : `aevalsrc=0:d=${D}[a0]`);
  e.voices.forEach((x, i) => {
    const ms = Math.max(0, Math.round(x.start * 1000));
    f.push(`[${voiceIn[i]}:a]atempo=${clamp(x.speed, 0.5, 2)},adelay=delays=${ms}:all=1,volume=${round2(clamp(x.volume, 0, 2) * clamp(e.voiceVolume, 0, 2))}[vo${i}]`);
    mix.push(`[vo${i}]`);
  });
  if (e.bgm) {
    const fade = e.bgm.fade && D > 3 ? `,afade=t=in:d=0.5,afade=t=out:st=${(D - 2).toFixed(2)}:d=2` : "";
    f.push(`[${bgmIn}:a]atrim=0:${D},asetpts=PTS-STARTPTS,volume=${clamp(e.bgm.volume, 0, 2)}${fade}[bgm]`);
    mix.push("[bgm]");
  }
  f.push(`${mix.join("")}amix=inputs=${mix.length}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[aout]`);

  const out = `${p.folder}/final.mp4`;
  const tmp = resolveMedia(`${dir}/export.mp4`);
  await run(ffmpegPath, [
    ...args,
    "-filter_complex", f.join(";"),
    "-map", overlays.length ? `[${v}]` : "0:v", "-map", "[aout]", "-t", String(D),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
    "-map_metadata", "-1", "-map_chapters", "-1", "-metadata:s:v:0", "handler_name=VideoHandler", "-metadata:s:a:0", "handler_name=SoundHandler",
    "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact", "-movflags", "+faststart", tmp,
  ], { windowsHide: true, maxBuffer: 32 * 1024 * 1024 }).catch((err) => {
    throw new Error(`Export gagal: ${String(err?.stderr ?? err).slice(-300)}`);
  });
  await fs.rename(tmp, resolveMedia(out));
  return out;
}

/**
 * Let Gemini adjust the timeline from a plain-language instruction ("caption lebih catchy", "musik pelan").
 * It may only change text/timing/volumes/style; media files stay as they are. Values are clamped by the caller.
 */
export async function aiAdjustEdit(p: VideoProject, e: ProjectEdit, instruction: string) {
  const { askGemini, extractJson } = await import("@/lib/platforms/gemini");
  const { geminiAccount } = await import("@/lib/prompt-writer");
  const g = await geminiAccount();
  const state = {
    durationSec: e.duration,
    product: { name: p.product.name, price: p.product.price },
    clips: e.clips.map((c) => ({ label: c.label, start: c.start, dur: c.dur })),
    captions: e.captions.map(({ start, end, text }) => ({ start, end, text })),
    captionStyle: e.captionStyle,
    safe: e.safe,
    voices: e.voices.map((v) => ({ id: v.id, start: v.start, durSec: round2(v.dur / v.speed), speed: v.speed, volume: v.volume, text: v.text })),
    clipVolume: e.clipVolume,
    voiceVolume: e.voiceVolume,
    bgm: e.bgm && { name: e.bgm.name, volume: e.bgm.volume, offset: e.bgm.offset, fade: e.bgm.fade },
  };
  const prompt = `You edit a short vertical TikTok affiliate video (Indonesian) on a timeline, like a CapCut editor.
Current timeline (JSON, times in seconds, volumes are gains where 1 = original, max 2):
${JSON.stringify(state)}

Instruction from the user (Indonesian): "${instruction.replace(/"/g, "'").slice(0, 600)}"

Rules:
- Captions are on-screen text in casual Indonesian, max ~5 words each, must not overlap, must stay inside 0..durationSec, and should match when the voice speaks.
- captionStyle.preset is one of tiktok|kotak|kuning|bersih; captionStyle.anim is the entrance animation, one of none|pop|fade|naik|sapu; captionStyle.x / captionStyle.y are the horizontal / vertical center (0-1; text is kept inside the safe area "safe" automatically, so avoid its margins); captionStyle.size is font size / video width (0.04-0.09); captionStyle.upper true = UPPERCASE.
- You may move voices (start), change their volume (0-2) or speed (0.8-1.4). Keep voices from overlapping each other.
- Background music (bgm) usually sits at 0.1-0.25 under a voice-over. clipVolume is the original clip sound.
- Only change what the instruction asks for (plus fixes needed to keep things valid). Keep everything else identical.

Output ONLY JSON with the same shape: {"captions":[...],"captionStyle":{...},"voices":[{"id":"...","start":0,"speed":1,"volume":1}],"clipVolume":1,"voiceVolume":1,"bgm":{"volume":0.2,"offset":0,"fade":true}} (omit bgm if there is none), plus "note": a one-sentence Indonesian summary of what you changed.`;
  const ans = extractJson<{
    captions?: { start: number; end: number; text: string }[];
    captionStyle?: Partial<ProjectEdit["captionStyle"]>;
    voices?: { id: string; start?: number; speed?: number; volume?: number }[];
    clipVolume?: number;
    voiceVolume?: number;
    bgm?: { volume?: number; offset?: number; fade?: boolean };
    note?: string;
  }>(await askGemini(g.sessionKey, prompt));
  if (!ans || typeof ans !== "object") throw new Error("Jawaban Gemini tidak terbaca. Coba lagi.");

  const D = e.duration;
  const next: ProjectEdit = { ...e };
  if (Array.isArray(ans.captions))
    next.captions = ans.captions
      .filter((c) => c && String(c.text ?? "").trim())
      .map((c) => {
        const start = round2(clamp(Number(c.start), 0, D - 0.2));
        return { id: uid(), start, end: round2(clamp(Number(c.end), start + 0.2, D)), text: String(c.text).trim().slice(0, 120) };
      })
      .sort((a, b) => a.start - b.start)
      .slice(0, 80);
  if (ans.captionStyle) {
    const s = ans.captionStyle;
    next.captionStyle = {
      preset: ["tiktok", "kotak", "kuning", "bersih"].includes(String(s.preset)) ? (s.preset as ProjectEdit["captionStyle"]["preset"]) : e.captionStyle.preset,
      x: s.x != null ? round2(clamp(Number(s.x), 0.1, 0.9)) : e.captionStyle.x,
      y: s.y != null ? round2(clamp(Number(s.y), 0.1, 0.9)) : e.captionStyle.y,
      anim: CAPTION_ANIMS.some((a) => a.id === s.anim) ? (s.anim as ProjectEdit["captionStyle"]["anim"]) : e.captionStyle.anim,
      size: s.size != null ? clamp(Number(s.size), 0.035, 0.1) : e.captionStyle.size,
      upper: s.upper != null ? !!s.upper : e.captionStyle.upper,
    };
  }
  if (Array.isArray(ans.voices))
    next.voices = e.voices.map((v) => {
      const a = ans.voices!.find((x) => x?.id === v.id);
      return a ? { ...v, start: round2(clamp(Number(a.start ?? v.start), 0, D - 0.3)), speed: round2(clamp(Number(a.speed ?? v.speed), 0.5, 2)), volume: round2(clamp(Number(a.volume ?? v.volume), 0, 2)) } : v;
    });
  if (ans.clipVolume != null) next.clipVolume = round2(clamp(Number(ans.clipVolume), 0, 2));
  if (ans.voiceVolume != null) next.voiceVolume = round2(clamp(Number(ans.voiceVolume), 0, 2));
  if (ans.bgm && e.bgm)
    next.bgm = { ...e.bgm, volume: round2(clamp(Number(ans.bgm.volume ?? e.bgm.volume), 0, 2)), offset: round2(clamp(Number(ans.bgm.offset ?? e.bgm.offset), 0, Math.max(0, e.bgm.dur - 1))), fade: ans.bgm.fade ?? e.bgm.fade };
  return { edit: next, note: String(ans.note ?? "Timeline diperbarui.").slice(0, 200) };
}
