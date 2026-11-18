"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImageIcon, Loader2, Search, Store } from "lucide-react";
import { listShowcaseForPick, type ShowcasePick } from "@/app/(dashboard)/video/project-actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mediaUrl } from "@/lib/media-url";

/** Pick a product from the TikTok showcase (etalase) as the video's product. */
export function ShowcasePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (item: ShowcasePick) => void }) {
  const [items, setItems] = useState<ShowcasePick[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    listShowcaseForPick().then((l) => alive && setItems(l), () => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [open]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = items ?? [];
    return needle ? list.filter((it) => `${it.title} ${it.shopName ?? ""}`.toLowerCase().includes(needle)) : list;
  }, [items, q]);
  const accounts = new Set(items?.map((i) => i.account)).size;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Store className="size-4" /> Pilih produk dari Etalase</DialogTitle>
          <DialogDescription>Nama, harga dan foto produk diisi otomatis (foto dari galeri produk bila ada, kalau tidak dari sampul etalase).</DialogDescription>
        </DialogHeader>

        <label className="flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-[13px] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
          <Search className="size-4 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama produk atau toko..." className="min-w-0 flex-1 bg-transparent outline-none" />
          {items && <span className="text-[11px] text-muted-foreground">{shown.length} produk{accounts > 1 ? ` · ${accounts} akun` : ""}</span>}
        </label>

        <div className="max-h-[58vh] overflow-y-auto">
          {!items ? (
            <div className="grid place-items-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-12 text-center">
              <Store className="size-6 text-muted-foreground" />
              <p className="text-[13px] font-medium">Etalase masih kosong</p>
              <p className="text-xs text-muted-foreground">Tambah produk ke etalase TikTok atau sinkronkan dulu di menu <Link href="/showcase" className="underline">TikTok Shop</Link>.</p>
            </div>
          ) : shown.length === 0 ? (
            <p className="py-12 text-center text-xs text-muted-foreground">Tidak ada produk yang cocok dengan &quot;{q}&quot;.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {shown.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    onPick(it);
                    onClose();
                  }}
                  className="group flex flex-col overflow-hidden rounded-lg border bg-background text-left transition-colors hover:border-primary/50 hover:bg-accent"
                >
                  <div className="relative aspect-square w-full bg-muted">
                    {it.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local media
                      <img src={mediaUrl(it.cover)} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center"><ImageIcon className="size-5 text-muted-foreground" /></span>
                    )}
                    {!it.inStock && <span className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">Stok habis</span>}
                    {it.labels[0] && <span className="absolute right-1.5 bottom-1.5 rounded bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-white">{it.labels[0]}</span>}
                  </div>
                  <div className="space-y-0.5 p-2">
                    <p className="line-clamp-2 text-xs leading-snug font-medium">{it.title}</p>
                    <p className="flex items-baseline gap-1.5 text-[13px] font-semibold">
                      {it.price}
                      {it.originalPrice && it.originalPrice !== it.price && <span className="text-[10px] font-normal text-muted-foreground line-through">{it.originalPrice}</span>}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {it.shopName ?? "-"}{it.commission ? ` · komisi ${it.commission}` : ""}{accounts > 1 ? ` · @${it.account}` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
