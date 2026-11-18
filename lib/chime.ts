// Short notification sounds synthesized with Web Audio (no audio files to ship).
// Users can mute them from the status bar; the choice is kept per device.

const KEY = "traktiva:sound";
let ctx: AudioContext | null = null;

export const soundOn = () => {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
};
export const setSoundOn = (on: boolean) => {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
};

/** Rising two-note chime for success, a soft falling pair for "needs attention". */
export function chime(kind: "done" | "failed") {
  if (!soundOn()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const notes = kind === "done" ? [659.25, 987.77] : [523.25, 392.0]; // E5→B5 / C5→G4
    notes.forEach((freq, i) => {
      const t = ctx!.currentTime + i * 0.14;
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch {} // no audio device / blocked autoplay: the toast still shows
}
