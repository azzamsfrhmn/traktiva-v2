import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { BarChart3, Bookmark, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PlatformIcon } from "@/components/platform-icon";
import { db } from "@/lib/db";
import { accounts, kaloSessions, savedProducts } from "@/lib/db/schema";
import { COUNTRIES } from "@/lib/countries";
import { getKv, maskCookie } from "@/lib/kalo";
import type { MarketCategory, RankedProduct, ShopOverview } from "@/lib/platforms/tiktok-shop";
import { PRESETS } from "@/lib/presets";
import { getShopCache } from "@/lib/showcase";
import { KaloStudio, SessionsButton } from "../kalodata/kalo-studio";
import type { KaloHit } from "../kalodata/actions";
import { AccountPicker, RisetCountry } from "./country-filter";
import { MarketPanel } from "./market-panel";
import { SavedList } from "./saved-list";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

// One research workspace: TikTok's own ranking, KaloData sales data, and the products you saved from both.
// Platforms plug in their own sources later; only TikTok Shop is live for now.
const PLATFORMS = [
  { id: "tiktok", icon: "tiktok", label: "TikTok Shop", ready: true },
  { id: "youtube", icon: "youtube", label: "YouTube Shorts", ready: false },
  { id: "shopee", icon: "shopee", label: "Shopee Video", ready: false },
  { id: "facebook", icon: "facebook", label: "Facebook Pro", ready: false },
] as const;
const SOURCES = [
  { id: "tiktok", label: "Ranking TikTok", icon: TrendingUp },
  { id: "kalodata", label: "KaloData", icon: BarChart3 },
  { id: "tersimpan", label: "Tersimpan", icon: Bookmark },
] as const;

