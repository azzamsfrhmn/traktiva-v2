"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUp, BarChart3, Check, ChevronDown, LayoutGrid, Loader2, Minus, Plus, RefreshCw, Search, Store, Users } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SaveProductButton } from "@/components/save-product-button";
import { categoryMeta } from "@/lib/market-categories";
import { usePersistentState } from "@/lib/use-persistent-state";
import { toast } from "sonner";
import type { MarketCategory, RankedProduct } from "@/lib/platforms/tiktok-shop";
import { addShowcaseProducts, loadMarketRanking } from "../showcase/actions";

const compact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });

/** "Analitik pasar": top products per category from TikTok Shop (icon dropdown + search), one-click add to the showcase. */
export function MarketPanel({
  accountId, categories, categoryId, products, capturedAt, leading, country = "ID", savedKeys = [],
}: { accountId: number; categories: MarketCategory[]; categoryId: string | null; products: RankedProduct[]; capturedAt: string | null; leading?: React.ReactNode; country?: string; savedKeys?: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [loadingCat, setLoadingCat] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [q, setQ] = usePersistentState("riset:tiktok-q", "");

  const load = (cat?: string) => {
    setLoadingCat(cat ?? "first");
    start(async () => {
      try {
        const id = await loadMarketRanking(accountId, cat);
        router.push(`/riset?sumber=tiktok&kategori=${id}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal memuat riset pasar");
      } finally {
        setLoadingCat(null);
      }
    });
  };
  const add = (p: RankedProduct) => {
    setAdding(p.productId);
    start(async () => {
      try {
        const [r] = await addShowcaseProducts(accountId, p.productId);
        if (r?.ok) {
          setAdded((s) => new Set(s).add(p.productId));
          toast.success("Masuk etalase");
        } else toast.error(r?.message ?? "Ditolak TikTok");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal");
      } finally {
        setAdding(null);
      }
    });
  };

  if (!categories.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center">
        <Store className="size-7 text-muted-foreground" />
        <p className="text-sm font-medium">Riset pasar TikTok Shop</p>
        <p className="max-w-md text-xs text-muted-foreground">Lihat produk paling laris minggu ini per kategori, langsung dari data TikTok Shop akunmu. Produk yang cocok bisa ditambahkan ke etalase sekali klik.</p>
        <button type="button" disabled={pending} onClick={() => load()} className="mt-2 flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-70">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Muat riset pasar
        </button>
      </div>
    );
  }

  const current = categories.find((c) => c.id === categoryId) ?? null;
  const meta = current ? categoryMeta(current.name) : null;
  const k = q.trim().toLowerCase();
  const shown = k ? products.filter((p) => `${p.title} ${p.shopName ?? ""}`.toLowerCase().includes(k)) : products;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {leading}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            className="flex h-9 min-w-56 items-center gap-2 rounded-lg border bg-card px-2.5 text-left text-xs font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-70"
          >
            {meta ? (
              <span className="grid size-6 shrink-0 place-items-center rounded-md" style={{ background: `${meta.color}1f`, color: meta.color }}>
                {loadingCat ? <Loader2 className="size-3.5 animate-spin" /> : <meta.icon className="size-3.5" />}
              </span>
            ) : (
              <LayoutGrid className="size-4 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate">{meta?.label ?? "Pilih kategori"}</span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[60vh] w-72 overflow-y-auto">
            {categories.map((c) => {
              const m = categoryMeta(c.name);
              return (
                <DropdownMenuItem key={c.id} onClick={() => c.id !== categoryId && load(c.id)} className="gap-2.5 py-1.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md" style={{ background: `${m.color}1f`, color: m.color }}>
                    <m.icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.label}</span>
                  {c.id === categoryId && <Check className="size-3.5 text-brand-light" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <label className="flex h-9 min-w-48 flex-1 items-center gap-2 rounded-lg border bg-card px-3 text-xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk atau toko di ranking ini..." className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        {k && (
          <Link href={`/riset?sumber=kalodata&q=${encodeURIComponent(q.trim())}`} className="flex h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-xs font-medium hover:bg-accent" title="Cari kata kunci ini di seluruh TikTok Shop lewat KaloData">
            <BarChart3 className="size-4 text-[#f2c94c]" /> Cari lebih luas
          </Link>
        )}
        <button type="button" disabled={pending || !categoryId} onClick={() => categoryId && load(categoryId)} title="Muat ulang ranking kategori ini" className="grid size-9 place-items-center rounded-lg border bg-card text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-60">
          <RefreshCw className={`size-4 ${pending && loadingCat ? "animate-spin" : ""}`} />
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Top 20 minggu ini · indeks transaksi TikTok{capturedAt ? ` · ${capturedAt}` : ""}{k ? ` · ${shown.length} cocok` : ""}
      </p>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
          {products.length === 0 ? "Pilih kategori untuk memuat ranking." : "Tidak ada yang cocok. Coba Cari lebih luas di KaloData."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {shown.map((p) => {
            const inShowcase = p.inShowcase || added.has(p.productId);
            return (
              <div key={p.productId} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
                <div className="w-8 shrink-0 text-center">
                  <p className="text-sm font-semibold tabular-nums">{p.rank}</p>
                  <p className={`flex items-center justify-center text-[10px] ${p.rankChange > 0 ? "text-status-ok" : p.rankChange < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {p.rankChange > 0 ? <ArrowUp className="size-2.5" /> : p.rankChange < 0 ? <ArrowDown className="size-2.5" /> : <Minus className="size-2.5" />}
                    {p.rankChange !== 0 && Math.abs(p.rankChange)}
                  </p>
                </div>
                <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {p.coverUrl && <img src={p.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium" title={p.title}>{p.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {p.shopName ?? "—"}{p.shopScore != null ? ` · ★ ${p.shopScore}` : ""}{p.openPlan ? " · komisi terbuka" : ""}
                  </p>
                </div>
                <div className="hidden w-28 shrink-0 text-right sm:block">
                  <p className="text-xs font-semibold">{p.price}</p>
                  <p className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground"><Users className="size-3" />{compact.format(p.creators)} kreator</p>
                </div>
                <div className="hidden w-24 shrink-0 md:block" title="Indeks transaksi relatif (0–100)">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-status-ok" style={{ width: `${Math.min(100, p.transactionIndex)}%` }} />
                  </div>
                  <p className="mt-0.5 text-right text-[10px] text-muted-foreground tabular-nums">indeks {p.transactionIndex.toFixed(1)}</p>
                </div>
                <SaveProductButton
                  compact
                  saved={savedKeys.includes(`${p.productId}:${country}`)}
                  product={{
                    productId: p.productId, country, source: "tiktok", title: p.title, image: p.coverUrl, price: p.price, shopName: p.shopName,
                    metrics: { index: Number(p.transactionIndex.toFixed(1)), creators: p.creators, rating: p.shopScore, rank: p.rank },
                  }}
                />
                <button
                  type="button"
                  disabled={inShowcase || !p.canAdd || adding === p.productId}
                  onClick={() => add(p)}
                  title={inShowcase ? "Sudah di etalase" : !p.canAdd ? "Produk ini tidak bisa kamu tambahkan" : "Tambah ke etalase"}
                  className={`flex h-7 w-24 shrink-0 items-center justify-center gap-1 rounded-md text-[11px] font-medium disabled:cursor-not-allowed ${inShowcase ? "bg-status-ok/10 text-status-ok" : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"}`}
                >
                  {adding === p.productId ? <Loader2 className="size-3.5 animate-spin" /> : inShowcase ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                  {inShowcase ? "Di etalase" : "Etalase"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
