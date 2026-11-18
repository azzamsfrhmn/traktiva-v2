import { CircleAlert, Gauge, Radio, ShieldCheck, UserRound } from "lucide-react";
import type { ShopOverview } from "@/lib/platforms/tiktok-shop";

// "Akun & Performa": creator profile, account health (points / violations) and LIVE history from Streamer Desktop.

function Card({ icon, title, children, className = "" }: { icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border bg-card p-4 ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold">{icon}{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-status-ok" : tone === "warn" ? "text-status-progress" : tone === "bad" ? "text-destructive" : "";
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AccountPanel({ overview, capturedAt }: { overview: ShopOverview | null; capturedAt: string | null }) {
  if (!overview) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center">
        <UserRound className="size-7 text-muted-foreground" />
        <p className="text-sm font-medium">Belum ada data akun</p>
        <p className="max-w-sm text-xs text-muted-foreground">Klik Sinkronkan etalase: profil kreator, kesehatan akun, dan riwayat LIVE ikut diambil dari TikTok Shop.</p>
      </div>
    );
  }
  const { creator, health, lives } = overview;
  const pct = health.score != null && health.baseScore ? Math.round((health.score / health.baseScore) * 100) : null;
  const tone = pct == null ? undefined : pct >= 90 ? "ok" : pct >= 60 ? "warn" : "bad";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <Card icon={<UserRound className="size-4 text-[#26b5ce]" />} title="Profil kreator">
          <div className="flex items-center gap-3">
            {creator.avatarUrl ? (
              <img src={creator.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-12 rounded-full border object-cover" />
            ) : (
              <span className="grid size-12 place-items-center rounded-full bg-muted"><UserRound className="size-5 text-muted-foreground" /></span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">@{creator.handle ?? "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{creator.alias ?? ""}</p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div><dt className="text-muted-foreground">Wilayah</dt><dd className="font-medium">{creator.region ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Mata uang</dt><dd className="font-medium">{creator.currency ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Etalase</dt><dd className="font-medium">{overview.showcaseCount} produk</dd></div>
          </dl>
        </Card>

        <Card icon={<ShieldCheck className="size-4 text-status-ok" />} title="Kesehatan akun" className="lg:col-span-2">
          <div className="grid gap-2 sm:grid-cols-4">
            <Stat label="Poin akun" value={health.score ?? "—"} hint={health.baseScore ? `dari ${health.baseScore}` : undefined} tone={tone} />
            <Stat label="Status" value={<span style={{ color: health.riskColor ?? undefined }}>{health.riskText ?? "—"}</span>} />
            <Stat label="Poin pelanggaran" value={health.violationScore} tone={health.violationScore ? "bad" : "ok"} />
            <Stat label="Bisa dibanding" value={health.toAppeal} hint="pelanggaran" />
          </div>
          {pct != null && (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${tone === "ok" ? "bg-status-ok" : tone === "warn" ? "bg-status-progress" : "bg-destructive"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {health.deducted ? `−${health.deducted} poin dipotong` : "Belum ada poin dipotong"}{health.awarded ? ` · +${health.awarded} poin bonus` : ""}. Poin turun kalau melanggar aturan TikTok Shop; di bawah ambang tertentu izin affiliate dibatasi.
              </p>
            </div>
          )}
          {health.hasNewViolation && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive"><CircleAlert className="size-3.5" /> Ada pelanggaran baru. Cek di TikTok Shop → Reputasi Akun.</p>
          )}
        </Card>
      </div>

      <Card icon={<Radio className="size-4 text-[#ff3b6b]" />} title={`Riwayat LIVE (${lives.total})`}>
        {lives.total === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada sesi LIVE tercatat. Setelah kamu LIVE jualan, ringkasan tiap sesi muncul di sini.</p>
        ) : (
          <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-2 text-[10px]">{JSON.stringify(lives.items, null, 1)}</pre>
        )}
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Gauge className="size-3.5" /> Data dari TikTok Shop Streamer{capturedAt ? ` · diperbarui ${capturedAt}` : ""}. Ikut diperbarui setiap sinkron (manual atau otomatis).
      </p>
    </div>
  );
}