export default async function RisetPage({ searchParams }: PageProps<"/riset">) {
  const sp = await searchParams;
  const platform = PLATFORMS.find((p) => p.id === sp.platform) ?? PLATFORMS[0];
  const source = SOURCES.find((s) => s.id === sp.sumber)?.id ?? "tiktok";
  const saved = await db.select().from(savedProducts).orderBy(desc(savedProducts.createdAt));
  const savedKeys = saved.map((s) => `${s.productId}:${s.country}`);
  const concepts = PRESETS.filter((p) => p.available).map((p) => ({ id: p.id, title: p.title, bestFor: p.bestFor }));

  // KaloData sessions (header button) are needed on the KaloData tab only
  const sessions = source === "kalodata"
    ? (await db.select().from(kaloSessions).orderBy(desc(kaloSessions.id))).map((r) => ({
        id: r.id, label: r.label, masked: maskCookie(r.sessionCookie), email: r.email, source: r.source, status: r.status, lastError: r.lastError, created: fmt.format(r.createdAt),
      }))
    : [];

  return (
    <>
      <PageHeader slug="riset">
        {source === "kalodata" && <SessionsButton sessions={sessions} active={sessions.filter((s) => s.status === "active").length} />}
        <nav className="flex rounded-lg border bg-card p-0.5" aria-label="Platform">
          {PLATFORMS.map((p) => {
            const on = p.id === platform.id;
            const cls = `flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${on ? "bg-primary/12 text-foreground ring-1 ring-primary/40" : "text-muted-foreground"}`;
            return p.ready ? (
              <Link key={p.id} href={`/riset?platform=${p.id}`} className={`${cls} hover:text-foreground`} title={p.label}>
                <PlatformIcon platform={p.icon} className="size-3.5" />
                <span className="hidden sm:inline">{p.label}</span>
              </Link>
            ) : (
              <span key={p.id} className={`${cls} cursor-not-allowed opacity-50`} title={`${p.label} · segera hadir`}>
                <PlatformIcon platform={p.icon} className="size-3.5 grayscale" />
                <span className="hidden lg:inline">{p.label}</span>
              </span>
            );
          })}
        </nav>
      </PageHeader>

      <div className="flex-1 space-y-3">
        <nav className="flex gap-1 border-b" aria-label="Sumber data">
          {SOURCES.map((s) => (
            <Link
              key={s.id}
              href={`/riset?sumber=${s.id}`}
              className={`-mb-px flex h-9 items-center gap-1.5 border-b-2 px-3 text-[13px] font-medium transition-colors ${source === s.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <s.icon className="size-4" /> {s.label}
              {s.id === "tersimpan" && saved.length > 0 && <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{saved.length}</span>}
            </Link>
          ))}
        </nav>

        {source === "tiktok" && (await TiktokRanking({ sp, savedKeys }))}
        {source === "kalodata" && (await KaloTab({ sp, savedKeys, hasSession: sessions.some((s) => s.status !== "dead") }))}
        {source === "tersimpan" && (
          <SavedList
            concepts={concepts}
            items={saved.map((s) => ({ id: s.id, productId: s.productId, country: s.country, source: s.source, title: s.title, image: s.image, price: s.price, shopName: s.shopName, metrics: s.metrics, created: fmt.format(s.createdAt) }))}
          />
        )}
      </div>
    </>
  );
}

type SP = Record<string, string | string[] | undefined>;

async function TiktokRanking({ sp, savedKeys }: { sp: SP; savedKeys: string[] }) {
  const tiktok = (await db.select().from(accounts).where(eq(accounts.platform, "tiktok"))).sort((a, b) => a.username.localeCompare(b.username));
  // each account's market region comes from its last sync (creator info); unknown = not synced yet
  const regions = await Promise.all(tiktok.map(async (a) => ({ a, region: (await getShopCache<ShopOverview>(a.id, "overview"))?.data.creator.region?.toUpperCase() ?? null })));
  const wanted = typeof sp.negara === "string" ? sp.negara.toUpperCase() : null;
  const acc =
    tiktok.find((a) => a.username === sp.akun) ?? (wanted ? regions.find((r) => r.region === wanted)?.a : undefined) ?? tiktok.find((a) => a.status === "active") ?? tiktok[0];
  if (!acc) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center">
        <TrendingUp className="size-7 text-muted-foreground" />
        <p className="text-sm font-medium">Butuh akun TikTok affiliate</p>
        <p className="max-w-sm text-xs text-muted-foreground">Ranking TikTok Shop diambil lewat akun kreatormu. Tambahkan akun TikTok di Akun Sosial, atau pakai tab KaloData.</p>
        <Link href="/akun" className="mt-2 flex h-9 items-center rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90">Ke Akun Sosial</Link>
      </div>
    );
  }
  const accRegion = regions.find((r) => r.a.id === acc.id)?.region ?? "ID";
  const countryOptions = COUNTRIES.map((c) => {
    const owner = regions.find((r) => r.region === c.code);
    return owner ? { code: c.code, hint: `lewat @${owner.a.username}` } : { code: c.code, disabled: true, hint: `butuh akun TikTok ${c.name}` };
  });
  const categories = await getShopCache<MarketCategory[]>(acc.id, "categories");
  const catId = typeof sp.kategori === "string" ? sp.kategori : categories?.data[0]?.id;
  const ranking = catId ? await getShopCache<{ categoryId: string; products: RankedProduct[] }>(acc.id, `ranking:${catId}`) : null;
  return (
    <MarketPanel
      accountId={acc.id}
      country={accRegion}
      savedKeys={savedKeys}
      categories={categories?.data ?? []}
      categoryId={ranking?.data.categoryId ?? null}
      products={ranking?.data.products ?? []}
      capturedAt={ranking ? fmt.format(ranking.capturedAt) : null}
      leading={
        <>
          <RisetCountry value={accRegion} options={countryOptions} />
          {tiktok.length > 1 && <AccountPicker accounts={tiktok.map((a) => a.username)} value={acc.username} />}
        </>
      }
    />
  );
}

async function KaloTab({ sp, savedKeys, hasSession }: { sp: SP; savedKeys: string[]; hasSession: boolean }) {
  // the last search and its results come back from the DB, so closing/refreshing loses nothing
  const last = await getKv<{ keywords: string[]; country?: string }>("kalo:last-search");
  const q = typeof sp.q === "string" ? sp.q : null;
  const country = last?.data.country ?? "ID";
  const lastResults = !q && last ? await getKv<KaloHit[]>(`kalo:search:${country}:${[...last.data.keywords].sort().join("|")}`) : null;
  return (
    <KaloStudio
      hasSession={hasSession}
      lastKeywords={q ? [q] : last?.data.keywords ?? []}
      lastCountry={country}
      autoSearch={!!q}
      initialResults={lastResults?.data ?? null}
      initialDetailId={typeof sp.produk === "string" ? sp.produk : null}
      savedKeys={savedKeys}
    />
  );
}
