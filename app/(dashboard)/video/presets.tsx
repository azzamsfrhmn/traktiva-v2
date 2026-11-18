"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, Clapperboard, ImageIcon, ImagePlus, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { defaultOptions, PRESETS } from "@/lib/presets";
import { createProject } from "./project-actions";

const BADGE = { Stabil: "bg-status-ok/90 text-white", Baru: "bg-primary/90 text-primary-foreground", Segera: "bg-black/60 text-white", Bebas: "bg-[#8b7cf6]/90 text-white" } as const;

/** Example frame that fades in once loaded; missing files stay a quiet placeholder (no broken-image icon). */
function Frame({ src }: { src: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const img = ref.current; // the image may have finished loading before hydration attached onLoad
    if (img?.complete && img.naturalWidth > 0) setOk(true);
  }, []);
  return (
    <>
      {!ok && <ImageIcon className="absolute inset-0 m-auto size-4 text-muted-foreground/50" />}
      <img
        ref={ref}
        src={src}
        alt=""
        loading="lazy"
        onLoad={() => setOk(true)}
        className={`size-full object-cover transition-[opacity,transform] duration-500 group-hover:scale-105 ${ok ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}

const CUSTOM_STEPS = [
  { icon: PenLine, text: "Tulis prompt tiap adegan" },
  { icon: ImagePlus, text: "Pakai gambarmu atau buatan AI" },
  { icon: Clapperboard, text: "AI gerakkan jadi video" },
];

const DUMMY = { name: "Produk", details: "", price: "", photos: [] };

export function PresetGallery() {
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);
  const pick = (id: string) => {
    setPicked(id);
    start(async () => {
      try {
        await createProject(id); // redirects to the wizard
      } catch (e) {
        if (e instanceof Error && !e.message.includes("NEXT_REDIRECT")) toast.error(e.message);
        else throw e;
      }
    });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {PRESETS.map((p) => {
        const scenes = p.available ? p.scenes(DUMMY, defaultOptions(p)).length : 0;
        const frames = p.available && !p.custom ? Math.min(3, scenes) : 3;
        return (
          <article key={p.id} className={`group flex flex-col overflow-hidden rounded-xl border bg-card transition-colors ${p.available ? "hover:border-ring/40" : "opacity-70"}`}>
            {/* example frames: what the result looks like */}
            <div className={`relative grid gap-1 bg-muted/60 p-1 ${frames === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {p.custom
                ? CUSTOM_STEPS.map(({ icon: Icon, text }, i) => (
                    <div key={text} className="flex aspect-[9/16] flex-col items-center justify-center gap-2 rounded-md bg-gradient-to-b from-[#8b7cf6]/20 to-muted p-2 text-center">
                      <span className="grid size-9 place-items-center rounded-full bg-background/70 text-[#a99bff]"><Icon className="size-4" /></span>
                      <span className="text-[10px] leading-tight text-muted-foreground"><b className="text-foreground">{i + 1}.</b> {text}</span>
                    </div>
                  ))
                : Array.from({ length: frames }, (_, i) => i + 1).map((n) => (
                    <div key={n} className={`relative overflow-hidden rounded-md bg-muted ${frames === 2 ? "aspect-[27/32]" : "aspect-[9/16]"}`}>
                      <Frame src={`/presets/${p.id}-${n}.jpg`} />
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] font-medium text-white">{n}</span>
                    </div>
                  ))}
              <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">{p.custom ? "Cara kerja" : "Contoh hasil"}</span>
              {p.badge && <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur ${BADGE[p.badge]}`}>{p.badge}</span>}
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3.5">
              <p className="text-[13px] font-semibold leading-snug">{p.title}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{p.summary}</p>
              <p className="text-xs"><span className="text-muted-foreground">Cocok untuk: </span>{p.bestFor}</p>
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                {p.pipeline.map((step, i) => (
                  <span key={step} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    {i > 0 && <ArrowRight className="size-3" />}
                    <span className="rounded-md border bg-background px-1.5 py-0.5">{step}</span>
                  </span>
                ))}
              </div>
              <div className="mt-auto flex items-center gap-2 pt-2">
                <span className="flex-1 text-[11px] text-muted-foreground">
                  {p.custom ? "Adegan bebas (1–12)" : p.available ? `${scenes} adegan · ±${scenes * 6} detik${p.silent ? " · tanpa suara" : ""}` : "Segera hadir"}
                </span>
                <button
                  type="button"
                  disabled={!p.available || pending}
                  onClick={() => pick(p.id)}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                >
                  {pending && picked === p.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {p.available ? "Pakai konsep ini" : "Segera"}
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
