import Link from "next/link";
import { desc } from "drizzle-orm";
import { FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { videoProjects } from "@/lib/db/schema";
import { presetById, projectName } from "@/lib/presets";
import { NewProjectButton, ProjectList } from "./project-list";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const FILTERS = [
  { id: "semua", label: "Semua" },
  { id: "draft", label: "Draf" },
  { id: "running", label: "Sedang dibuat" },
  { id: "done", label: "Video jadi" },
  { id: "failed", label: "Perlu dicek" },
] as const;

export default async function ProyekPage({ searchParams }: PageProps<"/proyek">) {
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.id === sp.status)?.id ?? "semua";
  const all = await db.select().from(videoProjects).orderBy(desc(videoProjects.updatedAt));
  const count = (id: string) => (id === "semua" ? all.length : all.filter((p) => p.status === id).length);
  const shown = filter === "semua" ? all : all.filter((p) => p.status === filter);

  return (
    <>
      <PageHeader slug="proyek">
        <NewProjectButton />
      </PageHeader>

      {all.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center">
          <FolderKanban className="size-7 text-muted-foreground" />
          <p className="text-sm font-medium">Belum ada proyek</p>
          <p className="max-w-sm text-xs text-muted-foreground">Pakai konsep jadi atau racik sendiri: masukkan produk, lalu AI membuatkan gambar dan videonya.</p>
          <div className="mt-2"><NewProjectButton label="Buat proyek pertama" /></div>
        </div>
      ) : (
        <div className="flex-1 space-y-4">
          <nav className="flex flex-wrap gap-1.5" aria-label="Filter status">
            {FILTERS.map((f) => (
              <Link
                key={f.id}
                href={f.id === "semua" ? "/proyek" : `/proyek?status=${f.id}`}
                className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${filter === f.id ? "border-primary/50 bg-primary/10 text-brand-light" : "bg-card text-muted-foreground hover:text-foreground"}`}
              >
                {f.label}
                <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{count(f.id)}</span>
              </Link>
            ))}
          </nav>
          {shown.length ? (
            <ProjectList
              projects={shown.map((p) => ({
                id: p.id,
                name: projectName(p),
                product: p.product.name,
                scenes: p.scenes.length,
                preset: presetById(p.presetId)?.title ?? p.title,
                status: p.status,
                step: p.step,
                cover: p.scenes.find((x) => x.image)?.image ?? p.product.photos[0] ?? null,
                final: p.status === "done" ? p.finalPath : null,
                updated: fmt.format(p.updatedAt),
                progress: p.status === "running" ? p.progress : null,
              }))}
            />
          ) : (
            <p className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">Tidak ada proyek dengan status ini.</p>
          )}
        </div>
      )}
    </>
  );
}
