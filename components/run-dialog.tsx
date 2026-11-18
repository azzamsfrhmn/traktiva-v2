"use client";

import { useEffect, useState } from "react";
import { Bot, Check, Globe, Layers, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Asked right before images/videos are generated: how many concurrent workers, and which engine makes
// them. `const choice = await askRun({...}); if (choice) generate(choice)`. One <RunHost/> lives in the
// root layout (next to ConfirmHost).

export type RunEngine = "auto" | "api" | "browser";
export type RunChoice = { workers: number; engine: RunEngine; remember: boolean };
type Options = {
  kind: "gambar" | "video";
  jobs: number; // how many items this run will make
  workers: number; // current setting
  engine: RunEngine; // current setting
  accounts: number; // active Google accounts
  max: number;
};
type Request = Options & { resolve: (c: RunChoice | null) => void };

let show: ((r: Request) => void) | null = null;

export function askRun(opts: Options): Promise<RunChoice | null> {
  return new Promise((resolve) => {
    if (show) show({ ...opts, resolve });
    else resolve({ workers: opts.workers, engine: opts.engine, remember: false }); // host not mounted: use the settings
  });
}

const ENGINES: { id: RunEngine; label: string; hint: string; icon: typeof Zap }[] = [
  { id: "auto", label: "Otomatis", hint: "Lewat API (cepat). Kalau API bermasalah, pindah ke browser.", icon: Zap },
  { id: "api", label: "API saja", hint: "Hanya mesin video (flow2api). Paling cepat.", icon: Bot },
  { id: "browser", label: "Browser saja", hint: "Buka Flow di browser akun & isi otomatis. Lebih lambat, paling mirip manual.", icon: Globe },
];

/** Workers that keep accounts safe: ~2 running generations per Google account, never more than jobs. */
export const recommendedWorkers = (accounts: number, jobs: number, max: number) => Math.max(1, Math.min(jobs, max, Math.max(1, accounts) * 2));

export function RunHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [workers, setWorkers] = useState(1);
  const [engine, setEngine] = useState<RunEngine>("auto");
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    show = (r) => {
      setWorkers(Math.max(1, Math.min(r.workers, r.max, Math.max(1, r.jobs))));
      setEngine(r.engine);
      setRemember(false);
      setReq(r);
    };
    return () => {
      show = null;
    };
  }, []);

  const close = (ok: boolean) => {
    req?.resolve(ok ? { workers, engine, remember } : null);
    setReq(null);
  };

  if (!req) return <Dialog open={false} />;
  const rec = recommendedWorkers(req.accounts, req.jobs, req.max);
  const top = Math.max(1, Math.min(req.max, req.jobs));
  const choices = [...new Set([1, 2, 3, 4, 6, 8, 10, 15, 20].filter((n) => n <= top).concat(rec, top))].sort((a, b) => a - b);
  const heavy = workers > Math.max(1, req.accounts) * 3;
  const engineHint = ENGINES.find((e) => e.id === engine)!.hint;

  return (
    <Dialog open onOpenChange={(o) => !o && close(false)}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="space-y-4 p-5">
          <DialogHeader className="gap-1 text-left">
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <span className="grid size-8 place-items-center rounded-full bg-primary/12 text-brand-light"><Layers className="size-4" /></span>
              Buat {req.jobs} {req.kind}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed">
              Berapa yang dikerjakan bersamaan? {req.accounts} akun Google aktif.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-xs font-medium">Pekerja bersamaan</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Pekerja bersamaan">
              {choices.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={workers === n}
                  onClick={() => setWorkers(n)}
                  className={`relative flex h-9 min-w-11 items-center justify-center rounded-lg border px-3 font-mono text-[13px] tabular-nums transition-colors ${workers === n ? "border-primary/50 bg-primary/10 text-foreground" : "bg-background text-muted-foreground hover:bg-accent"}`}
                >
                  {n}
                  {n === rec && <span className="absolute -top-1.5 -right-1.5 rounded-full bg-status-ok px-1 text-[9px] font-sans font-semibold text-white">✓</span>}
                </button>
              ))}
            </div>
            <p className={`text-[11px] ${heavy ? "text-status-progress" : "text-muted-foreground"}`}>
              {heavy
                ? `Lebih dari 3 per akun: akun lebih mudah kena limit/captcha. Disarankan ${rec}.`
                : workers === rec
                  ? `Disarankan untuk ${req.accounts} akun (±2 per akun).`
                  : `Disarankan ${rec} (±2 per akun).`}
              {workers >= top && req.jobs > 1 ? " Semua dikerjakan sekaligus." : req.jobs > workers ? ` ${req.jobs - workers} lainnya menunggu giliran.` : ""}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium">Cara membuat</p>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Cara membuat">
              {ENGINES.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={engine === e.id}
                  onClick={() => setEngine(e.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${engine === e.id ? "border-primary/50 bg-primary/10" : "bg-background text-muted-foreground hover:bg-accent"}`}
                >
                  <e.icon className="size-3.5" /> {e.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{engineHint}</p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-3.5 accent-primary" />
            Pakai pilihan ini terus, jangan tanya lagi (bisa diubah di Pengaturan AI)
          </label>
        </div>
        <DialogFooter className="m-0 flex-row justify-end gap-2 border-t bg-muted/40 px-5 py-3">
          <button type="button" onClick={() => close(false)} className="flex h-9 items-center rounded-lg border bg-background px-3.5 text-[13px] font-medium hover:bg-accent">Batal</button>
          <button type="button" autoFocus onClick={() => close(true)} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90">
            <Check className="size-4" /> Mulai dengan {workers} pekerja
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
