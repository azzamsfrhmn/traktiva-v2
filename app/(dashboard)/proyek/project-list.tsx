"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, CircleAlert, Clock, Copy, FolderOpen, Loader2, MoreHorizontal, Package, PenLine, Search, Sparkles, Trash2, Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mediaUrl } from "@/lib/media-url";
import { usePersistentState } from "@/lib/use-persistent-state";
import { createProject, deleteProject, duplicateProject, openProjectFolder, renameProject } from "../video/project-actions";

export type ProjectView = {
  id: number;
  name: string;
  product: string;
  preset: string;
  status: "draft" | "running" | "done" | "failed";
  step: number;
  scenes: number;
  cover: string | null;
  final: string | null;
  updated: string;
  progress: string | null;
};

const STATUS = {
  draft: { icon: Clock, label: (s: number) => `Draf · langkah ${s}/6`, cls: "text-muted-foreground" },
  running: { icon: Loader2, label: () => "Sedang dibuat", cls: "text-status-progress" },
  done: { icon: CheckCircle2, label: () => "Video jadi", cls: "text-status-ok" },
  failed: { icon: CircleAlert, label: () => "Perlu dicek", cls: "text-destructive" },
} as const;

const btn = "flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium disabled:opacity-60";

/** Run a server action with a toast on failure and a refresh after. */
function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<unknown>, ok?: string) =>
    start(async () => {
      try {
        await fn();
        if (ok) toast.success(ok);
        router.refresh();
      } catch (e) {
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
        toast.error(e instanceof Error ? e.message : "Gagal");
      }
    });
  return { act, pending, router };
}

export function ProjectList({ projects }: { projects: ProjectView[] }) {
  const { act, router } = useAct();
  const [q, setQ] = usePersistentState("proyek:q", "");
  const [renaming, setRenaming] = useState<ProjectView | null>(null);
  const running = projects.some((p) => p.status === "running");

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [running, router]);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return k ? projects.filter((p) => `${p.name} ${p.product} ${p.preset}`.toLowerCase().includes(k)) : projects;
  }, [projects, q]);

  return (
    <div className="space-y-4">
      <label className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border bg-card px-3 text-[13px] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
        <Search className="size-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama proyek, produk, atau konsep..." className="min-w-0 flex-1 bg-transparent outline-none" />
      </label>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">Tidak ada proyek yang cocok.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {shown.map((p) => {
            const s = STATUS[p.status];
            const busy = p.status === "running";
            return (
              <article key={p.id} className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-ring/40">
                <Link href={`/video/${p.id}`} className="relative grid aspect-[9/14] place-items-center overflow-hidden bg-muted" aria-label={`Buka ${p.name} di Studio`}>
                  {p.final ? (
                    <video src={`${mediaUrl(p.final)}#t=0.5`} muted preload="metadata" className="size-full object-cover" />
                  ) : p.cover ? (
                    <img src={mediaUrl(p.cover)} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <Package className="size-6 text-muted-foreground" />
                  )}
                  <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                    <s.icon className={`size-3 ${busy ? "animate-spin" : ""}`} />
                    {s.label(p.step)}
                  </span>
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="Menu proyek"
                    className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-md bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100"
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem render={<Link href={`/video/${p.id}`} />}><Wand2 className="size-4" /> Buka di Studio</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRenaming(p)}><PenLine className="size-4" /> Ganti nama</DropdownMenuItem>
                    <DropdownMenuItem disabled={busy} onClick={() => act(() => duplicateProject(p.id), "Proyek diduplikat")}><Copy className="size-4" /> Duplikat</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => act(() => openProjectFolder(p.id))}><FolderOpen className="size-4" /> Buka folder</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={busy}
                      onClick={async () =>
                        (await confirmDialog({ title: `Hapus "${p.name}"?`, description: "Folder gambar dan video proyek ini di perangkat ikut dihapus. Tidak bisa dibatalkan.", danger: true })) &&
                        act(() => deleteProject(p.id, true), "Proyek dihapus")
                      }
                    >
                      <Trash2 className="size-4" /> Hapus
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Link href={`/video/${p.id}`} className="space-y-0.5 p-2.5">
                  <p className="truncate text-xs font-medium">{p.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{p.preset} · {p.scenes} adegan</p>
                  <p className={`truncate text-[11px] ${s.cls}`}>{p.progress ?? p.updated}</p>
                </Link>
              </article>
            );
          })}
        </div>
      )}

      <RenameDialog project={renaming} onClose={() => setRenaming(null)} />
    </div>
  );
}

function RenameDialog({ project, onClose }: { project: ProjectView | null; onClose: () => void }) {
  const { act, pending } = useAct();
  const [name, setName] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setName(project?.name ?? ""), 0);
    return () => clearTimeout(t);
  }, [project]);
  const save = () => project && act(async () => { await renameProject(project.id, name); onClose(); }, "Nama disimpan");
  return (
    <Dialog open={!!project} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ganti nama proyek</DialogTitle>
          <DialogDescription>Nama ini hanya untuk merapikan daftar proyek. Nama produk di video tidak berubah.</DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="h-9 w-full rounded-lg border bg-background px-3 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        <DialogFooter>
          <button type="button" onClick={onClose} className={`${btn} border bg-background hover:bg-accent`}>Batal</button>
          <button type="button" onClick={save} disabled={pending || !name.trim()} className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90`}>
            {pending && <Loader2 className="size-4 animate-spin" />} Simpan
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Proyek baru": start from a ready-made concept, or a blank custom mix. */
export function NewProjectButton({ label = "Proyek baru" }: { label?: string }) {
  const { act, pending } = useAct();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90`}>
        <Sparkles className="size-4" /> {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mulai proyek baru</DialogTitle>
            <DialogDescription>Pilih cara yang paling enak buatmu. Semua bisa diubah di Studio nanti.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/video" onClick={() => setOpen(false)} className="flex flex-col gap-1.5 rounded-xl border bg-background p-4 transition-colors hover:border-ring/40 hover:bg-accent">
              <span className="grid size-9 place-items-center rounded-lg bg-[#f2994a1a] text-[#f2994a]"><Sparkles className="size-4.5" /></span>
              <span className="text-[13px] font-semibold">Pakai konsep jadi</span>
              <span className="text-xs text-muted-foreground">Pilih gaya video yang sudah teruji, tinggal masukkan produk.</span>
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => createProject("custom"))}
              className="flex flex-col gap-1.5 rounded-xl border bg-background p-4 text-left transition-colors hover:border-ring/40 hover:bg-accent disabled:opacity-60"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-[#8b7cf61a] text-[#a99bff]">{pending ? <Loader2 className="size-4.5 animate-spin" /> : <PenLine className="size-4.5" />}</span>
              <span className="text-[13px] font-semibold">Racikan sendiri</span>
              <span className="text-xs text-muted-foreground">Tulis prompt sendiri, pakai gambarmu sendiri, atur adegan bebas.</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
