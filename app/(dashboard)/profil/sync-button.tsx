"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloudDownload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { syncTikTokAccount } from "../akun/actions";

export function SyncButton({ accountId, username, primary = false }: { accountId: number; username: string; primary?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function sync() {
    setBusy(true);
    const t = toast.loading(`Mengambil data @${username} dari TikTok...`);
    try {
      const r = await syncTikTokAccount(accountId);
      toast.success(`${r.videos} video & statistik diperbarui`, { id: t });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sinkron gagal", { id: t });
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={sync}
      disabled={busy}
      className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium shadow-xs disabled:opacity-60 ${primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border bg-background hover:bg-accent"}`}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" />}
      {busy ? "Menyinkronkan..." : "Sinkronkan"}
    </button>
  );
}
