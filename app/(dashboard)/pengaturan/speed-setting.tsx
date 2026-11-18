"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Gauge, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setSpeed } from "./actions";

type Speed = { id: string; parallel: number; label: string; hint: string };

export function SpeedSetting({ speeds, current, recommended, browsers }: { speeds: Speed[]; current: string; recommended: string; browsers: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (id: string) =>
    start(async () => {
      try {
        await setSpeed(id);
        toast.success("Kecepatan disimpan");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal");
      }
    });

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-[#4ea7fc1a] text-[#4ea7fc]"><Gauge className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold">Kecepatan pembuatan</h2>
          <p className="text-xs text-muted-foreground">Berapa gambar/video yang dibuat bersamaan. Lebih kencang = lebih cepat selesai, tapi PC lebih berat dan akun Google lebih mudah kena limit.</p>
        </div>
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Kecepatan pembuatan">
        {speeds.map((s) => {
          const on = s.id === current;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={pending}
              onClick={() => !on && pick(s.id)}
              className={`relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors disabled:opacity-70 ${on ? "border-primary/50 bg-primary/10" : "bg-background hover:bg-accent"}`}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-medium">
                {on && <Check className="size-3.5 text-brand-light" />}
                {s.label}
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">{s.parallel}×</span>
              </span>
              <span className="text-[11px] leading-snug text-muted-foreground">{s.hint}</span>
              {s.id === recommended && <span className="mt-1 w-fit rounded-full bg-status-ok/10 px-1.5 py-px text-[10px] font-medium text-status-ok">Disarankan untuk akunmu</span>}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">Mesin video menyiapkan {browsers} browser verifikasi otomatis untuk pilihan ini.</p>
    </section>
  );
}
